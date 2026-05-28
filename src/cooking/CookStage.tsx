import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, ScrollView } from 'react-native';
import { RecipeDef, StepType } from '../data/recipes';
import { ITEMS } from '../data/items';
import { ItemSprite } from '../sprite/ItemSprite';
import { Haptics } from '../services/Haptics';

/**
 * Real-kitchen cooking stage. A single, slow, non-looping timeline at the top
 * lists every action (add an ingredient / use a tool) at its moment. The pot is
 * the drop target in the middle. The bottom is a scrollable counter (tezgah)
 * with the recipe's ingredients + tools that you drag into the pot at the right
 * time and in the right order. Pure RN PanResponder/Animated.
 */

type ToolKind = 'knife' | 'spoon' | 'heat';

const TOOL_META: Record<ToolKind, { emoji: string; label: string }> = {
  knife: { emoji: '🔪', label: 'Doğra' },
  spoon: { emoji: '🥄', label: 'Karıştır' },
  heat:  { emoji: '🔥', label: 'Pişir' },
};

interface Action {
  matchKey: string;          // tile that satisfies this action
  kind:     'ingredient' | 'tool';
  id:       string;
  label:    string;
  sprite?:  string;          // ingredient sprite
  emoji?:   string;          // tool emoji
}

interface Tile {
  key:    string;
  kind:   'ingredient' | 'tool';
  id:     string;
  label:  string;
  sprite?: string;
  emoji?:  string;
  need:   number;            // ingredient units required (0 for tools)
}

const SLOT_MS = 1900;        // time per action slot (slow, real-cooking feel)
const WIN     = 0.34;        // ± green window, in slot units
const TICK_MS = 16;

function toolAction(t: ToolKind): Action {
  return { matchKey: `tool:${t}`, kind: 'tool', id: t, label: TOOL_META[t].label, emoji: TOOL_META[t].emoji };
}

function buildActions(recipe: RecipeDef): Action[] {
  const ingActions: Action[] = [];
  recipe.ingredients.forEach(ing => {
    for (let k = 0; k < ing.qty; k++) {
      ingActions.push({
        matchKey: ing.id, kind: 'ingredient', id: ing.id,
        label: ITEMS[ing.id]?.name ?? ing.id, sprite: ITEMS[ing.id]?.sprite,
      });
    }
  });

  const out: Action[] = [];
  let addedIngredients = false;
  recipe.steps.forEach((s: StepType) => {
    if (s === 'transfer') { out.push(...ingActions); addedIngredients = true; }
    else if (s === 'chop') out.push(toolAction('knife'));
    else if (s === 'mix')  out.push(toolAction('spoon'));
    else if (s === 'cook') out.push(toolAction('heat'));
  });
  if (!addedIngredients && ingActions.length) out.unshift(...ingActions);
  if (out.length === 0) out.push(...ingActions);
  return out;
}

interface Props {
  recipe:    RecipeDef;
  accent:    string;
  onConsume: (id: string) => boolean;
  onDone:    (quality: number) => void;
}

