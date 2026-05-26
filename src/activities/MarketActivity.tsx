import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { ItemSprite } from '../sprite/ItemSprite';

const SHOP_ITEMS = [
  { id: 'apple',  name: 'Elma',         cost: 3,  bonus: { happiness: 2 } },
  { id: 'candy',  name: 'Şeker',         cost: 4,  bonus: { happiness: 10 } },
  { id: 'heart',  name: 'İlk Yardım',   cost: 12, bonus: { health: 20 } },
  { id: 'star',   name: 'Yıldız Tozu',  cost: 8,  bonus: { happiness: 15 } },
  { id: 'soda',   name: 'Soda',          cost: 3,  bonus: { happiness: 6 } },
  { id: 'ramen',  name: 'Ramen',         cost: 6,  bonus: { hunger: 32 } },
];

export function MarketActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent, prefs, buyItem, spendCoins } = useEvaStore();
  const { sendCommand } = useBLE();
  const likes = prefs?.likesShopping ?? false;

  const buy = (item: typeof SHOP_ITEMS[0]) => {
    if (coins < item.cost) return;
    spendCoins(item.cost);
    buyItem(item.id, item.name, item.bonus as Partial<import('../store/types').Stats>);
    sendCommand({ cmd: 'activity', type: 'market_buy', item: item.name, likes });
  };

  const bonusLabel = (b: Record<string, number>) =>
    Object.entries(b).map(([k, v]) => `+${v} ${k}`).join(' · ');

  return (
    <ActivityFrame scene="market" title="Market"
      sub={likes ? 'Alışveriş büyük eğlence!' : 'Lazım olanı al çık'}
      onBack={onBack} coins={coins} mood={mood} accent={accent}
    >
      <Text style={styles.label}>Raf</Text>
      <View style={styles.grid}>
        {SHOP_ITEMS.map(item => {
          const can = coins >= item.cost;
          return (
            <TouchableOpacity key={item.id} onPress={() => buy(item)}
              disabled={!can} activeOpacity={0.8}
              style={[styles.card, !can && { opacity: 0.45 }]}>
              <View style={styles.cardIcon}>
                <ItemSprite name={item.id} scale={2.2} />
              </View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardBonus}>{bonusLabel(item.bonus)}</Text>
              <View style={[styles.priceTag, { backgroundColor: can ? accent : '#ccc' }]}>
                <ItemSprite name="coin" scale={0.8} />
                <Text style={styles.priceTxt}>{item.cost}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {likes && (
        <View style={[styles.hint, { backgroundColor: '#dff4ec', borderColor: accent }]}>
          <Text style={styles.hintTxt}>🛍 Alışverişte mutluluk bonusu kazanıyorsun!</Text>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:    { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  card:     { width: '30%', backgroundColor: '#fff', borderRadius: 14, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 6, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardIcon: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 11, fontWeight: '700', color: '#3a3530' },
  cardBonus:{ fontSize: 8, color: '#7a6f5e', fontFamily: 'monospace', textAlign: 'center' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  priceTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  hint:     { borderRadius: 10, padding: 10, borderWidth: 1 },
  hintTxt:  { fontSize: 11, color: '#3a3530' },
});
