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
import { ITEMS } from '../data/items';
import { Haptics } from '../services/Haptics';

const PREFS_KEY = 'eva.prefs';

// XP needed to advance FROM the given level to the next one.
export function xpToNext(level: number): number {
  return 100 + (level - 1) * 25;
}

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
  inventory:   Record<string, number>;  // item id → count
  level:       number;
  xp:          number;
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
  cookRaw:         (dishName: string) => void;
  eatCooked:       (index: number) => void;
  gymDone:         (intensity: number, likesExercise: boolean) => void;
  cinemaDone:      (sleepy: boolean) => void;
  buyItem:         (id: string, qty?: number) => void;
  addItem:         (id: string, qty?: number) => void;
  consumeItem:     (id: string, qty?: number) => boolean;
  useItem:         (id: string) => void;
  addXp:           (amount: number) => void;
  spendCoins:      (amount: number) => void;
  playgroundDone:  (coins: number, xp?: number) => void;
  toast:           (msg: string) => void;
  applyRealtime:   (deltaMs: number) => void;  // called by a 30 s ticker
  restoreFromDisk: () => Promise<void>;
  persistToDisk:   () => Promise<void>;
  revive:          () => void; // new Eva — full reset + triggers onboarding
  reviveSoft:      () => void; // correct code — stats reset to 50%, profile kept
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

