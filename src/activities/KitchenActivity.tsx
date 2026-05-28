import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { BigButton } from '../components/BigButton';
import { ItemSprite } from '../sprite/ItemSprite';
import { Haptics } from '../services/Haptics';
import { RECIPES, RecipeDef, dishFromRecipe } from '../data/recipes';
import { ITEMS } from '../data/items';

type Phase = 'select' | 'prep' | 'cooking' | 'done';
type Quality = 'perfect' | 'good' | 'raw' | 'burned';

export function KitchenActivity({ onBack }: { onBack: () => void }) {
  const {
    coins, mood, accent = '#7BD3B8', prefs, level, inventory,
    cookSuccess, cookBurned, cookRaw, addXp, consumeItem,
  } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();

  const [phase, setPhase]   = useState<Phase>('select');
  const [recipe, setRecipe] = useState<RecipeDef | null>(null);
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);   // seconds since pot started
  const [quality, setQuality] = useState<Quality | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const likes = prefs?.likesCooking;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const hasIngredients = (r: RecipeDef) =>
    r.ingredients.every(ing => (inventory[ing.id] ?? 0) >= ing.qty);

  const missingList = (r: RecipeDef) =>
    r.ingredients
      .filter(ing => (inventory[ing.id] ?? 0) < ing.qty)
      .map(ing => ITEMS[ing.id]?.name ?? ing.id)
      .join(', ');

  // ── Prep: place each required ingredient ──────────────────────────────────
  const openPrep = (r: RecipeDef) => {
    setRecipe(r);
    setPlaced({});
    setPhase('prep');
  };

  const placeOne = (id: string, need: number) => {
    setPlaced(p => {
      const cur = p[id] ?? 0;
      if (cur >= need) return p;
      Haptics.selection();
      return { ...p, [id]: cur + 1 };
    });
  };

  const allPlaced = recipe?.ingredients.every(ing => (placed[ing.id] ?? 0) >= ing.qty) ?? false;

  const startCooking = () => {
    if (!recipe) return;
    // Consume the ingredients now (availability was checked when entering prep).
    for (const ing of recipe.ingredients) {
      if (!consumeItem(ing.id, ing.qty)) return; // safety; shouldn't happen
    }
    setElapsed(0);
    setQuality(null);
    setPhase('cooking');
    startRef.current = Date.now();
    sendCommand({ cmd: 'activity', type: 'cook_start', dish: recipe.name });
    sendFace('cook');

    const maxTime = recipe.idealTimeS + recipe.windowS + 4; // auto-burn buffer
    timerRef.current = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      setElapsed(e);
      if (e >= maxTime) {
        finishCook(recipe, e); // never pulled out → burned
      }
    }, 100);
  };

  // ── Pull out / resolve ────────────────────────────────────────────────────
  const finishCook = (r: RecipeDef, e: number) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const diff = Math.abs(e - r.idealTimeS);
    let q: Quality;
    if (e < r.idealTimeS - r.windowS) q = 'raw';
    else if (e > r.idealTimeS + r.windowS) q = 'burned';
    else if (diff <= r.windowS * 0.4) q = 'perfect';
    else q = 'good';
    setQuality(q);
    setPhase('done');

    if (q === 'perfect' || q === 'good') {
      cookSuccess(dishFromRecipe(r, q === 'perfect'));
      addXp(Math.round(r.xp * (q === 'perfect' ? 1 : 0.7)));
      Haptics.success();
      sendFace('happy');
    } else if (q === 'raw') {
      cookRaw(r.name);
      Haptics.error();
      sendFace('sad');
    } else {
      cookBurned(r.name);
      Haptics.error();
      sendFace('sad');
    }
  };

  const pullOut = () => {
    if (!recipe) return;
    finishCook(recipe, (Date.now() - startRef.current) / 1000);
  };

  const reset = () => {
    setPhase('select'); setRecipe(null); setPlaced({}); setElapsed(0); setQuality(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const maxTime = recipe ? recipe.idealTimeS + recipe.windowS + 4 : 1;
  const progressPct = recipe ? Math.min(100, (elapsed / maxTime) * 100) : 0;
  const winStart = recipe ? ((recipe.idealTimeS - recipe.windowS) / maxTime) * 100 : 0;
  const winWidth = recipe ? ((recipe.windowS * 2) / maxTime) * 100 : 0;

  return (
    <ActivityFrame scene="kitchen" title="Mutfak"
      sub={likes ? 'Eva pişirmeyi seviyor — keyifli iş!' : 'Eva pişirmeyi sevmiyor ama yapacak…'}
      onBack={onBack} coins={coins}
      mood={phase === 'cooking' ? (likes ? 'excited' : 'sleepy') : mood}
      accent={accent}
    >
      {phase === 'select' && (
        <>
          <Text style={styles.label}>Tarifler · SV {level}</Text>
          <View style={styles.grid}>
            {RECIPES.map(r => {
              const locked = level < r.minLevel;
              const haveIng = hasIngredients(r);
              const disabled = locked || !haveIng;
              return (
                <TouchableOpacity key={r.id} disabled={disabled}
                  onPress={() => openPrep(r)} activeOpacity={0.8}
                  style={[styles.dishCard, disabled && { opacity: 0.5 }]}>
                  <View style={styles.dishIcon}>
                    <ItemSprite name={r.sprite} scale={2.2} />
                  </View>
                  <Text style={styles.dishName}>{r.name}</Text>
                  {locked ? (
                    <View style={styles.lockBadge}><Text style={styles.lockTxt}>SV {r.minLevel}</Text></View>
                  ) : !haveIng ? (
                    <Text style={styles.missing}>eksik: {missingList(r)}</Text>
                  ) : (
                    <Text style={styles.dishStats}>+{r.hunger}🍴 · {r.idealTimeS}sn ⏱</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.moodHint, { backgroundColor: likes ? '#dff4ec' : '#ffe5d6', borderColor: likes ? '#7BD3B8' : '#FF9D7A' }]}>
            <Text style={styles.moodHintTxt}>
              <Text style={{ fontWeight: '800' }}>{likes ? '👨‍🍳 Hobi modu:' : '😒 Görev modu:'}</Text>
              {' '}{likes ? 'Pişirme sırasında mutluluk artar' : 'Pişirir ama keyif almaz'}
            </Text>
          </View>
        </>
      )}

      {phase === 'prep' && recipe && (
        <View style={styles.prepBox}>
          <Text style={styles.prepTitle}>{recipe.name}</Text>
          <Text style={styles.prepSub}>Malzemeleri tencereye ekle</Text>
          <View style={styles.ingList}>
            {recipe.ingredients.map(ing => {
              const def = ITEMS[ing.id];
              const done = (placed[ing.id] ?? 0);
              const full = done >= ing.qty;
              return (
                <TouchableOpacity key={ing.id} onPress={() => placeOne(ing.id, ing.qty)}
                  activeOpacity={0.8} disabled={full}
                  style={[styles.ingChip, full && { borderColor: accent, backgroundColor: '#dff4ec' }]}>
                  <ItemSprite name={def?.sprite ?? ing.id} scale={1.8} />
                  <Text style={styles.ingName}>{def?.name ?? ing.id}</Text>
                  <Text style={styles.ingCount}>{done}/{ing.qty}{full ? ' ✓' : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <BigButton primary accent={accent} disabled={!allPlaced} onPress={startCooking}>
            Ocağa Koy
          </BigButton>
          <TouchableOpacity onPress={reset}><Text style={styles.cancel}>İptal</Text></TouchableOpacity>
        </View>
      )}

      {phase === 'cooking' && recipe && (
        <View style={styles.cookingBox}>
          <ItemSprite name={recipe.sprite} scale={3} />
          <Text style={styles.cookingTitle}>{recipe.name} pişiyor…</Text>
          <Text style={styles.cookingTimer}>{elapsed.toFixed(1)}sn</Text>
          {/* Progress track with a green "perfect" window */}
          <View style={styles.progressTrack}>
            <View style={[styles.windowZone, { left: `${winStart}%`, width: `${winWidth}%` }]} />
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: accent }]} />
          </View>
          <Text style={styles.cookingHint}>Yeşil bölgede çıkar! Erken = çiğ, geç = yanık.</Text>
          <BigButton primary accent={accent} onPress={pullOut}>Çıkar</BigButton>
        </View>
      )}

      {phase === 'done' && recipe && quality && (
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>
            {quality === 'perfect' ? '🌟' : quality === 'good' ? '✨' : quality === 'raw' ? '🥚' : '🔥'}
          </Text>
          <Text style={[styles.resultTitle, {
            color: quality === 'raw' ? '#E0A030' : (quality === 'burned' ? '#FF6B6B' : '#5BB89B'),
          }]}>
            {quality === 'perfect' ? `Mükemmel ${recipe.name}!`
              : quality === 'good' ? `${recipe.name} hazır!`
              : quality === 'raw' ? `${recipe.name} çiğ kaldı…`
              : `${recipe.name} yandı…`}
          </Text>
          <Text style={styles.resultSub}>
            {quality === 'perfect' ? `Çantana eklendi · +${recipe.xp} XP (bonus!)`
              : quality === 'good' ? `Çantana eklendi · +${Math.round(recipe.xp * 0.7)} XP`
              : quality === 'raw' ? 'Biraz daha beklemeliydin. Tekrar dene.'
              : 'Çok geç çıkardın. Tekrar dene.'}
          </Text>
          <BigButton primary accent={accent} onPress={reset}>Tamam</BigButton>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  label:       { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dishCard:    { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  dishIcon:    { width: 56, height: 56, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  dishName:    { fontSize: 12, fontWeight: '700', color: '#3a3530' },
  dishStats:   { fontSize: 9, color: '#7a6f5e', fontFamily: 'monospace' },
  missing:     { fontSize: 8, color: '#FF6B6B', textAlign: 'center', fontFamily: 'monospace' },
  lockBadge:   { backgroundColor: '#1d2733', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  lockTxt:     { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  moodHint:    { borderRadius: 10, padding: 10, borderWidth: 1 },
  moodHintTxt: { fontSize: 11, color: '#3a3530' },
  prepBox:     { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  prepTitle:   { fontSize: 18, fontWeight: '800', color: '#3a3530' },
  prepSub:     { fontSize: 12, color: '#7a6f5e' },
  ingList:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 4 },
  ingChip:     { width: 92, backgroundColor: '#faf6f0', borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: '#eee5d4' },
  ingName:     { fontSize: 11, fontWeight: '700', color: '#3a3530' },
  ingCount:    { fontSize: 10, color: '#7a6f5e', fontFamily: 'monospace' },
  cancel:      { fontSize: 13, color: '#aaa', paddingTop: 4 },
  cookingBox:  { alignItems: 'center', gap: 12, padding: 16 },
  cookingTitle:{ fontSize: 18, fontWeight: '800', color: '#3a3530' },
  cookingTimer:{ fontSize: 28, fontWeight: '900', color: '#3a3530', fontVariant: ['tabular-nums'] },
  progressTrack: { width: '100%', height: 18, backgroundColor: '#eee5d4', borderRadius: 4, overflow: 'hidden', borderWidth: 1.5, borderColor: '#1d2733', position: 'relative' },
  windowZone:  { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#7BD3B855' },
  progressFill:{ height: '100%', borderRadius: 3 },
  cookingHint: { fontSize: 11, color: '#7a6f5e', textAlign: 'center' },
  resultBox:   { alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  resultEmoji: { fontSize: 48 },
  resultTitle: { fontSize: 20, fontWeight: '800' },
  resultSub:   { fontSize: 13, color: '#7a6f5e', textAlign: 'center' },
});
