import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { ActivityFrame } from '../components/ActivityFrame';
import { BLERequired } from '../components/BLERequired';
import { StarsGame } from '../games/StarsGame';
import { ReactionGame } from '../games/ReactionGame';
import { MemoryGame } from '../games/MemoryGame';
import { BalonPatla } from '../games/BalonPatla';
import { HizliMat } from '../games/HizliMat';

const GAMES = [
  { id: 'stars',    name: 'Yıldız Avı',  emoji: '⭐', desc: '20sn · puan×2 jeton' },
  { id: 'reaction', name: 'Reaksiyon',   emoji: '🟢', desc: '5 tur · hıza göre ödül' },
  { id: 'memory',   name: 'Hafıza',      emoji: '🃏', desc: '4 çift · kart eşle' },
  { id: 'balon',    name: 'Balon Patla', emoji: '🎈', desc: '25sn · puan×3 jeton' },
  { id: 'mat',      name: 'Hızlı Mat',   emoji: '🧮', desc: '5 soru · süre = ödül' },
];

type GameId = 'stars' | 'reaction' | 'memory' | 'balon' | 'mat' | null;

export function PlaygroundActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent = '#7BD3B8', bleStatus } = useEvaStore();
  const [activeGame, setActiveGame] = useState<GameId>(null);

  if (bleStatus !== 'connected') {
    return <BLERequired onBack={onBack} />;
  }

  if (activeGame === 'stars')    return <StarsGame    onBack={() => setActiveGame(null)} />;
  if (activeGame === 'reaction') return <ReactionGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'memory')   return <MemoryGame   onBack={() => setActiveGame(null)} />;
  if (activeGame === 'balon')    return <BalonPatla   onBack={() => setActiveGame(null)} />;
  if (activeGame === 'mat')      return <HizliMat     onBack={() => setActiveGame(null)} />;

  return (
    <ActivityFrame scene="playground" title="Oyun Alanı"
      sub="Oyna, kazan, eğlen"
      onBack={onBack} coins={coins} mood={mood} accent={accent}>
      <Text style={styles.label}>Oyunlar</Text>
      <View style={styles.list}>
        {GAMES.map(g => (
          <TouchableOpacity key={g.id} onPress={() => setActiveGame(g.id as GameId)}
            activeOpacity={0.8} style={styles.gameRow}>
            <View style={[styles.gameEmoji, { backgroundColor: accent + '33' }]}>
              <Text style={{ fontSize: 22 }}>{g.emoji}</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameName}>{g.name}</Text>
              <Text style={styles.gameDesc}>{g.desc}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:     { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  list:      { gap: 8 },
  gameRow:   { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  gameEmoji: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gameInfo:  { flex: 1 },
  gameName:  { fontSize: 14, fontWeight: '800', color: '#3a3530' },
  gameDesc:  { fontSize: 10, color: '#7a6f5e', fontFamily: 'monospace' },
  arrow:     { fontSize: 20, color: '#bbb' },
});
