import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  EVA_DEVICE_NAME,
  EVA_SERVICE_UUID,
  MOOD_CHAR_UUID,
  PREFS_CHAR_UUID,
  CMD_CHAR_UUID,
  RSSI_CLOSE,
  RSSI_MEDIUM,
  RSSI_POLL_INTERVAL_MS,
  FAR_TIMEOUT_MS,
} from './constants';

export type BLEStatus = 'off' | 'disconnected' | 'scanning' | 'connecting' | 'connected';
export type Proximity = 'close' | 'medium' | 'far';

export interface BLECallbacks {
  onStatusChange: (status: BLEStatus) => void;
  onProximityChange: (proximity: Proximity) => void;
  onRssiUpdate: (rssi: number) => void;
  onPrefsRead: (prefs: Record<string, unknown>) => void;
}

class EvaBluetoothManager {
  private manager: BleManager;
  private device: Device | null = null;
  private callbacks: BLECallbacks | null = null;
  private rssiTimer: ReturnType<typeof setInterval> | null = null;
  private farTimer: ReturnType<typeof setTimeout> | null = null;
  private currentProximity: Proximity = 'far';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  setCallbacks(cb: BLECallbacks) {
    this.callbacks = cb;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const apiLevel = parseInt(Platform.Version as string, 10);
      if (apiLevel >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(granted).every(
          (v) => v === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS handles permissions via Info.plist
  }

  async scan() {
    const btState = await this.manager.state();
    if (btState !== State.PoweredOn) {
      this.callbacks?.onStatusChange('off');
      return;
    }

    const hasPerms = await this.requestPermissions();
    if (!hasPerms) {
      this.callbacks?.onStatusChange('off');
      return;
    }

    this.callbacks?.onStatusChange('scanning');

    this.manager.startDeviceScan(
      [EVA_SERVICE_UUID],
      { allowDuplicates: false },
      async (error, device) => {
        if (error) {
          this.callbacks?.onStatusChange('disconnected');
          return;
        }
        if (device && device.name === EVA_DEVICE_NAME) {
          this.manager.stopDeviceScan();
          await this.connect(device);
        }
      }
    );

    // Stop scanning after 15s
    setTimeout(() => {
      this.manager.stopDeviceScan();
      if (!this.device) this.callbacks?.onStatusChange('disconnected');
    }, 15_000);
  }

  private _connecting = false;

  private async connect(device: Device) {
    if (this._connecting) return;
    this._connecting = true;
    this.callbacks?.onStatusChange('connecting');
    try {
      const connected = await device.connect({ autoConnect: false });

      // Register disconnect handler BEFORE any GATT operations so we never
      // miss a drop that happens during service discovery or readPrefs.
      connected.onDisconnected(() => {
        this.handleDisconnect();
      });

      // MTU negotiation improves throughput and connection stability on Android.
      try { await connected.requestMTU(185); } catch { /* not critical */ }

      await connected.discoverAllServicesAndCharacteristics();
      this.device = connected;
      this._connecting = false;
      this.callbacks?.onStatusChange('connected');

      await this.readPrefs();
      this.startRSSIPolling();
    } catch (e) {
      this._connecting = false;
      this.device = null;   // clear inconsistent state
      this.callbacks?.onStatusChange('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleDisconnect() {
    if (this._connecting) return;      // ignore spurious events during connect
    this.stopRSSIPolling();
    this.device = null;
    this.callbacks?.onStatusChange('disconnected');
    this.callbacks?.onProximityChange('far');
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.device) this.scan();   // only scan if still disconnected
    }, 10_000);
  }

  private _rssiErrors = 0;

  private startRSSIPolling() {
    this._rssiErrors = 0;
    this.stopRSSIPolling();
    this.rssiTimer = setInterval(async () => {
      if (!this.device) return;
      try {
        const d = await this.device.readRSSI();
        this._rssiErrors = 0;
        const rssi = d.rssi ?? -100;
        this.callbacks?.onRssiUpdate(rssi);
        this.updateProximity(rssi);
      } catch {
        this._rssiErrors++;
        // 5 consecutive RSSI failures → treat as silent disconnect
        if (this._rssiErrors >= 5) {
          this._rssiErrors = 0;
          this.handleDisconnect();
        }
      }
    }, RSSI_POLL_INTERVAL_MS);
  }

  private stopRSSIPolling() {
    if (this.rssiTimer) { clearInterval(this.rssiTimer); this.rssiTimer = null; }
    if (this.farTimer)  { clearTimeout(this.farTimer);   this.farTimer  = null; }
  }

  private updateProximity(rssi: number) {
    let proximity: Proximity;
    if (rssi > RSSI_CLOSE)       proximity = 'close';
    else if (rssi > RSSI_MEDIUM) proximity = 'medium';
    else                          proximity = 'far';

    if (proximity === this.currentProximity) return;
    const prev = this.currentProximity;
    this.currentProximity = proximity;
    this.callbacks?.onProximityChange(proximity);

    // Notify Pi
    if (proximity === 'far') {
      // Grace period before telling Pi to wave/sleep
      this.farTimer = setTimeout(() => {
        this.sendCommand({ cmd: 'proximity', level: 'far' });
      }, FAR_TIMEOUT_MS);
    } else {
      if (this.farTimer) { clearTimeout(this.farTimer); this.farTimer = null; }
      if (prev === 'far') {
        this.sendCommand({ cmd: 'proximity', level: 'close' });
      }
    }
  }

  private b64encode(str: string): string {
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  async sendMood(mood: string, stats: Record<string, number>) {
    if (!this.device) return;
    try {
      const payload = JSON.stringify({ mood, stats });
      await this.device.writeCharacteristicWithoutResponseForService(
        EVA_SERVICE_UUID, MOOD_CHAR_UUID, this.b64encode(payload)
      );
    } catch { /* ignore */ }
  }

  async sendPrefs(prefs: Record<string, unknown>) {
    if (!this.device) return;
    try {
      const payload = JSON.stringify(prefs);
      await this.device.writeCharacteristicWithoutResponseForService(
        EVA_SERVICE_UUID, PREFS_CHAR_UUID, this.b64encode(payload)
      );
    } catch { /* ignore */ }
  }

  async readPrefs(): Promise<Record<string, unknown> | null> {
    if (!this.device) return null;
    try {
      const char = await this.device.readCharacteristicForService(
        EVA_SERVICE_UUID, PREFS_CHAR_UUID
      );
      if (char.value) {
        const str = Buffer.from(char.value, 'base64').toString('utf-8');
        const data = JSON.parse(str);
        this.callbacks?.onPrefsRead(data);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }

  async sendCommand(cmd: Record<string, unknown>) {
    if (!this.device) return;
    try {
      const payload = JSON.stringify(cmd);
      await this.device.writeCharacteristicWithoutResponseForService(
        EVA_SERVICE_UUID, CMD_CHAR_UUID, this.b64encode(payload)
      );
    } catch { /* ignore */ }
  }

  get isConnected() { return this.device !== null; }
  get deviceId()    { return this.device?.id ?? null; }

  destroy() {
    this.stopRSSIPolling();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.device?.cancelConnection();
    this.manager.destroy();
  }
}

// Singleton
export const evaBLE = new EvaBluetoothManager();
