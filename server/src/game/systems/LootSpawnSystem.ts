// ─── Loot Spawn System ───
// Spawns barrels (10 HP, breakable, Tier 0-1 loot, 600s respawn) and
// crates at monument locations with weighted random loot table rolls.

import {
  ComponentType,
  type HealthComponent,
  type InventoryComponent,
  type ItemStack,
  type LootableComponent,
  type LootTableEntry,
  type PositionComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const CHECK_INTERVAL_S = 30;
let timeSinceLastCheck = 0;

// ─── Loot Tier Tables ───

/** Tier 0 — Barrel loot (basic resources) */
const BARREL_LOOT_TABLE: LootTableEntry[] = [
  { itemId: 1, quantity: 50, chance: 0.4 }, // Wood
  { itemId: 2, quantity: 30, chance: 0.3 }, // Stone
  { itemId: 10, quantity: 15, chance: 0.25 }, // Metal Fragments
  { itemId: 6, quantity: 20, chance: 0.3 }, // Cloth
  { itemId: 13, quantity: 20, chance: 0.2 }, // Charcoal
  { itemId: 15, quantity: 10, chance: 0.15 }, // Low Grade Fuel
  { itemId: 16, quantity: 1, chance: 0.1 }, // Rope
  { itemId: 9, quantity: 10, chance: 0.15 }, // Bone
];

/** Tier 1 — Basic crate loot */
const BASIC_CRATE_LOOT_TABLE: LootTableEntry[] = [
  { itemId: 10, quantity: 50, chance: 0.4 }, // Metal Fragments
  { itemId: 11, quantity: 30, chance: 0.3 }, // Sulfur
  { itemId: 6, quantity: 40, chance: 0.3 }, // Cloth
  { itemId: 16, quantity: 2, chance: 0.2 }, // Rope
  { itemId: 17, quantity: 1, chance: 0.15 }, // Tarp
  { itemId: 20, quantity: 1, chance: 0.15 }, // Sewing Kit
  { itemId: 29, quantity: 1, chance: 0.1 }, // Bone Knife
  { itemId: 30, quantity: 1, chance: 0.08 }, // Stone Spear
  { itemId: 58, quantity: 2, chance: 0.2 }, // Bandage
  { itemId: 55, quantity: 3, chance: 0.25 }, // Mushroom
];

/** Tier 2 — Military crate loot */
const MILITARY_CRATE_LOOT_TABLE: LootTableEntry[] = [
  { itemId: 10, quantity: 100, chance: 0.4 }, // Metal Fragments
  { itemId: 12, quantity: 5, chance: 0.2 }, // HQM
  { itemId: 18, quantity: 1, chance: 0.15 }, // Spring
  { itemId: 19, quantity: 1, chance: 0.15 }, // Pipe
  { itemId: 32, quantity: 1, chance: 0.1 }, // Machete
  { itemId: 37, quantity: 1, chance: 0.08 }, // Revolver
  { itemId: 42, quantity: 12, chance: 0.2 }, // Pistol Ammo
  { itemId: 50, quantity: 1, chance: 0.08 }, // Road Sign Vest
  { itemId: 59, quantity: 1, chance: 0.12 }, // Medical Syringe
  { itemId: 14, quantity: 30, chance: 0.25 }, // Gunpowder
];

/** Tier 3 — Elite crate loot */
const ELITE_CRATE_LOOT_TABLE: LootTableEntry[] = [
  { itemId: 12, quantity: 15, chance: 0.3 }, // HQM
  { itemId: 18, quantity: 2, chance: 0.2 }, // Spring
  { itemId: 19, quantity: 2, chance: 0.2 }, // Pipe
  { itemId: 39, quantity: 1, chance: 0.1 }, // Semi-Auto Rifle
  { itemId: 40, quantity: 1, chance: 0.05 }, // Assault Rifle
  { itemId: 44, quantity: 30, chance: 0.2 }, // Rifle Ammo
  { itemId: 52, quantity: 1, chance: 0.08 }, // Metal Facemask
  { itemId: 33, quantity: 1, chance: 0.1 }, // Salvaged Sword
  { itemId: 59, quantity: 2, chance: 0.15 }, // Medical Syringe
  { itemId: 50, quantity: 1, chance: 0.12 }, // Road Sign Vest
];

// ─── Loot Roll Helper ───

/** Roll a loot table and return item stacks based on chance */
export function rollLootTable(table: LootTableEntry[]): ItemStack[] {
  const items: ItemStack[] = [];

  for (const entry of table) {
    if (Math.random() <= entry.chance) {
      // Randomize quantity slightly (75% to 125% of base)
      const qty = Math.max(1, Math.round(entry.quantity * (0.75 + Math.random() * 0.5)));
      items.push({ itemId: entry.itemId, quantity: qty });
    }
  }

  return items;
}

// ─── Loot Spawn Tracking ───

interface LootSpawnPoint {
  position: { x: number; y: number; z: number };
  tier: 'barrel' | 'basic' | 'military' | 'elite';
  entityId: number | null;
  lastDespawnTime: number;
  respawnDelayS: number;
}

const spawnPoints: LootSpawnPoint[] = [];

/** Register a loot spawn point (called during world generation) */
export function registerLootSpawnPoint(
  position: { x: number; y: number; z: number },
  tier: 'barrel' | 'basic' | 'military' | 'elite',
  respawnDelayS: number = 600,
): void {
  spawnPoints.push({
    position,
    tier,
    entityId: null,
    lastDespawnTime: 0,
    respawnDelayS,
  });
}

function getLootTableForTier(tier: string): LootTableEntry[] {
  switch (tier) {
    case 'barrel':
      return BARREL_LOOT_TABLE;
    case 'basic':
      return BASIC_CRATE_LOOT_TABLE;
    case 'military':
      return MILITARY_CRATE_LOOT_TABLE;
    case 'elite':
      return ELITE_CRATE_LOOT_TABLE;
    default:
      return BARREL_LOOT_TABLE;
  }
}

function getHealthForTier(tier: string): number {
  switch (tier) {
    case 'barrel':
      return 10;
    case 'basic':
      return 50;
    case 'military':
      return 100;
    case 'elite':
      return 200;
    default:
      return 10;
  }
}

// ─── Loot Spawn System ───

export const lootSpawnSystem: SystemFn = (world: GameWorld, dt: number): void => {
  timeSinceLastCheck += dt;
  if (timeSinceLastCheck < CHECK_INTERVAL_S) return;
  timeSinceLastCheck = 0;

  const now = Date.now();

  for (const spawn of spawnPoints) {
    // Check if entity still exists
    if (spawn.entityId !== null) {
      if (world.ecs.entityExists(spawn.entityId)) {
        // Check if it's been looted or destroyed
        const health = world.ecs.getComponent<HealthComponent>(
          spawn.entityId,
          ComponentType.Health,
        );
        if (health && health.current > 0) {
          continue; // Still alive, skip
        }
      }
      // Entity destroyed or dead — mark for respawn
      spawn.entityId = null;
      spawn.lastDespawnTime = now;
    }

    // Check respawn timer
    if (spawn.entityId === null) {
      const elapsed = (now - spawn.lastDespawnTime) / 1000;
      if (elapsed < spawn.respawnDelayS && spawn.lastDespawnTime > 0) continue;

      // Spawn new loot entity
      const lootTable = getLootTableForTier(spawn.tier);
      let items = rollLootTable(lootTable);
      if (items.length === 0) {
        // Guarantee at least 1 item — pick highest chance entry as fallback
        const fallback = lootTable.reduce((best, entry) =>
          entry.chance > best.chance ? entry : best,
        );
        const qty = Math.max(1, Math.round(fallback.quantity * (0.75 + Math.random() * 0.5)));
        items = [{ itemId: fallback.itemId, quantity: qty }];
      }

      const hp = getHealthForTier(spawn.tier);
      const entityId = world.ecs.createEntity();

      world.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
        x: spawn.position.x,
        y: spawn.position.y,
        z: spawn.position.z,
        rotation: 0,
      });

      world.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
        current: hp,
        max: hp,
      });

      world.ecs.addComponent<InventoryComponent>(entityId, ComponentType.Inventory, {
        slots: items,
        maxSlots: items.length,
      });

      world.ecs.addComponent<LootableComponent>(entityId, ComponentType.Lootable, {
        lootTable: [...lootTable], // Clone to prevent shared reference mutation
        isLooted: false,
      });

      world.ecs.addComponent(entityId, ComponentType.Collider, {
        width: 0.8,
        height: 0.8,
        depth: 0.8,
        isStatic: true,
      });

      spawn.entityId = entityId;

      logger.debug(
        {
          entityId,
          tier: spawn.tier,
          items: items.length,
          position: spawn.position,
        },
        'Loot container spawned',
      );
    }
  }
};
