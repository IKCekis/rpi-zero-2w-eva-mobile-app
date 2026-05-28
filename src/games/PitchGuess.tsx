import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { Haptics } from '../services/Haptics';
import { playTone, stopTone } from '../services/Tone';

/**
 * Pitch game: a real sine tone (synthesized via expo-av) plays the target pitch.
 * The player slides a frequency control and plays their own tone to imitate it
 * by ear, with a live waveform graph. No time limit — accuracy on confirm
 * (log-frequency closeness) drives the reward.
 */

const MIN_F = 196;   // ~G3
const MAX_F = 784;   // ~G5
const WAVE_W = 300;
const WAVE_H = 110;

type Phase = 'play' | 'result';

function freqToCycles(freq: number): number {
  // map audible freq → a pleasant number of visible cycles
  return 1 + ((freq - MIN_F) / (MAX_F - MIN_F)) * 9;
}

function sinePath(cycles: number, phase: number): string {
  const steps = 90;
  const amp = WAVE_H / 2 - 8;
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
  const [phase, setPhase] = useState<Phase>('play');
  const [target] = useState(() => Math.round(MIN_F + Math.random() * (MAX_F - MIN_F)));
  const [guess, setGuess] = useState(Math.round((MIN_F + MAX_F) / 2));
  const [wavePhase, setWavePhase] = useState(0);
  const [barW, setBarW] = useState(280);
  const barWRef = useRef(280);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sendCommand({ cmd: 'game', type: 'pitch_start' });
    sendFace('play');
    animRef.current = setInterval(() => setWavePhase(p => p + 0.3), 40);
    return () => { if (animRef.current) clearInterval(animRef.current); stopTone(); };
  }, []);

  const setFromX = (x: number) => {
    const w = barWRef.current;
    const ratio = Math.max(0, Math.min(1, x / w));
    setGuess(Math.round(MIN_F + ratio * (MAX_F - MIN_F)));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    })
  ).current;

  const onBarLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    barWRef.current = w; setBarW(w);
  };

  // Musical closeness: within an octave maps 0..1, exact = 1.
  const cents = 1200 * Math.log2(guess / target);
  const accuracy = Math.max(0, 1 - Math.abs(cents) / 1200);
  const earned = Math.round(2 + accuracy * 13);

  const confirm = () => {
    setPhase('result');
    if (Math.abs(cents) <= 80) Haptics.success(); else Haptics.error();
  };

  const collect = () => {
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'pitch_done', accuracy: Math.round(accuracy * 100), earned });
    sendFace('happy');
    onBack();
  };

  const thumbX = ((guess - MIN_F) / (MAX_F - MIN_F)) * barW;

  if (phase === 'result') {
    return (
      <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
        <Text style={styles.title}>{accuracy > 0.9 ? 'Keskin kulak!' : accuracy > 0.65 ? 'İyi!' : 'Olmadı'}</Text>
        <View style={styles.waveBox}>
          <Svg width={WAVE_W} height={WAVE_H}>
            <Path d={sinePath(freqToCycles(target), wavePhase)} stroke={accent} strokeWidth={3} fill="none" />
            <Path d={sinePath(freqToCycles(guess), wavePhase)} stroke="#FFD93D" strokeWidth={2} fill="none" opacity={0.8} />
          </Svg>
        </View>
        <Text style={styles.reveal}>Hedef: {target}Hz · Senin: {guess}Hz</Text>
        <View style={styles.listenRow}>
          <TouchableOpacity onPress={() => playTone(target)} style={[styles.listenBtn, { borderColor: accent }]}>
            <Text style={[styles.listenTxt, { color: accent }]}>🔊 Hedef</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => playTone(guess)} style={[styles.listenBtn, { borderColor: '#FFD93D' }]}>
            <Text style={[styles.listenTxt, { color: '#FFD93D' }]}>🔊 Senin</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.bigStat}>%{Math.round(accuracy * 100)}</Text>
        <Text style={styles.sub}>isabet · +{earned}¢ + XP</Text>
        <TouchableOpacity onPress={collect} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
          <Text style={styles.btnTxt}>Ödülü al</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
      <Text style={styles.title}>🎚 Frekans Taklidi</Text>
      <Text style={styles.sub}>Hedef sesi dinle, aynısını yakalamaya çalış. Süre yok!</Text>

      <View style={styles.waveBox}>
        <Svg width={WAVE_W} height={WAVE_H}>
          <Path d={sinePath(freqToCycles(guess), wavePhase)} stroke="#FFD93D" strokeWidth={3} fill="none" />
        </Svg>
      </View>

      <View style={styles.listenRow}>
        <TouchableOpacity onPress={() => playTone(target)} style={[styles.listenBtn, { borderColor: accent }]}>
          <Text style={[styles.listenTxt, { color: accent }]}>🔊 Hedefi Dinle</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => playTone(guess)} style={[styles.listenBtn, { borderColor: '#FFD93D' }]}>
          <Text style={[styles.listenTxt, { color: '#FFD93D' }]}>🔊 Sesini Çal</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.freqVal}>{guess} Hz</Text>
      {/* Frequency slider */}
      <View style={styles.barWrap} onLayout={onBarLayout} {...responder.panHandlers}>
        <View style={styles.barTrack} />
        <View style={[styles.barThumb, { left: Math.max(0, Math.min(barW - 28, thumbX - 14)), backgroundColor: '#FFD93D' }]} />
      </View>
      <Text style={styles.hint}>pes ◀───────▶ tiz</Text>

      <TouchableOpacity onPress={confirm} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Onayla</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  full:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title:     { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
  sub:       { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  waveBox:   { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 8 },
  listenRow: { flexDirection: 'row', gap: 12 },
  listenBtn: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  listenTxt: { fontSize: 13, fontWeight: '800' },
  freqVal:   { fontSize: 32, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },
  barWrap:   { width: '90%', height: 44, justifyContent: 'center' },
  barTrack:  { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  barThumb:  { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: '#fff' },
  hint:      { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' },
  reveal:    { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' },
  bigStat:   { fontSize: 52, fontWeight: '900', color: '#FFD93D' },
  btn:       { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:      { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
});
