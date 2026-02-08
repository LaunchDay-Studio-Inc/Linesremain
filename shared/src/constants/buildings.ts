// ─── Building Registry ───

import { BuildingPieceType, BuildingTier } from '../types/buildings.js';
import type { UpgradeCost } from '../types/buildings.js';

// ─── HP per tier for each building piece ───

export interface BuildingPieceStats {
  type: BuildingPieceType;
  healthPerTier: Record<BuildingTier, number>;
  upgradeCosts: Record<BuildingTier, UpgradeCost[]>;
}

export const BUILDING_REGISTRY: Record<string, BuildingPieceStats> = {
  [BuildingPieceType.Foundation]: {
    type: BuildingPieceType.Foundation,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.FoundationTriangle]: {
    type: BuildingPieceType.FoundationTriangle,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 100 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 150 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 100 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 13 }],
    },
  },
  [BuildingPieceType.Wall]: {
    type: BuildingPieceType.Wall,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.HalfWall]: {
    type: BuildingPieceType.HalfWall,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 125,
      [BuildingTier.Stone]: 250,
      [BuildingTier.Metal]: 500,
      [BuildingTier.Armored]: 1000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 100 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 150 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 100 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 13 }],
    },
  },
  [BuildingPieceType.Doorway]: {
    type: BuildingPieceType.Doorway,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.WindowFrame]: {
    type: BuildingPieceType.WindowFrame,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.Floor]: {
    type: BuildingPieceType.Floor,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.FloorTriangle]: {
    type: BuildingPieceType.FloorTriangle,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 100 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 150 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 100 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 13 }],
    },
  },
  [BuildingPieceType.Stairs]: {
    type: BuildingPieceType.Stairs,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.Roof]: {
    type: BuildingPieceType.Roof,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.Door]: {
    type: BuildingPieceType.Door,
    healthPerTier: {
      [BuildingTier.Twig]: 0,
      [BuildingTier.Wood]: 200,
      [BuildingTier.Stone]: 0,
      [BuildingTier.Metal]: 800,
      [BuildingTier.Armored]: 1500,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [],
      [BuildingTier.Stone]: [],
      [BuildingTier.Metal]: [],
      [BuildingTier.Armored]: [],
    },
  },
  [BuildingPieceType.WallFrame]: {
    type: BuildingPieceType.WallFrame,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 250,
      [BuildingTier.Stone]: 500,
      [BuildingTier.Metal]: 1000,
      [BuildingTier.Armored]: 2000,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 200 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 300 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 200 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 25 }],
    },
  },
  [BuildingPieceType.FloorGrill]: {
    type: BuildingPieceType.FloorGrill,
    healthPerTier: {
      [BuildingTier.Twig]: 0,
      [BuildingTier.Wood]: 0,
      [BuildingTier.Stone]: 0,
      [BuildingTier.Metal]: 750,
      [BuildingTier.Armored]: 0,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [],
      [BuildingTier.Stone]: [],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 150 }],
      [BuildingTier.Armored]: [],
    },
  },
  [BuildingPieceType.Fence]: {
    type: BuildingPieceType.Fence,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 150,
      [BuildingTier.Stone]: 300,
      [BuildingTier.Metal]: 600,
      [BuildingTier.Armored]: 1200,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 100 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 150 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 100 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 10 }],
    },
  },
  [BuildingPieceType.Pillar]: {
    type: BuildingPieceType.Pillar,
    healthPerTier: {
      [BuildingTier.Twig]: 10,
      [BuildingTier.Wood]: 200,
      [BuildingTier.Stone]: 400,
      [BuildingTier.Metal]: 800,
      [BuildingTier.Armored]: 1600,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [{ itemId: 1, quantity: 100 }],
      [BuildingTier.Stone]: [{ itemId: 2, quantity: 150 }],
      [BuildingTier.Metal]: [{ itemId: 10, quantity: 100 }],
      [BuildingTier.Armored]: [{ itemId: 12, quantity: 13 }],
    },
  },
  [BuildingPieceType.Campfire]: {
    type: BuildingPieceType.Campfire,
    healthPerTier: {
      [BuildingTier.Twig]: 100,
      [BuildingTier.Wood]: 100,
      [BuildingTier.Stone]: 0,
      [BuildingTier.Metal]: 0,
      [BuildingTier.Armored]: 0,
    },
    upgradeCosts: {
      [BuildingTier.Twig]: [],
      [BuildingTier.Wood]: [],
      [BuildingTier.Stone]: [],
      [BuildingTier.Metal]: [],
      [BuildingTier.Armored]: [],
    },
  },
};

// ─── Decay Constants ───

/** Time in seconds before decay begins when no tool cupboard is present */
export const DECAY_NO_TC_DELAY_SECONDS = 3600; // 1 hour

/** Decay times per tier (seconds to fully decay once started) */
export const DECAY_TIME_PER_TIER: Record<BuildingTier, number> = {
  [BuildingTier.Twig]: 3600, // 1 hour
  [BuildingTier.Wood]: 10800, // 3 hours
  [BuildingTier.Stone]: 18000, // 5 hours
  [BuildingTier.Metal]: 28800, // 8 hours
  [BuildingTier.Armored]: 43200, // 12 hours
};

/** Upkeep cost multiplier relative to upgrade cost (per day) */
export const UPKEEP_COST_MULTIPLIER = 0.1;