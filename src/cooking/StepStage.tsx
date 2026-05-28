import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, LayoutChangeEvent } from 'react-native';
import { StepType, STEP_META } from '../data/recipes';
import { Haptics } from '../services/Haptics';

/**
 * One cooking step: drag the tool onto the target, releasing while the timeline
 * cursor is inside the green window. Repeats STEP_META[step].reps times, then
 * reports the average quality (0..1) via onDone. Pure RN PanResponder/Animated
 * (no gesture-handler/reanimated).
 */

const ZONE_START = 58;
const ZONE_END   = 82;
const ZONE_MID   = (ZONE_START + ZONE_END) / 2;
const STEP_PCT   = 1.0;          // cursor % per 16ms tick
const AREA_H     = 230;
const OBJ        = 64;           // draggable size
const OBJ_LEFT   = 18;
const OBJ_TOP    = AREA_H - OBJ - 16;
const TARGET     = 96;           // target diameter
const TARGET_TOP = 24;
const HIT_R      = TARGET / 2 + 26;  // forgiving hit radius

const VIS: Record<StepType, { tool: string; target: string }> = {
  chop:     { tool: '🔪', target: '🥬' },
  transfer: { tool: '🥚', target: '🥣' },
  mix:      { tool: '🥄', target: '🥣' },
  cook:     { tool: '🍳', target: '🍽️' },
};

interface Props {
  step:       StepType;
  stepIndex:  number;
  totalSteps: number;
  accent:     string;
  onDone:     (quality: number) => void;
}

export function StepStage({ step, stepIndex, totalSteps, accent, onDone }: Props) {
  const meta = STEP_META[step];
  const vis  = VIS[step];

  const [cursor, setCursor] = useState(0);
  const [reps, setReps]     = useState(0);
  const [flash, setFlash]   = useState<'hit' | 'miss' | null>(null);
  const [areaW, setAreaW]   = useState(320);

  const cursorRef = useRef(0);
  const areaWRef  = useRef(320);
  const repsRef   = useRef(0);
  const qualities = useRef<number[]>([]);
  const pan       = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cursorTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cursorTimer.current = setInterval(() => {
      cursorRef.current = cursorRef.current >= 100 ? 0 : cursorRef.current + STEP_PCT;
      setCursor(cursorRef.current);
    }, 16);
    return () => { if (cursorTimer.current) clearInterval(cursorTimer.current); };
  }, []);

  const onArea = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    areaWRef.current = w;
    setAreaW(w);
  };

  const resolveRelease = (dx: number, dy: number) => {
    const objCenter = { x: OBJ_LEFT + OBJ / 2 + dx, y: OBJ_TOP + OBJ / 2 + dy };
    const targetCenter = { x: areaWRef.current - TARGET / 2 - 18, y: TARGET_TOP + TARGET / 2 };
    const dist = Math.hypot(objCenter.x - targetCenter.x, objCenter.y - targetCenter.y);
    const onTarget = dist <= HIT_R;

    if (!onTarget) {
      // Didn't reach the target — no rep consumed, snap back and retry.
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      return;
    }

    const c = cursorRef.current;
    const inZone = c >= ZONE_START && c <= ZONE_END;
    let q: number;
    if (inZone) {
      q = Math.max(0, 1 - Math.abs(c - ZONE_MID) / ((ZONE_END - ZONE_START) / 2));
      Haptics.success();
      setFlash('hit');
    } else {
      q = 0.15;             // reached target but mistimed
      Haptics.error();
      setFlash('miss');
    }
    setTimeout(() => setFlash(null), 180);
    qualities.current.push(q);

    const done = repsRef.current + 1;
    repsRef.current = done;
    setReps(done);

    // Snap back for the next rep.
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();

    if (done >= meta.reps) {
      if (cursorTimer.current) { clearInterval(cursorTimer.current); cursorTimer.current = null; }
      const avg = qualities.current.reduce((s, v) => s + v, 0) / qualities.current.length;
      setTimeout(() => onDone(avg), 220);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => resolveRelease(g.dx, g.dy),
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <Text style={styles.stepLabel}>Adım {stepIndex + 1}/{totalSteps} · {meta.emoji} {meta.label}</Text>
      <Text style={styles.verb}>{meta.verb}</Text>

      {/* Timeline */}
      <View style={styles.track}>
        <View style={[styles.zone, { left: `${ZONE_START}%`, width: `${ZONE_END - ZONE_START}%` }]} />
        <View style={[styles.cursor, { left: `${cursor}%`, backgroundColor: accent }]} />
      </View>

      {/* Play area */}
      <View style={styles.area} onLayout={onArea}>
        <View style={[
          styles.target,
          flash === 'hit'  && { borderColor: '#5BB89B', backgroundColor: '#dff4ec' },
          flash === 'miss' && { borderColor: '#FF6B6B', backgroundColor: '#ffe0e0' },
        ]}>
          <Text style={styles.targetEmoji}>{vis.target}</Text>
        </View>

        <Animated.View
          {...responder.panHandlers}
          style={[styles.obj, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        >
          <Text style={styles.objEmoji}>{vis.tool}</Text>
        </Animated.View>
      </View>

      <View style={styles.repsRow}>
        {Array.from({ length: meta.reps }).map((_, i) => (
          <View key={i} style={[styles.repDot, i < reps && { backgroundColor: accent, borderColor: accent }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { gap: 10 },
  stepLabel:   { fontSize: 13, fontWeight: '800', color: '#3a3530', textAlign: 'center' },
  verb:        { fontSize: 12, color: '#7a6f5e', textAlign: 'center' },
  track:       { width: '100%', height: 16, backgroundColor: '#eee5d4', borderRadius: 6, borderWidth: 1.5, borderColor: '#1d2733', position: 'relative', overflow: 'hidden' },
  zone:        { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#7BD3B855' },
  cursor:      { position: 'absolute', top: 2, bottom: 2, width: 6, borderRadius: 3, marginLeft: -3 },
  area:        { height: AREA_H, backgroundColor: '#faf6f0', borderRadius: 14, borderWidth: 1.5, borderColor: '#eee5d4', position: 'relative', overflow: 'hidden' },
  target:      { position: 'absolute', top: TARGET_TOP, right: 18, width: TARGET, height: TARGET, borderRadius: TARGET / 2, borderWidth: 3, borderColor: '#1d2733', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  targetEmoji: { fontSize: 44 },
  obj:         { position: 'absolute', left: OBJ_LEFT, top: OBJ_TOP, width: OBJ, height: OBJ, borderRadius: 14, backgroundColor: '#fff', borderWidth: 2, borderColor: '#1d2733', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  objEmoji:    { fontSize: 36 },
  repsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 2 },
  repDot:      { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#ccc', backgroundColor: '#fff' },
});
