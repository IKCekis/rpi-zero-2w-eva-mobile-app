import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBLE, ScannedDevice } from '../ble/BLEContext';
import { useEvaStore } from '../store/useEvaStore';

export function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const { startScan, stopScan, connectToDevice, verifyPin, skipPin, saveDevice, forgetDevice, savedDeviceId } = useBLE();
  const bleStatus = useEvaStore(s => s.bleStatus);

  const [devices,     setDevices]     = useState<ScannedDevice[]>([]);
  const [connecting,  setConnecting]  = useState<string | null>(null);
  const [pinVisible,  setPinVisible]  = useState(false);
  const [pin,         setPin]         = useState('');
  const [pinError,    setPinError]    = useState('');
  const [verifying,   setVerifying]   = useState(false);
  const [scanning,    setScanning]    = useState(false);

  const scan = useCallback((clearList = true) => {
    if (clearList) setDevices([]);
    setScanning(true);
    startScan((d) => {
      setDevices(prev => {
        if (prev.some(p => p.id === d.id)) return prev;
        return [...prev, d];
      });
    }).finally(() => setScanning(false));
  }, [startScan]);

  // Start scan on mount and when status goes back to disconnected
  useEffect(() => {
    if (bleStatus === 'disconnected' || bleStatus === 'off') {
      // Don't clear list on auto-rescan — avoids "device disappears" UX
      if (!scanning) scan(false);
    }
    // Show PIN entry overlay when connection is established but PIN not confirmed
    if (bleStatus === 'pin_required') {
      setPinVisible(true);
      setPin('');
      setPinError('');
    }
  }, [bleStatus]);

  useEffect(() => {
    return () => stopScan();
  }, []);

  const handleConnect = async (device: ScannedDevice) => {
    stopScan();
    setScanning(false);
    setConnecting(device.id);
    const isNew = device.id !== savedDeviceId;
    try {
      await connectToDevice(device, isNew);
      if (!isNew) {
        // Saved device — skip PIN automatically
        await skipPin();
      }
      // For new devices, bleStatus becomes 'pin_required' → PIN overlay shows
    } catch {
      setConnecting(null);
    }
  };

  const handlePinConfirm = async () => {
    if (pin.length !== 6) { setPinError('6 haneli kodu tam girin'); return; }
    setVerifying(true);
    const ok = await verifyPin(pin);
    setVerifying(false);
    if (ok) {
      if (connecting) await saveDevice(connecting);
      setPinVisible(false);
      setConnecting(null);
    } else {
      setPinError('Yanlış kod. Eva\'nın ekranına tekrar bak.');
      setPin('');
    }
  };

  const handleForget = async () => {
    await forgetDevice();
    scan(true);
  };

  // Sort: saved device first
  const sorted = [...devices].sort((a, b) => {
    if (a.id === savedDeviceId) return -1;
    if (b.id === savedDeviceId) return 1;
    return b.rssi - a.rssi;
  });

  const rssiBar = (rssi: number) => {
    if (rssi > -60) return '●●●';
    if (rssi > -75) return '●●○';
    return '●○○';
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>EVA ile Bağlan</Text>
        <Text style={styles.sub}>Yakındaki EVA cihazını seç</Text>
        <Text style={styles.hint}>
          Telefon Bluetooth ayarlarından değil, buradan bağlan
        </Text>
      </View>

      {/* Device list */}
      <View style={styles.listWrap}>
        {scanning && devices.length === 0 && (
          <View style={styles.scanningRow}>
            <ActivityIndicator color="#7BD3B8" />
            <Text style={styles.scanningTxt}>Taranıyor...</Text>
          </View>
        )}

        <FlatList
          data={sorted}
          keyExtractor={d => d.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => {
            const isSaved   = item.id === savedDeviceId;
            const isBusy    = connecting === item.id;
            return (
              <View style={[styles.deviceRow, isSaved && styles.deviceRowSaved]}>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceSub}>
                    {rssiBar(item.rssi)}  {item.rssi} dBm
                    {isSaved ? '  ·  Son bağlantı' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleConnect(item)}
                  disabled={!!connecting}
                  style={[styles.connectBtn, isSaved && styles.connectBtnSaved]}
                >
                  {isBusy
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.connectTxt}>Bağlan</Text>}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            !scanning ? (
              <Text style={styles.emptyTxt}>Cihaz bulunamadı</Text>
            ) : null
          }
        />
      </View>

      {/* Bottom actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {!scanning && !connecting && (
          <TouchableOpacity onPress={scan} style={styles.rescanBtn}>
            <Text style={styles.rescanTxt}>Yeniden Tara</Text>
          </TouchableOpacity>
        )}
        {savedDeviceId && (
          <TouchableOpacity onPress={handleForget} style={styles.forgetBtn}>
            <Text style={styles.forgetTxt}>Cihazı Unut</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* PIN entry overlay */}
      {pinVisible && (
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Eşleşme Kodu</Text>
            <Text style={styles.pinDesc}>
              Eva'nın ekranında görünen{'\n'}6 haneli kodu girin
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={t => { setPin(t.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor="#555"
              textAlign="center"
              autoFocus
            />
            {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}
            <TouchableOpacity
              onPress={handlePinConfirm}
              disabled={verifying || pin.length !== 6}
              style={[styles.pinConfirmBtn, pin.length !== 6 && { opacity: 0.4 }]}
            >
              {verifying
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.pinConfirmTxt}>Onayla</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setPinVisible(false); setConnecting(null); scan(); }}
              style={styles.pinCancelBtn}
            >
              <Text style={styles.pinCancelTxt}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#faf6f0' },
  header:          { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  title:           { fontSize: 26, fontWeight: '900', color: '#1d2733', letterSpacing: -0.5 },
  sub:             { fontSize: 13, color: '#8a7f6e', marginTop: 4 },
  hint:            { fontSize: 11, color: '#b8a89a', marginTop: 6, textAlign: 'center' },
  listWrap:        { flex: 1, paddingHorizontal: 16 },
  scanningRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  scanningTxt:     { fontSize: 14, color: '#8a7f6e' },
  deviceRow:       {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    borderWidth: 1.5, borderColor: '#eee5d4',
  },
  deviceRowSaved:  { borderColor: '#7BD3B8' },
  deviceInfo:      { flex: 1 },
  deviceName:      { fontSize: 15, fontWeight: '700', color: '#1d2733' },
  deviceSub:       { fontSize: 11, color: '#8a7f6e', marginTop: 2 },
  connectBtn:      {
    backgroundColor: '#1d2733', borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  connectBtnSaved: { backgroundColor: '#7BD3B8' },
  connectTxt:      { fontSize: 13, fontWeight: '700', color: '#fff' },
  bottom:          { paddingHorizontal: 16, gap: 8 },
  rescanBtn:       {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#eee5d4',
  },
  rescanTxt:       { fontSize: 14, fontWeight: '700', color: '#1d2733' },
  forgetBtn:       { alignItems: 'center', paddingVertical: 10 },
  forgetTxt:       { fontSize: 13, color: '#aaa' },
  emptyTxt:        { textAlign: 'center', color: '#aaa', marginTop: 24, fontSize: 14 },

  // PIN overlay
  pinOverlay:      {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  pinCard:         {
    width: '85%', backgroundColor: '#faf6f0', borderRadius: 20,
    padding: 24, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  pinTitle:        { fontSize: 20, fontWeight: '900', color: '#1d2733' },
  pinDesc:         { fontSize: 13, color: '#8a7f6e', textAlign: 'center', lineHeight: 20 },
  pinInput:        {
    width: '80%', borderWidth: 2, borderColor: '#1d2733', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 28, fontWeight: '800', color: '#1d2733',
    letterSpacing: 8, backgroundColor: '#fff',
  },
  pinError:        { fontSize: 12, color: '#ff6b6b', textAlign: 'center' },
  pinConfirmBtn:   {
    backgroundColor: '#7BD3B8', borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 13, width: '80%', alignItems: 'center',
  },
  pinConfirmTxt:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  pinCancelBtn:    { paddingVertical: 8 },
  pinCancelTxt:    { fontSize: 13, color: '#aaa' },
});
