import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { CoinHud } from '../components/CoinHud';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ItemSprite } from '../sprite/ItemSprite';
import { ITEMS, ItemKind } from '../data/items';
import { Haptics } from '../services/Haptics';

const CAPACITY = 24;

type Selection =
  | { type: 'item'; id: string }
  | { type: 'cooked'; index: number };

const KIND_LABEL: Record<ItemKind, string> = {
  ingredient: 'Malzemeler',
  food:       'Yemekler',
  special:    'Özel',
};

export default function InventoryScreen() {
  const { coins, bleStatus, proximity, accent = '#7BD3B8', inventory, cookedItems, useItem, eatCooked } = useEvaStore();
  const { sendFace } = useBLE();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Selection | null>(null);

  // Group bag items by kind (unknown ids are skipped — they have no catalog entry).
  const grouped: Record<ItemKind, { id: string; count: number }[]> = {
    ingredient: [], food: [], special: [],
  };
  Object.entries(inventory).forEach(([id, count]) => {
    const def = ITEMS[id];
    if (!def || count <= 0) return;
    grouped[def.kind].push({ id, count });
  });

  const totalItems = Object.values(inventory).reduce((s, n) => s + n, 0) + cookedItems.length;

  const onUse = () => {
    if (!selected) return;
    if (selected.type === 'item') {
      const def = ITEMS[selected.id];
      useItem(selected.id);            // applies stats + haptics + toast
      if (def?.stats) sendFace('eat');
      if ((useEvaStore.getState().inventory[selected.id] ?? 0) <= 0) setSelected(null);
    } else {
      eatCooked(selected.index);
      Haptics.success();
      sendFace('eat');
      setSelected(null);
    }
  };

  const selectedDef =
    selected?.type === 'item' ? ITEMS[selected.id] :
    selected?.type === 'cooked' ? cookedItems[selected.index] : null;
  const selectedUsable =
    selected?.type === 'cooked' ||
    (selected?.type === 'item' && !!ITEMS[selected.id]?.stats);

  const renderSlot = (
    key: string, sprite: string, name: string, count: number | null,
    badge: string | undefined, isSel: boolean, onPress: () => void,
  ) => (
    <TouchableOpacity key={key} activeOpacity={0.8} onPress={onPress}
      style={[styles.slot, isSel && { borderColor: accent, borderWidth: 2 }]}>
      <ItemSprite name={sprite} scale={2.2} />
      <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
      {count !== null && (
        <View style={styles.countBadge}><Text style={styles.countTxt}>×{count}</Text></View>
      )}
      {badge && (
        <View style={[styles.labelBadge, { backgroundColor: badge === 'nadir' ? '#FF7AA8' : '#FFD93D' }]}>
          <Text style={styles.labelTxt}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const usedSlots = grouped.ingredient.length + grouped.food.length + grouped.special.length + cookedItems.length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: selected ? 180 : 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <ConnectionBadge status={bleStatus} proximity={proximity} accent={accent} />
          <CoinHud coins={coins} />
        </View>

        <Text style={styles.title}>Çanta</Text>
        <Text style={styles.sub}>{totalItems} eşya · {usedSlots}/{CAPACITY} yuva</Text>

        {/* Cooked dishes (eatable, indexed separately) */}
        {cookedItems.length > 0 && (
          <>
            <Text style={styles.section}>Pişen Yemekler</Text>
            <View style={styles.grid}>
              {cookedItems.map((dish, i) =>
                renderSlot(`cooked-${i}`, dish.sprite, dish.name, null, 'taze',
                  selected?.type === 'cooked' && selected.index === i,
                  () => setSelected({ type: 'cooked', index: i })))}
            </View>
          </>
        )}

        {(['ingredient', 'food', 'special'] as ItemKind[]).map(kind =>
          grouped[kind].length > 0 ? (
            <View key={kind}>
              <Text style={styles.section}>{KIND_LABEL[kind]}</Text>
              <View style={styles.grid}>
                {grouped[kind].map(({ id, count }) => {
                  const def = ITEMS[id];
                  const badge = kind === 'special' ? 'nadir' : undefined;
                  return renderSlot(id, def.sprite, def.name, count, badge,
                    selected?.type === 'item' && selected.id === id,
                    () => setSelected({ type: 'item', id }));
                })}
              </View>
            </View>
          ) : null
        )}

        {usedSlots === 0 && (
          <Text style={styles.empty}>Çantan boş. Markete uğra veya mutfakta pişir!</Text>
        )}
      </ScrollView>

      {/* Detail / use panel */}
      {selected && selectedDef && (
        <View style={[styles.detail, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.detailIcon}>
            <ItemSprite name={selectedDef.sprite} scale={2.6} />
          </View>
          <View style={styles.detailInfo}>
            <Text style={styles.detailName}>{selectedDef.name}</Text>
            <Text style={styles.detailDesc} numberOfLines={2}>
              {selected.type === 'item'
                ? (ITEMS[selected.id]?.desc ?? '')
                : `Pişirdiğin yemek · +${cookedItems[selected.index].hunger} açlık · +${cookedItems[selected.index].happiness} mutluluk`}
            </Text>
          </View>
          {selectedUsable ? (
            <TouchableOpacity onPress={onUse} style={[styles.useBtn, { backgroundColor: accent }]}>
              <Text style={styles.useTxt}>Kullan</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ingTag}><Text style={styles.ingTagTxt}>Malzeme</Text></View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, paddingHorizontal: 16 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:      { fontSize: 22, fontWeight: '800', color: '#3a3530', marginBottom: 2 },
  sub:        { fontSize: 11, color: '#8a7f6e', marginBottom: 8 },
  section:    { fontSize: 10, fontWeight: '700', color: '#8a7f6e', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot:       {
    width: '22%', backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4,
    position: 'relative', borderWidth: 1.5, borderColor: '#eee5d4',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  itemName:   { fontSize: 10, fontWeight: '700', color: '#3a3530' },
  countBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#1d2733', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  countTxt:   { fontSize: 10, fontWeight: '700', color: '#fff' },
  labelBadge: { position: 'absolute', top: 4, left: 4, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  labelTxt:   { fontSize: 8, fontWeight: '800', color: '#1d2733', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty:      { textAlign: 'center', color: '#aaa', marginTop: 32, fontSize: 13 },
  detail:     {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 12,
    borderTopWidth: 1, borderColor: '#eee5d4',
  },
  detailIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 16, fontWeight: '800', color: '#3a3530' },
  detailDesc: { fontSize: 11, color: '#7a6f5e', marginTop: 2 },
  useBtn:     { borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  useTxt:     { fontSize: 14, fontWeight: '800', color: '#fff' },
  ingTag:     { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#eee5d4' },
  ingTagTxt:  { fontSize: 12, fontWeight: '700', color: '#8a7f6e' },
});
