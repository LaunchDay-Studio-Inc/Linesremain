// ─── Recipe Types ───

export enum CraftingTier {
  Primitive = 0,
  Intermediate = 1,
  Advanced = 2,
  Military = 3,
}

export interface RecipeIngredient {
  itemId: number;
  quantity: number;
}

export interface RecipeDefinition {
  id: number;
  name: string;
  tier: CraftingTier;
  ingredients: RecipeIngredient[];
  outputItemId: number;
  outputQuantity: number;
  craftTimeSeconds: number;
  requiredStation?: string; // e.g. 'workbench', 'furnace', 'mixing_table'
  requiredBlueprint?: boolean; // true = player must learn blueprint before crafting
}
