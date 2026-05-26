import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { EvaSprite } from '../sprite/EvaSprite';

type Step =
  | 'welcome'
  | 'ble_pair'
  | 'restore_check'
  | 'name'
  | 'cooking'
  | 'cinema'
  | 'exercise'
  | 'shopping'
  | 'syncing'
  | 'done';

const ACCENT = '#7BD3B8';

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { bleStatus, setPrefs, prefs } = useEvaStore();
  const { sendPrefs, reconnect } = useBLE();

  const [step, setStep] = useState<Step>('welcome');
  const [petName, setPetName] = useState('Eva');
  const [answers, setAnswers] = useState({
    likesCooking: false,
    cinemaSleepy: false,
    likesExercise: false,
    likesShopping: false,
  });

  const go = (next: Step) => setStep(next);

  const answer = (key: keyof typeof answers, val: boolean) => {
    setAnswers(a => ({ ...a, [key]: val }));
  };

  const syncAndFinish = async () => {
    go('syncing');
    const finalPrefs = {
      petName: petName.trim() || 'Eva',
      ...answers,
      pairedAt: new Date().toISOString(),
    };
    await setPrefs(finalPrefs);
    await sendPrefs(finalPrefs);
    setTimeout(() => { go('done'); }, 1200);
  };

  const YesNo = ({ q, k }: { q: string; k: keyof typeof answers }) => (
    <View style={styles.card}>
      <Text style={styles.cardQ}>{q}</Text>
      <View style={styles.ynRow}>
        <TouchableOpacity onPress={() => answer(k, true)} activeOpacity={0.8}
          style={[styles.ynBtn, answers[k] === true && { backgroundColor: ACCENT }]}>
          <Text style={[styles.ynTxt, answers[k] === true && { color: '#fff' }]}>Evet</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => answer(k, false)} activeOpacity={0.8}
          style={[styles.ynBtn, answers[k] === false && { backgroundColor: '#FF9D7A' }]}>
          <Text style={[styles.ynTxt, answers[k] === false && { color: '#fff' }]}>Hayır</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Welcome ───────────────────────────────────────────────────────────────
  if (step === 'welcome') return (
    <View style={styles.screen}>
      <View style={styles.spriteWrap}>
        <EvaSprite mood="excited" size={80} />
      </View>
      <Text style={styles.headline}>Merhaba!</Text>
      <Text style={styles.body}>Eva'na hoş geldin. Birkaç adımda ona seni tanıtalım.</Text>
      <BigBtn onPress={() => go('ble_pair')}>Başlayalım →</BigBtn>
    </View>
  );

  // ── BLE Pair ─────────────────────────────────────────────────────────────
  if (step === 'ble_pair') return (
    <View style={styles.screen}>
      <Text style={styles.stepLabel}>1 / 7</Text>
      <Text style={styles.headline}>Cihazı eşle</Text>
      <Text style={styles.body}>Eva'nın cihazını açın ve yakına getirin.</Text>
      <View style={[styles.statusBox, { borderColor: bleStatus === 'connected' ? ACCENT : '#ccc' }]}>
        <Text style={styles.statusDot}>{bleStatus === 'connected' ? '🟢' : bleStatus === 'scanning' ? '🔵' : '⚫'}</Text>
        <Text style={styles.statusTxt}>
          {bleStatus === 'connected' ? 'Bağlantı kuruldu!' :
           bleStatus === 'scanning' ? 'Aranıyor…' : 'Bağlı değil'}
        </Text>
      </View>
      {bleStatus !== 'connected' && (
        <TouchableOpacity onPress={reconnect} style={[styles.outlineBtn, { borderColor: ACCENT }]}>
          <Text style={[styles.outlineTxt, { color: ACCENT }]}>Tekrar tara</Text>
        </TouchableOpacity>
      )}
      <BigBtn onPress={() => go('restore_check')} disabled={bleStatus !== 'connected'}>
        Devam →
      </BigBtn>
      <TouchableOpacity onPress={() => go('restore_check')}>
        <Text style={styles.skip}>Şimdilik geç</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Restore check ─────────────────────────────────────────────────────────
  if (step === 'restore_check') return (
    <View style={styles.screen}>
      <Text style={styles.stepLabel}>2 / 7</Text>
      <Text style={styles.headline}>Daha önce kullandın mı?</Text>
      <Text style={styles.body}>Cihazda kayıtlı bir profil varsa geri yüklenecek.</Text>
      <BigBtn onPress={() => {
        if (prefs?.petName) { onComplete(); } else { go('name'); }
      }}>
        {prefs?.petName ? `"${prefs.petName}" olarak devam et` : 'Yeni profil oluştur'}
      </BigBtn>
    </View>
  );

  // ── Name ──────────────────────────────────────────────────────────────────
  if (step === 'name') return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <Text style={styles.stepLabel}>3 / 7</Text>
      <Text style={styles.headline}>Eva'nın adı ne olsun?</Text>
      <TextInput
        style={styles.nameInput}
        value={petName}
        onChangeText={setPetName}
        placeholder="Eva"
        maxLength={16}
        autoFocus
      />
      <BigBtn onPress={() => go('cooking')} disabled={!petName.trim()}>Devam →</BigBtn>
    </KeyboardAvoidingView>
  );

  // ── Questions ─────────────────────────────────────────────────────────────
  if (step === 'cooking') return (
    <View style={styles.screen}>
      <Text style={styles.stepLabel}>4 / 7</Text>
      <Text style={styles.headline}>Yemek pişirmeyi sever mi?</Text>
      <Text style={styles.body}>Bu, mutfak aktivitelerini etkiler.</Text>
      <YesNo q="Yemek pişirmekten keyif alır mı?" k="likesCooking" />
      <BigBtn onPress={() => go('cinema')}>Devam →</BigBtn>
    </View>
  );

  if (step === 'cinema') return (
    <View style={styles.screen}>
      <Text style={styles.stepLabel}>5 / 7</Text>
      <Text style={styles.headline}>Sinema onu uyutur mu?</Text>
      <Text style={styles.body}>Film izlerken enerji durumunu etkiler.</Text>
      <YesNo q="Sinema izlerken uyur mu?" k="cinemaSleepy" />
      <BigBtn onPress={() => go('exercise')}>Devam →</BigBtn>
    </View>
  );

  if (step === 'exercise') return (
    <View style={styles.screen}>
      <Text style={styles.stepLabel}>6 / 7</Text>
      <Text style={styles.headline}>Spor yapmayı sever mi?</Text>
      <Text style={styles.body}>Gym aktivitelerini etkiler.</Text>
      <YesNo q="Egzersiz yapmaktan hoşlanır mı?" k="likesExercise" />
      <BigBtn onPress={() => go('shopping')}>Devam →</BigBtn>
    </View>
  );

  if (step === 'shopping') return (
    <View style={styles.screen}>
      <Text style={styles.stepLabel}>7 / 7</Text>
      <Text style={styles.headline}>Alışveriş yapmayı sever mi?</Text>
      <Text style={styles.body}>Market aktivitelerini etkiler.</Text>
      <YesNo q="Alışverişten keyif alır mı?" k="likesShopping" />
      <BigBtn onPress={syncAndFinish}>Kaydet ve başla →</BigBtn>
    </View>
  );

  // ── Syncing ───────────────────────────────────────────────────────────────
  if (step === 'syncing') return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={styles.body}>Cihaza gönderiliyor…</Text>
    </View>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={styles.spriteWrap}>
        <EvaSprite mood="happy" size={80} />
      </View>
      <Text style={styles.headline}>Hazır! 🎉</Text>
      <Text style={styles.body}>Merhaba {petName}! Hadi oynamaya başlayalım.</Text>
      <BigBtn onPress={onComplete}>Hadi!</BigBtn>
    </View>
  );
}

