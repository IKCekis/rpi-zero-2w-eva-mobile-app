import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mood, TabName, SceneName, Stats, Prefs, CookedDish,
  BLEStatus, Proximity, PiState,
} from './types';
import {
  applyDecay, isDead as calcDead, saveState, loadAndDecay,
  DECAY_PER_HOUR,
} from '../services/StatDecay';

const PREFS_KEY = 'eva.prefs';

// BLE command sender injected by BLEContext to avoid circular deps.
// When connected, Pi is the source of truth; local mutations are optimistic UI.
let _piSend: ((cmd: Record<string, unknown>) => void) | null = null;
export function injectBLESend(fn: (cmd: Record<string, unknown>) => void) {
  _piSend = fn;
}

export type MediaMode = 'none' | 'music' | 'video';

interface Toast { msg: string; key: number; }

interface EvaState {
  tab:         TabName;
  scene:       SceneName;
  mood:        Mood;
  stats:       Stats;
  coins:       number;
  charge:      number;
  accent:      string;
  cookedItems: CookedDish[];
  inventory:   string[];
  prefs:       Prefs | null;
  lastToast:   Toast | null;
  isDead:      boolean;
  mediaMode:   MediaMode;
  mediaStart:  number;   // timestamp when media mode started

  // BLE
  bleStatus:  BLEStatus;
  proximity:  Proximity;
  rssi:       number;
  piPrefs:    Record<string, unknown> | null;
  piState:    PiState | null;  // authoritative stat/meta snapshot from Pi

  // Actions
  setTab:          (tab: TabName, scene?: SceneName) => void;
  gotoScene:       (scene: SceneName) => void;
  setPrefs:        (prefs: Prefs) => void;
  setPiPrefs:      (p: Record<string, unknown>) => void;
  setPiState:      (s: PiState) => void;
  setBLEStatus:    (s: BLEStatus) => void;
  setProximity:    (p: Proximity) => void;
  setRssi:         (r: number) => void;
  setMediaMode:    (mode: MediaMode) => void;
  orderFood:       (item: { name: string; cost: number; fills: Partial<Stats> }) => void;
  cookSuccess:     (dish: CookedDish) => void;
  cookBurned:      (dishName: string) => void;
  eatCooked:       (index: number) => void;
  gymDone:         (intensity: number, likesExercise: boolean) => void;
  cinemaDone:      (sleepy: boolean) => void;
  buyItem:         (id: string, name: string, bonus: Partial<Stats>) => void;
  spendCoins:      (amount: number) => void;
  playgroundDone:  (coins: number) => void;
  toast:           (msg: string) => void;
  applyRealtime:   (deltaMs: number) => void;  // called by a 30 s ticker
  restoreFromDisk: () => Promise<void>;
  persistToDisk:   () => Promise<void>;
  revive:          () => void; // called after HNKOEE code accepted
}

const INITIAL_STATS: Stats = {
  hunger: 68, happiness: 72, energy: 54, clean: 76, health: 60,
};

function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

function modStats(stats: Stats, delta: Partial<Stats>): Stats {
  const s = { ...stats };
  for (const k of Object.keys(delta) as (keyof Stats)[]) {
    if (delta[k] !== undefined) s[k] = clamp(s[k] + (delta[k] as number));
  }
  return s;
}

function moodFromStats(stats: Stats): Mood {
  if (stats.energy    < 15) return 'sleepy';
  if (stats.hunger    < 20) return 'hungry';
  if (stats.happiness < 25) return 'sad';
  if (stats.happiness > 80) return 'happy';
  return 'happy';
}

