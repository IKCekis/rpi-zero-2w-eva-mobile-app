import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { BigButton } from '../components/BigButton';
import { ItemSprite } from '../sprite/ItemSprite';
import { CookedDish } from '../store/types';

const DISHES: CookedDish[] = [
  { id: 'omlet',    name: 'Omlet',          sprite: 'soda',  hunger: 26, happiness: 4  },
  { id: 'corba',    name: 'Sebze Çorbası',  sprite: 'ramen', hunger: 22, happiness: 6  },
  { id: 'ev_pizza', name: 'Ev Pizzası',     sprite: 'pizza', hunger: 38, happiness: 10 },
  { id: 'ev_pasta', name: 'Ev Pastası',     sprite: 'cake',  hunger: 18, happiness: 22 },
];

type Phase = 'select' | 'cooking' | 'done';

export function KitchenActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent = '#7BD3B8', prefs, cookSuccess, cookBurned } = useEvaStore();
  const { sendCommand } = useBLE();
  const [chosen, setChosen] = useState<CookedDish | null>(null);
  const [phase, setPhase] = useState<Phase>('select');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<'success' | 'burned' | null>(null);
  const COOK_TIME_S = 20;
  const likes = prefs?.likesCooking;

  useEffect(() => {
    if (phase !== 'cooking' || !chosen) return;
    let p = 0;
    const t = setInterval(() => {
      p += 100 / (COOK_TIME_S * 10);
      if (p >= 100) {
        clearInterval(t);
        const r = Math.random() < 0.85 ? 'success' : 'burned';
        setResult(r);
        setPhase('done');
      }
      setProgress(p);
    }, 100);
    return () => clearInterval(t);
  }, [phase, chosen]);

  const finish = () => {
    if (!chosen) return;
    if (result === 'success') {
      cookSuccess(chosen);
      sendCommand({ cmd: 'activity', type: 'cook_success', dish: chosen.name });
    } else {
      cookBurned(chosen.name);
      sendCommand({ cmd: 'activity', type: 'cook_burned' });
    }
    setPhase('select'); setChosen(null); setProgress(0); setResult(null);
  };

  return (
    <ActivityFrame scene="kitchen" title="Mutfak"
      sub={likes ? 'Eva pişirmeyi seviyor — keyifli iş!' : 'Eva pişirmeyi sevmiyor ama yapacak…'}
      onBack={onBack} coins={coins}
      mood={phase === 'cooking' ? (likes ? 'excited' : 'sleepy') : mood}
      accent={accent}
    >
      {phase === 'select' && (
        <>
          <Text style={styles.label}>Ne pişirelim?</Text>
          <View style={styles.grid}>
            {DISHES.map(d => (
              <TouchableOpacity key={d.id} onPress={() => { setChosen(d); setPhase('cooking'); }}
                activeOpacity={0.8} style={styles.dishCard}>
                <View style={styles.dishIcon}>
                  <ItemSprite name={d.sprite} scale={2.4} />
                </View>
                <Text style={styles.dishName}>{d.name}</Text>
                <Text style={styles.dishStats}>+{d.hunger} 🍴  {COOK_TIME_S}sn ⏱</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.moodHint, { backgroundColor: likes ? '#dff4ec' : '#ffe5d6', borderColor: likes ? '#7BD3B8' : '#FF9D7A' }]}>
            <Text style={styles.moodHintTxt}>
              <Text style={{ fontWeight: '800' }}>{likes ? '👨‍🍳 Hobi modu:' : '😒 Görev modu:'}</Text>
              {' '}{likes ? 'Pişirme sırasında mutluluk artar' : 'Pişirir ama keyif almaz'}
            </Text>
          </View>
        </>
      )}

      {phase === 'cooking' && chosen && (
        <View style={styles.cookingBox}>
          <ItemSprite name={chosen.sprite} scale={3} />
          <Text style={styles.cookingTitle}>{chosen.name} pişiyor…</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
          </View>
          <Text style={styles.cookingHint}>
            {Math.round(progress)}% · {likes ? 'şarkı söylüyor 🎵' : 'sabırsız bekliyor…'}
          </Text>
        </View>
      )}

      {phase === 'done' && chosen && (
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>{result === 'success' ? '✨' : '🔥'}</Text>
          <Text style={[styles.resultTitle, { color: result === 'success' ? '#5BB89B' : '#FF6B6B' }]}>
            {result === 'success' ? `${chosen.name} hazır!` : `${chosen.name} yandı…`}
          </Text>
          <Text style={styles.resultSub}>
            {result === 'success' ? 'Çantana eklendi. Evde acıktığında yiyebilirsin.' : 'Bu sefer olmadı. Tekrar dene.'}
          </Text>
          <BigButton primary accent={accent} onPress={finish}>Tamam</BigButton>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:      { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dishCard:   { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  dishIcon:   { width: 56, height: 56, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  dishName:   { fontSize: 12, fontWeight: '700', color: '#3a3530' },
  dishStats:  { fontSize: 9, color: '#7a6f5e', fontFamily: 'monospace' },
  moodHint:   { borderRadius: 10, padding: 10, borderWidth: 1 },
  moodHintTxt:{ fontSize: 11, color: '#3a3530' },
  cookingBox: { alignItems: 'center', gap: 14, padding: 20 },
  cookingTitle:{ fontSize: 18, fontWeight: '800', color: '#3a3530' },
  progressTrack: { width: '100%', height: 14, backgroundColor: '#eee5d4', borderRadius: 4, overflow: 'hidden', borderWidth: 1.5, borderColor: '#1d2733' },
  progressFill:  { height: '100%', borderRadius: 3 },
  cookingHint:   { fontSize: 11, color: '#7a6f5e', fontFamily: 'monospace', letterSpacing: 0.5 },
  resultBox:  { alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  resultEmoji:{ fontSize: 48 },
  resultTitle:{ fontSize: 22, fontWeight: '800' },
  resultSub:  { fontSize: 13, color: '#7a6f5e', textAlign: 'center' },
});
