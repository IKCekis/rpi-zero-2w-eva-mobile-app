import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// React Native has no global Buffer. Without this import every Buffer.from()
// below throws (silently caught), so GATT writes never send and reads/notify
// never parse — which silently broke all PIN verification and command sending.
import { Buffer } from 'buffer';
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
  private currentProximity:  Proximity = 'far';
  private _connecting        = false;
  private _rssiErrors        = 0;
  private _lastPendingPin:   string    = '';
  // Device we want to stay connected to — set on every connect attempt, including
  // mid-pairing (before the device is saved). Lets us auto-reconnect when Android
  // drops the link during PIN entry instead of kicking the user back to the list.
  private _reconnectTargetId: string | null = null;

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
    this._reconnectTargetId = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
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

  // ── Auto-reconnect to the current target (saved device OR mid-pairing) ────
  async scanAndReconnect(): Promise<void> {
    const targetId = this._reconnectTargetId ?? this.savedDeviceId;
    if (!targetId || this.device || this._connecting) return;

    const btState = await this.manager.state();
    if (btState !== State.PoweredOn) { this.callbacks?.onStatusChange('off'); return; }

    const hasPerms = await this.requestPermissions();
    if (!hasPerms) { this.callbacks?.onStatusChange('off'); return; }

    this.callbacks?.onStatusChange('scanning');

    this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      async (error, device) => {
        if (error || !device) return;
        if (device.id === targetId) {
          this.manager.stopDeviceScan();
          // Not "new" only if it's the saved device — otherwise we're still
          // mid-pairing and connectInternal will re-check PREFS for _pin_ok.
          await this.connectInternal(device, /* isNew */ targetId !== this.savedDeviceId);
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
    this._reconnectTargetId = device.id;
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
            if (data.pending_pin) this._lastPendingPin = data.pending_pin;
            this.callbacks?.onStateUpdate(data);
          } catch { /* ignore malformed */ }
        }
      );

      if (isNew) {
        // Read PREFS first: Pi may still have _pin_ok=true from a rapid reconnect
        // right after a successful verify_pin (Android GATT drop before phone confirmed).
        const prefs = await this.readPrefs();
        if (prefs?._pin_ok === true) {
          this.callbacks?.onStatusChange('connected');
          this.startRSSIPolling();
        } else {
          this.callbacks?.onStatusChange('pin_required');
          this.startKeepalive();
        }
      } else {
        // Saved device — tell the Pi to skip PIN so its OLED leaves the PIN
        // screen (covers auto-reconnect after the Pi's PIN TTL regenerated one).
        try { await this.sendCommand({ cmd: 'skip_pin' }); } catch { /* ignore */ }
        this.callbacks?.onStatusChange('connected');
        await this.readPrefs();
        this.startRSSIPolling();
      }
    } catch {
      this._connecting = false;
      this.device = null;
      this.callbacks?.onStatusChange('disconnected');
      if (this._reconnectTargetId) this.scheduleReconnect();
    }
  }

  private handleDisconnect() {
    if (this._connecting) return;
    this.stopRSSIPolling();
    this.stopKeepalive();
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.device = null;
    this.callbacks?.onProximityChange('far');
    // Reconnect to whatever we're targeting — including a device we're still
    // pairing with — so a mid-PIN-entry drop recovers instead of dead-ending.
    if (this._reconnectTargetId) {
      this.callbacks?.onStatusChange('scanning');
      this.scheduleReconnect();
    } else {
      this.callbacks?.onStatusChange('disconnected');
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.device) this.scanAndReconnect();
    }, 2_500);
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

  // Tell the Pi which face/animation to show on its OLED. Best-effort: silently
  // no-ops when disconnected (e.g. testing without the device).
  async sendFace(anim: string, opts: Record<string, unknown> = {}) {
    await this.sendCommand({ cmd: 'face', anim, ...opts });
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

  // Direct read of STATE_CHAR — Pi merges pending_pin + _pin_ok into it, so this
  // works even when notifications haven't been delivered yet.
  async readState(): Promise<(PiState & { _pin_ok?: boolean }) | null> {
    if (!this.device) return null;
    try {
      const char = await this.device.readCharacteristicForService(EVA_SERVICE_UUID, STATE_CHAR_UUID);
      if (char.value) {
        return JSON.parse(Buffer.from(char.value, 'base64').toString('utf-8'));
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

  private markPaired() {
    this.callbacks?.onStatusChange('connected');
    this.startRSSIPolling();
  }

  // Wait briefly for auto-reconnect to restore the link (Android often drops it
  // exactly as the user submits the PIN). Returns true once a device is present.
  private async waitForDevice(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (!this.device && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 300));
    }
    return this.device !== null;
  }

  async verifyPin(pin: string): Promise<boolean> {
    this.stopKeepalive();

    // A transient drop may have killed the link right as the user hit confirm.
    // Give auto-reconnect a chance before judging the code.
    if (!this.device) await this.waitForDevice(8000);

    // Freshest PIN the Pi advertises: prefer a direct STATE_CHAR read (carries
    // pending_pin + _pin_ok), fall back to the last value pushed via notify.
    let knownPin = this._lastPendingPin;
    const st = await this.readState();
    if (st?.pending_pin) knownPin = String(st.pending_pin);
    if (st?._pin_ok === true) { this.markPaired(); return true; }

    // Tell the Pi (best effort — may not land on a flaky link).
    try { await this.sendCommand({ cmd: 'verify_pin', pin }); } catch { /* ignore */ }

    // Confirm via PREFS _pin_ok.
    await new Promise(r => setTimeout(r, 700));
    const prefs = await this.readPrefs();
    if (prefs?._pin_ok === true) { this.markPaired(); return true; }

    // Local verification: the Pi broadcast this exact PIN to us, so a match is
    // authoritative even when the write/read-back round-trip failed.
    if (knownPin && pin === knownPin) {
      // Nudge the Pi out of PIN mode on its OLED (best effort, non-blocking).
      this.sendCommand({ cmd: 'verify_pin', pin }).catch(() => {});
      this.markPaired();
      return true;
    }

    this.startKeepalive();
    return false;
  }

  // User cancelled pairing — stop reconnecting and drop the link.
  cancelPairing(): void {
    this._reconnectTargetId = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopKeepalive();
    this.stopRSSIPolling();
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.manager.stopDeviceScan();
    this.device?.cancelConnection().catch(() => {});
    this.device = null;
    this.callbacks?.onStatusChange('disconnected');
  }

  async skipPin(): Promise<void> {
    await this.sendCommand({ cmd: 'skip_pin' });
    this.stopKeepalive();
    this.markPaired();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  get isConnected() { return this.device !== null; }
  get deviceId()    { return this.device?.id ?? null; }

  destroy() {
    this._reconnectTargetId = null;
    this.stopRSSIPolling();
    this.stopKeepalive();
    this.stateSubscription?.remove();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.device?.cancelConnection();
    this.manager.destroy();
  }
}

export const evaBLE = new EvaBluetoothManager();
