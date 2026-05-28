import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { Haptics } from '../services/Haptics';

/**
 * Color game: match a target color using an HSV picker (hue / saturation /
 * brightness bars). No time limit — accuracy on confirm (RGB closeness) drives
 * the reward.
 */

type RGB = { r: number; g: number; b: number };
type Phase = 'pick' | 'result';

const MAX_DIST = Math.sqrt(3 * 255 ** 2);

function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
const css = (c: RGB) => `rgb(${c.r}, ${c.g}, ${c.b})`;
const dist = (a: RGB, b: RGB) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

function GradientBar({ stops, ratio, onChange }: {
  stops: { offset: number; color: string }[];
  ratio: number;
  onChange: (r: number) => void;
}) {
  const [w, setW] = useState(280);
  const wRef = useRef(280);
  const idRef = useRef('grad' + Math.random().toString(36).slice(2, 8));
  const set = (x: number) => { onChange(Math.max(0, Math.min(1, x / wRef.current))); };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { Haptics.selection(); set(e.nativeEvent.locationX); },
      onPanResponderMove:  (e) => set(e.nativeEvent.locationX),
    })
  ).current;
  const onLayout = (e: LayoutChangeEvent) => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); };
  return (
    <View style={styles.bar} onLayout={onLayout} {...pan.panHandlers}>
      <Svg width={w} height={30}>
        <Defs>
          <LinearGradient id={idRef.current} x1="0" y1="0" x2="1" y2="0">
            {stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} />)}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={30} rx={8} fill={`url(#${idRef.current})`} />
      </Svg>
      <View style={[styles.thumb, { left: Math.max(0, Math.min(w - 24, ratio * w - 12)) }]} />
    </View>
  );
}

export function ColorMatch({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const [phase, setPhase] = useState<Phase>('pick');
  const [target] = useState<RGB>(() => hsvToRgb(
    Math.random() * 360,
    0.5 + Math.random() * 0.5,
    0.55 + Math.random() * 0.45,
  ));
  const [h, setH] = useState(180);
  const [s, setS] = useState(0.5);
  const [v, setV] = useState(0.7);

  React.useEffect(() => {
    sendCommand({ cmd: 'game', type: 'colormatch_start' });
    sendFace('play');
  }, []);

  const current = hsvToRgb(h, s, v);
  const accuracy = Math.max(0, 1 - dist(current, target) / MAX_DIST);
  const earned = Math.round(2 + accuracy * 13);

  const hueStops = [0, 1, 2, 3, 4, 5, 6].map(i => ({ offset: i / 6, color: css(hsvToRgb((i * 60) % 360, 1, 1)) }));
  const satStops = [{ offset: 0, color: css(hsvToRgb(h, 0, v)) }, { offset: 1, color: css(hsvToRgb(h, 1, v)) }];
  const valStops = [{ offset: 0, color: css(hsvToRgb(h, s, 0)) }, { offset: 1, color: css(hsvToRgb(h, s, 1)) }];

  const confirm = () => {
    setPhase('result');
    if (accuracy > 0.9) Haptics.success(); else Haptics.error();
  };

  const collect = () => {
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'colormatch_done', accuracy: Math.round(accuracy * 100), earned });
    sendFace('happy');
    onBack();
  };

  if (phase === 'result') {
    return (
      <View style={[styles.full, { backgroundColor: '#1d2733' }]}>
        <Text style={styles.title}>{accuracy > 0.92 ? 'Mükemmel göz!' : accuracy > 0.75 ? 'Çok iyi!' : 'İdare eder'}</Text>
        <View style={styles.compareRow}>
          <View style={styles.compareCol}>
            <View style={[styles.compareSwatch, { backgroundColor: css(target) }]} />
            <Text style={styles.compareLbl}>Hedef</Text>
          </View>
          <View style={styles.compareCol}>
            <View style={[styles.compareSwatch, { backgroundColor: css(current) }]} />
            <Text style={styles.compareLbl}>Senin</Text>
          </View>
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
      <Text style={styles.title}>🎨 Renk Tutturma</Text>
      <Text style={styles.sub}>Sürgülerle hedef renge en yakınını yakala. Süre yok!</Text>

      <View style={styles.compareRow}>
        <View style={styles.compareCol}>
          <View style={[styles.compareSwatch, { backgroundColor: css(target) }]} />
          <Text style={styles.compareLbl}>Hedef</Text>
        </View>
        <View style={styles.compareCol}>
          <View style={[styles.compareSwatch, { backgroundColor: css(current), borderColor: accent }]} />
          <Text style={styles.compareLbl}>Senin</Text>
        </View>
      </View>

      <View style={styles.pickers}>
        <Text style={styles.pickLbl}>Renk tonu</Text>
        <GradientBar stops={hueStops} ratio={h / 360} onChange={r => setH(r * 360)} />
        <Text style={styles.pickLbl}>Canlılık</Text>
        <GradientBar stops={satStops} ratio={s} onChange={setS} />
        <Text style={styles.pickLbl}>Parlaklık</Text>
        <GradientBar stops={valStops} ratio={v} onChange={setV} />
      </View>

      <TouchableOpacity onPress={confirm} activeOpacity={0.8} style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnTxt}>Onayla</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  full:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title:       { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
  sub:         { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  compareRow:  { flexDirection: 'row', gap: 24 },
  compareCol:  { alignItems: 'center', gap: 6 },
  compareSwatch:{ width: 96, height: 96, borderRadius: 18, borderWidth: 3, borderColor: '#fff' },
  compareLbl:  { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  pickers:     { width: '100%', gap: 6 },
  pickLbl:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  bar:         { width: '100%', height: 30, justifyContent: 'center', marginBottom: 6 },
  thumb:       { position: 'absolute', top: 1, width: 24, height: 28, borderRadius: 7, borderWidth: 3, borderColor: '#fff', backgroundColor: 'transparent' },
  bigStat:     { fontSize: 52, fontWeight: '900', color: '#FFD93D' },
  btn:         { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:      { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:        { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
});
