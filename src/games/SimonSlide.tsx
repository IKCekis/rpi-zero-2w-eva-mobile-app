import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { Haptics } from '../services/Haptics';

const PADS = [
  { id: 0, color: '#FF6B6B' },
  { id: 1, color: '#FFD93D' },
  { id: 2, color: '#5C8EE8' },
  { id: 3, color: '#7BD3B8' },
];

type Phase = 'ready' | 'showing' | 'input' | 'summary';

export function SimonSlide({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const [phase, setPhase]   = useState<Phase>('ready');
  const [seq, setSeq]       = useState<number[]>([]);
  const [step, setStep]     = useState(0);     // input progress
  const [lit, setLit]       = useState<number | null>(null);
  const [round, setRound]   = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const playSequence = (full: number[]) => {
    setPhase('showing');
    setLit(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    full.forEach((pad, i) => {
      timers.current.push(setTimeout(() => { setLit(pad); Haptics.selection(); }, 600 * i + 300));
      timers.current.push(setTimeout(() => setLit(null), 600 * i + 650));
    });
    timers.current.push(setTimeout(() => { setPhase('input'); setStep(0); }, 600 * full.length + 400));
  };

  const start = () => {
    const first = [Math.floor(Math.random() * 4)];
    setSeq(first); setRound(1);
    sendCommand({ cmd: 'game', type: 'simon_start' });
    sendFace('play');
    playSequence(first);
  };

  const nextRound = () => {
    const next = [...seq, Math.floor(Math.random() * 4)];
    setSeq(next); setRound(next.length);
    playSequence(next);
  };

  const press = (pad: number) => {
    if (phase !== 'input') return;
    setLit(pad);
    timers.current.push(setTimeout(() => setLit(null), 150));
    if (pad === seq[step]) {
      const ns = step + 1;
      if (ns >= seq.length) { Haptics.success(); timers.current.push(setTimeout(nextRound, 500)); }
      else setStep(ns);
    } else {
      Haptics.error();
      finish();
    }
  };

  const finish = () => {
    timers.current.forEach(clearTimeout);
    setPhase('summary');
  };

  const collect = () => {
    const earned = Math.max(0, seq.length - 1) * 2;   // 2 coins per completed round
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'simon_done', rounds: seq.length - 1, earned });
    sendFace('happy');
    onBack();
  };

  if (phase === 'ready') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>🟦 Simon</Text>
      <Text style={styles.sub}>Sırayı izle, aynısını tekrarla!</Text>
      <Text style={styles.rules}>Her tur bir renk uzar · tur başına 2 jeton</Text>
      <TouchableOpacity onPress={start} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'summary') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>Bitti!</Text>
      <Text style={styles.bigStat}>{Math.max(0, seq.length - 1)}</Text>
      <Text style={styles.sub}>tamamlanan tur</Text>
      <TouchableOpacity onPress={collect} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Jetonları al</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.roundTxt}>Tur {round}</Text>
      <Text style={styles.status}>{phase === 'showing' ? 'İZLE…' : 'TEKRARLA'}</Text>
      <View style={styles.padGrid}>
        {PADS.map(p => (
          <TouchableOpacity key={p.id} activeOpacity={0.7}
            disabled={phase !== 'input'}
            onPress={() => press(p.id)}
            style={[styles.pad, { backgroundColor: p.color, opacity: lit === p.id ? 1 : 0.35 }]} />
        ))}
      </View>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  full:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  title:    { fontSize: 28, fontWeight: '900', color: '#fff' },
  bigStat:  { fontSize: 72, fontWeight: '900', color: '#FFD93D' },
  sub:      { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  rules:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontFamily: 'monospace', lineHeight: 20 },
  roundTxt: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' },
  status:   { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  padGrid:  { width: 260, height: 260, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  pad:      { width: 120, height: 120, borderRadius: 18 },
  btn:      { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