export function CookStage({ recipe, accent, onConsume, onDone }: Props) {
  const actions = useMemo(() => buildActions(recipe), [recipe]);
  const N = actions.length;

  const tiles = useMemo(() => {
    const seen = new Map<string, Tile>();
    actions.forEach(a => {
      const ex = seen.get(a.matchKey);
      if (!ex) {
        seen.set(a.matchKey, {
          key: a.matchKey, kind: a.kind, id: a.id, label: a.label,
          sprite: a.sprite, emoji: a.emoji, need: a.kind === 'ingredient' ? 1 : 0,
        });
      } else if (a.kind === 'ingredient') {
        ex.need += 1;
      }
    });
    return [...seen.values()];
  }, [actions]);

  const [playhead, setPlayhead] = useState(0);     // 0..100 %
  const [added, setAdded]       = useState<Record<string, number>>({});
  const [flash, setFlash]       = useState<{ key: string; type: 'hit' | 'late' | 'wrong' } | null>(null);

  const pRef       = useRef(0);                     // playhead in slot units
  const elapsedRef = useRef(0);
  const filledRef  = useRef<boolean[]>([]);
  const scoresRef  = useRef<number[]>([]);
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const potRef     = useRef<View>(null);
  const potRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const doneRef    = useRef(false);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS;
      const p = elapsedRef.current / SLOT_MS;
      pRef.current = p;
      const passed = Math.min(Math.floor(p), N);
      for (let i = 0; i < passed; i++) {
        if (!filledRef.current[i] && scoresRef.current[i] === undefined) scoresRef.current[i] = 0;
      }
      setPlayhead(Math.min(100, (p / N) * 100));
      if (p >= N) finish();
    }, TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const arr = actions.map((_, i) => scoresRef.current[i] ?? 0);
    const avg = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    setTimeout(() => onDone(avg), 250);
  };

  const measurePot = () => {
    const node = potRef.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
    node?.measureInWindow?.((x, y, w, h) => { potRectRef.current = { x, y, w, h }; });
  };

  const overPot = (mx: number, my: number) => {
    const r = potRectRef.current;
    if (!r) return false;
    const pad = 36;
    return mx >= r.x - pad && mx <= r.x + r.w + pad && my >= r.y - pad && my <= r.y + r.h + pad;
  };

  const flashTile = (key: string, type: 'hit' | 'late' | 'wrong') => {
    setFlash({ key, type });
    setTimeout(() => setFlash(null), 200);
  };

  const resolveDrop = (tileKey: string) => {
    const i = Math.floor(pRef.current);
    if (i >= N || doneRef.current) return;
    if (filledRef.current[i]) return;
    const a = actions[i];
    if (tileKey !== a.matchKey) { Haptics.error(); flashTile(tileKey, 'wrong'); return; }

    const dist = Math.abs(pRef.current - (i + 0.5));
    let score: number;
    if (dist <= WIN) { score = Math.max(0.2, 1 - dist / WIN); Haptics.success(); flashTile(tileKey, 'hit'); }
    else { score = 0.3; Haptics.tap(); flashTile(tileKey, 'late'); }

    filledRef.current[i] = true;
    scoresRef.current[i] = score;
    if (a.kind === 'ingredient') {
      onConsume(a.id);
      setAdded(prev => ({ ...prev, [a.matchKey]: (prev[a.matchKey] ?? 0) + 1 }));
    }
  };

  const onTileDrop = (key: string, mx: number, my: number) => {
    if (overPot(mx, my)) resolveDrop(key);
  };

  const activeIdx = Math.min(N - 1, Math.floor((playhead / 100) * N));
  const activeAction = actions[activeIdx];
  const activeFilled = filledRef.current[activeIdx];

  return (
    <View style={styles.root}>
      {/* Prompt */}
      <Text style={styles.prompt}>
        {activeAction
          ? (activeFilled ? '👌 sıradakini bekle…' : `Şimdi: ${activeAction.kind === 'tool' ? activeAction.emoji + ' ' : ''}${activeAction.label}`)
          : 'Hazır!'}
      </Text>

      {/* Timeline — single pass, non-looping */}
      <View style={styles.track}>
        {actions.map((a, i) => {
          const left   = ((i + 0.5) / N) * 100;
          const gStart = ((i + 0.5 - WIN) / N) * 100;
          const gWidth = ((WIN * 2) / N) * 100;
          const isActive = i === activeIdx && !activeFilled;
          return (
            <React.Fragment key={i}>
              <View style={[styles.gband, { left: `${gStart}%`, width: `${gWidth}%` }]} />
              <View style={[styles.marker, { left: `${left}%` }, isActive && { borderColor: accent, transform: [{ scale: 1.15 }] }, filledRef.current[i] && { opacity: 0.3 }]}>
                {a.kind === 'ingredient'
                  ? <ItemSprite name={a.sprite ?? a.id} scale={1.0} />
                  : <Text style={styles.markerEmoji}>{a.emoji}</Text>}
              </View>
            </React.Fragment>
          );
        })}
        <View style={[styles.playhead, { left: `${playhead}%`, backgroundColor: accent }]} />
      </View>

      {/* Pot (drop target) */}
      <View style={styles.potArea}>
        <View ref={potRef} onLayout={measurePot} style={styles.pot}>
          <Text style={styles.potEmoji}>🍲</Text>
        </View>
        <Text style={styles.potHint}>Tezgahtan tencereye sürükle</Text>
      </View>

      {/* Counter (tezgah) — scrollable */}
      <Text style={styles.counterLabel}>TEZGAH</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.counter}
      >
        {tiles.map(t => (
          <DragTile key={t.key} tile={t} added={added[t.key] ?? 0}
            flash={flash?.key === t.key ? flash.type : null} accent={accent} onDrop={onTileDrop} />
        ))}
      </ScrollView>
    </View>
  );
}

