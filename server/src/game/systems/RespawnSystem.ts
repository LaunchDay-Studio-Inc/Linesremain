// ─── Respawn System ───
// Handles player death (creates LootBag with all items) and respawn
// (random/bag/bed spawn types, stat reset, starting Rock item).

import {
  ComponentType,
  CORPSE_DESPAWN_SECONDS,
  SEA_LEVEL,
  WORLD_SIZE,
  type EntityId,
  type EquipmentComponent,
  type HealthComponent,
  type InventoryComponent,
  type ItemStack,
  type PositionComponent,
  type SleepingBagComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';

// ─── Death Tracking ───

interface DeathRecord {
  playerId: string;
  entityId: EntityId;
  deathTime: number;
  deathPosition: { x: number; y: number; z: number };
}

const pendingDeaths: DeathRecord[] = [];

/** Check if a player entity has died (health <= 0) and queue for processing */
export function checkPlayerDeath(world: GameWorld, playerId: string, entityId: EntityId): boolean {
  const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
  if (!health || health.current > 0) return false;

  const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
  if (!pos) return false;

  pendingDeaths.push({
    playerId,
    entityId,
    deathTime: Date.now(),
    deathPosition: { x: pos.x, y: pos.y, z: pos.z },
  });

  return true;
}

/** Process all pending player deaths — creates loot bags */
export function processPlayerDeaths(world: GameWorld): DeathRecord[] {
  const processed: DeathRecord[] = [];

  while (pendingDeaths.length > 0) {
    const death = pendingDeaths.shift()!;
    processed.push(death);

    // Gather all items from inventory + equipment
    const allItems: ItemStack[] = [];

    const inventory = world.ecs.getComponent<InventoryComponent>(
      death.entityId,
      ComponentType.Inventory,
    );
    if (inventory) {
      for (const slot of inventory.slots) {
        if (slot !== null) {
          allItems.push({ ...slot });
        }
      }
    }

    const equipment = world.ecs.getComponent<EquipmentComponent>(
      death.entityId,
      ComponentType.Equipment,
    );
    if (equipment) {
      const equipSlots = [
        equipment.head,
        equipment.chest,
        equipment.legs,
        equipment.feet,
        equipment.held,
      ];
      for (const slot of equipSlots) {
        if (slot !== null) {
          allItems.push({ ...slot });
        }
      }
    }

    // Create loot bag at death position if there are items
    if (allItems.length > 0) {
      world.createLootBagEntity(death.deathPosition, allItems, CORPSE_DESPAWN_SECONDS);
      logger.info({ playerId: death.playerId, items: allItems.length }, 'Created death loot bag');
    }

    // Remove the player entity
    world.removePlayerEntity(death.playerId);

    logger.info({ playerId: death.playerId, position: death.deathPosition }, 'Player died');
  }

  return processed;
}

// ─── Respawn Types ───

export type RespawnType = 'random' | 'bag' | 'bed';

/** 5-minute cooldown between sleeping bag respawns */
const SLEEPING_BAG_COOLDOWN_MS = 5 * 60 * 1000;

/** Find the sleeping bag entity placed by a specific player */
function findPlayerSleepingBag(
  world: GameWorld,
  playerId: string,
): { entityId: EntityId; bag: SleepingBagComponent; pos: PositionComponent } | null {
  const bags = world.ecs.query(ComponentType.SleepingBag, ComponentType.Position);
  for (const bagEntityId of bags) {
    const bag = world.ecs.getComponent<SleepingBagComponent>(
      bagEntityId,
      ComponentType.SleepingBag,
    );
    if (!bag || bag.placerId !== playerId) continue;

    const pos = world.ecs.getComponent<PositionComponent>(bagEntityId, ComponentType.Position);
    if (!pos) continue;

    return { entityId: bagEntityId, bag, pos };
  }
  return null;
}

/** Check if a player has a sleeping bag placed */
export function playerHasSleepingBag(world: GameWorld, playerId: string): boolean {
  return findPlayerSleepingBag(world, playerId) !== null;
}

/** Find a random spawn position on the map */
function findRandomSpawnPosition(world: GameWorld): { x: number; y: number; z: number } {
  // Try to find a valid position near the coast/beach
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = Math.random() * WORLD_SIZE;
    const z = Math.random() * WORLD_SIZE;

    // Simple surface check — find the highest solid block
    for (let checkY = 63; checkY >= SEA_LEVEL; checkY--) {
      const block = world.chunkStore.getBlock(Math.floor(x), checkY, Math.floor(z));
      if (block !== undefined && block !== 0) {
        return { x, y: checkY + 1, z };
      }
    }
  }

  // Fallback: spawn at world center, above sea level
  return { x: WORLD_SIZE / 2, y: SEA_LEVEL + 5, z: WORLD_SIZE / 2 };
}

/** Process a player respawn — creates new entity with fresh stats */
export function processRespawn(
  world: GameWorld,
  playerId: string,
  respawnType: RespawnType = 'random',
): EntityId {
  let spawnPos: { x: number; y: number; z: number };

  if (respawnType === 'bag') {
    const bagResult = findPlayerSleepingBag(world, playerId);
    const now = Date.now();

    if (bagResult && now - bagResult.bag.lastUsedTime >= SLEEPING_BAG_COOLDOWN_MS) {
      spawnPos = { x: bagResult.pos.x, y: bagResult.pos.y + 1, z: bagResult.pos.z };
      bagResult.bag.lastUsedTime = now;
      logger.info({ playerId, bagEntityId: bagResult.entityId }, 'Player respawning at sleeping bag');
    } else {
      spawnPos = findRandomSpawnPosition(world);
      logger.info({ playerId }, 'Sleeping bag unavailable or on cooldown, random respawn');
    }
  } else {
    spawnPos = findRandomSpawnPosition(world);
  }

  // Create fresh player entity
  const entityId = world.createPlayerEntity(playerId, spawnPos);

  // Give starting Rock item (id 21)
  const inventory = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
  if (inventory) {
    inventory.slots[0] = { itemId: 21, quantity: 1, durability: 50 };
  }

  logger.info({ playerId, position: spawnPos }, 'Player respawned');

  return entityId;
}
