// ─── Player Types ───

import type { ItemStack } from './items.js';

export interface PlayerState {
  position: { x: number; y: number; z: number; rotation: number };
  health: number;
  hunger: number;
  thirst: number;
  temperature: number;
  inventory: (ItemStack | null)[];
  equipment: {
    head: ItemStack | null;
    chest: ItemStack | null;
    legs: ItemStack | null;
    feet: ItemStack | null;
    held: ItemStack | null;
  };
}

export interface PlayerStats {
  totalPlaytime: number; // seconds
  totalKills: number;
  totalDeaths: number;
}

// ─── Lineage Types ───

export interface AncestorRecord {
  generation: number;
  survivedSeconds: number;
  enemiesKilled: number;
  buildingsPlaced: number;
  causeOfDeath: string;
}

export interface PlayerLineage {
  generation: number; // starts at 1
  totalDeaths: number;
  inheritedXP: number; // XP carried forward this generation
  inheritedBlueprints: number[]; // blueprint IDs from ancestors
  lineageStartedAt: number; // timestamp (epoch ms)
  ancestors: AncestorRecord[]; // last 5 ancestors
}