function DragTile({ tile, added, flash, accent, onDrop }: {
  tile: Tile; added: number; flash: 'hit' | 'late' | 'wrong' | null; accent: string;
  onDrop: (key: string, mx: number, my: number) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        onDrop(tile.key, g.moveX, g.moveY);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
    })
  ).current;

  const remaining = tile.kind === 'ingredient' ? tile.need - added : null;
  const depleted = remaining !== null && remaining <= 0;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.tile,
        { transform: pan.getTranslateTransform() },
        depleted && { opacity: 0.35 },
        flash === 'wrong' && { borderColor: '#FF6B6B', backgroundColor: '#ffe0e0' },
        flash === 'hit'   && { borderColor: '#5BB89B', backgroundColor: '#dff4ec' },
        flash === 'late'  && { borderColor: '#E0A030' },
      ]}
    >
      {tile.kind === 'ingredient'
        ? <ItemSprite name={tile.sprite ?? tile.id} scale={1.8} />
        : <Text style={styles.tileEmoji}>{tile.emoji}</Text>}
      <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
      {remaining !== null && (
        <View style={[styles.tileBadge, { backgroundColor: depleted ? '#bbb' : accent }]}>
          <Text style={styles.tileBadgeTxt}>×{Math.max(0, remaining)}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, gap: 10 },
  prompt:      { fontSize: 16, fontWeight: '800', color: '#3a3530', textAlign: 'center' },
  track:       { height: 56, backgroundColor: '#eee5d4', borderRadius: 12, borderWidth: 1.5, borderColor: '#1d2733', position: 'relative', overflow: 'hidden', justifyContent: 'center' },
  gband:       { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#7BD3B855' },
  marker:      { position: 'absolute', width: 34, height: 34, marginLeft: -17, borderRadius: 9, backgroundColor: '#fff', borderWidth: 2, borderColor: '#cbb89a', alignItems: 'center', justifyContent: 'center' },
  markerEmoji: { fontSize: 18 },
  playhead:    { position: 'absolute', top: 0, bottom: 0, width: 4, marginLeft: -2, borderRadius: 2 },
  potArea:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  pot:         { width: 130, height: 130, borderRadius: 28, backgroundColor: '#fff', borderWidth: 3, borderColor: '#1d2733', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 },
  potEmoji:    { fontSize: 72 },
  potHint:     { fontSize: 12, color: '#7a6f5e' },
  counterLabel:{ fontSize: 10, fontWeight: '800', color: '#7a6f5e', letterSpacing: 1.5 },
  counter:     { gap: 10, paddingVertical: 4, paddingRight: 16 },
  tile:        { width: 78, height: 92, backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#eee5d4', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  tileEmoji:   { fontSize: 34 },
  tileLabel:   { fontSize: 10, fontWeight: '700', color: '#3a3530', maxWidth: 70 },
  tileBadge:   { position: 'absolute', top: 4, right: 4, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tileBadgeTxt:{ fontSize: 10, fontWeight: '800', color: '#fff' },
});
