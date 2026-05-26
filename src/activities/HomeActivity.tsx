import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { ActivityFrame } from '../components/ActivityFrame';
import { BigButton } from '../components/BigButton';
import { ItemSprite } from '../sprite/ItemSprite';

export function HomeActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent = '#7BD3B8', cookedItems, eatCooked, gotoScene } = useEvaStore();

  return (
    <ActivityFrame scene="bedroom" title="Ev"
      sub="Pişirdiğin yemekleri burada yiyebilirsin"
      onBack={onBack} coins={coins} mood={mood} accent={accent}>

      {cookedItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🍽</Text>
          <Text style={styles.emptyTitle}>Mutfak boş</Text>
          <Text style={styles.emptySub}>Önce mutfakta bir şeyler pişir</Text>
          <BigButton primary accent={accent} onPress={() => gotoScene('kitchen')}>
            Mutfağa git
          </BigButton>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Pişirdiğin yemekler · {cookedItems.length}</Text>
          <View style={styles.grid}>
            {cookedItems.map((dish, i) => (
              <TouchableOpacity key={i} onPress={() => eatCooked(i)}
                activeOpacity={0.8} style={styles.dishBtn}>
                <View style={styles.dishIcon}>
                  <ItemSprite name={dish.sprite} scale={2} />
                </View>
                <View style={styles.dishInfo}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  <Text style={styles.dishStats}>+{dish.hunger} açlık</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  empty:      { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#0000001a', borderStyle: 'dashed' },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#3a3530' },
  emptySub:   { fontSize: 12, color: '#7a6f5e', marginBottom: 6 },
  label:      { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grid:       { gap: 8 },
  dishBtn:    { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  dishIcon:   { width: 48, height: 48, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  dishInfo:   { flex: 1 },
  dishName:   { fontSize: 13, fontWeight: '700', color: '#3a3530' },
  dishStats:  { fontSize: 9, color: '#7a6f5e', fontFamily: 'monospace', marginTop: 2 },
});
