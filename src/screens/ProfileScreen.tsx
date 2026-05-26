import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvaStore } from '../store/useEvaStore';
import { EvaSprite } from '../sprite/EvaSprite';
import { StatBar } from '../components/StatBar';
import { CoinHud } from '../components/CoinHud';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { BigButton } from '../components/BigButton';

export default function ProfileScreen() {
  const {
    mood, stats, coins, charge, bleStatus, proximity, rssi,
    accent = '#7BD3B8', prefs,
  } = useEvaStore();

  const level = 7, xp = 62;
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <ConnectionBadge status={bleStatus} proximity={proximity} accent={accent} />
        <CoinHud coins={coins} />
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: accent + '22' }]}>
          <EvaSprite mood={mood} scale={3} />
        </View>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{prefs?.petName ?? 'Eva'}</Text>
            <Text style={styles.deviceId}>EVA-001</Text>
          </View>
          <Text style={styles.sub}>blob arkadaş · 4 gün önce evlat edinildi</Text>
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>SV {level}</Text>
            <Text style={styles.xpVal}>{xp}/100 XP</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xp}%`, backgroundColor: accent }]} />
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Yaşam</Text>
        <StatBar icon="🍎" label="Açlık"    value={stats.hunger}    color="#FF6B6B" />
        <StatBar icon="💗" label="Mutluluk" value={stats.happiness} color="#FF7AA8" />
        <StatBar icon="⚡" label="Enerji"   value={stats.energy}    color="#FFD93D" />
        <StatBar icon="🚿" label="Temizlik" value={stats.clean}     color="#5C8EE8" />
        <StatBar icon="❤️" label="Sağlık"   value={stats.health}    color="#5BB89B" />
      </View>

      {/* Prefs summary */}
      {prefs && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Kişilik</Text>
          {[
            ['Yemek pişirme', prefs.likesCooking ? '❤️ Seviyor' : '😒 Sevmiyor'],
            ['Sinemada',      prefs.cinemaSleepy ? '😴 Uyur'    : '🍿 Uyanık'],
            ['Spor',          prefs.likesExercise ? '💪 Seviyor' : '🥱 Zorla'],
            ['Alışveriş',     prefs.likesShopping ? '🛍️ Bayılır' : '⚡ Al-kaç'],
          ].map(([k, v]) => (
            <View key={k} style={styles.prefRow}>
              <Text style={styles.prefKey}>{k}</Text>
              <Text style={styles.prefVal}>{v}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Device */}
      <View style={[styles.card, styles.darkCard]}>
        <View style={styles.deviceRow}>
          <View>
            <Text style={styles.deviceLabel}>Eşleşmiş Cihaz</Text>
            <Text style={styles.deviceName}>Pi Zero 2W · OLED anahtarlık</Text>
          </View>
          <View style={[styles.dot, {
            backgroundColor: bleStatus === 'connected' ? '#5BB89B' : '#c44',
          }]} />
        </View>
        {[
          ['Durum',    bleStatus === 'connected' ? 'bağlı' : 'çevrimdışı'],
          ['Yakınlık', proximity],
          ['Sinyal',   bleStatus === 'connected' ? `${rssi} dBm` : '—'],
          ['Pil',      `${Math.round(charge * 100)}%`],
          ['Yazılım',  'eva.0.5.0'],
        ].map(([k, v]) => (
          <View key={k} style={styles.metaRow}>
            <Text style={styles.metaKey}>{k}</Text>
            <Text style={styles.metaVal}>{v}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, paddingHorizontal: 16 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  profileCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  avatar:      { width: 96, height: 96, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  nameRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  name:        { fontSize: 22, fontWeight: '800', color: '#3a3530' },
  deviceId:    { fontSize: 10, color: '#8a7f6e', letterSpacing: 0.5 },
  sub:         { fontSize: 11, color: '#8a7f6e', marginBottom: 8 },
  xpRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  xpLabel:     { fontSize: 11, fontWeight: '700', color: '#3a3530' },
  xpVal:       { fontSize: 11, color: '#8a7f6e' },
  xpTrack:     { height: 8, backgroundColor: '#eee5d4', borderRadius: 3, overflow: 'hidden' },
  xpFill:      { height: '100%', borderRadius: 3 },
  card:        { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  darkCard:    { backgroundColor: '#1d2733' },
  sectionLabel:{ fontSize: 10, fontWeight: '700', color: '#8a7f6e', letterSpacing: 1, textTransform: 'uppercase' },
  prefRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#0000000f' },
  prefKey:     { fontSize: 12, color: '#7a6f5e' },
  prefVal:     { fontSize: 12, fontWeight: '600', color: '#3a3530' },
  deviceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deviceLabel: { fontSize: 10, fontWeight: '700', color: '#ffffff99', letterSpacing: 1, textTransform: 'uppercase' },
  deviceName:  { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  metaRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#ffffff15' },
  metaKey:     { fontSize: 11, color: '#ffffff55', fontFamily: 'monospace' },
  metaVal:     { fontSize: 11, color: '#fff', fontFamily: 'monospace' },
});
