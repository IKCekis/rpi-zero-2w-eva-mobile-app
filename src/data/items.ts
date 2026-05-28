import { Stats } from '../store/types';

export type ItemKind = 'ingredient' | 'food' | 'special';

export interface ItemDef {
  id:     string;
  name:   string;
  sprite: string;            // ItemSprite name
  kind:   ItemKind;
  stats?: Partial<Stats>;    // applied when the item is "used" (food/special)
  cost?:  number;            // market price; omit if not buyable
  desc:   string;
}

// Single source of truth for everything that can sit in the bag, be bought,
// or be cooked with. InventoryScreen, MarketActivity and the recipe system
// all read from here.
export const ITEMS: Record<string, ItemDef> = {
  // ── Ingredients (used in recipes; cheap, so home cooking beats eating out) ─
  egg:    { id: 'egg',    name: 'Yumurta', sprite: 'egg',    kind: 'ingredient', cost: 2, desc: 'Tariflerin temel taşı.' },
  flour:  { id: 'flour',  name: 'Un',      sprite: 'flour',  kind: 'ingredient', cost: 2, desc: 'Hamur işlerinin temeli.' },
  tomato: { id: 'tomato', name: 'Domates', sprite: 'tomato', kind: 'ingredient', cost: 2, desc: 'Çorba ve pizzanın olmazsa olmazı.' },
  cheese: { id: 'cheese', name: 'Peynir',  sprite: 'cheese', kind: 'ingredient', cost: 3, desc: 'Eritince her şey güzelleşir.' },

  // ── Foods (ready to eat — "Kullan" applies stats; priced like the restaurant) ─
  apple:  { id: 'apple', name: 'Elma',  sprite: 'apple', kind: 'food', stats: { hunger: 12, health: 4 },    cost: 3,  desc: 'Taze ve sağlıklı.' },
  ramen:  { id: 'ramen', name: 'Ramen', sprite: 'ramen', kind: 'food', stats: { hunger: 24, happiness: 6 }, cost: 8,  desc: 'Sıcacık, doyurucu.' },
  pizza:  { id: 'pizza', name: 'Pizza', sprite: 'pizza', kind: 'food', stats: { hunger: 34, happiness: 12 },cost: 13, desc: 'Herkesin favorisi.' },
  soda:   { id: 'soda',  name: 'Gazoz', sprite: 'soda',  kind: 'food', stats: { happiness: 10, energy: 6 }, cost: 4,  desc: 'Şekerli enerji patlaması.' },
  candy:  { id: 'candy', name: 'Şeker', sprite: 'candy', kind: 'food', stats: { happiness: 14, hunger: 4 }, cost: 3,  desc: 'Küçük bir mutluluk.' },
  cake:   { id: 'cake',  name: 'Pasta', sprite: 'cake',  kind: 'food', stats: { hunger: 16, happiness: 22 },cost: 11, desc: 'Özel günler için.' },

  // ── Special (rare, strong effect) ─────────────────────────────────────────
  star:   { id: 'star',  name: 'Yıldız',     sprite: 'star',  kind: 'special', stats: { happiness: 20 }, desc: 'Nadir parıltı — büyük mutluluk.' },
  heart:  { id: 'heart', name: 'İlk Yardım', sprite: 'heart', kind: 'special', stats: { health: 30 },    desc: 'Acil durumda sağlığı toparlar.' },
};

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

// Items that can be purchased in the market (have a cost).
export const BUYABLE_ITEMS: ItemDef[] = Object.values(ITEMS).filter(i => i.cost !== undefined);
