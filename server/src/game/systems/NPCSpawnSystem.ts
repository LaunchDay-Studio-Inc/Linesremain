// ─── NPC Spawn System ───
// Spawns NPCs near connected players. Maintains a target population
// per player and respawns creatures when the local count drops below threshold.
// Passive/neutral creatures spawn any time; hostile creatures only at night.
// Hostiles despawn during the day if far from players.

import {
  AIBehavior,
  BiomeType,
  ComponentType,
  NPCCreatureType,
  type LootTableEntry,
  type NPCTypeComponent,
  type PositionComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';
import { isDaytime } from './DayNightSystem.js';
import { isBloodMoon } from './WorldEventSystem.js';

// ─── Constants ───

/** Check spawn conditions every 200 ticks (10 seconds at 20 TPS) */
const SPAWN_CHECK_INTERVAL = 200;

/** Maximum NPCs within spawn radius per player */
const MAX_NPCS_PER_PLAYER = 8;

/** Radius around each player to count and spawn NPCs (blocks) */
const SPAWN_RADIUS = 80;

/** Minimum distance from player for new spawns (blocks) */
const MIN_SPAWN_DISTANCE = 30;

/** Maximum passive/neutral NPCs worldwide */
const MAX_PASSIVE_NPCS = 35;

/** Maximum hostile NPCs worldwide */
const MAX_HOSTILE_NPCS = 15;

/** Maximum total NPCs in the world */
const MAX_TOTAL_NPCS = MAX_PASSIVE_NPCS + MAX_HOSTILE_NPCS;

/** Distance beyond which hostile NPCs despawn during the day */
const HOSTILE_DESPAWN_DISTANCE = 80;

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
  groupSize?: { min: number; max: number }; // for group spawning
  nightOnly?: boolean;
  fleeHealthPercent?: number;
  packRadius?: number;
  isBoss?: boolean;
  spawnBiomes?: BiomeType[];
}

const PASSIVE_TEMPLATES: CreatureTemplate[] = [
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
      { itemId: 53, quantity: 2, chance: 1.0 }, // Raw Meat
      { itemId: 9, quantity: 1, chance: 0.5 }, // Bone
      { itemId: 8, quantity: 1, chance: 0.3 }, // Animal Fat
    ],
    weight: 30,
    groupSize: { min: 2, max: 4 },
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
      { itemId: 53, quantity: 4, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 2, chance: 0.8 }, // Leather
      { itemId: 8, quantity: 2, chance: 0.6 }, // Animal Fat
      { itemId: 9, quantity: 2, chance: 0.5 }, // Bone
    ],
    weight: 20,
    groupSize: { min: 3, max: 5 },
  },
];

const NEUTRAL_TEMPLATES: CreatureTemplate[] = [
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
      { itemId: 53, quantity: 5, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 3, chance: 0.9 }, // Leather
      { itemId: 8, quantity: 3, chance: 0.7 }, // Animal Fat
      { itemId: 9, quantity: 3, chance: 0.8 }, // Bone
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
      { itemId: 53, quantity: 3, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 2, chance: 0.6 }, // Leather
      { itemId: 9, quantity: 2, chance: 0.4 }, // Bone
    ],
    weight: 8,
  },
  {
    creatureType: NPCCreatureType.Boar,
    behavior: AIBehavior.Neutral,
    health: 80,
    damage: 15,
    walkSpeed: 2.5,
    runSpeed: 3.5,
    aggroRange: 8,
    attackRange: 2.0,
    attackCooldown: 1.5,
    wanderRadius: 20,
    colliderWidth: 0.8,
    colliderHeight: 0.8,
    lootTable: [
      { itemId: 9, quantity: 5, chance: 1.0 }, // Bone
      { itemId: 6, quantity: 3, chance: 0.8 }, // Cloth
      { itemId: 53, quantity: 2, chance: 0.6 }, // Raw Meat
    ],
    weight: 12,
    groupSize: { min: 1, max: 3 },
    fleeHealthPercent: 0.2,
    spawnBiomes: [
      BiomeType.DrygrassPlains,
      BiomeType.Greenhollow,
      BiomeType.AshwoodForest,
      BiomeType.Mossreach,
    ],
  },
];

