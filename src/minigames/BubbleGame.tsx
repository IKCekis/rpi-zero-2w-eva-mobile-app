import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Dimensions, Animated,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: (score: number) => void;
}

const { width: SW, height: SH } = Dimensions.get('window');
const TOTAL_BUBBLES = 8;
const BUBBLE_LIFE   = 1600; // ms before a bubble auto-pops (miss)
const BUBBLE_SIZE   = 72;
const COLORS = ['#FF6B6B', '#FFD93D', '#7BD3B8', '#FF7AA8', '#5C8EE8', '#a090ff', '#FFB347'];

interface Bubble {
  id:     number;
  x:      number;
  y:      number;
  color:  string;
  scale:  Animated.Value;
  opacity:Animated.Value;
}

let _uid = 0;

export function BubbleGame({ visible, onClose }: Props) {
  const [phase, setPhase]     = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore]     = useState(0);
  const [round, setRound]     = useState(0);
  const [bubble, setBubble]   = useState<Bubble | null>(null);
  const scoreRef              = useRef(0);
  const roundRef              = useRef(0);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef              = useRef<'ready' | 'playing' | 'done'>('ready');

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const spawnBubble = useCallback(() => {
    const x = 24 + Math.random() * (SW - 24 - BUBBLE_SIZE - 24);
    const y = 120 + Math.random() * (SH * 0.45);
    const b: Bubble = {
      id:      ++_uid,
      x, y,
      color:   COLORS[Math.floor(Math.random() * COLORS.length)],
      scale:   new Animated.Value(0),
      opacity: new Animated.Value(1),
    };
    setBubble(b);

    // Pop-in animation
    Animated.spring(b.scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

    // Auto-miss after BUBBLE_LIFE
    timerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'playing') return;
      nextRound(false, b.id);
    }, BUBBLE_LIFE);
  }, []);

  const nextRound = useCallback((hit: boolean, bubbleId: number) => {
    clearTimer();
    setBubble(prev => (prev?.id === bubbleId ? null : prev));

    if (hit) scoreRef.current++;
    roundRef.current++;

    setScore(scoreRef.current);
    setRound(roundRef.current);

    if (roundRef.current >= TOTAL_BUBBLES) {
      phaseRef.current = 'done';
      setPhase('done');
    } else {
      setTimeout(spawnBubble, 400);
    }
  }, [spawnBubble]);

  const tapBubble = useCallback((id: number) => {
    if (phaseRef.current !== 'playing') return;
    clearTimer();
    setBubble(prev => {
      if (!prev || prev.id !== id) return prev;
      Animated.parallel([
        Animated.timing(prev.scale,   { toValue: 1.6, duration: 180, useNativeDriver: true }),
        Animated.timing(prev.opacity, { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start();
      return prev;
    });
    setTimeout(() => nextRound(true, id), 200);
  }, [nextRound]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    roundRef.current = 0;
    phaseRef.current = 'playing';
    setScore(0);
    setRound(0);
    setPhase('playing');
    setBubble(null);
    setTimeout(spawnBubble, 300);
  }, [spawnBubble]);

  useEffect(() => {
    if (!visible) {
      clearTimer();
      phaseRef.current = 'ready';
      setPhase('ready');
      setBubble(null);
    }
  }, [visible]);

  const coins = score * 2;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>

        {/* HUD */}
        {phase === 'playing' && (
          <View style={styles.hud}>
            <Text style={styles.hudTxt}>💨 {round}/{TOTAL_BUBBLES}</Text>
            <Text style={styles.hudTxt}>⭐ {score}</Text>
          </View>
        )}

        {/* Bubble */}
        {bubble && phase === 'playing' && (
          <Pressable
            onPress={() => tapBubble(bubble.id)}
            style={[styles.bubble, { left: bubble.x, top: bubble.y, borderColor: bubble.color }]}
          >
            <Animated.View
              style={{
                width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2,
                backgroundColor: bubble.color + '55',
                alignItems: 'center', justifyContent: 'center',
                transform: [{ scale: bubble.scale }],
                opacity: bubble.opacity,
              }}
            >
              <Text style={{ fontSize: 28 }}>💨</Text>
            </Animated.View>
          </Pressable>
        )}

        {/* Ready screen */}
        {phase === 'ready' && (
          <View style={styles.centerCard}>
            <Text style={styles.cardTitle}>Balon Patlat! 💨</Text>
            <Text style={styles.cardSub}>Ekranda çıkan balonlara{'\n'}kaybolmadan önce dokun!</Text>
            <Text style={styles.cardSub2}>{TOTAL_BUBBLES} balon · 2¢ her hit</Text>
            <TouchableOpacity onPress={startGame} style={styles.startBtn}>
              <Text style={styles.startTxt}>Başla!</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onClose(0)} style={styles.cancel}>
              <Text style={styles.cancelTxt}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Done screen */}
        {phase === 'done' && (
          <View style={styles.centerCard}>
            <Text style={styles.cardTitle}>
              {score >= 7 ? '🏆 Mükemmel!' : score >= 5 ? '🎉 İyi oynadın!' : '😅 Fena değil!'}
            </Text>
            <Text style={styles.resultScore}>{score}/{TOTAL_BUBBLES}</Text>
            <Text style={styles.resultCoins}>+{coins}¢ kazandın!</Text>
            <TouchableOpacity onPress={() => onClose(score)} style={styles.startBtn}>
              <Text style={styles.startTxt}>Harika!</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={startGame} style={styles.cancel}>
              <Text style={styles.cancelTxt}>Tekrar oyna</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: '#0d1528', justifyContent: 'center', alignItems: 'center' },
  hud:         {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28,
  },
  hudTxt:      { fontSize: 20, fontWeight: '800', color: '#fff' },
  bubble:      { position: 'absolute', borderWidth: 0 },
  centerCard:  {
    backgroundColor: '#1a2540', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 12, minWidth: 280,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  cardTitle:   { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
  cardSub:     { fontSize: 14, color: '#8899bb', textAlign: 'center', lineHeight: 21 },
  cardSub2:    { fontSize: 12, color: '#5566aa', textAlign: 'center' },
  resultScore: { fontSize: 64, fontWeight: '900', color: '#FFD93D' },
  resultCoins: { fontSize: 20, fontWeight: '700', color: '#7BD3B8' },
  startBtn:    {
    marginTop: 8, backgroundColor: '#5C8EE8', borderRadius: 16,
    paddingHorizontal: 40, paddingVertical: 14,
  },
  startTxt:    { fontSize: 17, fontWeight: '800', color: '#fff' },
  cancel:      { marginTop: 2 },
  cancelTxt:   { fontSize: 13, color: '#5566aa' },
});
