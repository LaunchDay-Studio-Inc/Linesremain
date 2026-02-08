// ─── Season / Wipe Types ───

export interface SeasonConfig {
  wipeCycleSeconds: number; // default: 7 days = 604800
  seasonNumber: number;
  seasonStartedAt: number; // epoch ms
  nextWipeAt: number; // epoch ms
}

export interface SeasonReward {
  title: string;
  category: 'kills' | 'buildings' | 'playtime' | 'general';
  rank: number; // top rank (1 = first place)
}

export const SEASON_REWARDS: SeasonReward[] = [
  { title: 'The Reaper', category: 'kills', rank: 1 },
  { title: 'The Architect', category: 'buildings', rank: 1 },
  { title: 'The Enduring', category: 'playtime', rank: 1 },
];

/** Default wipe cycle: 7 days in seconds */
export const DEFAULT_WIPE_CYCLE_SECONDS = 604800;

/** What persists across wipes */
export const WIPE_PERSISTENCE = {
  keepAccounts: true,
  keepXP: true,
  keepAchievements: true,
  keepBlueprints: true, // configurable
  resetInventory: true,
  resetBuildings: true,
  resetWorld: true,
  resetPositions: true,
} as const;
