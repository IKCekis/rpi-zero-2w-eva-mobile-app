import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { evaBLE, BLEStatus, Proximity, ScannedDevice } from './BLEManager';
import { useEvaStore, injectBLESend } from '../store/useEvaStore';

interface BLEContextValue {
  sendMood:        (mood: string, stats: Record<string, number>) => Promise<void>;
  sendPrefs:       (prefs: Record<string, unknown>) => Promise<void>;
  sendCommand:     (cmd: Record<string, unknown>) => Promise<void>;
  startScan:       (onDeviceFound: (d: ScannedDevice) => void) => Promise<void>;
  stopScan:        () => void;
  connectToDevice: (scanned: ScannedDevice, isNew: boolean) => Promise<void>;
  verifyPin:       (pin: string) => Promise<boolean>;
  skipPin:         () => Promise<void>;
  cancelPairing:   () => void;
  reconnect:       () => Promise<void>;
  saveDevice:      (deviceId: string) => Promise<void>;
  forgetDevice:    () => Promise<void>;
  savedDeviceId:   string | null;
}

const BLEContext = createContext<BLEContextValue>({
  sendMood:        async () => {},
  sendPrefs:       async () => {},
  sendCommand:     async () => {},
  startScan:       async () => {},
  stopScan:        () => {},
  connectToDevice: async () => {},
  verifyPin:       async () => false,
  skipPin:         async () => {},
  cancelPairing:   () => {},
  reconnect:       async () => {},
  saveDevice:      async () => {},
  forgetDevice:    async () => {},
  savedDeviceId:   null,
});

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const setBLEStatus = useEvaStore(s => s.setBLEStatus);
  const setProximity = useEvaStore(s => s.setProximity);
  const setRssi      = useEvaStore(s => s.setRssi);
  const setPiPrefs   = useEvaStore(s => s.setPiPrefs);
  const setPiState   = useEvaStore(s => s.setPiState);
  const appStateRef  = useRef(AppState.currentState);

  const [savedDeviceId, setSavedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    injectBLESend((cmd) => evaBLE.sendCommand(cmd));

    evaBLE.setCallbacks({
      onStatusChange:    (s: BLEStatus)  => setBLEStatus(s),
      onProximityChange: (p: Proximity)  => setProximity(p),
      onRssiUpdate:      (r: number)     => setRssi(r),
      onPrefsRead:       (prefs)         => setPiPrefs(prefs),
      onStateUpdate:     (state)         => setPiState(state),
    });

    evaBLE.init().then(() => {
      setSavedDeviceId(evaBLE.savedDeviceId);
      if (evaBLE.savedDeviceId) evaBLE.scanAndReconnect();
    });

    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (!evaBLE.isConnected) evaBLE.scanAndReconnect();
      }
      appStateRef.current = next;
    });

    return () => { sub.remove(); evaBLE.destroy(); };
  }, []);

  const value: BLEContextValue = {
    sendMood:        (mood, stats) => evaBLE.sendMood(mood, stats),
    sendPrefs:       (prefs)       => evaBLE.sendPrefs(prefs),
    sendCommand:     (cmd)         => evaBLE.sendCommand(cmd),
    startScan:       (cb)          => evaBLE.startScan(cb),
    stopScan:        ()            => evaBLE.stopScan(),
    connectToDevice: (d, isNew)    => evaBLE.connectToDevice(d, isNew),
    verifyPin:       (pin)         => evaBLE.verifyPin(pin),
    skipPin:         ()            => evaBLE.skipPin(),
    cancelPairing:   ()            => evaBLE.cancelPairing(),
    reconnect:       ()            => evaBLE.scanAndReconnect(),
    saveDevice:      async (id)    => { await evaBLE.saveDevice(id); setSavedDeviceId(id); },
    forgetDevice:    async ()      => { await evaBLE.forgetSavedDevice(); setSavedDeviceId(null); },
    savedDeviceId,
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
}

export const useBLE = () => useContext(BLEContext);
export type { ScannedDevice };
