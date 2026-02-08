// ─── Defense System ───
// Handles landmine arming, proximity detection, and detonation.
// Barricades are passive static colliders with health — they block movement
// via the physics system and can be destroyed, requiring no per-tick logic.

import {
  BuildingPieceType,
  BuildingTier,
  ComponentType,
  type BarricadeComponent,
  type BuildingComponent,
  type ColliderComponent,
  type EntityId,
  type HealthComponent,
  type LandmineComponent,
  type OwnershipComponent,
  type PositionComponent,
  type SleepingBagComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const LANDMINE_ARM_DELAY = 5; // seconds
const LANDMINE_TRIGGER_RADIUS = 1.0; // blocks
const LANDMINE_DAMAGE = 50;

/** Grace period: placer won't trigger their own mine for this many seconds after placement */
const PLACER_GRACE_PERIOD = 10; // seconds

// ─── Module-level Notifications ───

const explosionNotifications: {
  position: { x: number; y: number; z: number };
  type: 'landmine';
}[] = [];

/**
 * Drain all queued explosion notifications since the last call.
 * Consumers (e.g. network broadcast) call this once per tick.
 */
export function drainDefenseExplosionNotifications() {
  return explosionNotifications.splice(0);
}

// ─── Helper: 3D Euclidean Distance ───

function distance3D(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ─── Entity Factories ───

/**
 * Create a landmine entity at the given position.
 * The mine arms itself after LANDMINE_ARM_DELAY seconds.
 */
export function createLandmineEntity(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  placerId: string,
): EntityId {
  const entityId = world.ecs.createEntity();

  world.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
    x: position.x,
    y: position.y,
    z: position.z,
    rotation: 0,
  });

  world.ecs.addComponent<LandmineComponent>(entityId, ComponentType.Landmine, {
    placerId,
    armedAt: Date.now() + LANDMINE_ARM_DELAY * 1000,
    isArmed: false,
    damage: LANDMINE_DAMAGE,
    triggerRadius: LANDMINE_TRIGGER_RADIUS,
  });

  world.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
    width: 0.3,
    height: 0.1,
    depth: 0.3,
    isStatic: true,
  });

  world.ecs.addComponent<OwnershipComponent>(entityId, ComponentType.Ownership, {
    ownerId: placerId,
    teamId: null,
    isLocked: false,
    authPlayerIds: [placerId],
  });

  logger.debug({ entityId, position, placerId }, 'Landmine entity created');
  return entityId;
}

/**
 * Create a barricade entity at the given position.
 * Barricades are static colliders with health — they block movement and can be destroyed.
 */
export function createBarricadeEntity(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  placerId: string,
): EntityId {
  const entityId = world.ecs.createEntity();

  world.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
    x: position.x,
    y: position.y,
    z: position.z,
    rotation: 0,
  });

  world.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
    current: 100,
    max: 100,
  });

  world.ecs.addComponent<BarricadeComponent>(entityId, ComponentType.Barricade, {
    placerId,
  });

  world.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
    width: 3.0,
    height: 1.5,
    depth: 0.5,
    isStatic: true,
  });

  world.ecs.addComponent<OwnershipComponent>(entityId, ComponentType.Ownership, {
    ownerId: placerId,
    teamId: null,
    isLocked: false,
    authPlayerIds: [placerId],
  });

  logger.debug({ entityId, position, placerId }, 'Barricade entity created');
  return entityId;
}

/**
 * Create a sleeping bag entity at the given position.
 * Enforces one sleeping bag per player — destroys any existing bag first.
 */
export function createSleepingBagEntity(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  placerId: string,
): EntityId {
  // One-per-player: destroy existing sleeping bag for this player
  const existingBags = world.ecs.query(ComponentType.SleepingBag);
  for (const bagId of existingBags) {
    const bag = world.ecs.getComponent<SleepingBagComponent>(bagId, ComponentType.SleepingBag);
    if (bag && bag.placerId === placerId) {
      world.ecs.destroyEntity(bagId);
      logger.debug({ entityId: bagId, placerId }, 'Destroyed old sleeping bag');
    }
  }

  const entityId = world.ecs.createEntity();

  world.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
    x: position.x,
    y: position.y,
    z: position.z,
    rotation: 0,
  });

  world.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
    current: 100,
    max: 100,
  });

  world.ecs.addComponent<SleepingBagComponent>(entityId, ComponentType.SleepingBag, {
    placerId,
    lastUsedTime: 0,
  });

  world.ecs.addComponent<BuildingComponent>(entityId, ComponentType.Building, {
    pieceType: BuildingPieceType.SleepingBag,
    tier: BuildingTier.Twig,
    stability: 1,
  });

  world.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
    width: 1.8,
    height: 0.2,
    depth: 0.8,
    isStatic: true,
  });

  world.ecs.addComponent<OwnershipComponent>(entityId, ComponentType.Ownership, {
    ownerId: placerId,
    teamId: null,
    isLocked: false,
    authPlayerIds: [placerId],
  });

  logger.debug({ entityId, position, placerId }, 'Sleeping bag entity created');
  return entityId;
}

