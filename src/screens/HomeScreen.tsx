import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvaStore, MediaMode } from '../store/useEvaStore';
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
import { setManualMediaMode } from '../services/MediaWatcher';

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

const SNACK_DELTAS: Record<SnackId, Partial<Record<string, number>>> = {
  apple:  { hunger: 15, health: 3 },
  cookie: { hunger: 12, happiness: 8 },
  banana: { hunger: 18, energy: 5 },
};

const MEDIA_LABEL: Record<MediaMode, { emoji: string; label: string; color: string }> = {
  none:  { emoji: '',   label: '',                color: '#fff' },
  music: { emoji: '🎵', label: 'Müzik Dinliyor',  color: '#a090ff' },
  video: { emoji: '🎬', label: 'Film İzliyor',    color: '#FF7AA8' },
};

export default function HomeScreen() {
  const {
    mood, stats, coins, scene, bleStatus, proximity, accent = '#7BD3B8',
    mediaMode, playgroundDone, setMediaMode,
  } = useEvaStore();
  const { sendMood, sendCommand } = useBLE();
  const insets = useSafeAreaInsets();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  useEffect(() => {
    sendMood(mood, stats as unknown as Record<string, number>);
  }, [mood, stats]);

  // Sync media mode to Pi whenever it changes
  useEffect(() => {
    if (mediaMode !== 'none') {
      sendCommand({ cmd: 'media', state: mediaMode });
    } else {
      sendCommand({ cmd: 'media', state: 'none' });
    }
  }, [mediaMode]);

  const QUICK_ACTIONS: { id: ActiveModal & string; label: string; emoji: string; color: string }[] = [
    { id: 'feed', label: 'Besle',  emoji: 'apple',  color: '#FF6B6B' },
    { id: 'play', label: 'Oyna',   emoji: 'star',   color: '#FFD93D' },
    { id: 'rest', label: 'Dinlen', emoji: 'heart',  color: '#5C8EE8' },
    { id: 'wash', label: 'Yıka',   emoji: 'soda',   color: '#7BD3B8' },
  ];

  const toggleMediaMode = (mode: 'music' | 'video') => {
    const next: MediaMode = mediaMode === mode ? 'none' : mode;
    setManualMediaMode(next, setMediaMode);
  };

  const openQuickAction = (action: ActiveModal) => {
    setActiveModal(action);
    if (action) {
      sendCommand({ cmd: 'activity', type: `${action}_start` });
    }
  };

  const onWashClose = (completed: boolean) => {
    setActiveModal(null);
    sendCommand({ cmd: 'activity', type: completed ? 'wash_done' : 'wash_cancel' });
    if (completed) {
      useEvaStore.setState(s => ({
        stats:     { ...s.stats, clean: Math.min(100, s.stats.clean + 28), happiness: Math.min(100, s.stats.happiness + 4) },
        lastToast: { msg: 'Tertemiz! +28 🧼', key: Date.now() },
      }));
    }
  };

  const onFeedClose = (choice: SnackId | null) => {
    setActiveModal(null);
    if (!choice) {
      sendCommand({ cmd: 'activity', type: 'feed_cancel' });
      return;
    }
    const delta = SNACK_DELTAS[choice];
    useEvaStore.setState(s => {
      const ns = { ...s.stats };
      (Object.keys(delta) as (keyof typeof ns)[]).forEach(k => {
        ns[k] = Math.min(100, (ns[k] as number) + (delta[k] as number));
      });
      return { stats: ns, lastToast: { msg: `Mmm! +${delta.hunger} Açlık 😋`, key: Date.now() } };
    });
    sendCommand({ cmd: 'activity', type: 'feed_done', item: choice });
  };

  const onRestClose = (completed: boolean) => {
    setActiveModal(null);
    sendCommand({ cmd: 'activity', type: completed ? 'rest_done' : 'rest_cancel' });
    if (completed) {
      useEvaStore.setState(s => ({
        stats: { ...s.stats, energy: Math.min(100, s.stats.energy + 22), health: Math.min(100, s.stats.health + 3) },
        lastToast: { msg: 'Dinlendi! +22 Enerji ⚡', key: Date.now() },
      }));
    }
  };

  const onBubbleClose = (score: number) => {
    setActiveModal(null);
    if (score > 0) {
      playgroundDone(score * 2);
      sendCommand({ cmd: 'activity', type: 'play_done', score, earned: score * 2 });
    } else {
      sendCommand({ cmd: 'activity', type: 'play_cancel' });
    }
  };

  const mediaBadge = MEDIA_LABEL[mediaMode];

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

        {/* Media mode banner */}
        {mediaMode !== 'none' && (
          <TouchableOpacity
            onPress={() => toggleMediaMode(mediaMode as 'music' | 'video')}
            style={[styles.mediaBanner, { backgroundColor: mediaBadge.color + '22', borderColor: mediaBadge.color }]}
          >
            <Text style={styles.mediaEmoji}>{mediaBadge.emoji}</Text>
            <View style={styles.mediaTextCol}>
              <Text style={[styles.mediaLabel, { color: mediaBadge.color }]}>{mediaBadge.label}</Text>
              <Text style={styles.mediaSub}>
                {mediaMode === 'music' ? 'Mutluluk ↑ · Enerji ↓' : 'Mutluluk ↑↑ · Enerji ↓↓ · Açlık ↓'}
              </Text>
            </View>
            <Text style={styles.mediaClose}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Hero */}
        <View style={styles.heroBox}>
          <ScenePlaceholder
            scene={scene}
            label={`EV · ${(SCENE_NAMES[scene] ?? scene).toUpperCase()}`}
            height={220}
          />
          <View style={styles.evaCenter}>
            <EvaSprite mood={mood} scale={4} />
          </View>
          <View style={styles.speechBubble}>
            <Text style={styles.speechTxt}>{MOOD_LABEL[mood] ?? ''}</Text>
          </View>
          {mediaMode !== 'none' && (
            <View style={styles.mediaOverlay}>
              <Text style={styles.mediaOverlayEmoji}>{mediaBadge.emoji}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <StatBar icon="🍎" label="Açlık"    value={stats.hunger}    color="#FF6B6B" />
          <StatBar icon="💗" label="Mutluluk" value={stats.happiness} color="#FF7AA8" />
          <StatBar icon="⚡" label="Enerji"   value={stats.energy}    color="#FFD93D" />
          <StatBar icon="🚿" label="Temizlik" value={stats.clean}     color="#5C8EE8" />
          <StatBar icon="❤️" label="Sağlık"   value={stats.health}    color="#5BB89B" />
        </View>

        {/* Media quick toggles */}
        <View style={styles.mediaRow}>
          <TouchableOpacity
            onPress={() => toggleMediaMode('music')}
            style={[styles.mediaToggle, mediaMode === 'music' && styles.mediaToggleActive]}
          >
            <Text style={styles.mediaToggleEmoji}>🎵</Text>
            <Text style={styles.mediaToggleTxt}>Müzik</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleMediaMode('video')}
            style={[styles.mediaToggle, mediaMode === 'video' && { ...styles.mediaToggleActive, borderColor: '#FF7AA8', backgroundColor: '#FF7AA833' }]}
          >
            <Text style={styles.mediaToggleEmoji}>🎬</Text>
            <Text style={styles.mediaToggleTxt}>Film</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.actGrid}>
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.id}
              onPress={() => openQuickAction(a.id as ActiveModal)}
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
  screen:          { flex: 1, backgroundColor: '#faf6f0' },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  mediaBanner:     {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10,
  },
  mediaEmoji:      { fontSize: 24 },
  mediaTextCol:    { flex: 1 },
  mediaLabel:      { fontSize: 13, fontWeight: '800' },
  mediaSub:        { fontSize: 10, color: '#8a7f6e', marginTop: 1 },
  mediaClose:      { fontSize: 16, color: '#aaa' },
  heroBox:         { position: 'relative', marginBottom: 14 },
  evaCenter:       { position: 'absolute', left: '50%', top: '52%', marginLeft: -48, marginTop: -48 },
  speechBubble:    {
    position: 'absolute', right: 14, top: 12,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    borderWidth: 1.5, borderColor: '#1d2733',
  },
  speechTxt:       { fontSize: 11, fontWeight: '600', color: '#3a3530' },
  mediaOverlay:    {
    position: 'absolute', left: 14, top: 12,
    backgroundColor: '#fff', borderRadius: 10, padding: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  mediaOverlayEmoji: { fontSize: 20 },
  card:            {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    gap: 10, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  mediaRow:        { flexDirection: 'row', gap: 8, marginBottom: 10 },
  mediaToggle:     {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#eee5d4',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  mediaToggleActive: { borderColor: '#a090ff', backgroundColor: '#a090ff22' },
  mediaToggleEmoji:  { fontSize: 18 },
  mediaToggleTxt:    { fontSize: 12, fontWeight: '700', color: '#3a3530' },
  actGrid:         { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actBtn:          {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  actIcon:         { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actLabel:        { fontSize: 11, fontWeight: '600', color: '#3a3530' },
});
