import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BLEProvider } from './src/ble/BLEContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useEvaStore } from './src/store/useEvaStore';
import { initMediaWatcher } from './src/services/MediaWatcher';
import { setupNotifications, checkAndSendStatReminders, sendLongAbsenceReminder } from './src/services/Notifications';

const TICK_MS = 30_000; // real-time decay tick: 30 s

function AppInner() {
  const { applyRealtime, persistToDisk, restoreFromDisk, setMediaMode, stats } = useEvaStore();

  const lastTickRef   = useRef(Date.now());
  const tickTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef   = useRef<AppStateStatus>(AppState.currentState);
  const cleanupMedia  = useRef<(() => void) | null>(null);

  // ── On mount: restore + setup ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await setupNotifications();
      const result = await restoreFromDisk();

      // Send absence reminder if gone > 3 hours
      // (restoreFromDisk applies decay; we approximate elapsed via saved timestamp)
    })();

    // Start the real-time decay ticker
    tickTimerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      applyRealtime(delta);
      const { stats, isDead } = useEvaStore.getState();
      if (!isDead) checkAndSendStatReminders(stats).catch(() => {});
    }, TICK_MS);

    // Init media watcher
    cleanupMedia.current = initMediaWatcher((mode) => {
      setMediaMode(mode);
      const { bleStatus } = useEvaStore.getState();
      // BLE send handled in BLEContext via store subscription (below)
    });

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      cleanupMedia.current?.();
    };
  }, []);

  // ── AppState changes: persist on background, restore lastTick on foreground ─
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === 'background' || next === 'inactive') {
        await persistToDisk();
      }
      if (next === 'active' && prev !== 'active') {
        // Apply decay for the time spent in background
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;
        if (delta > 5_000) applyRealtime(delta);
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BLEProvider>
        <StatusBar style="dark" />
        <AppInner />
        <AppNavigator />
      </BLEProvider>
    </SafeAreaProvider>
  );
}
