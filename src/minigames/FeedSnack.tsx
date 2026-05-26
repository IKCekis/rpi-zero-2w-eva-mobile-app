import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
} from 'react-native';
import { EvaSprite } from '../sprite/EvaSprite';

interface Props {
  visible: boolean;
  onClose: (choice: SnackId | null) => void;
}

export type SnackId = 'apple' | 'cookie' | 'banana';

const SNACKS: { id: SnackId; emoji: string; name: string; desc: string; color: string }[] = [
  { id: 'apple',  emoji: '🍎', name: 'Elma',     desc: '+15 Açlık\n+3 Sağlık',    color: '#FF6B6B' },
  { id: 'cookie', emoji: '🍪', name: 'Kurabiye', desc: '+12 Açlık\n+8 Mutluluk',  color: '#FFD93D' },
  { id: 'banana', emoji: '🍌', name: 'Muz',      desc: '+18 Açlık\n+5 Enerji',    color: '#FFCA6B' },
];

export function FeedSnack({ visible, onClose }: Props) {
  const [picked, setPicked] = useState<SnackId | null>(null);
  const scales = useRef(SNACKS.map(() => new Animated.Value(1)));

  const pick = (id: SnackId, index: number) => {
    if (picked) return;
    setPicked(id);
    Animated.sequence([
      Animated.timing(scales.current[index], { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.timing(scales.current[index], { toValue: 0,    duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        setPicked(null);
        scales.current.forEach(s => s.setValue(1));
        onClose(id);
      }, 400);
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={() => { setPicked(null); scales.current.forEach(s => s.setValue(1)); }}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Ne yemek istersin? 🍽️</Text>

          <View style={styles.evaRow}>
            <EvaSprite mood={picked ? 'happy' : 'hungry'} scale={2.5} />
            {picked && <Text style={styles.speechBubble}>Mmm, {SNACKS.find(s => s.id === picked)?.name}! 😋</Text>}
          </View>

          <View style={styles.snackRow}>
            {SNACKS.map((s, i) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => pick(s.id, i)}
                activeOpacity={0.8}
                style={styles.card}
              >
                <Animated.View style={[styles.emojiCircle, { backgroundColor: s.color + '33', transform: [{ scale: scales.current[i] }] }]}>
                  <Text style={styles.emoji}>{s.emoji}</Text>
                </Animated.View>
                <Text style={styles.snackName}>{s.name}</Text>
                <Text style={styles.snackDesc}>{s.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => onClose(null)} style={styles.cancel}>
            <Text style={styles.cancelTxt}>Aç değilim</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       {
    backgroundColor: '#fffbf4', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, alignItems: 'center', gap: 16,
  },
  title:       { fontSize: 20, fontWeight: '800', color: '#3a3530' },
  evaRow:      { flexDirection: 'row', alignItems: 'center', gap: 16, height: 80 },
  speechBubble:{
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#1d2733',
    paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '600', color: '#3a3530',
  },
  snackRow:    { flexDirection: 'row', gap: 12 },
  card:        {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  emojiCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emoji:       { fontSize: 32 },
  snackName:   { fontSize: 13, fontWeight: '800', color: '#3a3530' },
  snackDesc:   { fontSize: 10, color: '#8a7f6e', textAlign: 'center', lineHeight: 15 },
  cancel:      {},
  cancelTxt:   { fontSize: 13, color: '#aaa' },
});
