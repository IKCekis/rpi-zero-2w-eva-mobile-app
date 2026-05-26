import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { BLEProvider } from './src/ble/BLEContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { loadPersistedPrefs } from './src/store/useEvaStore';

export default function App() {
  useEffect(() => {
    loadPersistedPrefs();
  }, []);

  return (
    <BLEProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </BLEProvider>
  );
}
