// ─── Death System ───
// Detects player death (health <= 0) and NPC death (health <= 0).
// Players: creates loot bags via RespawnSystem, queues death notifications.
// NPCs: rolls loot from loot tables, creates item drops, destroys entity.

import type { AncestorRecord } from '@lineremain/shared';
import {
  ComponentType,
  type HealthComponent,
  type HungerComponent,
  type LastDamageSourceComponent,
  type LootableComponent,
  type PositionComponent,
  type TemperatureComponent,
  type ThirstComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';
import { trackDeath } from './AchievementSystem.js';
import { rollLootTable } from './LootSpawnSystem.js';
import { checkPlayerDeath, playerHasSleepingBag, processPlayerDeaths } from './RespawnSystem.js';

// ─── Death Notification Queue ───

export interface DeathNotification {
  playerId: string;
  cause: string;
  killerId: string | null; // playerId of attacker (if PvP)
  killerName: string | null; // display name of attacker (if PvP)
  hasSleepingBag: boolean;
  isLineDeath: boolean; // true = no sleeping bag, lineage advances
  lineage?: {
    generation: number;
    ancestorSummary: AncestorRecord;
    inheritedXP: number;
    inheritedBlueprints: number;
  };
}

// ─── Death Notification Queue (per-world to avoid cross-instance bleed) ───

const deathQueues = new WeakMap<GameWorld, DeathNotification[]>();

function getDeathQueue(world: GameWorld): DeathNotification[] {
  let queue = deathQueues.get(world);
  if (!queue) {
    queue = [];
    deathQueues.set(world, queue);
  }
  return queue;
}

/** Drain all pending death notifications (called by StateBroadcaster) */
export function drainDeathNotifications(world: GameWorld): DeathNotification[] {
  const queue = deathQueues.get(world);
  if (!queue || queue.length === 0) return [];
  deathQueues.set(world, []);
  return queue;
}

// ─── System ───

export function deathSystem(world: GameWorld, _dt: number): void {
  // ── Player Deaths ──
  const playerMap = world.getPlayerEntityMap();

  for (const [playerId, entityId] of playerMap) {
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
    if (!health || health.current > 0) continue;

    const wasDead = checkPlayerDeath(world, playerId, entityId);
    if (!wasDead) continue;

    const { cause, killerId, killerName } = determineCauseOfDeath(world, entityId);
    const hasBag = playerHasSleepingBag(world, playerId);
    const isLineDeath = !hasBag;
    getDeathQueue(world).push({ playerId, cause, killerId, killerName, hasSleepingBag: hasBag, isLineDeath });
    trackDeath(playerId);
    logger.info({ playerId, cause }, 'Player death detected');
  }

  processPlayerDeaths(world);

  // ── NPC Deaths ──
  const npcEntities = world.ecs.query(ComponentType.NPCType, ComponentType.Health);
  const deadNPCs: number[] = [];

  for (const entityId of npcEntities) {
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
    if (!health || health.current > 0) continue;

    deadNPCs.push(entityId);
  }

  for (const entityId of deadNPCs) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    const lootable = world.ecs.getComponent<LootableComponent>(entityId, ComponentType.Lootable);

    // Roll loot and create a single loot bag (Issue 141 — avoids N individual drops)
    if (pos && lootable && lootable.lootTable.length > 0) {
      const items = rollLootTable(lootable.lootTable);
      if (items.length > 0) {
        world.createLootBagEntity(
          { x: pos.x, y: pos.y + 0.5, z: pos.z },
          items,
          300, // 5 minute despawn
        );
      }
    }

    // Destroy the NPC entity
    world.ecs.destroyEntity(entityId);
  }
}

// ─── Cause of Death (Issue 124) ───
// Uses LastDamageSourceComponent for accurate cause tracking instead of
// heuristic guessing. Falls back to environment checks if no component exists.

function determineCauseOfDeath(
  world: GameWorld,
  entityId: number,
): { cause: string; killerId: string | null; killerName: string | null } {
  // Check LastDamageSource component first (most accurate)
  const lastDamage = world.ecs.getComponent<LastDamageSourceComponent>(
    entityId,
    ComponentType.LastDamageSource,
  );

  if (lastDamage) {
    return {
      cause: lastDamage.cause,
      killerId: lastDamage.attackerPlayerId,
      killerName: null, // resolved by StateBroadcaster which has access to player names
    };
  }

  // Fallback: environmental heuristic (for deaths from systems that don't set LastDamageSource yet)
  const temp = world.ecs.getComponent<TemperatureComponent>(
    entityId,
    ComponentType.Temperature,
  );
  if (temp) {
    if (temp.current < 20) return { cause: 'cold', killerId: null, killerName: null };
    if (temp.current > 50) return { cause: 'heat', killerId: null, killerName: null };
  }

  const hunger = world.ecs.getComponent<HungerComponent>(
    entityId,
    ComponentType.Hunger,
  );
  if (hunger && hunger.current <= 0) return { cause: 'hunger', killerId: null, killerName: null };

  const thirst = world.ecs.getComponent<ThirstComponent>(
    entityId,
    ComponentType.Thirst,
  );
  if (thirst && thirst.current <= 0) return { cause: 'thirst', killerId: null, killerName: null };

  return { cause: 'combat', killerId: null, killerName: null };
}
