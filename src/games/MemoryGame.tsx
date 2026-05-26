import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';

const EMOJIS = ['🍎', '🎈', '⭐', '🎵'];
const PAIRS = [...EMOJIS, ...EMOJIS];
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

type Card = { id: number; emoji: string; flipped: boolean; matched: boolean };

export function MemoryGame({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand } = useBLE();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const initCards = () => {
    setCards(shuffle(PAIRS).map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false })));
    setSelected([]); setMoves(0); setLocked(false);
  };

  const start = () => { initCards(); setPhase('playing'); };

  const flip = (id: number) => {
    if (locked) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;
    const newCards = cards.map(c => c.id === id ? { ...c, flipped: true } : c);
    const newSel = [...selected, id];
    setCards(newCards);
    setSelected(newSel);

    if (newSel.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = newSel.map(sid => newCards.find(c => c.id === sid)!);
      if (a.emoji === b.emoji) {
        const matched = newCards.map(c => newSel.includes(c.id) ? { ...c, matched: true } : c);
        setCards(matched);
        setSelected([]);
        setLocked(false);
        if (matched.every(c => c.matched)) setTimeout(() => setPhase('done'), 400);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => newSel.includes(c.id) ? { ...c, flipped: false } : c));
          setSelected([]);
          setLocked(false);
        }, 900);
      }
    }
  };

  const collect = () => {
    const earned = moves <= 4 ? 12 : moves <= 6 ? 8 : moves <= 8 ? 5 : 3;
    playgroundDone(earned);
    sendCommand({ cmd: 'game', type: 'memory_done', moves, earned });
    onBack();
  };

  if (phase === 'ready') return (
    <View style={styles.center}>
      <Text style={styles.title}>🃏 Hafıza</Text>
      <Text style={styles.sub}>4 çifti bul! Az hamlede daha fazla jeton.</Text>
      <TouchableOpacity onPress={start} style={[styles.btn, { backgroundColor: accent }]} activeOpacity={0.8}>
        <Text style={styles.btnTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'done') return (
    <View style={styles.center}>
      <Text style={styles.title}>🎉 Tebrikler!</Text>
      <Text style={styles.bigStat}>{moves}</Text>
      <Text style={styles.sub}>hamlede tamamladın</Text>
      <TouchableOpacity onPress={collect} style={[styles.btn, { backgroundColor: accent }]} activeOpacity={0.8}>
        <Text style={styles.btnTxt}>Jetonları al</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.moveTxt}>Hamle: {moves}</Text>
      <View style={styles.grid}>
        {cards.map(card => (
          <TouchableOpacity key={card.id} onPress={() => flip(card.id)}
            activeOpacity={0.8}
            style={[styles.card, card.matched && { backgroundColor: accent + '55' }]}>
            <Text style={styles.cardTxt}>
              {card.flipped || card.matched ? card.emoji : '?'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#1d2733', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  center:   { flex: 1, backgroundColor: '#1d2733', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title:    { fontSize: 28, fontWeight: '900', color: '#fff' },
  bigStat:  { fontSize: 72, fontWeight: '900', color: '#FFD93D' },
  sub:      { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  moveTxt:  { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  card:     { width: 80, height: 80, backgroundColor: '#2e3d4f', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff22' },
  cardTxt:  { fontSize: 36 },
  btn:      { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
