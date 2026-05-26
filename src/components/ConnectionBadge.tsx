import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BLEStatus, Proximity } from '../store/types';
import { useBLE } from '../ble/BLEContext';

interface Props {
  status:    BLEStatus;
  proximity: Proximity;
  accent:    string;
}

const STATUS_LABEL: Record<BLEStatus, string> = {
  off:          'BT KAPALI',
  disconnected: 'BAĞLANMIYOR',
  scanning:     'ARANIYOR…',
  connecting:   'BAĞLANIYOR…',
  connected:    'EVA·BAĞLI',
};

export function ConnectionBadge({ status, proximity, accent }: Props) {
  const { reconnect } = useBLE();
  const connected = status === 'connected';

  const dotColor = connected
    ? proximity === 'far' ? '#FFD93D' : '#5BB89B'
    : '#c44';

  return (
    <TouchableOpacity
      onPress={connected ? undefined : reconnect}
      activeOpacity={connected ? 1 : 0.7}
      style={[
        styles.badge,
        connected
          ? { backgroundColor: accent + '26', borderColor: accent + '55' }
          : { backgroundColor: '#ffe5e5', borderColor: '#f0bcbc' },
      ]}
    >
      <Text style={[styles.label, { color: connected ? '#1a6a4d' : '#a33' }]}>
        {STATUS_LABEL[status]}
        {connected && proximity === 'far' ? ' · UZAK' : ''}
      </Text>
      <View style={[styles.dot, { backgroundColor: dotColor,
        ...(connected ? { shadowColor: dotColor, shadowOpacity: 0.7, shadowRadius: 4 } : {}),
      }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
});
