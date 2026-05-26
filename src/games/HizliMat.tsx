import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEvaStore } from '../store/useEvaStore';
import { useBLE } from '../ble/BLEContext';

const QUESTIONS = 5;
const TIME_PER_Q = 10;

type Question = { q: string; answer: number; choices: number[] };

const genQuestion = (): Question => {
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * 3)];
  let a = Math.floor(Math.random() * 12) + 1;
  let b = Math.floor(Math.random() * 12) + 1;
  let answer: number;
  let q: string;
  if (op === '+')  { answer = a + b; q = `${a} + ${b}`; }
  else if (op === '-') { if (a < b) [a, b] = [b, a]; answer = a - b; q = `${a} − ${b}`; }
  else { answer = a * b; q = `${a} × ${b}`; }

  const wrongs = new Set<number>();
  while (wrongs.size < 2) {
    const w = answer + Math.floor(Math.random() * 7) - 3;
    if (w !== answer && w >= 0) wrongs.add(w);
  }
  const choices = [...wrongs, answer].sort(() => Math.random() - 0.5);
  return { q, answer, choices };
};

export function HizliMat({ onBack }: { onBack: () => void }) {
  const { accent = '#7BD3B8', playgroundDone } = useEvaStore();
  const { sendCommand } = useBLE();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [qIndex, setQIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [totalEarned, setTotalEarned] = useState(0);
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(TIME_PER_Q);

  const startQ = (idx: number) => {
    setQIndex(idx);
    setQuestion(genQuestion());
    setTimeLeft(TIME_PER_Q);
    timeRef.current = TIME_PER_Q;
    setLastResult(null);
    timerRef.current = setInterval(() => {
      timeRef.current -= 1;
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) {
        clearInterval(timerRef.current!);
        advance(0, idx);
      }
    }, 1000);
  };

  const advance = (earned: number, idx: number) => {
    setTotalEarned(t => t + earned);
    if (idx + 1 >= QUESTIONS) {
      setPhase('done');
    } else {
      setTimeout(() => startQ(idx + 1), 600);
    }
  };

  const answer = (choice: number) => {
    clearInterval(timerRef.current!);
    if (!question) return;
    const correct = choice === question.answer;
    const earned = correct ? timeRef.current : 0;
    setLastResult(correct ? 'correct' : 'wrong');
    advance(earned, qIndex);
  };

  const start = () => { setTotalEarned(0); setPhase('playing'); startQ(0); };

  useEffect(() => () => clearInterval(timerRef.current!), []);

  const collect = () => {
    playgroundDone(totalEarned);
    sendCommand({ cmd: 'game', type: 'hizlimat_done', earned: totalEarned });
    onBack();
  };

  if (phase === 'ready') return (
    <View style={styles.center}>
      <Text style={styles.title}>🧮 Hızlı Mat</Text>
      <Text style={styles.sub}>5 soru, 10 saniye. Ne kadar hızlı cevaplarsan o kadar çok jeton!</Text>
      <TouchableOpacity onPress={start} style={[styles.btn, { backgroundColor: accent }]} activeOpacity={0.8}>
        <Text style={styles.btnTxt}>Başla!</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
    </View>
  );

  if (phase === 'done') return (
    <View style={styles.center}>
      <Text style={styles.title}>Bitti!</Text>
      <Text style={styles.bigStat}>{totalEarned}</Text>
      <Text style={styles.sub}>jeton kazandın</Text>
      <TouchableOpacity onPress={collect} style={[styles.btn, { backgroundColor: accent }]} activeOpacity={0.8}>
        <Text style={styles.btnTxt}>Al ve çık</Text>
      </TouchableOpacity>
    </View>
  );

  const borderColor = lastResult === 'correct' ? '#4CAF50' : lastResult === 'wrong' ? '#FF6B6B' : '#ffffff22';

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Text style={styles.meta}>{qIndex + 1} / {QUESTIONS}</Text>
        <Text style={[styles.timer, { color: timeLeft <= 3 ? '#FF6B6B' : '#fff' }]}>{timeLeft}s</Text>
      </View>
      <View style={[styles.qBox, { borderColor }]}>
        <Text style={styles.qTxt}>{question?.q} = ?</Text>
      </View>
      <View style={styles.choices}>
        {question?.choices.map((c, i) => (
          <TouchableOpacity key={i} onPress={() => answer(c)} activeOpacity={0.8}
            style={[styles.choice, { backgroundColor: accent + '33', borderColor: accent }]}>
            <Text style={styles.choiceTxt}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.earned}>Kazanılan: {totalEarned} jeton</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: '#1d2733', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  center:    { flex: 1, backgroundColor: '#1d2733', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title:     { fontSize: 28, fontWeight: '900', color: '#fff' },
  bigStat:   { fontSize: 72, fontWeight: '900', color: '#FFD93D' },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  meta:      { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' },
  timer:     { fontSize: 18, fontWeight: '800' },
  qBox:      { width: '100%', borderRadius: 16, borderWidth: 2, padding: 24, alignItems: 'center' },
  qTxt:      { fontSize: 36, fontWeight: '900', color: '#fff', fontFamily: 'monospace' },
  choices:   { flexDirection: 'row', gap: 12 },
  choice:    { flex: 1, borderRadius: 14, borderWidth: 2, paddingVertical: 18, alignItems: 'center' },
  choiceTxt: { fontSize: 24, fontWeight: '800', color: '#fff' },
  earned:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' },
  btn:       { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  btnTxt:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  back:      { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
});
