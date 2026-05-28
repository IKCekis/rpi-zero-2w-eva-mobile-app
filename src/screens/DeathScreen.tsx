import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearState } from '../services/StatDecay';

const REVIVAL_CODE = 'HNKOEE';

interface Props {
  onReviveSoft: () => void; // correct code — stats reset, profile kept
  onReviveNew:  () => void; // new Eva — full reset + onboarding
}

type Phase = 'mourning' | 'code' | 'confirm_new';

export function DeathScreen({ onReviveSoft, onReviveNew }: Props) {
  const insets        = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('mourning');
  const [code, setCode]   = useState('');
  const [error, setError] = useState('');
  const fadeIn            = useRef(new Animated.Value(0)).current;
  const heartbeat         = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 1200, useNativeDriver: true }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeat, { toValue: 1.08, duration: 400, useNativeDriver: true }),
        Animated.timing(heartbeat, { toValue: 1.0,  duration: 400, useNativeDriver: true }),
        Animated.delay(1600),
      ])
    );
    pulse.start();
    const stop = setTimeout(() => pulse.stop(), 4000);
    return () => clearTimeout(stop);
  }, []);

  const tryRevive = async () => {
    if (code.trim().toUpperCase() !== REVIVAL_CODE) {
      setError('Yanlış şifre. Eva sana güveniyor mu?');
      setCode('');
      return;
    }
    // Correct code: soft revival — disk state is stale but Pi will push fresh
    // stats on next connect; clear local dead-state from disk only.
    await clearState();
    onReviveSoft();
  };

  const confirmNewEva = async () => {
    await clearState();
    await AsyncStorage.removeItem('eva_onboarded');
    onReviveNew();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>

        <Animated.View style={[styles.evaContainer, { transform: [{ scale: heartbeat }] }]}>
          <Text style={styles.evaEmoji}>🤍</Text>
          <Text style={styles.crossedEyes}>x_x</Text>
        </Animated.View>

        <Text style={styles.heading}>Eva gitti...</Text>
        <Text style={styles.sub}>
          Çok özledin, çok yoruldu, kimse bakmadı.{'\n'}
          Şimdi huzurlu bir yerde uyuyor.
        </Text>

        {phase === 'mourning' && (
          <View style={styles.btnGroup}>
            <TouchableOpacity onPress={() => setPhase('code')} style={styles.reviveBtn}>
              <Text style={styles.reviveTxt}>Geri Getir ✨</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhase('confirm_new')} style={styles.newBtn}>
              <Text style={styles.newTxt}>Yeni Eva Oluştur 🌱</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'code' && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Canlandırma şifresi</Text>
            <Text style={styles.codeHint}>
              Doğru şifreyle Eva geri döner — tüm birikimin korunur, sadece statlar yarıya çıkar.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={t => { setCode(t); setError(''); }}
              placeholder="••••••"
              placeholderTextColor="#555"
              autoCapitalize="characters"
              maxLength={6}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={tryRevive}
              autoFocus
            />
            {!!error && <Text style={styles.errorTxt}>{error}</Text>}
            <TouchableOpacity onPress={tryRevive} style={styles.confirmBtn}>
              <Text style={styles.confirmTxt}>Onayla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPhase('mourning'); setError(''); setCode(''); }}>
              <Text style={styles.cancelTxt}>İptal</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'confirm_new' && (
          <View style={styles.codeBox}>
            <Text style={styles.confirmNewTitle}>Emin misin?</Text>
            <Text style={styles.confirmNewDesc}>
              Tüm ilerleme, envanter ve birikimler silinecek.{'\n'}
              Yepyeni bir Eva başlayacak.
            </Text>
            <TouchableOpacity onPress={confirmNewEva} style={styles.dangerBtn}>
              <Text style={styles.dangerTxt}>Evet, Yeni Eva Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhase('mourning')}>
              <Text style={styles.cancelTxt}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#0a0a14', alignItems: 'center', justifyContent: 'center' },
  content:          { alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  evaContainer:     { alignItems: 'center', marginBottom: 12 },
  evaEmoji:         { fontSize: 64 },
  crossedEyes:      { fontSize: 24, color: '#444', fontFamily: 'monospace', letterSpacing: 4, marginTop: -8 },
  heading:          { fontSize: 32, fontWeight: '900', color: '#c0b0cc', letterSpacing: -0.5 },
  sub:              { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  btnGroup:         { width: '100%', alignItems: 'center', gap: 12, marginTop: 24 },
  reviveBtn:        {
    borderWidth: 1.5, borderColor: '#a090ff',
    borderRadius: 20, paddingHorizontal: 32, paddingVertical: 14, width: '80%', alignItems: 'center',
  },
  reviveTxt:        { fontSize: 16, fontWeight: '700', color: '#a090ff' },
  newBtn:           { paddingVertical: 10 },
  newTxt:           { fontSize: 14, color: '#444' },
  codeBox:          { width: '100%', alignItems: 'center', gap: 12, marginTop: 16 },
  codeLabel:        { fontSize: 12, color: '#666', letterSpacing: 1, textTransform: 'uppercase' },
  codeHint:         { fontSize: 12, color: '#555', textAlign: 'center', lineHeight: 18 },
  codeInput:        {
    width: '70%', borderWidth: 1.5, borderColor: '#333', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center',
    letterSpacing: 6, backgroundColor: '#111',
  },
  errorTxt:         { fontSize: 12, color: '#ff6b6b', textAlign: 'center' },
  confirmBtn:       {
    backgroundColor: '#a090ff', borderRadius: 16,
    paddingHorizontal: 36, paddingVertical: 12, width: '80%', alignItems: 'center',
  },
  confirmTxt:       { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancelTxt:        { fontSize: 13, color: '#444', paddingVertical: 8 },
  confirmNewTitle:  { fontSize: 20, fontWeight: '800', color: '#c0b0cc' },
  confirmNewDesc:   { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20 },
  dangerBtn:        {
    backgroundColor: '#ff6b6b', borderRadius: 16,
    paddingHorizontal: 36, paddingVertical: 12, width: '80%', alignItems: 'center',
    marginTop: 8,
  },
  dangerTxt:        { fontSize: 15, fontWeight: '800', color: '#fff' },
});
