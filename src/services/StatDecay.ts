/**
 * StatDecay — persistence + time-based decay + death detection.
 *
 * Decay rates (points per hour):
 *   hunger    7.5   →  empty in ~9 h without feeding
 *   happiness 4.0   →  empty in ~20 h without fun
 *   energy    5.5   →  empty in ~10 h without rest
 *   clean     3.0   →  empty in ~25 h without washing
 *   health    auto  →  +2/h when all stats > 50, -2/h when any stat < 25
 *
 * Death: any stat reaches 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stats } from '../store/types';

const SAVE_KEY      = 'eva.state.v2';
const TIMESTAMP_KEY = 'eva.lastSave';

export const DECAY_PER_HOUR: Record<keyof Stats, number> = {
  hunger:    7.5,
  happiness: 4.0,
  energy:    5.5,
  clean:     3.0,
  health:    0,   // computed dynamically
};

// Points per hour from media modes (positive = gain, negative = drain)
export const MEDIA_DECAY: Record<'music' | 'video', Partial<Record<keyof Stats, number>>> = {
  music: { happiness: +3.0, energy: -1.5 },
  video: { happiness: +4.0, energy: -3.0, hunger: -1.5 },
};

function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

export function applyDecay(
  stats: Stats,
  elapsedMs: number,
  mediaMode: 'none' | 'music' | 'video' = 'none',
): Stats {
  const hrs = elapsedMs / 3_600_000;
  const s = { ...stats };

  (Object.keys(DECAY_PER_HOUR) as (keyof Stats)[]).forEach(k => {
    s[k] = clamp(s[k] - DECAY_PER_HOUR[k] * hrs);
  });

  // Health: regen or decay based on overall wellbeing
  const avgVitals = (s.hunger + s.happiness + s.energy) / 3;
  const healthDelta = avgVitals > 50 ? +2.0 : avgVitals < 25 ? -2.0 : 0;
  s.health = clamp(s.health + healthDelta * hrs);

  // Media mode bonus/penalty
  if (mediaMode !== 'none') {
    const mods = MEDIA_DECAY[mediaMode];
    (Object.keys(mods) as (keyof Stats)[]).forEach(k => {
      s[k] = clamp(s[k] + (mods[k] as number) * hrs);
    });
  }

  return s;
}

export function isDead(stats: Stats): boolean {
  return Object.values(stats).some(v => v <= 0);
}

export interface PersistedState {
  stats:     Stats;
  coins:     number;
  mediaMode: 'none' | 'music' | 'video';
}

export async function saveState(state: PersistedState): Promise<void> {
  await AsyncStorage.multiSet([
    [SAVE_KEY,      JSON.stringify(state)],
    [TIMESTAMP_KEY, Date.now().toString()],
  ]);
}

export async function loadAndDecay(): Promise<{ state: PersistedState; elapsedMs: number } | null> {
  try {
    const [rawState, rawTs] = await AsyncStorage.multiGet([SAVE_KEY, TIMESTAMP_KEY]);
    const stateStr = rawState[1];
    const tsStr    = rawTs[1];
    if (!stateStr || !tsStr) return null;

    const saved      = JSON.parse(stateStr) as PersistedState;
    const savedAt    = parseInt(tsStr, 10);
    const elapsedMs  = Date.now() - savedAt;

    // Cap at 48 h to avoid extreme decay after factory reset / long ignore
    const cappedMs = Math.min(elapsedMs, 48 * 3_600_000);
    const decayed  = applyDecay(saved.stats, cappedMs, 'none');

    return {
      state: { ...saved, stats: decayed, mediaMode: 'none' },
      elapsedMs: cappedMs,
    };
  } catch {
    return null;
  }
}

export async function clearState(): Promise<void> {
  await AsyncStorage.multiRemove([SAVE_KEY, TIMESTAMP_KEY]);
}
