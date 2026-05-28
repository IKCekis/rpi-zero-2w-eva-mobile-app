import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ItemSprite } from '../sprite/ItemSprite';
import { ITEMS } from '../data/items';
import { ALL_STEPS, STEP_META, StepType, RecipeIngredient } from '../data/recipes';
import { autoBalance, buildCustomRecipe, addCustomRecipe } from '../services/CustomRecipes';
import { Haptics } from '../services/Haptics';
import { BigButton } from '../components/BigButton';

const INGREDIENTS = Object.values(ITEMS).filter(i => i.kind === 'ingredient');

interface Props {
  accent:  string;
  onClose: () => void;
  onSaved: () => void;   // refresh kitchen list
}

export function RecipeBuilder({ accent, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName]   = useState('');
  const [qty, setQty]     = useState<Record<string, number>>({});
  const [steps, setSteps] = useState<StepType[]>([]);

  const selected: RecipeIngredient[] = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, qty: n }));

  const canSave = name.trim().length > 0 && selected.length > 0 && steps.length > 0;
  const preview = canSave ? autoBalance(selected, steps) : { hunger: 0, happiness: 0, xp: 0 };

  const bump = (id: string, d: number) => {
    Haptics.selection();
    setQty(q => {
      const next = Math.max(0, Math.min(5, (q[id] ?? 0) + d));
      return { ...q, [id]: next };
    });
  };

  const addStep = (s: StepType) => { Haptics.tap(); setSteps(prev => [...prev, s]); };
  const removeStep = (i: number) => { Haptics.tap(); setSteps(prev => prev.filter((_, idx) => idx !== i)); };

  const save = async () => {
    if (!canSave) return;
    const recipe = buildCustomRecipe(name, selected, steps);
    await addCustomRecipe(recipe);
    Haptics.success();
    onSaved();
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={styles.closeTxt}>← İptal</Text></TouchableOpacity>
        <Text style={styles.title}>Yeni Tarif</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* 1. Name */}
        <View style={styles.card}>
          <Text style={styles.step}>1 · Adı ne olsun?</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Örn: Süper Pizza"
            placeholderTextColor="#b8a89a"
            maxLength={24}
          />
        </View>

        {/* 2. Ingredients */}
        <View style={styles.card}>
          <Text style={styles.step}>2 · Malzemeleri seç</Text>
          {INGREDIENTS.map(item => {
            const n = qty[item.id] ?? 0;
            return (
              <View key={item.id} style={styles.ingRow}>
                <View style={styles.ingIcon}><ItemSprite name={item.sprite} scale={1.8} /></View>
                <Text style={styles.ingName}>{item.name}</Text>
                <View style={styles.counter}>
                  <TouchableOpacity onPress={() => bump(item.id, -1)} disabled={n === 0}
                    style={[styles.counterBtn, n === 0 && { opacity: 0.35 }]}>
                    <Text style={styles.counterTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{n}</Text>
                  <TouchableOpacity onPress={() => bump(item.id, 1)} style={[styles.counterBtn, { backgroundColor: accent }]}>
                    <Text style={[styles.counterTxt, { color: '#fff' }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* 3. Steps */}
        <View style={styles.card}>
          <Text style={styles.step}>3 · Adımları sırayla ekle</Text>
          <View style={styles.stepPicker}>
            {ALL_STEPS.map(s => (
              <TouchableOpacity key={s} onPress={() => addStep(s)} style={styles.stepBtn} activeOpacity={0.8}>
                <Text style={styles.stepEmoji}>{STEP_META[s].emoji}</Text>
                <Text style={styles.stepBtnTxt}>{STEP_META[s].label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {steps.length === 0 ? (
            <Text style={styles.emptySteps}>Henüz adım yok. Yukarıdan ekle.</Text>
          ) : (
            <View style={styles.seqList}>
              {steps.map((s, i) => (
                <View key={i} style={styles.seqItem}>
                  <Text style={styles.seqNum}>{i + 1}</Text>
                  <Text style={styles.seqEmoji}>{STEP_META[s].emoji}</Text>
                  <Text style={styles.seqName}>{STEP_META[s].label}</Text>
                  <TouchableOpacity onPress={() => removeStep(i)} style={styles.seqRemove}>
                    <Text style={styles.seqRemoveTxt}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Preview */}
        <View style={[styles.card, styles.preview]}>
          <Text style={styles.previewLbl}>Bu tarif şunları verir</Text>
          <Text style={styles.previewVals}>🍴 +{preview.hunger}   💗 +{preview.happiness}   ⭐ +{preview.xp} XP</Text>
        </View>

        <BigButton primary accent={accent} disabled={!canSave} onPress={save}>Tarifi Kaydet</BigButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#faf6f0' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn:    { width: 60 },
  closeTxt:    { fontSize: 13, fontWeight: '700', color: '#7a6f5e' },
  title:       { fontSize: 18, fontWeight: '900', color: '#1d2733' },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  step:        { fontSize: 13, fontWeight: '800', color: '#3a3530' },
  nameInput:   { borderWidth: 1.5, borderColor: '#eee5d4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700', color: '#1d2733', backgroundColor: '#faf6f0' },
  ingRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ingIcon:     { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0000000a', alignItems: 'center', justifyContent: 'center' },
  ingName:     { flex: 1, fontSize: 14, fontWeight: '700', color: '#3a3530' },
  counter:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: '#eee5d4', alignItems: 'center', justifyContent: 'center' },
  counterTxt:  { fontSize: 22, fontWeight: '900', color: '#1d2733' },
  counterVal:  { fontSize: 18, fontWeight: '800', color: '#1d2733', minWidth: 18, textAlign: 'center' },
  stepPicker:  { flexDirection: 'row', gap: 8 },
  stepBtn:     { flex: 1, backgroundColor: '#faf6f0', borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: '#eee5d4' },
  stepEmoji:   { fontSize: 26 },
  stepBtnTxt:  { fontSize: 10, fontWeight: '700', color: '#3a3530' },
  emptySteps:  { fontSize: 12, color: '#b8a89a', textAlign: 'center', paddingVertical: 8 },
  seqList:     { gap: 6 },
  seqItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#faf6f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  seqNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1d2733', color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  seqEmoji:    { fontSize: 20 },
  seqName:     { flex: 1, fontSize: 13, fontWeight: '700', color: '#3a3530' },
  seqRemove:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffe0e0' },
  seqRemoveTxt:{ fontSize: 13, fontWeight: '800', color: '#FF6B6B' },
  preview:     { backgroundColor: '#dff4ec' },
  previewLbl:  { fontSize: 11, fontWeight: '700', color: '#5a7f72', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewVals: { fontSize: 15, fontWeight: '800', color: '#1d2733' },
});
