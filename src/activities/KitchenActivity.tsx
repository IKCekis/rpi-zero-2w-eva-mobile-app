import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { ActivityFrame } from '../components/ActivityFrame';
import { BigButton } from '../components/BigButton';
import { ItemSprite } from '../sprite/ItemSprite';
import { Haptics } from '../services/Haptics';
import { RECIPES, RecipeDef, dishFromRecipe } from '../data/recipes';
import { ITEMS } from '../data/items';
import { CookStage } from '../cooking/CookStage';
import { RecipeBuilder } from '../screens/RecipeBuilder';
import { loadCustomRecipes } from '../services/CustomRecipes';

type Phase = 'select' | 'cooking' | 'done';
type Quality = 'perfect' | 'good' | 'raw' | 'burned';

export function KitchenActivity({ onBack }: { onBack: () => void }) {
  const {
    coins, mood, accent = '#7BD3B8', prefs, level, inventory,
    cookSuccess, cookBurned, cookRaw, addXp, consumeItem,
  } = useEvaStore();
  const { sendCommand, sendFace } = useBLE();
  const insets = useSafeAreaInsets();

  const [phase, setPhase]   = useState<Phase>('select');
  const [recipe, setRecipe] = useState<RecipeDef | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [custom, setCustom] = useState<RecipeDef[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);

  const likes = prefs?.likesCooking;

  const reloadCustom = useCallback(() => { loadCustomRecipes().then(setCustom); }, []);
  useEffect(() => { reloadCustom(); }, [reloadCustom]);

  const allRecipes = [...RECIPES, ...custom];

  const hasIngredients = (r: RecipeDef) =>
    r.ingredients.every(ing => (inventory[ing.id] ?? 0) >= ing.qty);

  const missingList = (r: RecipeDef) =>
    r.ingredients
      .filter(ing => (inventory[ing.id] ?? 0) < ing.qty)
      .map(ing => ITEMS[ing.id]?.name ?? ing.id)
      .join(', ');

  // ── Start: ingredients are consumed on-drop inside CookStage ──────────────
  const startCooking = (r: RecipeDef) => {
    setRecipe(r); setQuality(null); setPhase('cooking');
    sendCommand({ cmd: 'activity', type: 'cook_start', dish: r.name });
    sendFace('cook');
  };

  // CookStage reports the aggregate quality (0..1) of the whole dish.
  const finishCooking = (r: RecipeDef, avg: number) => {
    const q: Quality = avg >= 0.85 ? 'perfect' : avg >= 0.6 ? 'good' : avg >= 0.3 ? 'raw' : 'burned';
    setQuality(q); setPhase('done');

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

  const reset = () => {
    setPhase('select'); setRecipe(null); setQuality(null);
  };

  // ── Recipe builder overlay ────────────────────────────────────────────────
  if (showBuilder) {
    return (
      <RecipeBuilder
        accent={accent}
        onClose={() => setShowBuilder(false)}
        onSaved={reloadCustom}
      />
    );
  }

  // ── Cooking: plain full-screen (no ScrollView, so drag isn't intercepted) ──
  if (phase === 'cooking' && recipe) {
    return (
      <View style={[styles.cookRoot, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.cookHeader}>
          <Text style={styles.cookTitle}>{recipe.name} hazırlanıyor…</Text>
          <TouchableOpacity onPress={reset}><Text style={styles.abort}>Vazgeç</Text></TouchableOpacity>
        </View>
        <CookStage
          recipe={recipe}
          accent={accent}
          onConsume={consumeItem}
          onDone={(q) => finishCooking(recipe, q)}
        />
      </View>
    );
  }

  return (
    <ActivityFrame scene="kitchen" title="Mutfak"
      sub={likes ? 'Eva pişirmeyi seviyor — keyifli iş!' : 'Eva pişirmeyi sevmiyor ama yapacak…'}
      onBack={onBack} coins={coins} mood={mood} accent={accent}
    >
      {phase === 'select' && (
        <>
          <View style={styles.headRow}>
            <Text style={styles.label}>Tarifler · SV {level}</Text>
            <TouchableOpacity onPress={() => setShowBuilder(true)} style={[styles.createBtn, { borderColor: accent }]}>
              <Text style={[styles.createTxt, { color: accent }]}>+ Tarif Oluştur</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {allRecipes.map(r => {
              const locked = level < r.minLevel;
              const haveIng = hasIngredients(r);
              const disabled = locked || !haveIng;
              return (
                <TouchableOpacity key={r.id} disabled={disabled}
                  onPress={() => startCooking(r)} activeOpacity={0.8}
                  style={[styles.dishCard, disabled && { opacity: 0.5 }]}>
                  {r.custom && <View style={[styles.customBadge, { backgroundColor: accent }]}><Text style={styles.customTxt}>özel</Text></View>}
                  <View style={styles.dishIcon}>
                    <ItemSprite name={r.sprite} scale={2.2} />
                  </View>
                  <Text style={styles.dishName} numberOfLines={1}>{r.name}</Text>
                  {locked ? (
                    <View style={styles.lockBadge}><Text style={styles.lockTxt}>SV {r.minLevel}</Text></View>
                  ) : !haveIng ? (
                    <Text style={styles.missing}>eksik: {missingList(r)}</Text>
                  ) : (
                    <Text style={styles.dishStats}>+{r.hunger}🍴 · {r.steps.length} adım</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.moodHint, { backgroundColor: likes ? '#dff4ec' : '#ffe5d6', borderColor: likes ? '#7BD3B8' : '#FF9D7A' }]}>
            <Text style={styles.moodHintTxt}>
              <Text style={{ fontWeight: '800' }}>{likes ? '👨‍🍳 Hobi modu:' : '😒 Görev modu:'}</Text>
              {' '}Her adımı timeline yeşil bölgesinde sürükleyerek yap!
            </Text>
          </View>
        </>
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
              : quality === 'raw' ? 'Adımları yeşil bölgede yap. Tekrar dene.'
              : 'Zamanlamaya dikkat. Tekrar dene.'}
          </Text>
          <BigButton primary accent={accent} onPress={reset}>Tamam</BigButton>
        </View>
      )}
    </ActivityFrame>
  );
}

const styles = StyleSheet.create({
  headRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label:       { fontSize: 10, fontWeight: '700', color: '#7a6f5e', letterSpacing: 1, textTransform: 'uppercase' },
  createBtn:   { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  createTxt:   { fontSize: 12, fontWeight: '800' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dishCard:    { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, position: 'relative' },
  customBadge: { position: 'absolute', top: 6, right: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  customTxt:   { fontSize: 8, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  dishIcon:    { width: 56, height: 56, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  dishName:    { fontSize: 12, fontWeight: '700', color: '#3a3530' },
  dishStats:   { fontSize: 9, color: '#7a6f5e', fontFamily: 'monospace' },
  missing:     { fontSize: 8, color: '#FF6B6B', textAlign: 'center', fontFamily: 'monospace' },
  lockBadge:   { backgroundColor: '#1d2733', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  lockTxt:     { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  moodHint:    { borderRadius: 10, padding: 10, borderWidth: 1 },
  moodHintTxt: { fontSize: 11, color: '#3a3530' },
  cookRoot:    { flex: 1, backgroundColor: '#faf6f0', paddingHorizontal: 16, gap: 14 },
  cookHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cookTitle:   { fontSize: 18, fontWeight: '800', color: '#3a3530' },
  abort:       { fontSize: 13, color: '#aaa', fontWeight: '700' },
  resultBox:   { alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  resultEmoji: { fontSize: 48 },
  resultTitle: { fontSize: 20, fontWeight: '800' },
  resultSub:   { fontSize: 13, color: '#7a6f5e', textAlign: 'center' },
});
