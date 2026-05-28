import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { Haptics } from '../services/Haptics';

/**
 * Pitch / frequency guessing game. The device has no audio output here (the
 * project uses haptics, not sound), so a "tone" is conveyed as an animated
 * waveform + haptic pulses whose rate encodes the frequency. The player then
 * reproduces the frequency they perceived.
 */

const SHOW_SECONDS = 5;
const MIN_F = 1;
const MAX_F = 10;
const WAVE_W = 280;
const WAVE_H = 90;

type Phase = 'show' | 'guess' | 'result';

function sinePath(cycles: number, phase: number): string {
  const steps = 80;
  const amp = WAVE_H / 2 - 6;
  const mid = WAVE_H / 2;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * WAVE_W;
    const y = mid - amp * Math.sin((i / steps) * cycles * 2 * Math.PI + phase);
    d += (i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return d;
}

export function PitchGuess({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const [phase, setPhase]   = useState<Phase>('show');
  const [count, setCount]   = useState(SHOW_SECONDS);
  const [target]            = useState(() => MIN_F + Math.floor(Math.random() * (MAX_F - MIN_F + 1)));
  const [guess, setGuess]   = useState(Math.round((MIN_F + MAX_F) / 2));
  const [wavePhase, setWavePhase] = useState(0);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const animTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate the waveform continuously.
  useEffect(() => {
    animTimer.current = setInterval(() => setWavePhase(p => p + 0.35), 40);
    return () => { if (animTimer.current) clearInterval(animTimer.current); };
  }, []);

  // Show phase: countdown + haptic pulses at the target rate.
  useEffect(() => {
    sendCommand({ cmd: 'game', type: 'pitch_start' });
    sendFace('play');
    pulseTimer.current = setInterval(() => Haptics.tap(), Math.round(1100 / target));
    countTimer.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          if (countTimer.current) clearInterval(countTimer.current);
          if (pulseTimer.current) clearInterval(pulseTimer.current);
          setPhase('guess');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countTimer.current) clearInterval(countTimer.current);
      if (pulseTimer.current) clearInterval(pulseTimer.current);
    };
  }, []);

  const accuracy = Math.max(0, 1 - Math.abs(guess - target) / (MAX_F - MIN_F));
  const earned = Math.round(accuracy * 12);

  const adjust = (d: number) => {
    setGuess(g => Math.max(MIN_F, Math.min(MAX_F, g + d)));
    Haptics.selection();
  };

  const confirm = () => {
    setPhase('result');
    if (Math.abs(guess - target) <= 1) Haptics.success(); else Haptics.error();
  };

  const collect = () => {
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'pitch_done', accuracy: Math.round(accuracy * 100), earned });
    sendFace('happy');
    onBack();
  };

  const Wave = ({ cycles, color }: { cycles: number; color: string }) => (
    <Svg width={WAVE_W} height={WAVE_H}>
      <Path d={sinePath(cycles, wavePhase)} stroke={color} strokeWidth={3} fill="none" />
    </Svg>
  );

  if (phase === 'show') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>🎚 Frekans Tahmini</Text>
      <Text style={styles.sub}>Dalgayı izle, titreşimi hisset!</Text>
      <View style={styles.waveBox}><Wave cycles={target} color={accent} /></View>
      <Text style={styles.count}>{count}</Text>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'guess') return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>Frekans neydi?</Text>
      <Text style={styles.sub}>Hatırladığın dalgayı yeniden kur</Text>
      <View style={styles.waveBox}><Wave cycles={guess} color="#FFD93D" /></View>
      <View style={styles.stepRow}>
        <TouchableOpacity onPress={() => adjust(-1)} style={[styles.stepBtn, { backgroundColor: accent }]}>
          <Text style={styles.stepTxt}>−</Text>
        </TouchableOpacity>
        <Text style={styles.freqVal}>{guess}</Text>
        <TouchableOpacity onPress={() => adjust(1)} style={[styles.stepBtn, { backgroundColor: accent }]}>
          <Text style={styles.stepTxt}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={confirm} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Onayla</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>{accuracy > 0.92 ? 'Keskin kulak!' : accuracy > 0.7 ? 'İyi!' : 'Olmadı'}</Text>
      <View style={styles.waveBox}><Wave cycles={target} color={accent} /></View>
      <Text style={styles.revealTxt}>Doğru: {target} · Senin: {guess}</Text>
      <Text style={styles.bigStat}>%{Math.round(accuracy * 100)}</Text>
      <Text style={styles.sub}>isabet · +{earned}¢</Text>
      <TouchableOpacity onPress={collect} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Jetonları al</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  full:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title:    { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
  sub:      { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  waveBox:  { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 8 },
  count:    { fontSize: 48, fontWeight: '900', color: '#FFD93D' },
  stepRow:  { flexDirection: 'row', alignItems: 'center', gap: 24 },
  stepBtn:  { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepTxt:  { fontSize: 32, fontWeight: '900', color: '#fff' },
  freqVal:  { fontSize: 44, fontWeight: '900', color: '#fff', minWidth: 60, textAlign: 'center' },
  revealTxt:{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' },
  bigStat:  { fontSize: 56, fontWeight: '900', color: '#FFD93D' },
  btn:      { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
