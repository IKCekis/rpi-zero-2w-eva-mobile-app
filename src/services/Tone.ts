/**
 * Tone — runtime sine-wave synthesis for the pitch game.
 *
 * Expo has no oscillator, so we build a small 16-bit PCM WAV in memory, encode
 * it as a base64 data URI, and play it via expo-av. All best-effort: if audio is
 * unavailable the calls silently no-op.
 */

import { Audio } from 'expo-av';
import { Buffer } from 'buffer';

const SAMPLE_RATE = 22050;

function buildWavDataUri(freq: number, ms: number): string {
  const samples = Math.max(1, Math.floor((SAMPLE_RATE * ms) / 1000));
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);                 // PCM fmt chunk size
  buf.writeUInt16LE(1, 20);                  // PCM
  buf.writeUInt16LE(1, 22);                  // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);    // byte rate
  buf.writeUInt16LE(2, 32);                  // block align
  buf.writeUInt16LE(16, 34);                 // bits/sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  const fade = Math.min(samples / 8, SAMPLE_RATE * 0.012); // ~12ms anti-click fade
  for (let i = 0; i < samples; i++) {
    let amp = 0.6;
    if (i < fade) amp *= i / fade;
    else if (i > samples - fade) amp *= (samples - i) / fade;
    const v = Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE)) * amp;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
  }
  return 'data:audio/wav;base64,' + buf.toString('base64');
}

let _setup = false;
let _current: Audio.Sound | null = null;

async function ensureSetup() {
  if (_setup) return;
  _setup = true;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  } catch { /* ignore */ }
}

export async function playTone(freq: number, ms = 900): Promise<void> {
  try {
    await ensureSetup();
    if (_current) { await _current.unloadAsync().catch(() => {}); _current = null; }
    const uri = buildWavDataUri(freq, ms);
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
    _current = sound;
    sound.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && st.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (_current === sound) _current = null;
      }
    });
  } catch { /* audio unavailable */ }
}

export async function stopTone(): Promise<void> {
  if (_current) { await _current.unloadAsync().catch(() => {}); _current = null; }
}
