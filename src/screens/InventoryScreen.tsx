import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvaStore } from '../store/useEvaStore';
import { CoinHud } from '../components/CoinHud';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ItemSprite } from '../sprite/ItemSprite';

const BASE_ITEMS = [
  { id: 'apple', name: 'Elma',  count: 4 },
  { id: 'ramen', name: 'Ramen', count: 2 },
  { id: 'pizza', name: 'Pizza', count: 1 },
  { id: 'star',  name: 'Yıldız', count: 12, label: 'özel' },
  { id: 'heart', name: 'İlk Yardım', count: 1, label: 'nadir' },
];

export default function InventoryScreen() {
  const { coins, bleStatus, proximity, accent = '#7BD3B8', inventory } = useEvaStore();
  const insets = useSafeAreaInsets();

  // merge base with earned
  const counts: Record<string, number> = {};
  BASE_ITEMS.forEach(i => { counts[i.id] = i.count; });
  inventory.forEach(id => { counts[id] = (counts[id] ?? 0) + 1; });

  const items = Object.entries(counts).map(([id, count]) => {
    const base = BASE_ITEMS.find(b => b.id === id);
    return { id, name: base?.name ?? id, count, label: base?.label };
  });

  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <ConnectionBadge status={bleStatus} proximity={proximity} accent={accent} />
        <CoinHud coins={coins} />
      </View>

      <Text style={styles.title}>Çanta</Text>
      <Text style={styles.sub}>{total} eşya · 24 yuva</Text>

      <View style={styles.grid}>
        {items.map(item => (
          <View key={item.id} style={styles.slot}>
            <ItemSprite name={item.id} scale={2.2} />
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countTxt}>×{item.count}</Text>
            </View>
            {item.label && (
              <View style={[styles.labelBadge, { backgroundColor: item.label === 'nadir' ? '#FF7AA8' : '#FFD93D' }]}>
                <Text style={styles.labelTxt}>{item.label}</Text>
              </View>
            )}
          </View>
        ))}
        {Array.from({ length: Math.max(0, 24 - items.length) }).map((_, i) => (
          <View key={`e${i}`} style={[styles.slot, styles.emptySlot]} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, paddingHorizontal: 16 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:      { fontSize: 22, fontWeight: '800', color: '#3a3530', marginBottom: 2 },
  sub:        { fontSize: 11, color: '#8a7f6e', marginBottom: 14 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  slot:       {
    width: '22%', backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4,
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  emptySlot:  { backgroundColor: 'rgba(0,0,0,0.03)', borderWidth: 1.5, borderColor: '#0000001a', borderStyle: 'dashed', height: 86 },
  itemName:   { fontSize: 10, fontWeight: '700', color: '#3a3530' },
  countBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#1d2733', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  countTxt:   { fontSize: 10, fontWeight: '700', color: '#fff' },
  labelBadge: { position: 'absolute', top: 4, left: 4, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  labelTxt:   { fontSize: 8, fontWeight: '800', color: '#1d2733', textTransform: 'uppercase', letterSpacing: 0.5 },
});
