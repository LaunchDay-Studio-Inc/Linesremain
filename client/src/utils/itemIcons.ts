// ─── Item & Building Icon Maps ───
// Maps item IDs and building piece types to SVG icon names.

import { BuildingPieceType } from '@shared/types/buildings';
import { ItemCategory } from '@shared/types/items';
import type { IconName } from '../ui/common/GameIcon';

// ─── Per-Item Icon Map ───

export const ITEM_ICON_MAP: Record<number, IconName> = {
  // Resources (1-15)
  1: 'wood',
  2: 'stone',
  3: 'stone', // Metal Ore
  4: 'sulfur', // Sulfur Ore
  5: 'hqm', // HQM Ore
  6: 'cloth',
  7: 'cloth', // Leather
  8: 'low-grade-fuel', // Animal Fat
  9: 'bone',
  10: 'metal-frags',
  11: 'sulfur',
  12: 'hqm',
  13: 'charcoal',
  14: 'gunpowder',
  15: 'low-grade-fuel',

  // Components (16-20)
  16: 'rope',
  17: 'cloth', // Tarp
  18: 'scrap', // Spring
  19: 'scrap', // Pipe
  20: 'scrap', // Sewing Kit

  // Tools (21-28)
  21: 'stone', // Rock
  22: 'hatchet', // Stone Hatchet
  23: 'pickaxe', // Stone Pickaxe
  24: 'hatchet', // Metal Hatchet
  25: 'pickaxe', // Metal Pickaxe
  26: 'hatchet', // Salvaged Axe
  27: 'pickaxe', // Salvaged Icepick
  28: 'hammer',

  // Melee Weapons (29-34)
  29: 'sword', // Bone Knife
  30: 'spear', // Stone Spear
  31: 'spear', // Wooden Spear
  32: 'sword', // Machete
  33: 'sword', // Salvaged Sword
  34: 'hammer', // Bone Club

  // Ranged Weapons (35-40)
  35: 'bow', // Hunting Bow
  36: 'bow', // Crossbow
  37: 'gun', // Revolver
  38: 'gun', // Pipe Shotgun
  39: 'gun', // Semi-Auto Rifle
  40: 'gun', // Assault Rifle

  // Ammo (41-44)
  41: 'ammo', // Arrow
  42: 'ammo', // Pistol Ammo
  43: 'ammo', // Shotgun Shell
  44: 'ammo', // Rifle Ammo

  // Armor (45-52)
  45: 'shield', // Burlap Shirt
  46: 'shield', // Burlap Trousers
  47: 'shield', // Hide Poncho
  48: 'shield', // Hide Pants
  49: 'shield', // Hide Boots
  50: 'shield', // Road Sign Vest
  51: 'shield', // Road Sign Kilt
  52: 'shield', // Metal Facemask

  // Consumables (53-59)
  53: 'meat', // Raw Meat
  54: 'meat', // Cooked Meat
  55: 'mushroom', // Mushroom
  56: 'hunger', // Cactus Flesh
  57: 'thirst', // Water Jug
  58: 'heart', // Bandage
  59: 'heart', // Medical Syringe

  // Building Items (60-63)
  60: 'hammer', // Building Plan
  61: 'door', // Wooden Door
  62: 'door', // Metal Door
  63: 'lock', // Code Lock

  // Deployables (64-67)
  64: 'sleeping-bag',
  65: 'storage', // Small Stash
  66: 'campfire', // Camp Fire
  67: 'campfire', // Furnace

  // Journal Fragments (68-87)
  68: 'scroll',
  69: 'scroll',
  70: 'scroll',
  71: 'scroll',
  72: 'scroll',
  73: 'scroll',
  74: 'scroll',
  75: 'scroll',
  76: 'scroll',
  77: 'scroll',
  78: 'scroll',
  79: 'scroll',
  80: 'scroll',
  81: 'scroll',
  82: 'scroll',
  83: 'scroll',
  84: 'scroll',
  85: 'scroll',
  86: 'scroll',
  87: 'scroll',

  // Creature Drops (88-89)
  88: 'bone', // Frost Fang
  89: 'charcoal', // Crimson Core

  // Endgame (90-96)
  90: 'c4', // C4 Explosive
  91: 'storage', // Storage Box
  92: 'storage', // Large Storage Box
  93: 'landmine',
  94: 'barricade', // Wooden Barricade
  95: 'research-table',
  96: 'scrap', // Scrap
};

// ─── Category Fallback Map ───

const CATEGORY_ICON_MAP: Record<ItemCategory, IconName> = {
  [ItemCategory.Resource]: 'stone',
  [ItemCategory.Tool]: 'pickaxe',
  [ItemCategory.WeaponMelee]: 'sword',
  [ItemCategory.WeaponRanged]: 'bow',
  [ItemCategory.Ammo]: 'ammo',
  [ItemCategory.Armor]: 'shield',
  [ItemCategory.Consumable]: 'meat',
  [ItemCategory.Building]: 'hammer',
  [ItemCategory.Deployable]: 'storage',
  [ItemCategory.Component]: 'scrap',
  [ItemCategory.Misc]: 'scrap',
};

// ─── Building Piece Icon Map ───

export const BUILDING_ICON_MAP: Record<BuildingPieceType, IconName> = {
  [BuildingPieceType.Foundation]: 'foundation',
  [BuildingPieceType.FoundationTriangle]: 'foundation-tri',
  [BuildingPieceType.Wall]: 'wall',
  [BuildingPieceType.HalfWall]: 'half-wall',
  [BuildingPieceType.Doorway]: 'doorway',
  [BuildingPieceType.WindowFrame]: 'window',
  [BuildingPieceType.WallFrame]: 'wall-frame',
  [BuildingPieceType.Floor]: 'floor',
  [BuildingPieceType.FloorTriangle]: 'floor-tri',
  [BuildingPieceType.Stairs]: 'stairs',
  [BuildingPieceType.Roof]: 'roof',
  [BuildingPieceType.Door]: 'door',
  [BuildingPieceType.Fence]: 'fence',
  [BuildingPieceType.Pillar]: 'pillar',
  [BuildingPieceType.FloorGrill]: 'floor',
  [BuildingPieceType.Campfire]: 'campfire',
  [BuildingPieceType.SleepingBag]: 'campfire',
};

// ─── Public API ───

export function getItemIconName(itemId: number, category?: ItemCategory): IconName {
  return ITEM_ICON_MAP[itemId] ?? (category ? CATEGORY_ICON_MAP[category] : undefined) ?? 'scrap';
}
