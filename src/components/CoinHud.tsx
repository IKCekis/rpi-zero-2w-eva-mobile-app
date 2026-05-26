import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ItemSprite } from '../sprite/ItemSprite';

interface Props { coins: number; }

export function CoinHud({ coins }: Props) {
  return (
    <View style={styles.row}>
      <ItemSprite name="coin" scale={1.5} />
      <Text style={styles.txt}>{coins.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#fff', borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  txt: { fontSize: 14, fontWeight: '700', color: '#3a3530' },
});
