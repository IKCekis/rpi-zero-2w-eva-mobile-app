import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { BigButton } from '../components/BigButton';

const MOVIES = [
  { id: 'action',  name: 'Patlama Tepesi',  cost: 12, emoji: '💥' },
  { id: 'romance', name: 'Pasta ve Aşk',    cost: 10, emoji: '💕' },
  { id: 'comedy',  name: 'Kedi Kahramanlar', cost: 8,  emoji: '😹' },
];

export function CinemaActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent = '#7BD3B8', prefs, spendCoins, cinemaDone } = useEvaStore();
  const { sendCommand } = useBLE();
  const [phase, setPhase] = useState<'select' | 'watching' | 'done'>('select');
  const [movie, setMovie] = useState<typeof MOVIES[0] | null>(null);
  const [pct, setPct] = useState(0);
  const sleepy = prefs?.cinemaSleepy ?? false;

  useEffect(() => {
    if (phase !== 'watching') return;
    const id = setInterval(() => setPct(v => Math.min(v + 3, 100)), 120);
    const done = setTimeout(() => { clearInterval(id); setPhase('done'); }, 4000);
    return () => { clearInterval(id); clearTimeout(done); };
  }, [phase]);

  const start = (m: typeof MOVIES[0]) => {
    if (coins < m.cost) return;
    spendCoins(m.cost);
    setMovie(m); setPct(0); setPhase('watching');
    sendCommand({ cmd: 'activity', type: 'cinema_start', movie: m.name });
  };

  const finish = () => {
    cinemaDone(sleepy);
    sendCommand({ cmd: 'activity', type: 'cinema_done', sleepy });
    setPhase('select'); setMovie(null);
  };

  return (
    <ActivityFrame scene="cinema" title="Sinema"
      sub={sleepy ? 'Uykuya dikkat — keyifli ama yorucu' : 'Keyfine bak'}
      onBack={onBack} coins={coins}
      mood={phase === 'watching' ? (sleepy ? 'sleepy' : 'excited') : mood}
      accent={accent}
    >
      {phase === 'select' && (
        <>
          <Text style={styles.label}>Bugünkü seanslar</Text>
          <View style={styles.list}>
            {MOVIES.map(m => {
              const can = coins >= m.cost;
              return (
                <TouchableOpacity key={m.id} onPress={() => start(m)} disabled={!can}
                  activeOpacity={0.8}
                  style={[styles.movieRow, !can && { opacity: 0.45 }]}>
                  <View style={styles.movieEmoji}>
                    <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                  </View>
                  <View style={styles.movieInfo}>
                    <Text style={styles.movieName}>{m.name}</Text>
                    <Text style={styles.movieCost}>bilet · {m.cost}¢</Text>
                  </View>
                  <Text style={styles.play}>▸</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {phase === 'watching' && movie && (
        <View style={styles.screen}>
          <Text style={{ fontSize: 64, marginBottom: 8 }}>{movie.emoji}</Text>
          <Text style={styles.screenTitle}>{movie.name}</Text>
          <Text style={styles.screenPct}>{pct}%</Text>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.resultBox}>
          <Text style={{ fontSize: 36, marginBottom: 4 }}>{sleepy ? '😴' : '🎬'}</Text>
          <Text style={styles.resultTitle}>{sleepy ? 'Güzeldi… ama içim geçti' : 'Harika filmdi!'}</Text>
          <Text style={styles.resultSub}>Mutluluk +18 · Enerji {sleepy ? '−10' : '−2'}</Text>
          <BigButton primary accent={accent} onPress={finish}>Çık</BigButton>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:      { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  list:       { gap: 8 },
  movieRow:   { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  movieEmoji: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1a0f1f', alignItems: 'center', justifyContent: 'center' },
  movieInfo:  { flex: 1 },
  movieName:  { fontSize: 14, fontWeight: '800', color: '#3a3530' },
  movieCost:  { fontSize: 10, color: '#7a6f5e', fontFamily: 'monospace' },
  play:       { fontSize: 18 },
  screen:     { backgroundColor: '#1a0f1f', borderRadius: 14, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  screenTitle:{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  screenPct:  { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace', marginTop: 6 },
  resultBox:  { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  resultTitle:{ fontSize: 18, fontWeight: '800', color: '#3a3530' },
  resultSub:  { fontSize: 12, color: '#7a6f5e', marginBottom: 6 },
});
