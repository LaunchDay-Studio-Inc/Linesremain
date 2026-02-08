// ─── Respawn System ───
// Handles player death (creates LootBag with all items) and respawn
// (random/bag/bed spawn types, stat reset, starting Rock item).

import {
  ComponentType,
  CORPSE_DESPAWN_SECONDS,
  levelFromXP,
  SEA_LEVEL,
  WORLD_SIZE,
  type AncestorRecord,
  type EntityId,
  type EquipmentComponent,
  type HealthComponent,
  type InventoryComponent,
  type ItemStack,
  type OwnershipComponent,
  type PositionComponent,
  type SleepingBagComponent,
} from '@lineremain/shared';
import { playerRepository } from '../../database/repositories/PlayerRepository.js';
import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';
import { getPlayerStats, trackGeneration } from './AchievementSystem.js';

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

  for (let i = 0; i < pendingDeaths.length; i++) {
    const death = pendingDeaths[i]!;
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

  pendingDeaths.length = 0;
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
      if (block !== undefined && block !== 0 && block !== 14) {
        return { x, y: checkY + 1, z };
      }
    }
  }

  // Fallback: spawn at world center, above sea level
  return { x: WORLD_SIZE / 2, y: SEA_LEVEL + 5, z: WORLD_SIZE / 2 };
}

// ─── Near-base spawn for line deaths ───

const NEAR_BASE_RADIUS = 50;

/** Find a spawn point near the player's buildings (for line death respawn) */
function findNearBaseSpawn(
  world: GameWorld,
  playerId: string,
): { x: number; y: number; z: number } | null {
  // Query all building entities with ownership
  const owned = world.ecs.query(
    ComponentType.Building,
    ComponentType.Ownership,
    ComponentType.Position,
  );

  // Compute centroid of all owned buildings
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let count = 0;

  for (const entityId of owned) {
    const ownership = world.ecs.getComponent<OwnershipComponent>(entityId, ComponentType.Ownership);
    if (!ownership || ownership.ownerId !== playerId) continue;

    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!pos) continue;

    sumX += pos.x;
    sumY += pos.y;
    sumZ += pos.z;
    count++;
  }

  if (count === 0) return null;

  const bestPos = { x: sumX / count, y: sumY / count, z: sumZ / count };

  // Pick a random point within NEAR_BASE_RADIUS blocks
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * (NEAR_BASE_RADIUS - 10);
    const sx = bestPos.x + Math.cos(angle) * dist;
    const sz = bestPos.z + Math.sin(angle) * dist;

    // Clamp to world bounds
    const cx = Math.max(1, Math.min(WORLD_SIZE - 1, sx));
    const cz = Math.max(1, Math.min(WORLD_SIZE - 1, sz));

    // Find solid ground
    for (let checkY = 63; checkY >= SEA_LEVEL; checkY--) {
      const block = world.chunkStore.getBlock(Math.floor(cx), checkY, Math.floor(cz));
      if (block !== undefined && block !== 0 && block !== 14) {
        return { x: cx, y: checkY + 1, z: cz };
      }
    }
  }

  // Fallback: spawn right at the base
  return { x: bestPos.x, y: bestPos.y + 1, z: bestPos.z };
}

// ─── Lineage Death Processing ───

export interface LineageAdvancement {
  newGeneration: number;
  inheritedXP: number;
  ancestor: AncestorRecord;
  blueprintCount: number;
}

/** Process a line death — advance generation, inherit XP, record ancestor */
export async function processLineageDeath(
  playerId: string,
  cause: string,
): Promise<LineageAdvancement> {
  // 1. Load current stats from AchievementSystem cache
  const stats = getPlayerStats(playerId);
  const currentXP = stats?.xp ?? 0;

  // 2. Get current generation from DB
  const lineageData = await playerRepository.getLineage(playerId);
  const currentGen = lineageData?.generation ?? 1;

  // 3. Calculate inheritance
  const inheritedXP = Math.floor(currentXP * 0.2);
  const newGeneration = currentGen + 1;

  // 4. Build ancestor record
  const ancestor: AncestorRecord = {
    generation: currentGen,
    survivedSeconds: stats?.totalPlaytimeSeconds ?? 0,
    enemiesKilled: (stats?.totalKillsNpc ?? 0) + (stats?.totalKillsPvp ?? 0),
    buildingsPlaced: stats?.totalBuildings ?? 0,
    causeOfDeath: cause,
  };

  // 5. Persist to DB
  await playerRepository.advanceGeneration(playerId, newGeneration, inheritedXP, ancestor);

  // 6. Update in-memory stats cache
  if (stats) {
    stats.xp = inheritedXP;
    stats.level = levelFromXP(inheritedXP);
    stats.generation = newGeneration;
  }

  // 7. Track generation for achievements
  trackGeneration(playerId, newGeneration);

  // 8. Count blueprints (already persisted across generations)
  const player = await playerRepository.findById(playerId);
  const blueprintCount = Array.isArray(player?.learnedBlueprints)
    ? (player.learnedBlueprints as number[]).length
    : 0;

  logger.info(
    { playerId, newGeneration, inheritedXP, blueprintCount },
    'Lineage advanced — line death processed',
  );

  return { newGeneration, inheritedXP, ancestor, blueprintCount };
}

/** Process a player respawn — creates new entity with fresh stats */
export function processRespawn(
  world: GameWorld,
  playerId: string,
  respawnType: RespawnType = 'random',
  isLineDeath: boolean = false,
): EntityId {
  let spawnPos: { x: number; y: number; z: number };

  if (respawnType === 'bag') {
    const bagResult = findPlayerSleepingBag(world, playerId);
    const now = Date.now();

    if (bagResult && now - bagResult.bag.lastUsedTime >= SLEEPING_BAG_COOLDOWN_MS) {
      spawnPos = { x: bagResult.pos.x, y: bagResult.pos.y + 1, z: bagResult.pos.z };
      bagResult.bag.lastUsedTime = now;
      logger.info(
        { playerId, bagEntityId: bagResult.entityId },
        'Player respawning at sleeping bag',
      );
    } else {
      spawnPos = findRandomSpawnPosition(world);
      logger.info({ playerId }, 'Sleeping bag unavailable or on cooldown, random respawn');
    }
  } else if (isLineDeath) {
    // Line death: try to spawn near player's base
    const baseSpawn = findNearBaseSpawn(world, playerId);
    if (baseSpawn) {
      spawnPos = baseSpawn;
      logger.info({ playerId, position: baseSpawn }, 'Line death — respawning near base');
    } else {
      spawnPos = findRandomSpawnPosition(world);
      logger.info({ playerId }, 'Line death — no base found, random respawn');
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