function BigBtn({ children, onPress, disabled }: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={[styles.bigBtn, disabled && { opacity: 0.4 }]}>
      <Text style={styles.bigBtnTxt}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: '#faf6f0', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  stepLabel:  { fontSize: 11, color: '#aaa', fontFamily: 'monospace' },
  headline:   { fontSize: 26, fontWeight: '900', color: '#3a3530', textAlign: 'center' },
  body:       { fontSize: 14, color: '#7a6f5e', textAlign: 'center', lineHeight: 20 },
  spriteWrap: { marginBottom: 8 },
  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardQ:      { fontSize: 14, fontWeight: '700', color: '#3a3530' },
  ynRow:      { flexDirection: 'row', gap: 10 },
  ynBtn:      { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#eee5d4', alignItems: 'center' },
  ynTxt:      { fontSize: 14, fontWeight: '700', color: '#3a3530' },
  bigBtn:     { backgroundColor: ACCENT, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center' },
  bigBtnTxt:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  outlineBtn: { borderWidth: 1.5, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  outlineTxt: { fontSize: 14, fontWeight: '700' },
  skip:       { fontSize: 13, color: '#aaa', marginTop: 4 },
  statusBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, width: '100%' },
  statusDot:  { fontSize: 18 },
  statusTxt:  { fontSize: 14, fontWeight: '600', color: '#3a3530' },
  nameInput:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 18, fontWeight: '700', width: '100%', borderWidth: 1.5, borderColor: '#ddd', color: '#3a3530' },
});
