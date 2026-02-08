// ─── Progression & Level System ───
// XP curve, level rewards, and cosmetic unlocks

export const MAX_LEVEL = 50;

/** Base XP for each level. Exponential curve: XP = floor(100 * 1.15^level) */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

/** Total cumulative XP needed to reach a given level */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/** Determine the current level from total XP */
export function levelFromXP(totalXP: number): number {
  let accumulated = 0;
  for (let level = 2; level <= MAX_LEVEL; level++) {
    accumulated += xpForLevel(level);
    if (totalXP < accumulated) return level - 1;
  }
  return MAX_LEVEL;
}

/** Get the XP progress within the current level (0-1) */
export function xpProgressInLevel(totalXP: number): number {
  const level = levelFromXP(totalXP);
  if (level >= MAX_LEVEL) return 1;
  const currentLevelTotal = totalXpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  if (nextLevelXP === 0) return 1;
  return Math.min(1, (totalXP - currentLevelTotal) / nextLevelXP);
}

// ─── XP Awards ───

export const XP_AWARDS = {
  blockBreak: 2,
  blockPlace: 1,
  craftItem: 10,
  killNPC: 25,
  killPlayer: 50,
  placeBuilding: 5,
  journalFound: 75,
  biomeDiscovered: 30,
  surviveNight: 15,
  deathPenalty: -10, // lose XP on death (never below 0)
} as const;

// ─── Level Rewards (cosmetic unlocks) ───

export type RewardType = 'body_color' | 'accessory' | 'trail' | 'death_effect' | 'title';

export interface LevelReward {
  level: number;
  type: RewardType;
  id: string;
  name: string;
  description: string;
  /** The actual value used in customization (hex color, accessory id, etc.) */
  value: string;
}

export const LEVEL_REWARDS: LevelReward[] = [
  // Body colors
  {
    level: 2,
    type: 'body_color',
    id: 'color_forest',
    name: 'Forest Green',
    description: 'A deep forest green body color.',
    value: '#2d5a27',
  },
  {
    level: 5,
    type: 'body_color',
    id: 'color_crimson',
    name: 'Crimson Red',
    description: 'A bold crimson body color.',
    value: '#cc2222',
  },
  {
    level: 8,
    type: 'body_color',
    id: 'color_ocean',
    name: 'Ocean Blue',
    description: 'A deep ocean blue body color.',
    value: '#1a5276',
  },
  {
    level: 12,
    type: 'body_color',
    id: 'color_gold',
    name: 'Royal Gold',
    description: 'A gleaming gold body color.',
    value: '#d4a017',
  },
  {
    level: 20,
    type: 'body_color',
    id: 'color_shadow',
    name: 'Shadow Black',
    description: 'A dark shadow body color.',
    value: '#1a1a2e',
  },

  // Head accessories
  {
    level: 3,
    type: 'accessory',
    id: 'bandana',
    name: 'Bandana',
    description: 'A simple cloth bandana.',
    value: 'bandana',
  },
  { level: 7, type: 'accessory', id: 'cap', name: 'Cap', description: 'A stylish cap.', value: 'cap' },
  {
    level: 15,
    type: 'accessory',
    id: 'helmet',
    name: 'Horned Helmet',
    description: 'A menacing horned helmet.',
    value: 'horns',
  },
  {
    level: 30,
    type: 'accessory',
    id: 'crown',
    name: 'Crown',
    description: 'A golden crown. Royalty.',
    value: 'crown',
  },
  {
    level: 45,
    type: 'accessory',
    id: 'horns',
    name: 'Demon Horns',
    description: 'Fiery demon horns.',
    value: 'horns',
  },

  // Trail effects
  {
    level: 10,
    type: 'trail',
    id: 'dust',
    name: 'Dust Trail',
    description: 'Leave a trail of dust as you move.',
    value: 'dust',
  },
  {
    level: 25,
    type: 'trail',
    id: 'sparkles',
    name: 'Sparkle Trail',
    description: 'Leave a trail of sparkles.',
    value: 'sparkles',
  },
  {
    level: 40,
    type: 'trail',
    id: 'fire',
    name: 'Fire Trail',
    description: 'Leave a blazing fire trail.',
    value: 'fire',
  },

  // Death effects
  {
    level: 6,
    type: 'death_effect',
    id: 'skull',
    name: 'Skull Pop',
    description: 'A skull appears on death.',
    value: 'skull',
  },
  {
    level: 18,
    type: 'death_effect',
    id: 'explosion',
    name: 'Explosion',
    description: 'Explode dramatically on death.',
    value: 'explosion',
  },
  {
    level: 35,
    type: 'death_effect',
    id: 'fade_gold',
    name: 'Golden Fade',
    description: 'Dissolve into golden particles.',
    value: 'fade_gold',
  },

  // Titles
  { level: 1, type: 'title', id: 'title_newcomer', name: 'Newcomer', description: 'Just arrived.', value: 'Newcomer' },
  {
    level: 10,
    type: 'title',
    id: 'title_survivor',
    name: 'Survivor',
    description: 'Battle-tested.',
    value: 'Survivor',
  },
  {
    level: 25,
    type: 'title',
    id: 'title_veteran',
    name: 'Veteran',
    description: 'A seasoned warrior.',
    value: 'Veteran',
  },
  {
    level: 50,
    type: 'title',
    id: 'title_legend',
    name: 'Legend',
    description: 'A living legend of the wasteland.',
    value: 'Legend',
  },
];

/** Get all rewards unlocked at or below a given level */
export function getUnlockedRewards(level: number): LevelReward[] {
  return LEVEL_REWARDS.filter((r) => r.level <= level);
}

/** Get rewards for a specific level */
export function getRewardsAtLevel(level: number): LevelReward[] {
  return LEVEL_REWARDS.filter((r) => r.level === level);
}

/** Star color tier based on level */
export function getStarColor(level: number): string {
  if (level >= 40) return '#ff4444'; // Red star
  if (level >= 30) return '#ff8800'; // Orange star
  if (level >= 20) return '#ffdd00'; // Gold star
  if (level >= 10) return '#44aaff'; // Blue star
  return '#aaaaaa'; // Gray star
}
