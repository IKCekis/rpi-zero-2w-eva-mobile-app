import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Animated,
} from 'react-native';
import { EvaSprite } from '../sprite/EvaSprite';

interface Props {
  visible: boolean;
  onClose: (completed: boolean) => void;
}

const TOTAL_MS = 4000;
const TICK_MS  = 50;

export function WashGame({ visible, onClose }: Props) {
  const [progress, setProgress]   = useState(0);
  const [done, setDone]           = useState(false);
  const [pressing, setPressing]   = useState(false);
  const progressRef               = useRef(0);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef                   = useRef(false);

  // bubble animations — 3 floating drops
  const bubbles = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);
  const bubbleLoops = useRef<Animated.CompositeAnimation[]>([]);

  const startBubbles = useCallback(() => {
    bubbleLoops.current.forEach(l => l.stop());
    bubbleLoops.current = bubbles.current.map((anim, i) => {
      anim.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(i * 250),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
    });
    bubbleLoops.current.forEach(l => l.start());
  }, []);

  const stopBubbles = useCallback(() => {
    bubbleLoops.current.forEach(l => l.stop());
  }, []);

  const reset = useCallback(() => {
    progressRef.current = 0;
    doneRef.current = false;
    setProgress(0);
    setDone(false);
    setPressing(false);
    stopBubbles();
  }, [stopBubbles]);

  const startFill = useCallback(() => {
    if (doneRef.current) return;
    setPressing(true);
    startBubbles();
    intervalRef.current = setInterval(() => {
      progressRef.current = Math.min(1, progressRef.current + TICK_MS / TOTAL_MS);
      setProgress(progressRef.current);
      if (progressRef.current >= 1) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        doneRef.current = true;
        setDone(true);
        stopBubbles();
        setTimeout(() => onClose(true), 1400);
      }
    }, TICK_MS);
  }, [startBubbles, stopBubbles, onClose]);

  const stopFill = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPressing(false);
    stopBubbles();
  }, [stopBubbles]);

  useEffect(() => {
    if (!visible) { stopFill(); reset(); }
  }, [visible]);

  const pct = Math.round(progress * 100);

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={reset}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Yıkama Zamanı! 🚿</Text>
          <Text style={styles.sub}>Suyu basılı tutarak Eva'yı yıka</Text>

          {/* Eva + bubbles */}
          <View style={styles.evaArea}>
            <EvaSprite mood={done ? 'happy' : pressing ? 'excited' : 'neutral'} scale={3.5} />
            {bubbles.current.map((anim, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.bubble,
                  {
                    left: 60 + i * 28,
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }],
                  },
                ]}
              >
                🫧
              </Animated.Text>
            ))}
          </View>

          {/* Progress bar */}
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pctTxt}>{done ? 'Tertemiz! +30 🧼' : `${pct}%`}</Text>

          {!done && (
            <Pressable
              onPressIn={startFill}
              onPressOut={stopFill}
              style={({ pressed }) => [styles.tapBtn, pressed && styles.tapBtnActive]}
            >
              <Text style={styles.tapEmoji}>🚿</Text>
              <Text style={styles.tapTxt}>Basılı tut</Text>
            </Pressable>
          )}

          {!done && (
            <TouchableOpacity onPress={() => { stopFill(); onClose(false); }} style={styles.cancel}>
              <Text style={styles.cancelTxt}>Vazgeç</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       {
    backgroundColor: '#eaf6f9', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, alignItems: 'center', gap: 12,
  },
  title:       { fontSize: 22, fontWeight: '800', color: '#1d2733' },
  sub:         { fontSize: 13, color: '#6e8a92', textAlign: 'center' },
  evaArea:     { height: 120, width: 180, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bubble:      { position: 'absolute', bottom: 20, fontSize: 22 },
  barBg:       { width: '100%', height: 16, backgroundColor: '#c5e8ef', borderRadius: 8, overflow: 'hidden' },
  barFill:     { height: '100%', backgroundColor: '#5C8EE8', borderRadius: 8 },
  pctTxt:      { fontSize: 14, fontWeight: '700', color: '#3a5a6a' },
  tapBtn:      {
    marginTop: 8, width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#5C8EE8', alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: '#5C8EE8', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  tapBtnActive:{ backgroundColor: '#3a70c4', transform: [{ scale: 0.96 }] },
  tapEmoji:    { fontSize: 36 },
  tapTxt:      { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancel:      { marginTop: 4 },
  cancelTxt:   { fontSize: 13, color: '#8a9aaa' },
});
