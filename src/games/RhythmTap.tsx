import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { Haptics } from '../services/Haptics';

const BEATS = 8;
const SWEEP_MS = 1200;     // time for the bar to cross once
const ZONE_START = 68;     // green target zone (percent)
const ZONE_END = 90;

type Phase = 'ready' | 'playing' | 'summary';

export function RhythmTap({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const [phase, setPhase] = useState<Phase>('ready');
  const [pos, setPos]     = useState(0);     // 0..100 sweep position
  const [beat, setBeat]   = useState(0);
  const [hits, setHits]   = useState(0);
  const startRef = useRef(0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);
  const lockRef = useRef(false);             // one tap per sweep

  useEffect(() => () => { if (raf.current) clearInterval(raf.current); }, []);

  const start = () => {
    setPhase('playing'); setHits(0); setBeat(0);
    beatRef.current = 0; lockRef.current = false;
    sendCommand({ cmd: 'game', type: 'rhythm_start' });
    sendFace('dance');
    startRef.current = Date.now();
    raf.current = setInterval(() => {
      const e = Date.now() - startRef.current;
      const cyclePos = (e % SWEEP_MS) / SWEEP_MS * 100;
      setPos(cyclePos);
      const b = Math.floor(e / SWEEP_MS);
      if (b !== beatRef.current) {
        beatRef.current = b;
        lockRef.current = false;
        setBeat(b);
        if (b >= BEATS) finish();
      }
    }, 16);
  };

  const finish = () => {
    if (raf.current) { clearInterval(raf.current); raf.current = null; }
    setPhase('summary');
  };

  const tap = () => {
    if (phase !== 'playing' || lockRef.current) return;
    lockRef.current = true;
    if (pos >= ZONE_START && pos <= ZONE_END) {
      setHits(h => h + 1);
      Haptics.success();
    } else {
      Haptics.error();
    }
  };

  const collect = () => {
    const earned = hits * 2;              // 2 coins per clean hit
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'rhythm_done', hits, earned });
    sendFace('happy');
    onBack();
  };

  if (phase === 'ready') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>🎵 Ritim</Text>
      <Text style={styles.sub}>Çizgi yeşil bölgedeyken dokun!</Text>
      <Text style={styles.rules}>{BEATS} vuruş · her isabet 1 jeton</Text>
      <TouchableOpacity onPress={start} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'summary') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>Bitti!</Text>
      <Text style={styles.bigStat}>{hits}<Text style={{ fontSize: 20 }}>/{BEATS}</Text></Text>
      <Text style={styles.sub}>isabet</Text>
      <TouchableOpacity onPress={collect} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Jetonları al</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <TouchableOpacity activeOpacity={1} onPress={tap} style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.roundTxt}>{Math.min(beat + 1, BEATS)} / {BEATS}  ·  isabet {hits}</Text>
      <View style={styles.track}>
        <View style={[styles.zone, { left: `${ZONE_START}%`, width: `${ZONE_END - ZONE_START}%` }]} />
        <View style={[styles.cursor, { left: `${pos}%`, backgroundColor: accent }]} />
      </View>
      <Text style={styles.tapHint}>DOKUN</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  full:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  title:    { fontSize: 28, fontWeight: '900', color: '#fff' },
  bigStat:  { fontSize: 72, fontWeight: '900', color: '#FFD93D' },
  sub:      { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  rules:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontFamily: 'monospace', lineHeight: 20 },
  roundTxt: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' },
  track:    { width: '100%', height: 46, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, position: 'relative', overflow: 'hidden' },
  zone:     { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#7BD3B855' },
  cursor:   { position: 'absolute', top: 4, bottom: 4, width: 6, borderRadius: 3 },
  tapHint:  { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 4 },
  btn:      { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
