import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { ItemSprite } from '../sprite/ItemSprite';

// Restaurant = convenience premium: instant, but pricier than cooking the same
// dish at home from market ingredients (see src/data/recipes.ts).
const MENU = [
  { id: 'apple', name: 'Elma',  cost: 4,  fills: { hunger: 12, happiness: 4 } },
  { id: 'ramen', name: 'Ramen', cost: 9,  fills: { hunger: 32, happiness: 8 } },
  { id: 'pizza', name: 'Pizza', cost: 15, fills: { hunger: 40, happiness: 14 } },
  { id: 'cake',  name: 'Pasta', cost: 13, fills: { hunger: 18, happiness: 22 } },
  { id: 'soda',  name: 'Soda',  cost: 5,  fills: { hunger: 4,  happiness: 10 } },
  { id: 'candy', name: 'Şeker', cost: 4,  fills: { happiness: 12 } },
];

export function RestaurantActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent = '#7BD3B8', orderFood } = useEvaStore();
  const { sendFace } = useBLE();

  const order = (item: typeof MENU[0]) => {
    // orderFood already sends the feed_done activity (with the coin cost); only
    // drive the OLED eating face here — sending a second 'eat' activity would
    // double-apply the fullness gain on the Pi.
    orderFood(item as Parameters<typeof orderFood>[0]);
    sendFace('eat');
  };

  return (
    <ActivityFrame scene="restaurant" title="Restoran"
      sub="Para öde, hem ye hem eğlen"
      onBack={onBack} coins={coins} mood={mood} accent={accent}>

      <Text style={styles.sectionLabel}>Menü</Text>
      <View style={styles.grid}>
        {MENU.map(item => {
          const canAfford = coins >= item.cost;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => canAfford && order(item)}
              disabled={!canAfford}
              activeOpacity={0.8}
              style={[styles.menuItem, !canAfford && styles.disabled]}
            >
              <View style={styles.menuIcon}>
                <ItemSprite name={item.id} scale={2.2} />
              </View>
              <Text style={styles.menuName}>{item.name}</Text>
              <View style={styles.costRow}>
                <ItemSprite name="coin" scale={0.9} />
                <Text style={styles.costTxt}>{item.cost}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuItem: {
    width: '30%', backgroundColor: '#fff', borderRadius: 12,
    paddingTop: 10, paddingBottom: 8, paddingHorizontal: 6, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  disabled:  { opacity: 0.45 },
  menuIcon:  { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  menuName:  { fontSize: 11, fontWeight: '700', color: '#3a3530' },
  costRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  costTxt:   { fontSize: 10, color: '#7a6f5e', fontFamily: 'monospace' },
});
