import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Animated,
} from 'react-native';
import { EvaSprite } from '../sprite/EvaSprite';

interface Props {
  visible: boolean;
  onClose: (completed: boolean) => void;
}

const TOTAL_MS = 5000;
const TICK_MS  = 50;

export function RestGame({ visible, onClose }: Props) {
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(false);
  const [pressing, setPressing] = useState(false);
  const progressRef             = useRef(0);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef                 = useRef(false);

  // 3 floating ZZZ animations
  const zzz = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);
  const zLoops = useRef<Animated.CompositeAnimation[]>([]);

  const startZzz = useCallback(() => {
    zLoops.current.forEach(l => l.stop());
    zLoops.current = zzz.current.map((anim, i) => {
      anim.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(i * 300),
          Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
    });
    zLoops.current.forEach(l => l.start());
  }, []);

  const stopZzz = useCallback(() => {
    zLoops.current.forEach(l => l.stop());
  }, []);

  const reset = useCallback(() => {
    progressRef.current = 0;
    doneRef.current = false;
    setProgress(0);
    setDone(false);
    setPressing(false);
    stopZzz();
  }, [stopZzz]);

  const startFill = useCallback(() => {
    if (doneRef.current) return;
    setPressing(true);
    startZzz();
    intervalRef.current = setInterval(() => {
      progressRef.current = Math.min(1, progressRef.current + TICK_MS / TOTAL_MS);
      setProgress(progressRef.current);
      if (progressRef.current >= 1) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        doneRef.current = true;
        setDone(true);
        stopZzz();
        setTimeout(() => onClose(true), 1400);
      }
    }, TICK_MS);
  }, [startZzz, stopZzz, onClose]);

  const stopFill = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPressing(false);
    stopZzz();
  }, [stopZzz]);

  useEffect(() => {
    if (!visible) { stopFill(); reset(); }
  }, [visible]);

  const pct = Math.round(progress * 100);

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={reset}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {done ? 'Enerji doldu! ⚡' : 'Dinlenme zamanı 😴'}
          </Text>
          <Text style={styles.sub}>
            {done ? '+25 Enerji kazandı' : 'Yastığa basılı tut, uyusun'}
          </Text>

          {/* Eva + ZZZ */}
          <View style={styles.evaArea}>
            <EvaSprite mood={done ? 'excited' : pressing ? 'sleepy' : 'neutral'} scale={3.5} />
            {zzz.current.map((anim, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.zText,
                  {
                    fontSize: 16 + i * 6,
                    left: 100 + i * 22,
                    opacity: anim,
                    transform: [
                      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -55] }) },
                      { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, i % 2 === 0 ? 10 : -10] }) },
                    ],
                  },
                ]}
              >
                Z
              </Animated.Text>
            ))}
          </View>

          {/* Progress bar */}
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pctTxt}>{done ? 'Dinlendi! 💤' : `${pct}%`}</Text>

          {!done && (
            <Pressable
              onPressIn={startFill}
              onPressOut={stopFill}
              style={({ pressed }) => [styles.tapBtn, pressed && styles.tapBtnActive]}
            >
              <Text style={styles.tapEmoji}>🌙</Text>
              <Text style={styles.tapTxt}>Basılı tut</Text>
            </Pressable>
          )}

          {!done && (
            <TouchableOpacity onPress={() => { stopFill(); onClose(false); }} style={styles.cancel}>
              <Text style={styles.cancelTxt}>Uykusu yok</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(10,10,30,0.6)', justifyContent: 'flex-end' },
  sheet:       {
    backgroundColor: '#1a1f3a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, alignItems: 'center', gap: 12,
  },
  title:       { fontSize: 22, fontWeight: '800', color: '#e8e0ff' },
  sub:         { fontSize: 13, color: '#8880aa', textAlign: 'center' },
  evaArea:     { height: 130, width: 200, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  zText:       { position: 'absolute', bottom: 20, fontWeight: '900', color: '#a090ff' },
  barBg:       { width: '100%', height: 16, backgroundColor: '#2a2f5a', borderRadius: 8, overflow: 'hidden' },
  barFill:     { height: '100%', backgroundColor: '#a090ff', borderRadius: 8 },
  pctTxt:      { fontSize: 14, fontWeight: '700', color: '#c0b8ff' },
  tapBtn:      {
    marginTop: 8, width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#6254cc', alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: '#6254cc', shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  tapBtnActive:{ backgroundColor: '#4a3faa', transform: [{ scale: 0.96 }] },
  tapEmoji:    { fontSize: 36 },
  tapTxt:      { fontSize: 12, fontWeight: '700', color: '#e8e0ff' },
  cancel:      { marginTop: 4 },
  cancelTxt:   { fontSize: 13, color: '#6060aa' },
});
