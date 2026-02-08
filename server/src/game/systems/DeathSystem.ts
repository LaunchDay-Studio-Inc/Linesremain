// ─── Death System ───
// Detects player death (health <= 0) and NPC death (health <= 0).
// Players: creates loot bags via RespawnSystem, queues death notifications.
// NPCs: rolls loot from loot tables, creates item drops, destroys entity.

import type { AncestorRecord } from '@lineremain/shared';
import {
  ComponentType,
  type HealthComponent,
  type HungerComponent,
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
  hasSleepingBag: boolean;
  isLineDeath: boolean; // true = no sleeping bag, lineage advances
  lineage?: {
    generation: number;
    ancestorSummary: AncestorRecord;
    inheritedXP: number;
    inheritedBlueprints: number;
  };
}

let deathNotificationQueue: DeathNotification[] = [];

/** Drain all pending death notifications (called by StateBroadcaster or SocketServer) */
export function drainDeathNotifications(): DeathNotification[] {
  const notifications = deathNotificationQueue;
  deathNotificationQueue = [];
  return notifications;
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

    const cause = determineCauseOfDeath(world, entityId);
    const hasBag = playerHasSleepingBag(world, playerId);
    const isLineDeath = !hasBag;
    deathNotificationQueue.push({ playerId, cause, hasSleepingBag: hasBag, isLineDeath });
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

    // Roll loot drops using shared randomization logic
    if (pos && lootable && !lootable.isLooted && lootable.lootTable.length > 0) {
      const items = rollLootTable(lootable.lootTable);
      for (const item of items) {
        world.createItemDropEntity(item, {
          x: pos.x + (Math.random() - 0.5),
          y: pos.y + 0.5,
          z: pos.z + (Math.random() - 0.5),
        });
      }
      lootable.isLooted = true;
    }

    // Destroy the NPC entity
    world.ecs.destroyEntity(entityId);
  }
}

// ─── Cause of Death Heuristic ───

function determineCauseOfDeath(world: GameWorld, entityId: number): string {
  // Check environmental extremes first (most specific causes)
  const temp = world.ecs.getComponent<TemperatureComponent>(
    entityId,
    ComponentType.Temperature,
  );
  if (temp) {
    if (temp.current < 20) return 'cold';
    if (temp.current > 50) return 'heat';
  }

  // Check survival deprivation (only if reserves are fully depleted)
  const hunger = world.ecs.getComponent<HungerComponent>(
    entityId,
    ComponentType.Hunger,
  );
  if (hunger && hunger.current <= 0) return 'hunger';

  const thirst = world.ecs.getComponent<ThirstComponent>(
    entityId,
    ComponentType.Thirst,
  );
  if (thirst && thirst.current <= 0) return 'thirst';

  // Default: combat damage (most common cause)
  return 'combat';
}
