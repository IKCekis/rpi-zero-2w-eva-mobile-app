import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoinHud } from './CoinHud';
import { ScenePlaceholder } from './ScenePlaceholder';
import { EvaSprite, EvaMood } from '../sprite/EvaSprite';

interface Props {
  scene:    string;
  title:    string;
  sub?:     string;
  onBack:   () => void;
  coins:    number;
  mood?:    EvaMood;
  accent?:  string;
  children: React.ReactNode;
}

export function ActivityFrame({ scene, title, sub, onBack, coins, mood = 'happy', children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Dünya</Text>
        </TouchableOpacity>
        <CoinHud coins={coins} />
      </View>

      <View style={styles.sceneBox}>
        <ScenePlaceholder
          scene={scene}
          label={`MEKAN · ${title.toUpperCase()}`}
          height={140}
        />
        <View style={styles.evaOverlay}>
          <EvaSprite mood={mood} scale={2.5} />
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {sub && <Text style={styles.sub}>{sub}</Text>}
      </View>

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { padding: 16, paddingBottom: 40 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn:    {
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#0000001a',
  },
  backTxt:    { fontSize: 12, fontWeight: '600', color: '#3a3530' },
  sceneBox:   { position: 'relative', marginBottom: 14 },
  evaOverlay: {
    position: 'absolute', left: '50%', top: '50%',
    marginLeft: -30, marginTop: -30,
  },
  header:     { marginBottom: 12 },
  title:      { fontSize: 22, fontWeight: '800', color: '#3a3530', letterSpacing: -0.3 },
  sub:        { fontSize: 12, color: '#7a6f5e', marginTop: 2 },
});
