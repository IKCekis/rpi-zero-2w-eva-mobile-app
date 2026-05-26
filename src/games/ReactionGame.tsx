import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';

const ROUNDS = 5;
const WAIT_MIN = 1200;
const WAIT_MAX = 3500;

type Phase = 'ready' | 'waiting' | 'go' | 'tapped' | 'miss' | 'summary';

export function ReactionGame({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand } = useBLE();
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRound = (r: number) => {
    setRound(r);
    setPhase('waiting');
    const delay = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
    timer.current = setTimeout(() => {
      goAt.current = Date.now();
      setPhase('go');
    }, delay);
  };

  useEffect(() => () => { clearTimeout(timer.current!); }, []);

  const tap = () => {
    if (phase === 'waiting') {
      clearTimeout(timer.current!);
      setPhase('miss');
      setTimeout(() => nextRound(), 1200);
      return;
    }
    if (phase === 'go') {
      const rt = Date.now() - goAt.current;
      setTimes(t => [...t, rt]);
      setPhase('tapped');
      setTimeout(() => nextRound(), 900);
    }
  };

  const nextRound = () => {
    const next = round + 1;
    if (next >= ROUNDS) { setPhase('summary'); return; }
    startRound(next);
  };

  const collect = () => {
    const avg = times.length ? times.reduce((s, t) => s + t, 0) / times.length : 9999;
    const earned = avg < 300 ? 12 : avg < 500 ? 8 : avg < 800 ? 5 : 3;
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'reaction_done', avgMs: Math.round(avg), earned });
    onBack();
  };

  const avgMs = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;

  const bgColor = phase === 'go' ? '#4CAF50' : phase === 'miss' ? '#FF6B6B' : phase === 'tapped' ? '#FFD93D' : '#1d2733';

  if (phase === 'ready') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>🟢 Reaksiyon</Text>
      <Text style={styles.sub}>Ekran yeşil olduğunda dokun!</Text>
      <Text style={styles.rules}>{ROUNDS} tur  ·  Erken dokunma = kaçırma!{'\n'}Ortalama hıza göre 3–12 jeton</Text>
      <TouchableOpacity onPress={() => startRound(0)} activeOpacity={0.8}
        style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'summary') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>Bitti!</Text>
      {avgMs !== null && <Text style={styles.bigStat}>{avgMs}<Text style={{ fontSize: 20 }}>ms</Text></Text>}
      <Text style={styles.sub}>ortalama tepki süresi</Text>
      <TouchableOpacity onPress={collect} activeOpacity={0.8}
        style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Jetonları al</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <TouchableOpacity activeOpacity={1} onPress={tap}
      style={[styles.full, { backgroundColor: bgColor }]}>
      <Text style={styles.roundTxt}>{round + 1} / {ROUNDS}</Text>
      <Text style={styles.bigMsg}>
        {phase === 'waiting' ? '…bekle…' :
         phase === 'go' ? 'ŞİMDİ!' :
         phase === 'tapped' ? `${times[times.length - 1]}ms ✓` :
         'ERKEN!'}
      </Text>
      <Text style={styles.tapHint}>{phase === 'waiting' ? 'hazır ol' : 'dokun'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  full:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title:    { fontSize: 28, fontWeight: '900', color: '#fff' },
  bigStat:  { fontSize: 72, fontWeight: '900', color: '#FFD93D' },
  bigMsg:   { fontSize: 44, fontWeight: '900', color: '#fff', textAlign: 'center' },
  roundTxt: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' },
  sub:      { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  rules:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontFamily: 'monospace', lineHeight: 20 },
  tapHint:  { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  btn:      { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
