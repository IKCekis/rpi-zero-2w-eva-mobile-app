/**
 * CustomRecipes — persistence + auto-balancing for user-created recipes.
 * Stored separately from the built-in RECIPES; the kitchen merges both.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecipeDef, RecipeIngredient, StepType } from '../data/recipes';
import { ITEMS } from '../data/items';

const KEY = 'eva.customRecipes';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Derive stats/xp from ingredients + steps so custom recipes can't be abused
// and the user never has to pick numbers (child-friendly).
export function autoBalance(ingredients: RecipeIngredient[], steps: StepType[]) {
  let cost = 0;
  ingredients.forEach(ing => { cost += (ITEMS[ing.id]?.cost ?? 2) * ing.qty; });
  const hunger    = clamp(Math.round(cost * 3 + steps.length * 2), 10, 60);
  const happiness = clamp(Math.round(cost * 1.2 + steps.length * 2), 4, 40);
  const xp        = clamp(Math.round(cost * 4 + steps.length * 6), 15, 120);
  return { hunger, happiness, xp };
}

// Sprite for the finished dish: use the priciest ingredient's sprite as a proxy.
function dishSprite(ingredients: RecipeIngredient[]): string {
  let best = ingredients[0]?.id;
  let bestCost = -1;
  ingredients.forEach(ing => {
    const c = ITEMS[ing.id]?.cost ?? 0;
    if (c > bestCost) { bestCost = c; best = ing.id; }
  });
  return ITEMS[best ?? '']?.sprite ?? 'soda';
}

export function buildCustomRecipe(name: string, ingredients: RecipeIngredient[], steps: StepType[]): RecipeDef {
  const { hunger, happiness, xp } = autoBalance(ingredients, steps);
  return {
    id:       `custom_${Date.now()}`,
    name:     name.trim() || 'Özel Tarif',
    sprite:   dishSprite(ingredients),
    minLevel: 1,                 // always available; ingredients still required
    ingredients,
    steps,
    idealTimeS: 6 + steps.length * 2,
    windowS:    2,
    hunger, happiness, xp,
    custom: true,
  };
}

export async function loadCustomRecipes(): Promise<RecipeDef[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function addCustomRecipe(recipe: RecipeDef): Promise<RecipeDef[]> {
  const list = await loadCustomRecipes();
  const next = [...list, recipe];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function deleteCustomRecipe(id: string): Promise<RecipeDef[]> {
  const list = await loadCustomRecipes();
  const next = list.filter(r => r.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
