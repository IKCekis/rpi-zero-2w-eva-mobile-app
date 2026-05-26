import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';

const { width: W, height: H } = Dimensions.get('window');
const GAME_H = 420;
const DURATION_S = 20;

type Obj = { id: number; x: number; y: number; type: 'star' | 'rock'; size: number };

let _id = 0;
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export function StarsGame({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand } = useBLE();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_S);
  const [objs, setObjs] = useState<Obj[]>([]);
  const scoreRef = useRef(0);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawn = () => {
    const type = Math.random() < 0.7 ? 'star' : 'rock';
    setObjs(prev => [...prev, {
      id: ++_id,
      x: rand(20, W - 60),
      y: -30,
      type,
      size: type === 'star' ? rand(28, 38) : rand(24, 32),
    }]);
  };

  const startGame = () => {
    setPhase('playing'); setScore(0); scoreRef.current = 0;
    setTimeLeft(DURATION_S); setObjs([]);
    spawnRef.current = setInterval(spawn, 700);
    frameRef.current = setInterval(() => {
      setObjs(prev => prev
        .map(o => ({ ...o, y: o.y + 3.5 }))
        .filter(o => o.y < GAME_H + 40));
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
    setObjs([]);
  };

  useEffect(() => () => {
    clearInterval(spawnRef.current!);
    clearInterval(frameRef.current!);
    clearInterval(timerRef.current!);
  }, []);

  const tap = (id: number, type: 'star' | 'rock') => {
    setObjs(prev => prev.filter(o => o.id !== id));
    if (type === 'star') {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 2);
      setScore(scoreRef.current);
    }
  };

  const collect = () => {
    const earned = scoreRef.current * 2;
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'stars_done', score: scoreRef.current, earned });
    onBack();
  };

  if (phase === 'ready') return (
    <View style={styles.overlay}>
      <Text style={styles.title}>⭐ Yıldız Avı</Text>
      <Text style={styles.sub}>Yıldızlara dokun, kayaları kaçır!</Text>
      <Text style={styles.rules}>⭐ Yıldız = +1  |  🪨 Kaya = −2{'\n'}Süre: {DURATION_S} saniye  ·  Puan × 2 = jeton</Text>
      <TouchableOpacity onPress={startGame} activeOpacity={0.8}
        style={[styles.startBtn, { backgroundColor: accent }]}>
        <Text style={styles.startTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'done') return (
    <View style={styles.overlay}>
      <Text style={styles.title}>Bitti!</Text>
      <Text style={styles.bigScore}>{score}</Text>
      <Text style={styles.sub}>puan → {score * 2} jeton kazandın</Text>
      <TouchableOpacity onPress={collect} activeOpacity={0.8}
        style={[styles.startBtn, { backgroundColor: accent }]}>
        <Text style={styles.startTxt}>Al ve çık</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.arena}>
      <View style={styles.hud}>
        <Text style={styles.hudTxt}>⭐ {score}</Text>
        <Text style={styles.hudTxt}>{timeLeft}s</Text>
      </View>
      {objs.map(o => (
        <TouchableOpacity key={o.id}
          onPress={() => tap(o.id, o.type)}
          style={[styles.obj, { left: o.x, top: o.y, width: o.size, height: o.size }]}>
          <Text style={{ fontSize: o.size * 0.75 }}>{o.type === 'star' ? '⭐' : '🪨'}</Text>
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
  rules:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontFamily: 'monospace', lineHeight: 20 },
  startBtn:  { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  startTxt:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:      { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  arena:     { flex: 1, backgroundColor: '#1d2733', position: 'relative' },
  hud:       { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  hudTxt:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  obj:       { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
