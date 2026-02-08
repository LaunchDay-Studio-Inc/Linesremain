// ─── Combat Constants ───

// ─── Hit Zone Multipliers ───
export const HEADSHOT_MULT = 2.0;
export const TORSO_MULT = 1.0;
export const LEG_MULT = 0.75;
export const ARM_MULT = 0.85;

// ─── Weapon Stats ───
export interface WeaponStats {
  itemId: number;
  baseDamage: number;
  attackRate: number; // attacks per second
  range: number; // blocks
  headshotCapable: boolean;
  ammoItemId?: number; // undefined for melee
  magazineSize?: number;
  reloadTimeSeconds?: number;
  projectileSpeed?: number; // blocks per second, undefined for hitscan/melee
  spreadDegrees?: number;
}

export const WEAPON_STATS: Record<number, WeaponStats> = {
  // Rock
  21: { itemId: 21, baseDamage: 5, attackRate: 2.0, range: 2.0, headshotCapable: false },
  // Bone Knife
  29: { itemId: 29, baseDamage: 15, attackRate: 3.0, range: 1.8, headshotCapable: false },
  // Stone Spear
  30: { itemId: 30, baseDamage: 20, attackRate: 1.5, range: 2.5, headshotCapable: false },
  // Wooden Spear
  31: { itemId: 31, baseDamage: 15, attackRate: 1.5, range: 2.5, headshotCapable: false },
  // Machete
  32: { itemId: 32, baseDamage: 30, attackRate: 2.0, range: 2.0, headshotCapable: false },
  // Salvaged Sword
  33: { itemId: 33, baseDamage: 40, attackRate: 1.5, range: 2.2, headshotCapable: false },
  // Bone Club
  34: { itemId: 34, baseDamage: 18, attackRate: 2.0, range: 1.8, headshotCapable: false },
  // Hunting Bow
  35: {
    itemId: 35,
    baseDamage: 25,
    attackRate: 1.0,
    range: 50,
    headshotCapable: true,
    ammoItemId: 41,
    magazineSize: 1,
    reloadTimeSeconds: 0.8,
    projectileSpeed: 40,
  },
  // Crossbow
  36: {
    itemId: 36,
    baseDamage: 40,
    attackRate: 0.5,
    range: 60,
    headshotCapable: true,
    ammoItemId: 41,
    magazineSize: 1,
    reloadTimeSeconds: 2.0,
    projectileSpeed: 55,
  },
  // Revolver
  37: {
    itemId: 37,
    baseDamage: 30,
    attackRate: 3.0,
    range: 40,
    headshotCapable: true,
    ammoItemId: 42,
    magazineSize: 6,
    reloadTimeSeconds: 3.5,
    spreadDegrees: 3.0,
  },
  // Pipe Shotgun
  38: {
    itemId: 38,
    baseDamage: 60,
    attackRate: 0.5,
    range: 15,
    headshotCapable: true,
    ammoItemId: 43,
    magazineSize: 1,
    reloadTimeSeconds: 3.0,
    spreadDegrees: 12.0,
  },
  // Semi-Auto Rifle
  39: {
    itemId: 39,
    baseDamage: 35,
    attackRate: 4.0,
    range: 80,
    headshotCapable: true,
    ammoItemId: 44,
    magazineSize: 16,
    reloadTimeSeconds: 3.0,
    spreadDegrees: 1.5,
  },
  // Assault Rifle
  40: {
    itemId: 40,
    baseDamage: 30,
    attackRate: 7.5,
    range: 70,
    headshotCapable: true,
    ammoItemId: 44,
    magazineSize: 30,
    reloadTimeSeconds: 4.0,
    spreadDegrees: 2.5,
  },
};

// ─── Armor Stats ───
export interface ArmorStats {
  itemId: number;
  damageReduction: number; // percentage reduction (0.0 – 1.0)
  slot: string;
  insulation: number; // temperature insulation bonus (°C)
}

/** Maximum damage reduction from armor (75% cap — players always take at least 25% damage) */
export const MAX_ARMOR_REDUCTION = 0.75;

export const ARMOR_STATS: Record<number, ArmorStats> = {
  // Burlap Shirt
  45: { itemId: 45, damageReduction: 0.05, slot: 'chest', insulation: 5 },
  // Burlap Trousers
  46: { itemId: 46, damageReduction: 0.05, slot: 'legs', insulation: 3 },
  // Hide Poncho
  47: { itemId: 47, damageReduction: 0.15, slot: 'chest', insulation: 8 },
  // Hide Pants
  48: { itemId: 48, damageReduction: 0.1, slot: 'legs', insulation: 5 },
  // Hide Boots
  49: { itemId: 49, damageReduction: 0.08, slot: 'feet', insulation: 3 },
  // Road Sign Vest
  50: { itemId: 50, damageReduction: 0.3, slot: 'chest', insulation: 2 },
  // Road Sign Kilt
  51: { itemId: 51, damageReduction: 0.25, slot: 'legs', insulation: 1 },
  // Metal Facemask
  52: { itemId: 52, damageReduction: 0.4, slot: 'head', insulation: 1 },
};

// ─── Melee Combat ───
export const MELEE_KNOCKBACK_FORCE = 3.0;
export const MELEE_HIT_COOLDOWN_MS = 100; // i-frames after being hit

// ─── Bleed ───
export const BLEED_DAMAGE_PER_SECOND = 2.0;
export const BLEED_DURATION_SECONDS = 10;
export const BLEED_CHANCE_MELEE = 0.15; // 15% chance on melee hit
export const BLEED_CHANCE_PROJECTILE = 0.3; // 30% chance on projectile hit

// ─── Downed State ───
export const DOWN_HEALTH_THRESHOLD = 0; // instant death in this game (no DBNO)
