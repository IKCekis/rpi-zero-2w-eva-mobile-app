import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';

const { width: W } = Dimensions.get('window');
const GAME_H = 500;
const DURATION_S = 25;
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

type BType = 'green' | 'blue' | 'gold' | 'bomb';
type Balloon = { id: number; x: number; y: number; type: BType; size: number };

const TYPE_CONFIG: Record<BType, { emoji: string; pts: number; color: string }> = {
  green: { emoji: '🟢', pts: 1,  color: '#4CAF50' },
  blue:  { emoji: '🔵', pts: 2,  color: '#2196F3' },
  gold:  { emoji: '🟡', pts: 3,  color: '#FFD93D' },
  bomb:  { emoji: '💣', pts: -2, color: '#FF6B6B' },
};

let _id = 0;

export function BalonPatla({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand } = useBLE();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_S);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const scoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawnBalloon = () => {
    const r = Math.random();
    const type: BType = r < 0.05 ? 'bomb' : r < 0.15 ? 'gold' : r < 0.4 ? 'blue' : 'green';
    setBalloons(prev => [...prev, {
      id: ++_id,
      x: rand(10, W - 70),
      y: GAME_H + 20,
      type,
      size: rand(36, 52),
    }]);
  };

  const start = () => {
    setPhase('playing'); setScore(0); scoreRef.current = 0;
    setTimeLeft(DURATION_S); setBalloons([]);
    spawnRef.current = setInterval(spawnBalloon, 600);
    frameRef.current = setInterval(() => {
      setBalloons(prev => prev
        .map(b => ({ ...b, y: b.y - 2.5 }))
        .filter(b => b.y > -60));
    }, 40);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const endGame = () => {
    clearInterval(spawnRef.current!);
    clearInterval(frameRef.current!);
    clearInterval(timerRef.current!);
    setPhase('done');
    setBalloons([]);
  };

  useEffect(() => () => {
    clearInterval(spawnRef.current!);
    clearInterval(frameRef.current!);
    clearInterval(timerRef.current!);
  }, []);

  const pop = (id: number, type: BType) => {
    setBalloons(prev => prev.filter(b => b.id !== id));
    scoreRef.current = Math.max(0, scoreRef.current + TYPE_CONFIG[type].pts);
    setScore(scoreRef.current);
  };

  const collect = () => {
    const earned = scoreRef.current * 3;
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'balon_done', score: scoreRef.current, earned });
    onBack();
  };

  if (phase === 'ready') return (
    <View style={styles.overlay}>
      <Text style={styles.title}>🎈 Balon Patla</Text>
      <Text style={styles.sub}>Balonları patlat, bombalardan kaçın!</Text>
      <Text style={styles.rules}>
        🟢 +1  🔵 +2  🟡 +3  💣 −2{'\n'}
        Süre: {DURATION_S}sn  ·  Puan × 3 = jeton
      </Text>
      <TouchableOpacity onPress={start} style={[styles.btn, { backgroundColor: accent }]} activeOpacity={0.8}>
        <Text style={styles.btnTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'done') return (
    <View style={styles.overlay}>
      <Text style={styles.title}>Bitti!</Text>
      <Text style={styles.bigScore}>{score}</Text>
      <Text style={styles.sub}>puan → {score * 3} jeton kazandın</Text>
      <TouchableOpacity onPress={collect} style={[styles.btn, { backgroundColor: accent }]} activeOpacity={0.8}>
        <Text style={styles.btnTxt}>Al ve çık</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.arena}>
      <View style={styles.hud}>
        <Text style={styles.hudTxt}>🎈 {score}</Text>
        <Text style={styles.hudTxt}>{timeLeft}s</Text>
      </View>
      {balloons.map(b => (
        <TouchableOpacity key={b.id}
          onPress={() => pop(b.id, b.type)}
          style={[styles.balloon, { left: b.x, top: b.y, width: b.size, height: b.size }]}>
          <Text style={{ fontSize: b.size * 0.72 }}>{TYPE_CONFIG[b.type].emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: '#1d2733', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title:     { fontSize: 28, fontWeight: '900', color: '#fff' },
  bigScore:  { fontSize: 72, fontWeight: '900', color: '#FFD93D' },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  rules:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontFamily: 'monospace', lineHeight: 22 },
  btn:       { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:      { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  arena:     { flex: 1, backgroundColor: '#1d2733', position: 'relative' },
  hud:       { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  hudTxt:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  balloon:   { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
