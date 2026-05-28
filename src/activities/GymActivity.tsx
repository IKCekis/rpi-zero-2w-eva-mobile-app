import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { BigButton } from '../components/BigButton';

const WORKOUTS = [
  { id: 'walk',  name: 'Yürüyüş',   emoji: '🚶', reps: 10, intensity: 1 as const },
  { id: 'run',   name: 'Koşu',       emoji: '🏃', reps: 15, intensity: 2 as const },
  { id: 'hiit',  name: 'HIIT',       emoji: '🔥', reps: 20, intensity: 3 as const },
];

type Phase = 'select' | 'working' | 'done';

export function GymActivity({ onBack }: { onBack: () => void }) {
  const { coins, mood, accent = '#7BD3B8', prefs, gymDone } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const [phase, setPhase] = useState<Phase>('select');
  const [workout, setWorkout] = useState<typeof WORKOUTS[0] | null>(null);
  const [taps, setTaps] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const likes = prefs?.likesExercise ?? false;

  const start = (w: typeof WORKOUTS[0]) => {
    setWorkout(w); setTaps(0); setPhase('working');
    sendCommand({ cmd: 'activity', type: 'gym_start', workout: w.name });
    sendFace('workout');
  };

  const tap = () => {
    if (!workout) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    const next = taps + 1;
    setTaps(next);
    if (next >= workout.reps) setPhase('done');
  };

  const finish = () => {
    if (!workout) return;
    gymDone(workout.intensity, likes);  // notifies Pi (gym_done) internally
    sendFace('happy');
    setPhase('select'); setWorkout(null); setTaps(0);
  };

  const pct = workout ? Math.min((taps / workout.reps) * 100, 100) : 0;

  return (
    <ActivityFrame scene="gym" title="Spor Salonu"
      sub={likes ? 'Eva sporu seviyor — harika!' : 'Sevmez ama sağlıklı kalacak'}
      onBack={onBack} coins={coins}
      mood={phase === 'working' ? (likes ? 'excited' : 'sleepy') : mood}
      accent={accent}
    >
      {phase === 'select' && (
        <>
          <Text style={styles.label}>Antrenman seç</Text>
          <View style={styles.list}>
            {WORKOUTS.map(w => (
              <TouchableOpacity key={w.id} onPress={() => start(w)}
                activeOpacity={0.8} style={styles.row}>
                <View style={styles.rowEmoji}>
                  <Text style={{ fontSize: 22 }}>{w.emoji}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{w.name}</Text>
                  <Text style={styles.rowSub}>{w.reps} hareket · zorluk {w.intensity}/3</Text>
                </View>
                <View style={[styles.diffDot, { backgroundColor: w.intensity === 1 ? '#7BD3B8' : w.intensity === 2 ? '#FFD93D' : '#FF6B6B' }]} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.hint, { backgroundColor: likes ? '#dff4ec' : '#ffe5d6', borderColor: likes ? '#7BD3B8' : '#FF9D7A' }]}>
            <Text style={styles.hintTxt}>
              <Text style={{ fontWeight: '800' }}>{likes ? '💪 Hobi modu:' : '😮‍💨 Görev modu:'}</Text>
              {' '}{likes ? 'Spor yaparken mutluluk ve enerji artar' : 'Sağlık artar ama enerji düşer'}
            </Text>
          </View>
        </>
      )}

      {phase === 'working' && workout && (
        <View style={styles.workBox}>
          <Animated.Text style={[styles.workEmoji, { transform: [{ translateX: shakeAnim }] }]}>
            {workout.emoji}
          </Animated.Text>
          <Text style={styles.workTitle}>{workout.name}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accent }]} />
          </View>
          <Text style={styles.tapHint}>{taps} / {workout.reps}</Text>
          <TouchableOpacity onPress={tap} activeOpacity={0.7}
            style={[styles.tapBtn, { backgroundColor: accent }]}>
            <Text style={styles.tapBtnTxt}>TAP!</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'done' && workout && (
        <View style={styles.resultBox}>
          <Text style={{ fontSize: 36, marginBottom: 4 }}>{likes ? '🏆' : '😮‍💨'}</Text>
          <Text style={styles.resultTitle}>{likes ? 'Harika antrenman!' : 'Bitti… sonunda!'}</Text>
          <Text style={styles.resultSub}>
            Sağlık +{workout.intensity * 8} · Enerji {likes ? `+${workout.intensity * 4}` : `−${workout.intensity * 5}`}
            {likes ? ' · Mutluluk +6' : ''}
          </Text>
          <BigButton primary accent={accent} onPress={finish}>Çık</BigButton>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:       { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  list:        { gap: 8, marginBottom: 12 },
  row:         { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  rowEmoji:    { width: 44, height: 44, borderRadius: 10, backgroundColor: '#eee5d4', alignItems: 'center', justifyContent: 'center' },
  rowInfo:     { flex: 1 },
  rowName:     { fontSize: 14, fontWeight: '800', color: '#3a3530' },
  rowSub:      { fontSize: 10, color: '#7a6f5e', fontFamily: 'monospace' },
  diffDot:     { width: 10, height: 10, borderRadius: 5 },
  hint:        { borderRadius: 10, padding: 10, borderWidth: 1 },
  hintTxt:     { fontSize: 11, color: '#3a3530' },
  workBox:     { alignItems: 'center', gap: 14, padding: 20 },
  workEmoji:   { fontSize: 64 },
  workTitle:   { fontSize: 18, fontWeight: '800', color: '#3a3530' },
  progressTrack: { width: '100%', height: 14, backgroundColor: '#eee5d4', borderRadius: 4, overflow: 'hidden', borderWidth: 1.5, borderColor: '#1d2733' },
  progressFill:  { height: '100%', borderRadius: 3 },
  tapHint:     { fontSize: 12, color: '#7a6f5e', fontFamily: 'monospace' },
  tapBtn:      { paddingHorizontal: 40, paddingVertical: 18, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  tapBtnTxt:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  resultBox:   { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#3a3530' },
  resultSub:   { fontSize: 12, color: '#7a6f5e', marginBottom: 6, textAlign: 'center' },
});