// ─── Defense System (per-tick) ───
// Arms landmines after their delay elapses, then checks proximity against
// all entities with Position + Health. Triggers the mine if any qualifying
// entity enters the trigger radius, applying damage and queuing an explosion
// notification for the network layer.

export const defenseSystem: SystemFn = (world: GameWorld, _dt: number): void => {
  const landmineEntities = world.ecs.query(ComponentType.Landmine, ComponentType.Position);

  if (landmineEntities.length === 0) return;

  const now = Date.now();

  // Pre-collect a set of entities belonging to the placer so we can apply the
  // grace period check: the placer's own entity should not trigger their mine
  // within the first PLACER_GRACE_PERIOD seconds.
  const playerEntityMap = world.getPlayerEntityMap();

  // Build a reverse lookup: entityId → playerId
  const entityToPlayerId = new Map<EntityId, string>();
  for (const [playerId, entityId] of playerEntityMap) {
    entityToPlayerId.set(entityId, playerId);
  }

  // Query all potential trigger targets (anything with Position + Health)
  const potentialTargets = world.ecs.query(ComponentType.Position, ComponentType.Health);

  for (const mineEntityId of landmineEntities) {
    const mine = world.ecs.getComponent<LandmineComponent>(mineEntityId, ComponentType.Landmine);
    if (!mine) continue;

    const minePos = world.ecs.getComponent<PositionComponent>(mineEntityId, ComponentType.Position);
    if (!minePos) continue;

    // Step 1: Arm the mine if the delay has elapsed
    if (!mine.isArmed) {
      if (now >= mine.armedAt) {
        mine.isArmed = true;
        logger.debug({ entityId: mineEntityId }, 'Landmine armed');
      } else {
        // Not yet armed — skip proximity checks
        continue;
      }
    }

    // Step 2: Check proximity to all entities with Position + Health
    let triggered = false;

    for (const targetId of potentialTargets) {
      // Don't trigger on the landmine entity itself
      if (targetId === mineEntityId) continue;

      const targetPos = world.ecs.getComponent<PositionComponent>(targetId, ComponentType.Position);
      if (!targetPos) continue;

      const dist = distance3D(
        minePos.x,
        minePos.y,
        minePos.z,
        targetPos.x,
        targetPos.y,
        targetPos.z,
      );

      if (dist > mine.triggerRadius) continue;

      // Grace period: skip if this entity belongs to the placer and the mine
      // was placed less than PLACER_GRACE_PERIOD seconds ago
      const targetPlayerId = entityToPlayerId.get(targetId);
      if (targetPlayerId === mine.placerId) {
        const placedAt = mine.armedAt - LANDMINE_ARM_DELAY * 1000;
        const elapsedSincePlacement = (now - placedAt) / 1000;
        if (elapsedSincePlacement < PLACER_GRACE_PERIOD) {
          continue;
        }
      }

      // Apply damage to the target
      const targetHealth = world.ecs.getComponent<HealthComponent>(targetId, ComponentType.Health);
      if (!targetHealth) continue;

      targetHealth.current = Math.max(0, targetHealth.current - mine.damage);

      logger.info(
        {
          mineEntityId,
          targetId,
          damage: mine.damage,
          remainingHealth: targetHealth.current,
          placerId: mine.placerId,
        },
        'Landmine triggered — damage applied',
      );

      // Queue explosion notification for network broadcast
      explosionNotifications.push({
        position: { x: minePos.x, y: minePos.y, z: minePos.z },
        type: 'landmine',
      });

      // Destroy the landmine entity
      world.ecs.destroyEntity(mineEntityId);
      triggered = true;
      break; // one trigger per mine
    }

    if (triggered) continue;
  }
};
