import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { Haptics } from '../services/Haptics';

const SHOW_SECONDS = 5;

type RGB = { r: number; g: number; b: number };
type Phase = 'show' | 'guess' | 'result';

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const clamp255 = (n: number) => Math.max(0, Math.min(255, n));
const css = (c: RGB) => `rgb(${c.r}, ${c.g}, ${c.b})`;
const dist = (a: RGB, b: RGB) =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
const MAX_DIST = Math.sqrt(3 * 255 ** 2);

function buildOptions(target: RGB): RGB[] {
  const opts: RGB[] = [target];
  while (opts.length < 8) {
    const jitter = (): number => {
      const sign = Math.random() < 0.5 ? -1 : 1;
      return sign * rand(25, 80);
    };
    const cand: RGB = {
      r: clamp255(target.r + jitter()),
      g: clamp255(target.g + jitter()),
      b: clamp255(target.b + jitter()),
    };
    if (opts.every(o => dist(o, cand) > 18)) opts.push(cand);
  }
  // shuffle
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

export function ColorMatch({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const [phase, setPhase]     = useState<Phase>('show');
  const [count, setCount]     = useState(SHOW_SECONDS);
  const [target]              = useState<RGB>(() => ({ r: rand(30, 225), g: rand(30, 225), b: rand(30, 225) }));
  const [options]             = useState<RGB[]>(() => []);
  const optsRef               = useRef<RGB[]>([]);
  const [picked, setPicked]   = useState<RGB | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  if (optsRef.current.length === 0) optsRef.current = buildOptions(target);

  useEffect(() => {
    sendCommand({ cmd: 'game', type: 'colormatch_start' });
    sendFace('play');
    timer.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          if (timer.current) clearInterval(timer.current);
          setPhase('guess');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const accuracy = picked ? Math.max(0, 1 - dist(picked, target) / MAX_DIST) : 0;
  const earned = Math.round(accuracy * 12);

  const pick = (c: RGB) => {
    setPicked(c);
    setPhase('result');
    if (dist(c, target) < 40) Haptics.success(); else Haptics.error();
  };

  const collect = () => {
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'colormatch_done', accuracy: Math.round(accuracy * 100), earned });
    sendFace('happy');
    onBack();
  };

  if (phase === 'show') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>🎨 Renk Tahmini</Text>
      <Text style={styles.sub}>Bu rengi aklında tut!</Text>
      <View style={[styles.bigSwatch, { backgroundColor: css(target) }]} />
      <Text style={styles.count}>{count}</Text>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'guess') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>Hangisiydi?</Text>
      <Text style={styles.sub}>En yakın olduğunu düşündüğünü seç</Text>
      <View style={styles.optGrid}>
        {optsRef.current.map((c, i) => (
          <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => pick(c)}
            style={[styles.optSwatch, { backgroundColor: css(c) }]} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>{accuracy > 0.92 ? 'Mükemmel göz!' : accuracy > 0.75 ? 'Çok iyi!' : 'İdare eder'}</Text>
      <View style={styles.compareRow}>
        <View style={styles.compareCol}>
          <View style={[styles.compareSwatch, { backgroundColor: css(target) }]} />
          <Text style={styles.compareLbl}>Doğru</Text>
        </View>
        <View style={styles.compareCol}>
          <View style={[styles.compareSwatch, { backgroundColor: picked ? css(picked) : '#000' }]} />
          <Text style={styles.compareLbl}>Senin</Text>
        </View>
      </View>
      <Text style={styles.bigStat}>%{Math.round(accuracy * 100)}</Text>
      <Text style={styles.sub}>isabet · +{earned}¢</Text>
      <TouchableOpacity onPress={collect} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Jetonları al</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  full:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title:       { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
  sub:         { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  bigSwatch:   { width: 180, height: 180, borderRadius: 24, borderWidth: 3, borderColor: '#fff' },
  count:       { fontSize: 48, fontWeight: '900', color: '#FFD93D' },
  optGrid:     { width: 280, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  optSwatch:   { width: 80, height: 80, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  compareRow:  { flexDirection: 'row', gap: 24 },
  compareCol:  { alignItems: 'center', gap: 6 },
  compareSwatch:{ width: 90, height: 90, borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
  compareLbl:  { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  bigStat:     { fontSize: 56, fontWeight: '900', color: '#FFD93D' },
  btn:         { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:      { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:        { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
