// ─── NPC Spawn System ───
// Spawns NPCs near connected players. Maintains a target population
// per player and respawns creatures when the local count drops below threshold.

import type { GameWorld } from '../World.js';
import {
  ComponentType,
  NPCCreatureType,
  AIBehavior,
  type PositionComponent,
  type LootTableEntry,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';

// ─── Constants ───

/** Check spawn conditions every 200 ticks (10 seconds at 20 TPS) */
const SPAWN_CHECK_INTERVAL = 200;

/** Maximum NPCs within spawn radius per player */
const MAX_NPCS_PER_PLAYER = 8;

/** Radius around each player to count and spawn NPCs (blocks) */
const SPAWN_RADIUS = 80;

/** Minimum distance from player for new spawns (blocks) */
const MIN_SPAWN_DISTANCE = 30;

/** Maximum total NPCs in the world */
const MAX_TOTAL_NPCS = 100;

// ─── Creature Definitions ───

interface CreatureTemplate {
  creatureType: NPCCreatureType;
  behavior: AIBehavior;
  health: number;
  damage: number;
  walkSpeed: number;
  runSpeed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  wanderRadius: number;
  colliderWidth: number;
  colliderHeight: number;
  lootTable: LootTableEntry[];
  weight: number; // relative spawn weight
}

const CREATURE_TEMPLATES: CreatureTemplate[] = [
  // ── Passive Creatures ──
  {
    creatureType: NPCCreatureType.DustHopper,
    behavior: AIBehavior.Passive,
    health: 100,
    damage: 0,
    walkSpeed: 2.5,
    runSpeed: 6.0,
    aggroRange: 10,
    attackRange: 1.5,
    attackCooldown: 2.0,
    wanderRadius: 25,
    colliderWidth: 0.6,
    colliderHeight: 0.8,
    lootTable: [
      { itemId: 53, quantity: 2, chance: 1.0 },  // Raw Meat
      { itemId: 9, quantity: 1, chance: 0.5 },    // Bone
      { itemId: 8, quantity: 1, chance: 0.3 },    // Animal Fat
    ],
    weight: 30,
  },
  {
    creatureType: NPCCreatureType.RidgeGrazer,
    behavior: AIBehavior.Passive,
    health: 200,
    damage: 0,
    walkSpeed: 1.8,
    runSpeed: 5.0,
    aggroRange: 12,
    attackRange: 2.0,
    attackCooldown: 2.0,
    wanderRadius: 30,
    colliderWidth: 1.0,
    colliderHeight: 1.5,
    lootTable: [
      { itemId: 53, quantity: 4, chance: 1.0 },  // Raw Meat
      { itemId: 7, quantity: 2, chance: 0.8 },    // Leather
      { itemId: 8, quantity: 2, chance: 0.6 },    // Animal Fat
      { itemId: 9, quantity: 2, chance: 0.5 },    // Bone
    ],
    weight: 20,
  },

  // ── Neutral Creatures ──
  {
    creatureType: NPCCreatureType.TuskWalker,
    behavior: AIBehavior.Neutral,
    health: 300,
    damage: 25,
    walkSpeed: 1.5,
    runSpeed: 5.5,
    aggroRange: 10,
    attackRange: 2.5,
    attackCooldown: 1.8,
    wanderRadius: 20,
    colliderWidth: 1.2,
    colliderHeight: 1.4,
    lootTable: [
      { itemId: 53, quantity: 5, chance: 1.0 },  // Raw Meat
      { itemId: 7, quantity: 3, chance: 0.9 },    // Leather
      { itemId: 8, quantity: 3, chance: 0.7 },    // Animal Fat
      { itemId: 9, quantity: 3, chance: 0.8 },    // Bone
    ],
    weight: 10,
  },
  {
    creatureType: NPCCreatureType.ShoreSnapper,
    behavior: AIBehavior.Neutral,
    health: 200,
    damage: 20,
    walkSpeed: 1.2,
    runSpeed: 4.0,
    aggroRange: 8,
    attackRange: 2.0,
    attackCooldown: 1.5,
    wanderRadius: 15,
    colliderWidth: 0.9,
    colliderHeight: 0.7,
    lootTable: [
      { itemId: 53, quantity: 3, chance: 1.0 },  // Raw Meat
      { itemId: 7, quantity: 2, chance: 0.6 },    // Leather
      { itemId: 9, quantity: 2, chance: 0.4 },    // Bone
    ],
    weight: 8,
  },

  // ── Hostile Creatures ──
  {
    creatureType: NPCCreatureType.HuskWalker,
    behavior: AIBehavior.Hostile,
    health: 250,
    damage: 30,
    walkSpeed: 2.0,
    runSpeed: 5.0,
    aggroRange: 20,
    attackRange: 2.0,
    attackCooldown: 1.5,
    wanderRadius: 25,
    colliderWidth: 0.8,
    colliderHeight: 1.8,
    lootTable: [
      { itemId: 6, quantity: 5, chance: 0.6 },    // Cloth
      { itemId: 9, quantity: 2, chance: 0.5 },     // Bone
      { itemId: 10, quantity: 3, chance: 0.2 },    // Metal Fragments
    ],
    weight: 15,
  },
  {
    creatureType: NPCCreatureType.SporeCrawler,
    behavior: AIBehavior.Hostile,
    health: 150,
    damage: 20,
    walkSpeed: 3.0,
    runSpeed: 7.0,
    aggroRange: 15,
    attackRange: 1.5,
    attackCooldown: 1.0,
    wanderRadius: 20,
    colliderWidth: 0.7,
    colliderHeight: 0.6,
    lootTable: [
      { itemId: 6, quantity: 3, chance: 0.5 },    // Cloth
      { itemId: 8, quantity: 1, chance: 0.4 },     // Animal Fat
    ],
    weight: 12,
  },
  {
    creatureType: NPCCreatureType.MireBrute,
    behavior: AIBehavior.Hostile,
    health: 400,
    damage: 40,
    walkSpeed: 1.5,
    runSpeed: 4.5,
    aggroRange: 18,
    attackRange: 3.0,
    attackCooldown: 2.0,
    wanderRadius: 15,
    colliderWidth: 1.4,
    colliderHeight: 2.0,
    lootTable: [
      { itemId: 53, quantity: 6, chance: 1.0 },   // Raw Meat
      { itemId: 7, quantity: 4, chance: 0.8 },     // Leather
      { itemId: 8, quantity: 3, chance: 0.7 },     // Animal Fat
      { itemId: 9, quantity: 4, chance: 0.9 },     // Bone
      { itemId: 10, quantity: 5, chance: 0.3 },    // Metal Fragments
    ],
    weight: 5,
  },
];

// Precompute total weight for weighted random selection
const TOTAL_WEIGHT = CREATURE_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

// ─── Tick Counter ───

let tickCounter = 0;

// ─── System ───

export function npcSpawnSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter % SPAWN_CHECK_INTERVAL !== 0) return;

  // Count total NPCs
  const allNPCs = world.ecs.query(ComponentType.NPCType);
  if (allNPCs.length >= MAX_TOTAL_NPCS) return;

  // Get all player positions
  const playerMap = world.getPlayerEntityMap();
  if (playerMap.size === 0) return;

  for (const [, entityId] of playerMap) {
    const playerPos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!playerPos) continue;

    // Count NPCs near this player
    let nearbyCount = 0;
    for (const npcId of allNPCs) {
      const npcPos = world.ecs.getComponent<PositionComponent>(npcId, ComponentType.Position);
      if (!npcPos) continue;

      const dx = npcPos.x - playerPos.x;
      const dz = npcPos.z - playerPos.z;
      if (dx * dx + dz * dz <= SPAWN_RADIUS * SPAWN_RADIUS) {
        nearbyCount++;
      }
    }

    // Spawn if below threshold
    const toSpawn = Math.min(2, MAX_NPCS_PER_PLAYER - nearbyCount);
    if (toSpawn <= 0) continue;

    for (let i = 0; i < toSpawn; i++) {
      if (allNPCs.length + i >= MAX_TOTAL_NPCS) break;

      const template = pickWeightedTemplate();
      const spawnPos = findSpawnPosition(world, playerPos);
      if (!spawnPos) continue;

      world.createNPCEntity(template.creatureType, spawnPos, {
        creatureType: template.creatureType,
        behavior: template.behavior,
        health: template.health,
        damage: template.damage,
        walkSpeed: template.walkSpeed,
        runSpeed: template.runSpeed,
        aggroRange: template.aggroRange,
        attackRange: template.attackRange,
        attackCooldown: template.attackCooldown,
        wanderRadius: template.wanderRadius,
        colliderWidth: template.colliderWidth,
        colliderHeight: template.colliderHeight,
        lootTable: template.lootTable,
      });

      logger.debug(
        { creature: template.creatureType, x: spawnPos.x, z: spawnPos.z },
        'Spawned NPC',
      );
    }
  }
}

// ─── Helpers ───

function pickWeightedTemplate(): CreatureTemplate {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const template of CREATURE_TEMPLATES) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }
  return CREATURE_TEMPLATES[0]!;
}

function findSpawnPosition(
  world: GameWorld,
  playerPos: PositionComponent,
): { x: number; y: number; z: number } | null {
  // Try a few random positions at a valid distance
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = MIN_SPAWN_DISTANCE + Math.random() * (SPAWN_RADIUS - MIN_SPAWN_DISTANCE);

    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;

    // Find the surface height at this position
    const surfaceY = findSurfaceY(world, Math.floor(x), Math.floor(z));
    if (surfaceY !== null) {
      return { x, y: surfaceY + 1, z };
    }
  }

  return null;
}

function findSurfaceY(world: GameWorld, worldX: number, worldZ: number): number | null {
  // Scan downward from a reasonable height to find solid ground
  for (let y = 63; y >= 1; y--) {
    const block = world.chunkStore.getBlock(worldX, y, worldZ);
    if (block !== null && block !== 0 && block !== 14) {
      // Found solid, non-water block
      return y;
    }
  }
  return null;
}
