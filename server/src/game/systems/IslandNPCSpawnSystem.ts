// ─── Island NPC Spawn System ───
// Spawns hostile NPCs on Ember Isle only. Haven is always safe.
// Runs every 200 ticks (~10 seconds). Max 6 hostiles on Ember Isle.

import {
  AIBehavior,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Z,
  ComponentType,
  EMBER_ISLAND,
  NPCCreatureType,
  type EntityId,
  type PositionComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';

const SPAWN_INTERVAL_TICKS = 200;
const MAX_ISLAND_NPCS = 6;
const DESPAWN_DISTANCE_SQ = 80 * 80;

let tickCounter = 0;
const islandNPCs = new Set<EntityId>();

export function islandNPCSpawnSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter < SPAWN_INTERVAL_TICKS) return;
  tickCounter = 0;

  // Remove destroyed NPCs from tracking set
  for (const npcId of islandNPCs) {
    if (!world.ecs.entityExists(npcId)) {
      islandNPCs.delete(npcId);
    }
  }

  // Check if any player is in island world AND on Ember Isle
  let hasEmberPlayer = false;
  const playerPositions: Array<{ x: number; z: number }> = [];

  for (const [playerId, worldType] of world.playerWorldMap) {
    if (worldType !== 'islands') continue;
    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) continue;
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!pos) continue;

    playerPositions.push({ x: pos.x, z: pos.z });

    // Check if player is within Ember Isle bounds (world coordinates)
    const minX = EMBER_ISLAND.minCX * CHUNK_SIZE_X;
    const maxX = (EMBER_ISLAND.maxCX + 1) * CHUNK_SIZE_X;
    const minZ = EMBER_ISLAND.minCZ * CHUNK_SIZE_Z;
    const maxZ = (EMBER_ISLAND.maxCZ + 1) * CHUNK_SIZE_Z;
    if (pos.x >= minX && pos.x < maxX && pos.z >= minZ && pos.z < maxZ) {
      hasEmberPlayer = true;
    }
  }

  // Despawn NPCs too far from any player
  for (const npcId of islandNPCs) {
    const pos = world.ecs.getComponent<PositionComponent>(npcId, ComponentType.Position);
    if (!pos) continue;

    let nearPlayer = false;
    for (const pp of playerPositions) {
      const dx = pos.x - pp.x;
      const dz = pos.z - pp.z;
      if (dx * dx + dz * dz < DESPAWN_DISTANCE_SQ) {
        nearPlayer = true;
        break;
      }
    }
    if (!nearPlayer) {
      world.ecs.destroyEntity(npcId);
      islandNPCs.delete(npcId);
    }
  }

  // Only spawn if a player is on Ember Isle and under the cap
  if (!hasEmberPlayer || islandNPCs.size >= MAX_ISLAND_NPCS) return;

  // Random position within Ember Isle bounds
  const minWX = EMBER_ISLAND.minCX * CHUNK_SIZE_X + 4;
  const maxWX = (EMBER_ISLAND.maxCX + 1) * CHUNK_SIZE_X - 4;
  const minWZ = EMBER_ISLAND.minCZ * CHUNK_SIZE_Z + 4;
  const maxWZ = (EMBER_ISLAND.maxCZ + 1) * CHUNK_SIZE_Z - 4;

  const spawnX = minWX + Math.random() * (maxWX - minWX);
  const spawnZ = minWZ + Math.random() * (maxWZ - minWZ);
  const spawnY = world.islandChunkStore.getGenerator().findSurfaceY(spawnX, spawnZ);

  // Don't spawn underwater
  if (spawnY < 33) return;

  const entityId = world.createNPCEntity(
    { x: spawnX, y: spawnY + 1, z: spawnZ },
    {
      creatureType: NPCCreatureType.DustHopper,
      behavior: AIBehavior.Hostile,
      health: 80,
      damage: 12,
      walkSpeed: 2.5,
      runSpeed: 5.0,
      aggroRange: 12,
      attackRange: 2.0,
      attackCooldown: 1.5,
      wanderRadius: 15,
      lootTable: [
        { itemId: 9, quantity: 2, chance: 0.8 }, // Bone
        { itemId: 53, quantity: 1, chance: 0.6 }, // Raw Meat
        { itemId: 7, quantity: 1, chance: 0.4 }, // Leather
      ],
    },
  );

  islandNPCs.add(entityId);
}
