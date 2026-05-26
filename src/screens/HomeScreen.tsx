import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';
import { EvaSprite } from '../sprite/EvaSprite';
import { ItemSprite } from '../sprite/ItemSprite';
import { StatBar } from '../components/StatBar';
import { CoinHud } from '../components/CoinHud';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ScenePlaceholder } from '../components/ScenePlaceholder';
import { WashGame } from '../minigames/WashGame';
import { FeedSnack, SnackId } from '../minigames/FeedSnack';
import { RestGame } from '../minigames/RestGame';
import { BubbleGame } from '../minigames/BubbleGame';

type ActiveModal = 'wash' | 'feed' | 'rest' | 'play' | null;

const MOOD_LABEL: Record<string, string> = {
  happy:   'iyi hissediyorum',
  sleepy:  'birazcık uykum var',
  sad:     'biraz üzülüyorum',
  excited: 'çok heyecanlı!',
  hungry:  'karnım acıktı',
};

const SCENE_NAMES: Record<string, string> = {
  bedroom: 'Yatak Odası', restaurant: 'Restoran', kitchen: 'Mutfak',
  playground: 'Oyun Alanı', market: 'Market', gym: 'Spor Salonu',
  cafe: 'Kafe', cinema: 'Sinema',
};

const SNACK_DELTAS: Record<SnackId, { hunger: number; happiness?: number; health?: number; energy?: number }> = {
  apple:  { hunger: 15, health: 3 },
  cookie: { hunger: 12, happiness: 8 },
  banana: { hunger: 18, energy: 5 },
};

export default function HomeScreen() {
  const {
    mood, stats, coins, scene, bleStatus, proximity, accent = '#7BD3B8',
    toast, playgroundDone,
  } = useEvaStore();
  const { sendMood } = useBLE();
  const insets = useSafeAreaInsets();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  useEffect(() => {
    sendMood(mood, stats as unknown as Record<string, number>);
  }, [mood, stats]);

  const QUICK_ACTIONS: { id: ActiveModal & string; label: string; emoji: string; color: string }[] = [
    { id: 'feed',  label: 'Besle',   emoji: 'apple',  color: '#FF6B6B' },
    { id: 'play',  label: 'Oyna',    emoji: 'star',   color: '#FFD93D' },
    { id: 'rest',  label: 'Dinlen',  emoji: 'heart',  color: '#5C8EE8' },
    { id: 'wash',  label: 'Yıka',    emoji: 'soda',   color: '#7BD3B8' },
  ];

  const onWashClose = (completed: boolean) => {
    setActiveModal(null);
    if (completed) {
      useEvaStore.setState(s => ({
        stats:     { ...s.stats, clean: Math.min(100, s.stats.clean + 30), happiness: Math.min(100, s.stats.happiness + 5) },
        lastToast: { msg: 'Tertemiz! +30 🧼', key: Date.now() },
      }));
    }
  };

  const onFeedClose = (choice: SnackId | null) => {
    setActiveModal(null);
    if (choice) {
      const delta = SNACK_DELTAS[choice];
      useEvaStore.setState(s => {
        const ns = { ...s.stats };
        (Object.keys(delta) as (keyof typeof delta)[]).forEach(k => {
          ns[k as keyof typeof ns] = Math.min(100, (ns[k as keyof typeof ns] as number) + (delta[k] as number));
        });
        return { stats: ns, lastToast: { msg: `Mmm, ${choice === 'apple' ? 'elma' : choice === 'cookie' ? 'kurabiye' : 'muz'}! 😋`, key: Date.now() } };
      });
    }
  };

  const onRestClose = (completed: boolean) => {
    setActiveModal(null);
    if (completed) {
      useEvaStore.setState(s => ({
        stats: { ...s.stats, energy: Math.min(100, s.stats.energy + 25), health: Math.min(100, s.stats.health + 3) },
        lastToast: { msg: 'Dinlendi! +25 Enerji ⚡', key: Date.now() },
      }));
    }
  };

  const onBubbleClose = (score: number) => {
    setActiveModal(null);
    if (score > 0) playgroundDone(score * 2);
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <ConnectionBadge status={bleStatus} proximity={proximity} accent={accent} />
          <CoinHud coins={coins} />
        </View>

        {/* Hero */}
        <View style={styles.heroBox}>
          <ScenePlaceholder
            scene={scene}
            label={`EV · ${(SCENE_NAMES[scene] ?? scene).toUpperCase()}`}
            height={240}
          />
          <View style={styles.evaCenter}>
            <EvaSprite mood={mood} scale={4} />
          </View>
          <View style={styles.speechBubble}>
            <Text style={styles.speechTxt}>{MOOD_LABEL[mood] ?? ''}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <StatBar icon="🍎" label="Açlık"    value={stats.hunger}    color="#FF6B6B" />
          <StatBar icon="💗" label="Mutluluk" value={stats.happiness} color="#FF7AA8" />
          <StatBar icon="⚡" label="Enerji"   value={stats.energy}    color="#FFD93D" />
          <StatBar icon="🚿" label="Temizlik" value={stats.clean}     color="#5C8EE8" />
          <StatBar icon="❤️" label="Sağlık"   value={stats.health}    color="#5BB89B" />
        </View>

        {/* Quick actions */}
        <View style={styles.actGrid}>
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.id}
              onPress={() => setActiveModal(a.id as ActiveModal)}
              style={styles.actBtn}
              activeOpacity={0.8}
            >
              <View style={[styles.actIcon, { backgroundColor: a.color + '22' }]}>
                <ItemSprite name={a.emoji} scale={2} />
              </View>
              <Text style={styles.actLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <WashGame   visible={activeModal === 'wash'} onClose={onWashClose} />
      <FeedSnack  visible={activeModal === 'feed'} onClose={onFeedClose} />
      <RestGame   visible={activeModal === 'rest'} onClose={onRestClose} />
      <BubbleGame visible={activeModal === 'play'} onClose={onBubbleClose} />
    </>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#faf6f0' },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroBox:      { position: 'relative', marginBottom: 16 },
  evaCenter:    { position: 'absolute', left: '50%', top: '52%', marginLeft: -48, marginTop: -48 },
  speechBubble: {
    position: 'absolute', right: 16, top: 16,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    borderWidth: 1.5, borderColor: '#1d2733',
  },
  speechTxt:    { fontSize: 11, fontWeight: '600', color: '#3a3530' },
  card:         {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    gap: 10, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  actGrid:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actBtn:       {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  actIcon:      { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actLabel:     { fontSize: 11, fontWeight: '600', color: '#3a3530' },
});
