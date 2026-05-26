import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { evaBLE, BLEStatus, Proximity } from './BLEManager';
import { useEvaStore } from '../store/useEvaStore';

interface BLEContextValue {
  sendMood:    (mood: string, stats: Record<string, number>) => Promise<void>;
  sendPrefs:   (prefs: Record<string, unknown>) => Promise<void>;
  sendCommand: (cmd: Record<string, unknown>) => Promise<void>;
  reconnect:   () => void;
}

const BLEContext = createContext<BLEContextValue>({
  sendMood:    async () => {},
  sendPrefs:   async () => {},
  sendCommand: async () => {},
  reconnect:   () => {},
});

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const setBLEStatus   = useEvaStore(s => s.setBLEStatus);
  const setProximity   = useEvaStore(s => s.setProximity);
  const setRssi        = useEvaStore(s => s.setRssi);
  const setPiPrefs     = useEvaStore(s => s.setPiPrefs);

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    evaBLE.setCallbacks({
      onStatusChange:    (s: BLEStatus)   => setBLEStatus(s),
      onProximityChange: (p: Proximity)   => setProximity(p),
      onRssiUpdate:      (r: number)      => setRssi(r),
      onPrefsRead:       (prefs)          => setPiPrefs(prefs),
    });

    evaBLE.scan();

    // Re-scan when app comes to foreground
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (!evaBLE.isConnected) evaBLE.scan();
      }
      appStateRef.current = next;
    });

    return () => {
      sub.remove();
      evaBLE.destroy();
    };
  }, []);

  const value: BLEContextValue = {
    sendMood:    (mood, stats) => evaBLE.sendMood(mood, stats),
    sendPrefs:   (prefs)       => evaBLE.sendPrefs(prefs),
    sendCommand: (cmd)         => evaBLE.sendCommand(cmd),
    reconnect:   ()            => evaBLE.scan(),
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
}

export const useBLE = () => useContext(BLEContext);