export const useEvaStore = create<EvaState>((set, get) => ({
  tab:         'home',
  scene:       'bedroom',
  mood:        'happy',
  stats:       { ...INITIAL_STATS },
  coins:       180,
  charge:      0.78,
  accent:      '#7BD3B8',
  cookedItems: [],
  inventory:   [],
  prefs:       null,
  lastToast:   null,
  isDead:      false,
  mediaMode:   'none',
  mediaStart:  0,
  bleStatus:   'disconnected',
  proximity:   'far',
  rssi:        -100,
  piPrefs:     null,
  piState:     null,

  setTab: (tab, scene) =>
    set({ tab, ...(scene ? { scene, tab: 'world' as TabName } : {}) }),

  gotoScene: (scene) => set({ tab: 'world', scene }),

  setPrefs: async (prefs) => {
    set({ prefs });
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  },

  setPiPrefs: (piPrefs) => set({ piPrefs }),

  setPiState: (piState) => {
    // Sync local stat fields so existing screens continue to work unchanged.
    const s = piState.stats;
    const m = piState.meta;
    const dead = s.fullness <= 0 && s.love <= 0 && s.energy <= 0;
    set({
      piState,
      stats: {
        hunger:    s.fullness,
        happiness: s.love,
        energy:    s.energy,
        clean:     s.cleanliness,
        health:    s.health,
      },
      coins:  m.money,
      mood:   (piState.mood as Mood) ?? 'happy',
      isDead: dead,
    });
  },

  setBLEStatus: (bleStatus) => set({ bleStatus }),
  setProximity: (proximity) => set({ proximity }),
  setRssi: (rssi) => set({ rssi }),

  setMediaMode: (mode) => {
    const { mediaMode, stats } = get();
    if (mode === mediaMode) return;
    set({ mediaMode: mode, mediaStart: mode !== 'none' ? Date.now() : 0 });
    const toastMap: Record<MediaMode, string> = {
      music: '🎵 Müzik modu başladı! Mutluluk artıyor.',
      video: '🎬 Film modu! Eğlen ama enerjine dikkat.',
      none:  'Medya modu kapandı.',
    };
    set({ lastToast: { msg: toastMap[mode], key: Date.now() } });
  },

  orderFood: (item) => {
    const { coins, stats } = get();
    if (coins < item.cost) return;
    // Optimistic local update; Pi will push authoritative values via STATE_CHAR.
    const next = modStats(stats, item.fills);
    set({ coins: coins - item.cost, stats: next, mood: moodFromStats(next),
          lastToast: { msg: `Eva ${item.name} yedi!`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'feed_done', item: item.name, score: 1.0 });
  },

  cookSuccess: (dish) => {
    const { prefs, stats } = get();
    const delta: Partial<Stats> = { energy: -6 };
    if (prefs?.likesCooking === true)  delta.happiness = 10;
    if (prefs?.likesCooking === false) delta.happiness = -4;
    const next = modStats(stats, delta);
    set(s => ({ stats: next, mood: moodFromStats(next),
                cookedItems: [...s.cookedItems, dish],
                lastToast: { msg: `${dish.name} pişirildi!`, key: Date.now() } }));
    _piSend?.({ cmd: 'activity', type: 'cook_success', score: 1.0 });
  },

  cookBurned: (dishName) => {
    set(s => {
      const next = modStats(s.stats, { happiness: -6, energy: -4 });
      return { stats: next, mood: moodFromStats(next),
               lastToast: { msg: `${dishName} yandı!`, key: Date.now() } };
    });
    _piSend?.({ cmd: 'activity', type: 'cook_burned', score: 0.0 });
  },

  eatCooked: (index) => {
    const { cookedItems } = get();
    const dish = cookedItems[index];
    if (!dish) return;
    const next = [...cookedItems];
    next.splice(index, 1);
    set(s => {
      const ns = modStats(s.stats, { hunger: dish.hunger, happiness: dish.happiness });
      return { stats: ns, mood: moodFromStats(ns), cookedItems: next,
               lastToast: { msg: `${dish.name} yendi!`, key: Date.now() } };
    });
    _piSend?.({ cmd: 'activity', type: 'eat', score: 1.0 });
  },

  gymDone: (intensity, likesExercise) => {
    const delta: Partial<Stats> = {
      health:    intensity * 5,
      energy:    -(intensity * 5),
      happiness: likesExercise ? intensity * 3 : -(intensity * 3),
    };
    set(s => {
      const ns = modStats(s.stats, delta);
      return { stats: ns, mood: moodFromStats(ns),
               lastToast: { msg: `Sağlık +${intensity * 5}`, key: Date.now() } };
    });
    _piSend?.({ cmd: 'activity', type: 'gym_done', score: Math.min(1, intensity / 3) });
  },

  cinemaDone: (sleepy) => {
    set(s => {
      const ns = modStats(s.stats, { happiness: 20, energy: sleepy ? -12 : -4 });
      return { stats: ns, mood: moodFromStats(ns),
               lastToast: { msg: sleepy ? 'Uyudu ama eğlendi!' : 'Harika filmdi!', key: Date.now() } };
    });
    _piSend?.({ cmd: 'activity', type: 'cinema_done', score: sleepy ? 0.7 : 1.0 });
  },

  buyItem: (id, name, bonus) => {
    const { prefs } = get();
    const delta: Partial<Stats> = { ...bonus };
    if (prefs?.likesShopping) delta.happiness = (delta.happiness ?? 0) + 6;
    set(s => {
      const ns = modStats(s.stats, delta);
      return { inventory: [...s.inventory, id], stats: ns, mood: moodFromStats(ns),
               lastToast: { msg: `${name} alındı!`, key: Date.now() } };
    });
    _piSend?.({ cmd: 'activity', type: 'market_buy', score: 1.0 });
  },

  spendCoins: (amount) => {
    const { coins } = get();
    if (coins < amount) return;
    set({ coins: coins - amount });
  },

  playgroundDone: (earned) => {
    set(s => {
      const ns = modStats(s.stats, { happiness: 8, energy: -6 });
      return { coins: s.coins + earned, stats: ns, mood: moodFromStats(ns),
               lastToast: { msg: `+${earned}¢ kazandın!`, key: Date.now() } };
    });
    _piSend?.({ cmd: 'activity', type: 'play_done', score: Math.min(1, earned / 10) });
  },

  toast: (msg) => set({ lastToast: { msg, key: Date.now() } }),

  // Called every 30 seconds by the App-level ticker.
  // Skipped when Pi is connected (Pi owns decay in that case).
  applyRealtime: (deltaMs) => {
    const { stats, mediaMode, isDead, piState } = get();
    if (isDead || piState !== null) return;  // Pi handles decay when connected
    const next = applyDecay(stats, deltaMs, mediaMode);
    const dead = calcDead(next);
    set({ stats: next, mood: moodFromStats(next), isDead: dead });
  },

  restoreFromDisk: async () => {
    try {
      const result = await loadAndDecay();
      if (!result) return;

      const dead = calcDead(result.state.stats);
      set({
        stats:     result.state.stats,
        coins:     result.state.coins,
        mediaMode: 'none',
        isDead:    dead,
        mood:      moodFromStats(result.state.stats),
      });
    } catch { /* first launch */ }

    // Also restore prefs
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) set({ prefs: JSON.parse(raw) });
    } catch { /* ignore */ }
  },

  persistToDisk: async () => {
    const { stats, coins, mediaMode } = get();
    await saveState({ stats, coins, mediaMode });
  },

  revive: () => {
    set({
      isDead:      false,
      stats:       { hunger: 50, happiness: 50, energy: 50, clean: 60, health: 50 },
      coins:       100,
      cookedItems: [],
      inventory:   [],
      prefs:       null,
      mood:        'happy',
      mediaMode:   'none',
      mediaStart:  0,
    });
  },
}));

// Kept for backwards-compat callers
export async function loadPersistedPrefs(): Promise<Prefs | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const prefs = JSON.parse(raw) as Prefs;
      useEvaStore.setState({ prefs });
      return prefs;
    }
  } catch { /* ignore */ }
  return null;
}