const HOSTILE_TEMPLATES: CreatureTemplate[] = [
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
      { itemId: 6, quantity: 5, chance: 0.6 }, // Cloth
      { itemId: 9, quantity: 2, chance: 0.5 }, // Bone
      { itemId: 10, quantity: 3, chance: 0.2 }, // Metal Fragments
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
      { itemId: 6, quantity: 3, chance: 0.5 }, // Cloth
      { itemId: 8, quantity: 1, chance: 0.4 }, // Animal Fat
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
      { itemId: 53, quantity: 6, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 4, chance: 0.8 }, // Leather
      { itemId: 8, quantity: 3, chance: 0.7 }, // Animal Fat
      { itemId: 9, quantity: 4, chance: 0.9 }, // Bone
      { itemId: 10, quantity: 5, chance: 0.3 }, // Metal Fragments
    ],
    weight: 5,
  },
  {
    creatureType: NPCCreatureType.FrostStalker,
    behavior: AIBehavior.Hostile,
    health: 120,
    damage: 25,
    walkSpeed: 2.5,
    runSpeed: 6.5,
    aggroRange: 22,
    attackRange: 2.0,
    attackCooldown: 1.2,
    wanderRadius: 30,
    colliderWidth: 0.7,
    colliderHeight: 1.2,
    lootTable: [
      { itemId: 53, quantity: 2, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 2, chance: 0.7 }, // Leather
      { itemId: 88, quantity: 1, chance: 0.4 }, // Frost Fang
    ],
    weight: 8,
    groupSize: { min: 2, max: 3 },
    spawnBiomes: [
      BiomeType.FrostveilPeaks,
      BiomeType.SnowmeltWoods,
      BiomeType.GlacialExpanse,
    ],
  },
  {
    creatureType: NPCCreatureType.Wolf,
    behavior: AIBehavior.Hostile,
    health: 120,
    damage: 25,
    walkSpeed: 3.0,
    runSpeed: 5.5,
    aggroRange: 20,
    attackRange: 2.0,
    attackCooldown: 1.2,
    wanderRadius: 30,
    colliderWidth: 0.7,
    colliderHeight: 1.0,
    lootTable: [
      { itemId: 53, quantity: 2, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 2, chance: 0.8 }, // Leather
      { itemId: 9, quantity: 1, chance: 0.5 }, // Bone
    ],
    weight: 10,
    groupSize: { min: 2, max: 4 },
    packRadius: 15,
  },
  {
    creatureType: NPCCreatureType.Bear,
    behavior: AIBehavior.Hostile,
    health: 400,
    damage: 60,
    walkSpeed: 1.8,
    runSpeed: 4.0,
    aggroRange: 15,
    attackRange: 3.0,
    attackCooldown: 2.0,
    wanderRadius: 20,
    colliderWidth: 1.4,
    colliderHeight: 2.0,
    lootTable: [
      { itemId: 53, quantity: 6, chance: 1.0 }, // Raw Meat
      { itemId: 7, quantity: 4, chance: 0.9 }, // Leather
      { itemId: 8, quantity: 3, chance: 0.7 }, // Animal Fat
      { itemId: 9, quantity: 3, chance: 0.6 }, // Bone
    ],
    weight: 3,
  },
  {
    creatureType: NPCCreatureType.Zombie,
    behavior: AIBehavior.Hostile,
    health: 150,
    damage: 30,
    walkSpeed: 1.5,
    runSpeed: 2.5,
    aggroRange: 25,
    attackRange: 2.0,
    attackCooldown: 1.5,
    wanderRadius: 20,
    colliderWidth: 0.8,
    colliderHeight: 1.8,
    lootTable: [
      { itemId: 6, quantity: 3, chance: 0.7 }, // Cloth
      { itemId: 9, quantity: 2, chance: 0.5 }, // Bone
      { itemId: 10, quantity: 2, chance: 0.3 }, // Metal Fragments
    ],
    weight: 15,
    groupSize: { min: 2, max: 5 },
    nightOnly: true,
  },
  {
    creatureType: NPCCreatureType.Bandit,
    behavior: AIBehavior.Hostile,
    health: 100,
    damage: 20,
    walkSpeed: 2.5,
    runSpeed: 4.0,
    aggroRange: 30,
    attackRange: 10.0,
    attackCooldown: 1.8,
    wanderRadius: 25,
    colliderWidth: 0.6,
    colliderHeight: 1.8,
    lootTable: [
      { itemId: 6, quantity: 5, chance: 0.8 }, // Cloth
      { itemId: 10, quantity: 3, chance: 0.5 }, // Metal Fragments
      { itemId: 96, quantity: 5, chance: 0.4 }, // Scrap
      { itemId: 15, quantity: 2, chance: 0.3 }, // Low Grade Fuel
    ],
    weight: 6,
    fleeHealthPercent: 0.3,
  },
  {
    creatureType: NPCCreatureType.ScrapHulk,
    behavior: AIBehavior.Hostile,
    health: 1000,
    damage: 80,
    walkSpeed: 1.0,
    runSpeed: 2.0,
    aggroRange: 20,
    attackRange: 4.0,
    attackCooldown: 2.5,
    wanderRadius: 15,
    colliderWidth: 1.6,
    colliderHeight: 2.5,
    lootTable: [
      { itemId: 10, quantity: 20, chance: 1.0 }, // Metal Fragments
      { itemId: 12, quantity: 5, chance: 0.6 }, // HQM
      { itemId: 96, quantity: 15, chance: 0.8 }, // Scrap
      { itemId: 15, quantity: 5, chance: 0.5 }, // Low Grade Fuel
    ],
    weight: 1,
    isBoss: true,
  },
];

