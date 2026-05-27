import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EVA_DEVICE_NAME,
  EVA_SERVICE_UUID,
  MOOD_CHAR_UUID,
  PREFS_CHAR_UUID,
  CMD_CHAR_UUID,
  STATE_CHAR_UUID,
  RSSI_CLOSE,
  RSSI_MEDIUM,
  RSSI_POLL_INTERVAL_MS,
  FAR_TIMEOUT_MS,
} from './constants';
import type { PiState } from '../store/types';

export type BLEStatus = 'off' | 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'pin_required';
export type Proximity  = 'close' | 'medium' | 'far';

export interface ScannedDevice {
  id:   string;
  name: string;
  rssi: number;
  raw:  Device;
}

export interface BLECallbacks {
  onStatusChange:    (status: BLEStatus) => void;
  onProximityChange: (proximity: Proximity) => void;
  onRssiUpdate:      (rssi: number) => void;
  onPrefsRead:       (prefs: Record<string, unknown>) => void;
  onStateUpdate:     (state: PiState) => void;
}

const SAVED_DEVICE_KEY = 'eva.ble.device_id';

class EvaBluetoothManager {
  private manager:          BleManager;
  private device:           Device | null = null;
  private callbacks:        BLECallbacks | null = null;
  private rssiTimer:         ReturnType<typeof setInterval>  | null = null;
  private farTimer:          ReturnType<typeof setTimeout>   | null = null;
  private reconnectTimer:    ReturnType<typeof setTimeout>   | null = null;
  private keepaliveTimer:    ReturnType<typeof setInterval>  | null = null;
  private stateSubscription: { remove: () => void } | null = null;
  private currentProximity: Proximity = 'far';
  private _connecting       = false;
  private _rssiErrors       = 0;

  savedDeviceId: string | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  setCallbacks(cb: BLECallbacks) { this.callbacks = cb; }

  async init(): Promise<void> {
    try { this.savedDeviceId = await AsyncStorage.getItem(SAVED_DEVICE_KEY); }
    catch { /* ignore */ }
  }

  async saveDevice(deviceId: string): Promise<void> {
    this.savedDeviceId = deviceId;
    await AsyncStorage.setItem(SAVED_DEVICE_KEY, deviceId);
  }

  async forgetSavedDevice(): Promise<void> {
    this.savedDeviceId = null;
    await AsyncStorage.removeItem(SAVED_DEVICE_KEY);
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
        return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return r === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  }