// Map local stat names → Pi stat names so the Pi can apply a requested effect
// and respond with the authoritative new state (see STATE_CHAR / setPiState).
const STAT_TO_PI: Record<keyof Stats, string> = {
  hunger: 'fullness', happiness: 'love', energy: 'energy', clean: 'cleanliness', health: 'health',
};
function toPiDelta(delta: Partial<Stats>): Record<string, number> {
  const out: Record<string, number> = {};
  (Object.keys(delta) as (keyof Stats)[]).forEach(k => {
    if (delta[k] !== undefined) out[STAT_TO_PI[k]] = delta[k] as number;
  });
  return out;
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
  inventory:   { egg: 3, flour: 2, tomato: 2, cheese: 1 },
  level:       1,
  xp:          0,
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
      // Pi is authoritative for level/xp while connected.
      level:  m.level,
      xp:     m.xp,
      mood:   (piState.mood as Mood) ?? 'happy',
      isDead: dead,
    });
  },

  setBLEStatus: (bleStatus) => {
    // On connect, clear any stale local dead-flag so a new/healthy Pi doesn't
    // briefly flash the DeathScreen before its first setPiState arrives.
    const patch: Partial<EvaState> = { bleStatus };
    if (bleStatus === 'connected') patch.isDead = false;
    set(patch);
  },
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
    // Drive the Pi's OLED face: dance to music, cinema glasses + popcorn for video.
    const faceMap: Record<MediaMode, string> = {
      music: 'dance', video: 'cinema_glasses', none: 'idle',
    };
    _piSend?.({ cmd: 'face', anim: faceMap[mode] });
    if (mode === 'video') _piSend?.({ cmd: 'face', anim: 'popcorn' });
  },

  // When connected, the Pi owns stats + money: we send the requested effect and
  // wait for STATE_CHAR (setPiState) instead of mutating locally. This stops the
  // jitter from optimistic updates fighting the Pi's decay. Offline, apply locally.
  orderFood: (item) => {
    const { coins, stats, piState } = get();
    if (coins < item.cost) return;
    set({ lastToast: { msg: `Eva ${item.name} yedi!`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'feed_done', item: item.name,
                effect: toPiDelta(item.fills), coins: -item.cost, score: 1.0 });
    if (piState) return;
    const next = modStats(stats, item.fills);
    set({ coins: coins - item.cost, stats: next, mood: moodFromStats(next) });
    get().addXp(6);
  },

  cookSuccess: (dish) => {
    const { prefs, piState } = get();
    const delta: Partial<Stats> = { energy: -6 };
    if (prefs?.likesCooking === true)  delta.happiness = 10;
    if (prefs?.likesCooking === false) delta.happiness = -4;
    set(s => ({ cookedItems: [...s.cookedItems, dish],
                lastToast: { msg: `${dish.name} pişirildi!`, key: Date.now() } }));
    _piSend?.({ cmd: 'activity', type: 'cook_success', effect: toPiDelta(delta), score: 1.0 });
    if (piState) return;
    set(s => { const next = modStats(s.stats, delta); return { stats: next, mood: moodFromStats(next) }; });
  },

  cookBurned: (dishName) => {
    const delta: Partial<Stats> = { happiness: -6, energy: -4 };
    set({ lastToast: { msg: `${dishName} yandı!`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'cook_burned', effect: toPiDelta(delta), score: 0.0 });
    if (get().piState) return;
    set(s => { const next = modStats(s.stats, delta); return { stats: next, mood: moodFromStats(next) }; });
  },

  // Pulled out too early — milder than burning, no dish produced.
  cookRaw: (dishName) => {
    const delta: Partial<Stats> = { happiness: -3, energy: -3 };
    set({ lastToast: { msg: `${dishName} çiğ kaldı…`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'cook_raw', effect: toPiDelta(delta), score: 0.2 });
    if (get().piState) return;
    set(s => { const next = modStats(s.stats, delta); return { stats: next, mood: moodFromStats(next) }; });
  },

  eatCooked: (index) => {
    const { cookedItems, piState } = get();
    const dish = cookedItems[index];
    if (!dish) return;
    const next = [...cookedItems];
    next.splice(index, 1);
    const delta: Partial<Stats> = { hunger: dish.hunger, happiness: dish.happiness };
    set({ cookedItems: next, lastToast: { msg: `${dish.name} yendi!`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'eat', effect: toPiDelta(delta), score: 1.0 });
    if (piState) return;
    set(s => { const ns = modStats(s.stats, delta); return { stats: ns, mood: moodFromStats(ns) }; });
  },

  gymDone: (intensity, likesExercise) => {
    const delta: Partial<Stats> = {
      health:    intensity * 5,
      energy:    -(intensity * 5),
      happiness: likesExercise ? intensity * 3 : -(intensity * 3),
    };
    set({ lastToast: { msg: `Sağlık +${intensity * 5}`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'gym_done', effect: toPiDelta(delta), score: Math.min(1, intensity / 3) });
    if (get().piState) return;
    set(s => { const ns = modStats(s.stats, delta); return { stats: ns, mood: moodFromStats(ns) }; });
    get().addXp(10 + intensity * 5);
  },

  cinemaDone: (sleepy) => {
    const delta: Partial<Stats> = { happiness: 20, energy: sleepy ? -12 : -4 };
    set({ lastToast: { msg: sleepy ? 'Uyudu ama eğlendi!' : 'Harika filmdi!', key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'cinema_done', effect: toPiDelta(delta), score: sleepy ? 0.7 : 1.0 });
    if (get().piState) return;
    set(s => { const ns = modStats(s.stats, delta); return { stats: ns, mood: moodFromStats(ns) }; });
    get().addXp(12);
  },

  // Buying stores the item in the bag (Pi doesn't track inventory). The coin cost
  // is handled by spendCoins in the caller; here we only do the shopping-fun bonus.
  buyItem: (id, qty = 1) => {
    const def = ITEMS[id];
    const name = def?.name ?? id;
    const { prefs, piState } = get();
    set(s => ({ inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + qty },
                lastToast: { msg: `${name} alındı!`, key: Date.now() } }));
    const bonus: Partial<Stats> = prefs?.likesShopping ? { happiness: 6 } : {};
    _piSend?.({ cmd: 'activity', type: 'market_buy', item: id, effect: toPiDelta(bonus), score: 1.0 });
    if (piState) return;
    if (prefs?.likesShopping) {
      set(s => { const ns = modStats(s.stats, bonus); return { stats: ns, mood: moodFromStats(ns) }; });
    }
    get().addXp(5);
  },

  addItem: (id, qty = 1) => {
    set(s => ({ inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + qty } }));
  },

  consumeItem: (id, qty = 1) => {
    const have = get().inventory[id] ?? 0;
    if (have < qty) return false;
    set(s => {
      const inv = { ...s.inventory };
      const left = (inv[id] ?? 0) - qty;
      if (left > 0) inv[id] = left; else delete inv[id];
      return { inventory: inv };
    });
    return true;
  },

  // Consume one unit of a food/special item and apply its stat effect.
  useItem: (id) => {
    const def = ITEMS[id];
    if (!def?.stats) return;
    if (!get().consumeItem(id, 1)) return;
    set({ lastToast: { msg: `${def.name} kullanıldı!`, key: Date.now() } });
    Haptics.success();
    _piSend?.({ cmd: 'activity', type: 'use_item', item: id, effect: toPiDelta(def.stats), score: 1.0 });
    if (get().piState) return;  // connected: Pi applies the effect and responds
    set(s => { const ns = modStats(s.stats, def.stats!); return { stats: ns, mood: moodFromStats(ns) }; });
  },

  addXp: (amount) => {
    if (amount <= 0) return;
    if (get().piState !== null) return;  // connected: Pi is authoritative for level/xp
    let { level, xp } = get();
    xp += amount;
    let leveled = false;
    while (xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level += 1;
      leveled = true;
    }
    set({ level, xp });
    if (leveled) {
      Haptics.levelUp();
      set({ lastToast: { msg: `🎉 Seviye atladın! SV ${level}`, key: Date.now() } });
    }
  },

  spendCoins: (amount) => {
    const { coins, piState } = get();
    if (coins < amount) return;
    // Connected: Pi owns the wallet — request the debit and wait for STATE_CHAR.
    if (piState) { _piSend?.({ cmd: 'wallet', delta: -amount }); return; }
    set({ coins: coins - amount });
  },

  // Every game awards BOTH coins and XP in a fair, comparable band.
  playgroundDone: (earnedRaw, xpRaw) => {
    const coins = Math.max(2, Math.min(15, Math.round(earnedRaw)));
    const xp    = Math.max(8, Math.min(30, Math.round(xpRaw ?? coins * 2)));
    const delta: Partial<Stats> = { happiness: 8, energy: -6 };
    set({ lastToast: { msg: `+${coins}¢ · +${xp} XP`, key: Date.now() } });
    _piSend?.({ cmd: 'activity', type: 'play_done', effect: toPiDelta(delta),
                coins, xp, score: Math.min(1, coins / 12) });
    if (get().piState) return;
    set(s => { const ns = modStats(s.stats, delta); return { coins: s.coins + coins, stats: ns, mood: moodFromStats(ns) }; });
    get().addXp(xp);
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
        stats:       result.state.stats,
        coins:       result.state.coins,
        level:       result.state.level ?? 1,
        xp:          result.state.xp ?? 0,
        inventory:   result.state.inventory ?? get().inventory,
        cookedItems: result.state.cookedItems ?? [],
        mediaMode:   'none',
        isDead:      dead,
        mood:        moodFromStats(result.state.stats),
      });
    } catch { /* first launch */ }

    // Also restore prefs
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) set({ prefs: JSON.parse(raw) });
    } catch { /* ignore */ }
  },

  persistToDisk: async () => {
    const { stats, coins, mediaMode, level, xp, inventory, cookedItems } = get();
    await saveState({ stats, coins, mediaMode, level, xp, inventory, cookedItems });
  },

  revive: () => {
    set({
      isDead:      false,
      stats:       { hunger: 50, happiness: 50, energy: 50, clean: 60, health: 50 },
      coins:       100,
      level:       1,
      xp:          0,
      cookedItems: [],
      inventory:   { egg: 3, flour: 2, tomato: 2, cheese: 1 },
      prefs:       null,
      mood:        'happy',
      mediaMode:   'none',
      mediaStart:  0,
    });
  },

  reviveSoft: () => {
    // Keeps coins, inventory, prefs, piState (level/xp from Pi) — only resets stats.
    set({
      isDead:     false,
      stats:      { hunger: 50, happiness: 50, energy: 50, clean: 60, health: 50 },
      mood:       'happy',
      mediaMode:  'none',
      mediaStart: 0,
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
