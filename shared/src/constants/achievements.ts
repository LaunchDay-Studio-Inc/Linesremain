// ─── Achievement Definitions ───
// 24 achievements across 6 categories

export enum AchievementCategory {
  Survival = 'survival',
  Building = 'building',
  Combat = 'combat',
  Exploration = 'exploration',
  Social = 'social',
  Meta = 'meta',
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string; // emoji or symbol for display
  xpReward: number;
  /** Stat key and threshold required to unlock */
  requirement: {
    stat: string;
    threshold: number;
  };
  /** Whether this achievement is hidden until unlocked */
  hidden?: boolean;
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  // ═══════════════════════════════════════
  // SURVIVAL (4 achievements)
  // ═══════════════════════════════════════
  first_night: {
    id: 'first_night',
    name: 'First Night',
    description: 'Survive your first night cycle.',
    category: AchievementCategory.Survival,
    icon: '🌙',
    xpReward: 50,
    requirement: { stat: 'nights_survived', threshold: 1 },
  },
  resourceful: {
    id: 'resourceful',
    name: 'Resourceful',
    description: 'Gather 500 total resources.',
    category: AchievementCategory.Survival,
    icon: '⛏',
    xpReward: 100,
    requirement: { stat: 'total_gathered', threshold: 500 },
  },
  hoarder: {
    id: 'hoarder',
    name: 'Hoarder',
    description: 'Gather 5,000 total resources.',
    category: AchievementCategory.Survival,
    icon: '📦',
    xpReward: 300,
    requirement: { stat: 'total_gathered', threshold: 5000 },
  },
  iron_stomach: {
    id: 'iron_stomach',
    name: 'Iron Stomach',
    description: 'Eat 50 food items.',
    category: AchievementCategory.Survival,
    icon: '🍖',
    xpReward: 150,
    requirement: { stat: 'total_eaten', threshold: 50 },
  },

  // ═══════════════════════════════════════
  // BUILDING (4 achievements)
  // ═══════════════════════════════════════
  first_foundation: {
    id: 'first_foundation',
    name: 'First Foundation',
    description: 'Place your first building piece.',
    category: AchievementCategory.Building,
    icon: '🏗',
    xpReward: 50,
    requirement: { stat: 'total_buildings', threshold: 1 },
  },
  architect: {
    id: 'architect',
    name: 'Architect',
    description: 'Place 50 building pieces.',
    category: AchievementCategory.Building,
    icon: '🏛',
    xpReward: 200,
    requirement: { stat: 'total_buildings', threshold: 50 },
  },
  master_builder: {
    id: 'master_builder',
    name: 'Master Builder',
    description: 'Place 250 building pieces.',
    category: AchievementCategory.Building,
    icon: '🏰',
    xpReward: 500,
    requirement: { stat: 'total_buildings', threshold: 250 },
  },
  first_craft: {
    id: 'first_craft',
    name: 'Tinkerer',
    description: 'Craft your first item.',
    category: AchievementCategory.Building,
    icon: '🔧',
    xpReward: 50,
    requirement: { stat: 'total_crafted', threshold: 1 },
  },

