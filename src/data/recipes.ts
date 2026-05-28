import { CookedDish } from '../store/types';

export interface RecipeIngredient {
  id:  string;   // ITEMS id
  qty: number;
}

// Ordered cooking steps. Each is a drag-in-the-green-window action (StepStage).
export type StepType = 'chop' | 'transfer' | 'mix' | 'cook';

export interface StepMeta {
  label: string;
  emoji: string;
  verb:  string;   // short imperative shown during play
  reps:  number;   // how many timed drags the step needs
}

export const STEP_META: Record<StepType, StepMeta> = {
  chop:     { label: 'Doğra',    emoji: '🔪', verb: 'Bıçağı malzemeye sürükle', reps: 3 },
  transfer: { label: 'Kaba Aktar', emoji: '🥣', verb: 'Malzemeyi kaba sürükle',  reps: 1 },
  mix:      { label: 'Karıştır', emoji: '🥄', verb: 'Kaşığı kaba sürükle',      reps: 2 },
  cook:     { label: 'Pişir',    emoji: '🍳', verb: 'Tencereyi ocaktan çek',    reps: 1 },
};

export const ALL_STEPS: StepType[] = ['chop', 'transfer', 'mix', 'cook'];

export interface RecipeDef {
  id:          string;
  name:        string;
  sprite:      string;              // produced dish sprite (ItemSprite name)
  minLevel:    number;              // unlocks at this level
  ingredients: RecipeIngredient[];
  steps:       StepType[];          // ordered cooking steps
  idealTimeS:  number;              // perfect pull-out time (seconds) — used by 'cook' step
  windowS:     number;              // ± tolerance around idealTimeS for success
  hunger:      number;              // dish value when later eaten
  happiness:   number;
  xp:          number;              // XP awarded on a successful cook
  custom?:     boolean;             // true for user-created recipes
}

// Recipes unlock as the pet levels up. idealTimeS/windowS drive the timing
// minigame: pull out within the window → success, near center → perfect.
export const RECIPES: RecipeDef[] = [
  {
    id: 'omlet', name: 'Omlet', sprite: 'egg', minLevel: 1,
    ingredients: [{ id: 'egg', qty: 2 }],
    steps: ['transfer', 'mix', 'cook'],
    idealTimeS: 6, windowS: 2, hunger: 22, happiness: 6, xp: 20,
  },
  {
    id: 'corba', name: 'Sebze Çorbası', sprite: 'ramen', minLevel: 2,
    ingredients: [{ id: 'tomato', qty: 2 }, { id: 'egg', qty: 1 }],
    steps: ['chop', 'transfer', 'mix', 'cook'],
    idealTimeS: 8, windowS: 2.5, hunger: 26, happiness: 8, xp: 28,
  },
  {
    id: 'tost', name: 'Peynirli Tost', sprite: 'soda', minLevel: 3,
    ingredients: [{ id: 'cheese', qty: 1 }, { id: 'flour', qty: 1 }],
    steps: ['chop', 'transfer', 'cook'],
    idealTimeS: 7, windowS: 2, hunger: 24, happiness: 12, xp: 32,
  },
  {
    id: 'ev_pizza', name: 'Ev Pizzası', sprite: 'pizza', minLevel: 4,
    ingredients: [{ id: 'flour', qty: 1 }, { id: 'tomato', qty: 1 }, { id: 'cheese', qty: 1 }],
    steps: ['chop', 'transfer', 'mix', 'cook'],
    idealTimeS: 10, windowS: 2, hunger: 38, happiness: 16, xp: 45,
  },
  {
    id: 'ev_pasta', name: 'Ev Pastası', sprite: 'cake', minLevel: 6,
    ingredients: [{ id: 'flour', qty: 2 }, { id: 'egg', qty: 2 }],
    steps: ['transfer', 'mix', 'cook'],
    idealTimeS: 12, windowS: 1.8, hunger: 18, happiness: 28, xp: 60,
  },
  {
    id: 'sef_special', name: 'Şef Spesiyali', sprite: 'pizza', minLevel: 8,
    ingredients: [{ id: 'flour', qty: 2 }, { id: 'cheese', qty: 2 }, { id: 'tomato', qty: 2 }, { id: 'egg', qty: 1 }],
    steps: ['chop', 'transfer', 'mix', 'cook'],
    idealTimeS: 14, windowS: 1.5, hunger: 46, happiness: 32, xp: 90,
  },
];

// Build the CookedDish that lands in the bag for a successful cook.
// "perfect" pulls give a small bonus to the dish's values.
export function dishFromRecipe(recipe: RecipeDef, perfect: boolean): CookedDish {
  const boost = perfect ? 1.2 : 1;
  return {
    id:        recipe.id,
    name:      recipe.name,
    sprite:    recipe.sprite,
    hunger:    Math.round(recipe.hunger * boost),
    happiness: Math.round(recipe.happiness * boost),
  };
}