const BLOOD_MOON_TEMPLATES: CreatureTemplate[] = [
  {
    creatureType: NPCCreatureType.CrimsonHusk,
    behavior: AIBehavior.Hostile,
    health: 120,
    damage: 35,
    walkSpeed: 2.5,
    runSpeed: 6.0,
    aggroRange: 25,
    attackRange: 2.0,
    attackCooldown: 1.3,
    wanderRadius: 30,
    colliderWidth: 0.9,
    colliderHeight: 1.9,
    lootTable: [
      { itemId: 6, quantity: 5, chance: 0.8 }, // Cloth
      { itemId: 9, quantity: 3, chance: 0.6 }, // Bone
      { itemId: 10, quantity: 5, chance: 0.4 }, // Metal Fragments
      { itemId: 89, quantity: 1, chance: 0.15 }, // Crimson Core
    ],
    weight: 20,
  },
];

// Combined passive+neutral pool for daytime spawning
const DAYTIME_TEMPLATES = [...PASSIVE_TEMPLATES, ...NEUTRAL_TEMPLATES];
const DAYTIME_TOTAL_WEIGHT = DAYTIME_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

// All templates for nighttime spawning (hostile gets extra weight at night)
const NIGHTTIME_TEMPLATES = [...PASSIVE_TEMPLATES, ...NEUTRAL_TEMPLATES, ...HOSTILE_TEMPLATES];
const NIGHTTIME_TOTAL_WEIGHT = NIGHTTIME_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

// Pre-allocated blood moon spawn pool (avoid per-tick array concatenation)
const NON_NIGHT_HOSTILE_TEMPLATES = HOSTILE_TEMPLATES.filter((t) => !t.nightOnly);
const NON_NIGHT_HOSTILE_WEIGHT = NON_NIGHT_HOSTILE_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

// Pre-allocated blood moon spawn pool (avoid per-tick array concatenation)
const BLOOD_MOON_POOL = [...HOSTILE_TEMPLATES, ...BLOOD_MOON_TEMPLATES];
const BLOOD_MOON_TOTAL_WEIGHT = BLOOD_MOON_POOL.reduce((sum, t) => sum + t.weight, 0);

// ─── Tick Counter ───

let tickCounter = 0;

// ─── System ───

export function npcSpawnSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter % SPAWN_CHECK_INTERVAL !== 0) return;

  const allNPCs = world.ecs.query(ComponentType.NPCType);
  const daytime = isDaytime(world);

  // ── Despawn distant hostiles during daytime ──
  if (daytime) {
    despawnDistantHostiles(world, allNPCs);
  }

  // Count total NPCs and split by behavior
  let passiveCount = 0;
  let hostileCount = 0;
  for (const npcId of allNPCs) {
    const npcType = world.ecs.getComponent<NPCTypeComponent>(npcId, ComponentType.NPCType);
    if (!npcType) continue;
    if (npcType.behavior === AIBehavior.Hostile) {
      hostileCount++;
    } else {
      passiveCount++;
    }
  }

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
      // Select template based on time of day and population caps
      const template = pickTemplate(daytime, passiveCount, hostileCount);
      if (!template) continue;

      const spawnPos = findSpawnPosition(world, playerPos);
      if (!spawnPos) continue;

      // Biome filtering: skip if template is restricted to specific biomes
      if (template.spawnBiomes && template.spawnBiomes.length > 0) {
        const biome = world.terrainGenerator.biomeManager.getBiome(spawnPos.x, spawnPos.z);
        if (!template.spawnBiomes.includes(biome)) continue;
      }

      // Group spawning for passive animals
      const groupSize = template.groupSize
        ? template.groupSize.min +
          Math.floor(Math.random() * (template.groupSize.max - template.groupSize.min + 1))
        : 1;

      for (let g = 0; g < groupSize; g++) {
        // Check caps before each individual spawn
        if (template.behavior === AIBehavior.Hostile && hostileCount >= MAX_HOSTILE_NPCS) break;
        if (template.behavior !== AIBehavior.Hostile && passiveCount >= MAX_PASSIVE_NPCS) break;

        // Offset group members slightly from the spawn position
        const offsetX = g === 0 ? 0 : (Math.random() - 0.5) * 6;
        const offsetZ = g === 0 ? 0 : (Math.random() - 0.5) * 6;
        const memberX = spawnPos.x + offsetX;
        const memberZ = spawnPos.z + offsetZ;
        const memberY = findSurfaceY(world, Math.floor(memberX), Math.floor(memberZ));
        if (memberY === null) continue;

        world.createNPCEntity(
          template.creatureType,
          { x: memberX, y: memberY + 1, z: memberZ },
          {
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
            nightOnly: template.nightOnly,
            fleeHealthPercent: template.fleeHealthPercent,
            packRadius: template.packRadius,
            isBoss: template.isBoss,
          },
        );

        if (template.behavior === AIBehavior.Hostile) {
          hostileCount++;
        } else {
          passiveCount++;
        }
      }

      logger.debug(
        { creature: template.creatureType, x: spawnPos.x, z: spawnPos.z, groupSize },
        'Spawned NPC group',
      );
    }
  }
}

