import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mood, TabName, SceneName, Stats, Prefs, CookedDish,
  BLEStatus, Proximity,
} from './types';

const PREFS_KEY = 'eva.prefs';

interface Toast { msg: string; key: number; }

interface EvaState {
  // Game state
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

  // BLE
  bleStatus:  BLEStatus;
  proximity:  Proximity;
  rssi:       number;
  piPrefs:    Record<string, unknown> | null;

  // Actions
  setTab:        (tab: TabName, scene?: SceneName) => void;
  gotoScene:     (scene: SceneName) => void;
  setPrefs:      (prefs: Prefs) => void;
  setPiPrefs:    (p: Record<string, unknown>) => void;
  setBLEStatus:  (s: BLEStatus) => void;
  setProximity:  (p: Proximity) => void;
  setRssi:       (r: number) => void;
  doAction:      (action: 'feed' | 'play' | 'sleep' | 'wash') => void;
  orderFood:     (item: { name: string; cost: number; fills: Partial<Stats> }) => void;
  cookSuccess:   (dish: CookedDish) => void;
  cookBurned:    (dishName: string) => void;
  eatCooked:     (index: number) => void;
  gymDone:       (intensity: number, likesExercise: boolean) => void;
  cinemaDone:    (sleepy: boolean) => void;
  buyItem:       (id: string, name: string, bonus: Partial<Stats>) => void;
  spendCoins:    (amount: number) => void;
  playgroundDone:(coins: number) => void;
  toast:         (msg: string) => void;
  resetGame:     () => void;
}

const INITIAL_STATS: Stats = {
  hunger: 68, happiness: 82, energy: 54, clean: 76, health: 65,
};

function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

function modStats(stats: Stats, delta: Partial<Stats>): Stats {
  const s = { ...stats };
  for (const k of Object.keys(delta) as (keyof Stats)[]) {
    if (delta[k] !== undefined) s[k] = clamp(s[k] + (delta[k] as number));
  }
  return s;
}

export const useEvaStore = create<EvaState>((set, get) => ({
  tab:         'home',
  scene:       'bedroom',
  mood:        'happy',
  stats:       { ...INITIAL_STATS },
  coins:       248,
  charge:      0.78,
  accent:      '#7BD3B8',
  cookedItems: [],
  inventory:   [],
  prefs:       null,
  lastToast:   null,
  bleStatus:   'disconnected',
  proximity:   'far',
  rssi:        -100,
  piPrefs:     null,

  setTab: (tab, scene) =>
    set({ tab, ...(scene ? { scene, tab: 'world' as TabName } : {}) }),

  gotoScene: (scene) => set({ tab: 'world', scene }),

  setPrefs: async (prefs) => {
    set({ prefs });
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  },

  setPiPrefs: (piPrefs) => set({ piPrefs }),

  setBLEStatus: (bleStatus) => set({ bleStatus }),

  setProximity: (proximity) => set({ proximity }),

  setRssi: (rssi) => set({ rssi }),

  doAction: (action) => {
    const map: Record<string, Partial<Stats> & { toast: string }> = {
      feed:  { hunger: 18, happiness: 4,  toast: 'Atıştırmalık zamanı!' },
      play:  { happiness: 14, energy: -8, toast: 'Çok eğlenceli!' },
      sleep: { energy: 22, hunger: -4,    toast: 'Zzz...' },
      wash:  { clean: 30, happiness: 3,   toast: 'Tertemiz!' },
    };
    const eff = map[action];
    const { toast: msg, ...delta } = eff;
    set(s => ({
      stats:     modStats(s.stats, delta),
      lastToast: { msg, key: Date.now() },
    }));
  },

  orderFood: (item) => {
    const { coins, stats } = get();
    if (coins < item.cost) return;
    set({
      coins: coins - item.cost,
      stats: modStats(stats, item.fills),
      lastToast: { msg: `Eva ${item.name} yedi!`, key: Date.now() },
    });
  },

  cookSuccess: (dish) => {
    const { prefs, stats } = get();
    const likes = prefs?.likesCooking;
    const delta: Partial<Stats> = { energy: -5 };
    if (likes === true)  delta.happiness = 8;
    if (likes === false) delta.happiness = -3;
    set(s => ({
      stats:       modStats(s.stats, delta),
      cookedItems: [...s.cookedItems, dish],
      lastToast:   { msg: `${dish.name} pişirildi!`, key: Date.now() },
    }));
  },

  cookBurned: (dishName) => {
    set(s => ({
      stats:     modStats(s.stats, { happiness: -5, energy: -3 }),
      lastToast: { msg: `${dishName} yandı!`, key: Date.now() },
    }));
  },

  eatCooked: (index) => {
    const { cookedItems } = get();
    const dish = cookedItems[index];
    if (!dish) return;
    const next = [...cookedItems];
    next.splice(index, 1);
    set(s => ({
      stats:       modStats(s.stats, { hunger: dish.hunger, happiness: dish.happiness }),
      cookedItems: next,
      lastToast:   { msg: `${dish.name} yendi!`, key: Date.now() },
    }));
  },

  gymDone: (intensity, likesExercise) => {
    const delta: Partial<Stats> = {
      health:    intensity * 5,
      energy:    -(intensity * 4),
      happiness: likesExercise ? intensity * 2 : -(intensity * 2),
    };
    set(s => ({
      stats:     modStats(s.stats, delta),
      lastToast: { msg: `Sağlık +${intensity * 5}`, key: Date.now() },
    }));
  },

  cinemaDone: (sleepy) => {
    set(s => ({
      stats:     modStats(s.stats, { happiness: 18, energy: sleepy ? -10 : -2 }),
      lastToast: { msg: sleepy ? 'Biraz uyudu ama eğlendi!' : 'Harika filmdi!', key: Date.now() },
    }));
  },

  buyItem: (id, name, bonus) => {
    const { prefs } = get();
    const delta: Partial<Stats> = { ...bonus };
    if (prefs?.likesShopping) delta.happiness = (delta.happiness ?? 0) + 5;
    set(s => ({
      inventory: [...s.inventory, id],
      stats:     modStats(s.stats, delta),
      lastToast: { msg: `${name} alındı!`, key: Date.now() },
    }));
  },

  spendCoins: (amount) => {
    const { coins } = get();
    if (coins < amount) return;
    set({ coins: coins - amount });
  },

  playgroundDone: (coins) => {
    set(s => ({
      coins:     s.coins + coins,
      stats:     modStats(s.stats, { happiness: 8, energy: -5 }),
      lastToast: { msg: `+${coins}¢ kazandın!`, key: Date.now() },
    }));
  },

  toast: (msg) => set({ lastToast: { msg, key: Date.now() } }),

  resetGame: () => set({
    tab:         'home',
    scene:       'bedroom',
    mood:        'happy',
    stats:       { ...INITIAL_STATS },
    coins:       248,
    cookedItems: [],
    inventory:   [],
    lastToast:   null,
  }),
}));

// Load prefs from AsyncStorage on startup
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
