import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: number;
  max?:  number;
  color: string;
  icon?: string;
}

export function StatBar({ label, value, max = 100, color, icon }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
      ) : null}
      <View style={styles.barArea}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label.toUpperCase()}</Text>
          <Text style={styles.value}>
            {Math.round(value)}
            <Text style={styles.max}>/{max}</Text>
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox:  { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  barArea:  { flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label:    { fontSize: 10, fontWeight: '600', color: '#3a353099', letterSpacing: 0.5 },
  value:    { fontSize: 10, fontWeight: '700', color: '#3a3530', fontVariant: ['tabular-nums'] },
  max:      { color: '#3a353066' },
  track:    { height: 10, backgroundColor: '#eee5d4', borderRadius: 3, overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: 3 },
});