// ─── Helpers ───

function pickTemplate(
  daytime: boolean,
  passiveCount: number,
  hostileCount: number,
): CreatureTemplate | null {
  // During Blood Moon: heavily favor hostile and blood moon creatures
  if (isBloodMoon()) {
    if (hostileCount >= MAX_HOSTILE_NPCS * 3) return null; // 3x cap during blood moon
    return pickWeightedTemplate(BLOOD_MOON_POOL, BLOOD_MOON_TOTAL_WEIGHT);
  }

  // During day: only spawn passive/neutral
  // At night: spawn all types (hostiles included)
  if (daytime) {
    if (passiveCount >= MAX_PASSIVE_NPCS) return null;
    return pickWeightedTemplate(DAYTIME_TEMPLATES, DAYTIME_TOTAL_WEIGHT);
  }

  // Night: prefer hostiles if under cap, but allow passives too
  if (hostileCount >= MAX_HOSTILE_NPCS && passiveCount >= MAX_PASSIVE_NPCS) return null;

  // If hostile cap reached, only pick from daytime pool
  if (hostileCount >= MAX_HOSTILE_NPCS) {
    return pickWeightedTemplate(DAYTIME_TEMPLATES, DAYTIME_TOTAL_WEIGHT);
  }

  return pickWeightedTemplate(NIGHTTIME_TEMPLATES, NIGHTTIME_TOTAL_WEIGHT);
}

function pickWeightedTemplate(
  templates: CreatureTemplate[],
  totalWeight: number,
): CreatureTemplate {
  let roll = Math.random() * totalWeight;
  for (const template of templates) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }
  return templates[0]!;
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

function despawnDistantHostiles(world: GameWorld, allNPCs: number[]): void {
  const playerMap = world.getPlayerEntityMap();
  if (playerMap.size === 0) return;

  // Collect player positions
  const playerPositions: PositionComponent[] = [];
  for (const [, entityId] of playerMap) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (pos) playerPositions.push(pos);
  }

  for (const npcId of allNPCs) {
    const npcType = world.ecs.getComponent<NPCTypeComponent>(npcId, ComponentType.NPCType);
    if (!npcType || npcType.behavior !== AIBehavior.Hostile) continue;

    // nightOnly creatures always despawn during daytime regardless of distance
    if (npcType.nightOnly) {
      world.ecs.destroyEntity(npcId);
      logger.debug(
        { npc: npcId, creature: npcType.creatureType },
        'Despawned nightOnly NPC (dawn)',
      );
      continue;
    }

    const npcPos = world.ecs.getComponent<PositionComponent>(npcId, ComponentType.Position);
    if (!npcPos) continue;

    // Check if any player is close enough to keep this hostile alive
    let nearPlayer = false;
    for (const pPos of playerPositions) {
      const dx = npcPos.x - pPos.x;
      const dz = npcPos.z - pPos.z;
      if (dx * dx + dz * dz <= HOSTILE_DESPAWN_DISTANCE * HOSTILE_DESPAWN_DISTANCE) {
        nearPlayer = true;
        break;
      }
    }

    if (!nearPlayer) {
      world.ecs.destroyEntity(npcId);
      logger.debug(
        { npc: npcId, creature: npcType.creatureType },
        'Despawned hostile NPC (daytime)',
      );
    }
  }
}
