import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { ActivityFrame } from '../components/ActivityFrame';
import { ItemSprite } from '../sprite/ItemSprite';
import { BUYABLE_ITEMS, ItemDef } from '../data/items';
import { Haptics } from '../services/Haptics';

const ORDER = { ingredient: 0, food: 1, special: 2 } as const;
const KIND_LABEL = { ingredient: 'Malzemeler', food: 'Yemekler', special: 'Özel' } as const;

export function MarketActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent, prefs, buyItem, spendCoins } = useEvaStore();
  const likes = prefs?.likesShopping ?? false;

  const buy = (item: ItemDef) => {
    const cost = item.cost ?? 0;
    if (coins < cost) return;
    spendCoins(cost);              // wallet debit (Pi-owned when connected)
    buyItem(item.id, 1);          // stores in bag + notifies Pi (market_buy)
    Haptics.success();
  };

  const effectLabel = (item: ItemDef) =>
    item.kind === 'ingredient'
      ? 'tarif malzemesi'
      : Object.entries(item.stats ?? {}).map(([k, v]) => `+${v} ${k}`).join(' · ');

  // Group buyable items by kind for clearer shelves.
  const groups = (['ingredient', 'food', 'special'] as const)
    .map(kind => ({ kind, items: BUYABLE_ITEMS.filter(i => i.kind === kind) }))
    .filter(g => g.items.length > 0)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);

  return (
    <ActivityFrame scene="market" title="Market"
      sub={likes ? 'Alışveriş büyük eğlence!' : 'Lazım olanı al çık'}
      onBack={onBack} coins={coins} mood={mood} accent={accent}
    >
      {groups.map(({ kind, items }) => (
        <View key={kind}>
          <Text style={styles.label}>{KIND_LABEL[kind]}</Text>
          <View style={styles.grid}>
            {items.map(item => {
              const cost = item.cost ?? 0;
              const can = coins >= cost;
              return (
                <TouchableOpacity key={item.id} onPress={() => buy(item)}
                  disabled={!can} activeOpacity={0.8}
                  style={[styles.card, !can && { opacity: 0.45 }]}>
                  <View style={styles.cardIcon}>
                    <ItemSprite name={item.sprite} scale={2.2} />
                  </View>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardBonus} numberOfLines={1}>{effectLabel(item)}</Text>
                  <View style={[styles.priceTag, { backgroundColor: can ? accent : '#ccc' }]}>
                    <ItemSprite name="coin" scale={0.8} />
                    <Text style={styles.priceTxt}>{cost}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {likes && (
        <View style={[styles.hint, { backgroundColor: '#dff4ec', borderColor: accent }]}>
          <Text style={styles.hintTxt}>🛍 Alışverişte mutluluk bonusu kazanıyorsun!</Text>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:    { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6, marginBottom: 8 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  card:     { width: '30%', backgroundColor: '#fff', borderRadius: 14, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 6, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardIcon: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 11, fontWeight: '700', color: '#3a3530' },
  cardBonus:{ fontSize: 8, color: '#7a6f5e', fontFamily: 'monospace', textAlign: 'center' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  priceTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  hint:     { borderRadius: 10, padding: 10, borderWidth: 1, marginTop: 4 },
  hintTxt:  { fontSize: 11, color: '#3a3530' },
});