  // ═══════════════════════════════════════
  // COMBAT (4 achievements)
  // ═══════════════════════════════════════
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill your first creature.',
    category: AchievementCategory.Combat,
    icon: '⚔',
    xpReward: 50,
    requirement: { stat: 'total_kills_npc', threshold: 1 },
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    description: 'Kill 25 creatures.',
    category: AchievementCategory.Combat,
    icon: '🏹',
    xpReward: 200,
    requirement: { stat: 'total_kills_npc', threshold: 25 },
  },
  apex_predator: {
    id: 'apex_predator',
    name: 'Apex Predator',
    description: 'Kill 100 creatures.',
    category: AchievementCategory.Combat,
    icon: '💀',
    xpReward: 500,
    requirement: { stat: 'total_kills_npc', threshold: 100 },
  },
  pvp_warrior: {
    id: 'pvp_warrior',
    name: 'Warrior',
    description: 'Defeat 10 other players.',
    category: AchievementCategory.Combat,
    icon: '🗡',
    xpReward: 300,
    requirement: { stat: 'total_kills_pvp', threshold: 10 },
  },

  // ═══════════════════════════════════════
  // EXPLORATION (4 achievements)
  // ═══════════════════════════════════════
  first_steps: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Visit 3 different biomes.',
    category: AchievementCategory.Exploration,
    icon: '👣',
    xpReward: 100,
    requirement: { stat: 'biomes_visited', threshold: 3 },
  },
  world_traveler: {
    id: 'world_traveler',
    name: 'World Traveler',
    description: 'Visit all 9 biomes.',
    category: AchievementCategory.Exploration,
    icon: '🌍',
    xpReward: 500,
    requirement: { stat: 'biomes_visited', threshold: 9 },
  },
  lore_seeker: {
    id: 'lore_seeker',
    name: 'Lore Seeker',
    description: 'Find 5 journal fragments.',
    category: AchievementCategory.Exploration,
    icon: '📜',
    xpReward: 200,
    requirement: { stat: 'journals_found', threshold: 5 },
  },
  historian: {
    id: 'historian',
    name: 'Historian',
    description: 'Find all 20 journal fragments.',
    category: AchievementCategory.Exploration,
    icon: '📚',
    xpReward: 1000,
    requirement: { stat: 'journals_found', threshold: 20 },
  },

  // ═══════════════════════════════════════
  // SOCIAL (4 achievements)
  // ═══════════════════════════════════════
  friendly: {
    id: 'friendly',
    name: 'Friendly',
    description: 'Send your first chat message.',
    category: AchievementCategory.Social,
    icon: '💬',
    xpReward: 25,
    requirement: { stat: 'total_chats', threshold: 1 },
  },
  social_butterfly: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Send 100 chat messages.',
    category: AchievementCategory.Social,
    icon: '🦋',
    xpReward: 150,
    requirement: { stat: 'total_chats', threshold: 100 },
  },
  team_player: {
    id: 'team_player',
    name: 'Team Player',
    description: 'Join or create a team.',
    category: AchievementCategory.Social,
    icon: '🤝',
    xpReward: 100,
    requirement: { stat: 'teams_joined', threshold: 1 },
  },
  trader: {
    id: 'trader',
    name: 'Trader',
    description: 'Drop 20 items for other players.',
    category: AchievementCategory.Social,
    icon: '🔄',
    xpReward: 150,
    requirement: { stat: 'total_drops', threshold: 20 },
  },

  // ═══════════════════════════════════════
  // META (4 achievements)
  // ═══════════════════════════════════════
  the_line_remains: {
    id: 'the_line_remains',
    name: 'The Line Remains',
    description: 'Reach level 10.',
    category: AchievementCategory.Meta,
    icon: '⭐',
    xpReward: 500,
    requirement: { stat: 'level', threshold: 10 },
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    description: 'Reach level 25.',
    category: AchievementCategory.Meta,
    icon: '🎖',
    xpReward: 1000,
    requirement: { stat: 'level', threshold: 25 },
  },
  die_hard: {
    id: 'die_hard',
    name: 'Die Hard',
    description: 'Die 50 times. Persistence is key.',
    category: AchievementCategory.Meta,
    icon: '☠',
    xpReward: 200,
    requirement: { stat: 'total_deaths', threshold: 50 },
  },
  blood_moon_survivor: {
    id: 'blood_moon_survivor',
    name: 'Blood Moon Survivor',
    description: 'Survive a blood moon event.',
    category: AchievementCategory.Meta,
    icon: '🔴',
    xpReward: 300,
    requirement: { stat: 'blood_moons_survived', threshold: 1 },
    hidden: true,
  },
};

/** Get all achievement definitions as an array */
export const ACHIEVEMENT_LIST: AchievementDefinition[] = Object.values(ACHIEVEMENTS);

/** All category values as an array */
export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = Object.values(AchievementCategory);

/** Get all achievement definitions as an array */
export function getAchievementList(): AchievementDefinition[] {
  return ACHIEVEMENT_LIST;
}

/** Get achievements by category */
export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
  return Object.values(ACHIEVEMENTS).filter((a) => a.category === category);
}