  // ── Scan for all EVA devices — used by ConnectScreen ─────────────────────
  async startScan(onDeviceFound: (d: ScannedDevice) => void): Promise<void> {
    const btState = await this.manager.state();
    if (btState !== State.PoweredOn) {
      this.callbacks?.onStatusChange('off');
      return;
    }
    const hasPerms = await this.requestPermissions();
    if (!hasPerms) { this.callbacks?.onStatusChange('off'); return; }

    this.callbacks?.onStatusChange('scanning');

    const seen = new Set<string>();
    this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error || !device) return;
        const name = device.name || device.localName || '';
        if (!name.startsWith('EVA-')) return;
        if (seen.has(device.id)) return;
        seen.add(device.id);
        onDeviceFound({
          id:   device.id,
          name: name || device.id,
          rssi: device.rssi ?? -100,
          raw:  device,
        });
      }
    );

    setTimeout(() => {
      this.manager.stopDeviceScan();
      if (!this.device) this.callbacks?.onStatusChange('disconnected');
    }, 30_000);
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  // ── Auto-reconnect to saved device (called on app foreground / init) ──────
  async scanAndReconnect(): Promise<void> {
    if (!this.savedDeviceId || this.device || this._connecting) return;

    const btState = await this.manager.state();
    if (btState !== State.PoweredOn) { this.callbacks?.onStatusChange('off'); return; }

    const hasPerms = await this.requestPermissions();
    if (!hasPerms) { this.callbacks?.onStatusChange('off'); return; }

    this.callbacks?.onStatusChange('scanning');
    const targetId = this.savedDeviceId;

    this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      async (error, device) => {
        if (error || !device) return;
        if (device.id === targetId) {
          this.manager.stopDeviceScan();
          await this.connectInternal(device, /* isNew */ false);
        }
      }
    );

    setTimeout(() => {
      this.manager.stopDeviceScan();
      if (!this.device) this.callbacks?.onStatusChange('disconnected');
    }, 30_000);
  }

  // ── Connect to a device chosen by the user in ConnectScreen ──────────────
  async connectToDevice(scanned: ScannedDevice, isNew: boolean): Promise<void> {
    await this.connectInternal(scanned.raw, isNew);
  }

  private async connectInternal(device: Device, isNew: boolean): Promise<void> {
    if (this._connecting) return;
    this._connecting = true;
    this.callbacks?.onStatusChange('connecting');
    try {
      const connected = await device.connect({ autoConnect: false });
      connected.onDisconnected(() => this.handleDisconnect());
      try { await connected.requestMTU(185); } catch { /* not critical */ }
      await connected.discoverAllServicesAndCharacteristics();
      this.device = connected;
      this._connecting = false;

      // Subscribe to Pi state notifications
      this.stateSubscription?.remove();
      this.stateSubscription = connected.monitorCharacteristicForService(
        EVA_SERVICE_UUID, STATE_CHAR_UUID,
        (error, char) => {
          if (error || !char?.value) return;
          try {
            const data: PiState = JSON.parse(Buffer.from(char.value, 'base64').toString('utf-8'));
            this.callbacks?.onStateUpdate(data);
          } catch { /* ignore malformed */ }
        }
      );

      // For saved devices skip PIN; for new devices require PIN confirmation.
      this.callbacks?.onStatusChange(isNew ? 'pin_required' : 'connected');

      await this.readPrefs();
      if (isNew) {
        // Keep Android connection alive during PIN entry; RSSI starts after PIN confirmed.
        this.startKeepalive();
      } else {
        this.startRSSIPolling();
      }
    } catch {
      this._connecting = false;
      this.device = null;
      this.callbacks?.onStatusChange('disconnected');
      if (this.savedDeviceId) this.scheduleReconnect();
    }
  }

  private handleDisconnect() {
    if (this._connecting) return;
    this.stopRSSIPolling();
    this.stopKeepalive();
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.device = null;
    this.callbacks?.onStatusChange('disconnected');
    this.callbacks?.onProximityChange('far');
    if (this.savedDeviceId) this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.device) this.scanAndReconnect();
    }, 10_000);
  }

  cancelReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  // ── RSSI / proximity ──────────────────────────────────────────────────────

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
        if (this._rssiErrors >= 5) { this._rssiErrors = 0; this.handleDisconnect(); }
      }
    }, RSSI_POLL_INTERVAL_MS);
  }

  private stopRSSIPolling() {
    if (this.rssiTimer) { clearInterval(this.rssiTimer); this.rssiTimer = null; }
    if (this.farTimer)  { clearTimeout(this.farTimer);   this.farTimer  = null; }
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(async () => {
      if (!this.device) { this.stopKeepalive(); return; }
      try {
        await this.device.readCharacteristicForService(EVA_SERVICE_UUID, PREFS_CHAR_UUID);
      } catch { /* ignore — just keeping link alive */ }
    }, 5_000);
  }

  private stopKeepalive() {
    if (this.keepaliveTimer) { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null; }
  }

  private updateProximity(rssi: number) {
    const proximity: Proximity =
      rssi > RSSI_CLOSE  ? 'close' :
      rssi > RSSI_MEDIUM ? 'medium' : 'far';
    if (proximity === this.currentProximity) return;
    const prev = this.currentProximity;
    this.currentProximity = proximity;
    this.callbacks?.onProximityChange(proximity);
    if (proximity === 'far') {
      this.farTimer = setTimeout(() => this.sendCommand({ cmd: 'proximity', level: 'far' }), FAR_TIMEOUT_MS);
    } else {
      if (this.farTimer) { clearTimeout(this.farTimer); this.farTimer = null; }
      if (prev === 'far') this.sendCommand({ cmd: 'proximity', level: 'close' });
    }
  }

  // ── GATT writes ───────────────────────────────────────────────────────────

  private b64(str: string): string {
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  async sendMood(mood: string, stats: Record<string, number>) {
    if (!this.device) return;
    try {
      await this.device.writeCharacteristicWithResponseForService(
        EVA_SERVICE_UUID, MOOD_CHAR_UUID, this.b64(JSON.stringify({ mood, stats }))
      );
    } catch { /* ignore */ }
  }

  async sendPrefs(prefs: Record<string, unknown>) {
    if (!this.device) return;
    try {
      await this.device.writeCharacteristicWithResponseForService(
        EVA_SERVICE_UUID, PREFS_CHAR_UUID, this.b64(JSON.stringify(prefs))
      );
    } catch { /* ignore */ }
  }

  async readPrefs(): Promise<Record<string, unknown> | null> {
    if (!this.device) return null;
    try {
      const char = await this.device.readCharacteristicForService(EVA_SERVICE_UUID, PREFS_CHAR_UUID);
      if (char.value) {
        const data = JSON.parse(Buffer.from(char.value, 'base64').toString('utf-8'));
        this.callbacks?.onPrefsRead(data);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }

  async sendCommand(cmd: Record<string, unknown>) {
    if (!this.device) return;
    try {
      // write-with-response: bluezero on Pi silently drops write-without-response
      // (AcquireWrite socket not implemented), so we always use the reliable path.
      await this.device.writeCharacteristicWithResponseForService(
        EVA_SERVICE_UUID, CMD_CHAR_UUID, this.b64(JSON.stringify(cmd))
      );
    } catch { /* ignore */ }
  }

  // ── PIN flow ──────────────────────────────────────────────────────────────

  async verifyPin(pin: string): Promise<boolean> {
    this.stopKeepalive();
    await this.sendCommand({ cmd: 'verify_pin', pin });
    await new Promise(r => setTimeout(r, 800));
    const prefs = await this.readPrefs();
    if (prefs?._pin_ok === true) {
      this.callbacks?.onStatusChange('connected');
      this.startRSSIPolling();
      return true;
    }
    // One retry in case Pi was still processing
    await new Promise(r => setTimeout(r, 600));
    const prefs2 = await this.readPrefs();
    const ok = prefs2?._pin_ok === true;
    if (ok) {
      this.callbacks?.onStatusChange('connected');
      this.startRSSIPolling();
    } else {
      this.startKeepalive();
    }
    return ok;
  }

  async skipPin(): Promise<void> {
    await this.sendCommand({ cmd: 'skip_pin' });
    this.stopKeepalive();
    this.callbacks?.onStatusChange('connected');
    this.startRSSIPolling();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  get isConnected() { return this.device !== null; }
  get deviceId()    { return this.device?.id ?? null; }

  destroy() {
    this.stopRSSIPolling();
    this.stopKeepalive();
    this.stateSubscription?.remove();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.device?.cancelConnection();
    this.manager.destroy();
  }
}

export const evaBLE = new EvaBluetoothManager();
