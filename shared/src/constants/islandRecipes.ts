// ─── Island Crafting Recipes ───
// Focused recipe set for the island world using only island-available resources.

export interface IslandRecipe {
  id: number;
  name: string;
  icon: string;
  ingredients: Array<{ itemId: number; quantity: number }>;
  result: { itemId: number; quantity: number };
  craftTime: number;
}

export const ISLAND_RECIPES: IslandRecipe[] = [
  // ── Tier 1: Immediate survival ──
  {
    id: 700,
    name: 'Stone Hatchet',
    icon: 'hatchet',
    ingredients: [
      { itemId: 1, quantity: 3 },
      { itemId: 2, quantity: 2 },
    ],
    result: { itemId: 22, quantity: 1 },
    craftTime: 5,
  },
  {
    id: 701,
    name: 'Stone Pickaxe',
    icon: 'pickaxe',
    ingredients: [
      { itemId: 1, quantity: 3 },
      { itemId: 2, quantity: 3 },
    ],
    result: { itemId: 23, quantity: 1 },
    craftTime: 6,
  },
  {
    id: 702,
    name: 'Wooden Spear',
    icon: 'spear',
    ingredients: [{ itemId: 1, quantity: 5 }],
    result: { itemId: 31, quantity: 1 },
    craftTime: 4,
  },
  {
    id: 703,
    name: 'Campfire',
    icon: 'fire-pit',
    ingredients: [
      { itemId: 1, quantity: 5 },
      { itemId: 2, quantity: 3 },
    ],
    result: { itemId: 66, quantity: 1 },
    craftTime: 8,
  },
  {
    id: 704,
    name: 'Torch',
    icon: 'torch',
    ingredients: [
      { itemId: 1, quantity: 2 },
      { itemId: 6, quantity: 1 },
    ],
    result: { itemId: 100, quantity: 1 },
    craftTime: 3,
  },

  // ── Tier 2: Sustenance ──
  {
    id: 705,
    name: 'Water Flask',
    icon: 'flask',
    ingredients: [
      { itemId: 6, quantity: 3 },
      { itemId: 1, quantity: 2 },
    ],
    result: { itemId: 99, quantity: 1 },
    craftTime: 6,
  },
  {
    id: 706,
    name: 'Bandage',
    icon: 'bandage',
    ingredients: [{ itemId: 6, quantity: 4 }],
    result: { itemId: 58, quantity: 2 },
    craftTime: 4,
  },
  {
    id: 707,
    name: 'Fiber Rope',
    icon: 'rope',
    ingredients: [{ itemId: 6, quantity: 6 }],
    result: { itemId: 101, quantity: 1 },
    craftTime: 5,
  },
  {
    id: 708,
    name: 'Mushroom Stew',
    icon: 'mushroom',
    ingredients: [
      { itemId: 55, quantity: 2 },
      { itemId: 99, quantity: 1 },
    ],
    result: { itemId: 98, quantity: 1 },
    craftTime: 10,
  },

  // ── Tier 3: Advanced ──
  {
    id: 709,
    name: 'Stone Knife',
    icon: 'sword',
    ingredients: [
      { itemId: 2, quantity: 4 },
      { itemId: 1, quantity: 1 },
    ],
    result: { itemId: 102, quantity: 1 },
    craftTime: 5,
  },
  {
    id: 710,
    name: 'Wooden Shield',
    icon: 'shield',
    ingredients: [
      { itemId: 1, quantity: 8 },
      { itemId: 101, quantity: 2 },
    ],
    result: { itemId: 103, quantity: 1 },
    craftTime: 15,
  },
  {
    id: 711,
    name: 'Metal Hatchet',
    icon: 'hatchet',
    ingredients: [
      { itemId: 1, quantity: 2 },
      { itemId: 3, quantity: 5 },
    ],
    result: { itemId: 24, quantity: 1 },
    craftTime: 12,
  },
  {
    id: 712,
    name: 'Metal Pickaxe',
    icon: 'pickaxe',
    ingredients: [
      { itemId: 1, quantity: 2 },
      { itemId: 3, quantity: 6 },
    ],
    result: { itemId: 25, quantity: 1 },
    craftTime: 14,
  },
];
