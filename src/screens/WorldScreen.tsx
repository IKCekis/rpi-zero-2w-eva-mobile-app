import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { CoinHud } from '../components/CoinHud';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ScenePlaceholder } from '../components/ScenePlaceholder';
import { SceneName } from '../store/types';
// Activity imports
import { KitchenActivity }    from '../activities/KitchenActivity';
import { HomeActivity }       from '../activities/HomeActivity';
import { RestaurantActivity } from '../activities/RestaurantActivity';
import { CinemaActivity }     from '../activities/CinemaActivity';
import { GymActivity }        from '../activities/GymActivity';
import { MarketActivity }     from '../activities/MarketActivity';
import { PlaygroundActivity } from '../activities/PlaygroundActivity';

const PLACES: {
  id: SceneName; name: string; sub: string; cost: number; unlocked: boolean;
}[] = [
  { id: 'bedroom',    name: 'Yatak Odası', sub: 'dinlen ve şarj ol',         cost: 0,  unlocked: true  },
  { id: 'restaurant', name: 'Restoran',    sub: 'şık yemekler ye',           cost: 8,  unlocked: true  },
  { id: 'kitchen',    name: 'Mutfak',      sub: 'kendin pişir',              cost: 0,  unlocked: true  },
  { id: 'playground', name: 'Oyun Alanı',  sub: 'arkadaşlarla oyna',         cost: 0,  unlocked: true  },
  { id: 'market',     name: 'Market',      sub: 'alışveriş yap',             cost: 0,  unlocked: true  },
  { id: 'gym',        name: 'Spor Salonu', sub: 'enerji seviyeni yükselt',   cost: 12, unlocked: true  },
  { id: 'cafe',       name: 'Kafe',        sub: 'sıcak okuma köşesi',        cost: 4,  unlocked: false },
  { id: 'cinema',     name: 'Sinema',      sub: 'romantik gece',             cost: 18, unlocked: false },
];

export default function WorldScreen() {
  const { coins, scene: activeScene, bleStatus, proximity, accent = '#7BD3B8' } = useEvaStore();
  const [openScene, setOpenScene] = useState<SceneName | null>(null);

  // Render scene activity
  const goBack = () => setOpenScene(null);
  if (openScene) {
    switch (openScene) {
      case 'kitchen':    return <KitchenActivity    onBack={goBack} />;
      case 'bedroom':    return <HomeActivity       onBack={goBack} />;
      case 'restaurant': return <RestaurantActivity onBack={goBack} />;
      case 'cinema':     return <CinemaActivity     onBack={goBack} />;
      case 'gym':        return <GymActivity        onBack={goBack} />;
      case 'market':     return <MarketActivity     onBack={goBack} />;
      case 'playground': return <PlaygroundActivity onBack={goBack} />;
      default:           return null;
    }
  }

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <ConnectionBadge status={bleStatus} proximity={proximity} accent={accent} />
        <CoinHud coins={coins} />
      </View>

      <Text style={styles.sectionLabel}>Eva'nın Dünyası · {PLACES.length} mekan</Text>

      <View style={styles.grid}>
        {PLACES.map(place => {
          const locked   = !place.unlocked;
          const isActive = place.id === activeScene;
          return (
            <TouchableOpacity
              key={place.id}
              onPress={() => !locked && setOpenScene(place.id)}
              disabled={locked}
              activeOpacity={0.85}
              style={[
                styles.card,
                isActive && { borderColor: accent, borderWidth: 2.5 },
                locked && { opacity: 0.55 },
              ]}
            >
              <ScenePlaceholder scene={place.id} height={90} />
              {locked && (
                <View style={styles.lockOverlay}>
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockTxt}>SV {place.id === 'cafe' ? 3 : 5}</Text>
                  </View>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardName}>{place.name}</Text>
                  {place.cost > 0 && <Text style={styles.cardCost}>−{place.cost}¢</Text>}
                </View>
                <Text style={styles.cardSub}>{place.sub}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, paddingHorizontal: 16 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8a7f6e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  card:         {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    borderWidth: 1.5, borderColor: '#0000000f',
  },
  lockOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,20,30,0.55)', alignItems: 'center', justifyContent: 'center' },
  lockBadge:    { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  lockTxt:      { fontSize: 10, fontWeight: '700', color: '#3a3530', letterSpacing: 1 },
  cardBody:     { padding: 10 },
  cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  cardName:     { fontSize: 14, fontWeight: '700', color: '#3a3530' },
  cardCost:     { fontSize: 10, color: '#8a7f6e', fontVariant: ['tabular-nums'] },
  cardSub:      { fontSize: 11, color: '#8a7f6e' },
});
