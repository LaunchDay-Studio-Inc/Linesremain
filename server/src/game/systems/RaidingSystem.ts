// ─── Raiding System ───
// Handles C4 explosive placement, fuse timers, detonation, building damage,
// and base attack notifications.

import {
  BUILDING_REGISTRY,
  ComponentType,
  ITEM_REGISTRY,
  type BuildingComponent,
  type ColliderComponent,
  type EntityId,
  type ExplosiveComponent,
  type HealthComponent,
  type InventoryComponent,
  type ItemStack,
  type OwnershipComponent,
  type PositionComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const C4_FUSE_DURATION = 10; // seconds
const C4_DAMAGE = 500;
const C4_SPLASH_DAMAGE = 200;
const C4_SPLASH_RADIUS = 3; // blocks
const C4_MIN_DISTANCE_OWN_TC = 10; // blocks
const C4_ITEM_ID = 90;
const MATERIAL_REFUND_RATIO = 0.25;

// ─── Notification Types ───

interface ExplosionNotification {
  position: { x: number; y: number; z: number };
  destroyedIds: number[];
}

interface BaseAttackNotification {
  ownerId: string;
  position: { x: number; y: number; z: number };
  attackerPlayerId: string;
}

// ─── Module-level notification arrays (drain pattern) ───

const explosionNotifications: ExplosionNotification[] = [];
const baseAttackNotifications: BaseAttackNotification[] = [];

// ─── Helpers ───

function distSq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.sqrt(distSq(a, b));
}

// ─── Lazy Explosive Component Registration ───
// The Explosive component store must be registered before entities are created.
// registerComponent is idempotent — safe to call multiple times.

let explosiveStoreRegistered = false;

function ensureExplosiveStore(world: GameWorld): void {
  if (!explosiveStoreRegistered) {
    world.ecs.registerComponent<ExplosiveComponent>(ComponentType.Explosive);
    explosiveStoreRegistered = true;
  }
}

// ─── Helper: Check if target position is near the placer's own TC ───

function isNearOwnTC(
  world: GameWorld,
  playerId: string,
  targetPos: { x: number; y: number; z: number },
): boolean {
  // Query all building entities with Inventory — these are potential TCs
  const tcCandidates = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
    ComponentType.Ownership,
    ComponentType.Inventory,
  );

  const minDistSq = C4_MIN_DISTANCE_OWN_TC * C4_MIN_DISTANCE_OWN_TC;

  for (const entityId of tcCandidates) {
    const ownership = world.ecs.getComponent<OwnershipComponent>(
      entityId,
      ComponentType.Ownership,
    )!;

    // Only consider TCs where the placer is authorized
    if (!ownership.authPlayerIds.includes(playerId)) continue;

    const tcPos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;

    if (distSq(tcPos, targetPos) <= minDistSq) {
      return true;
    }
  }

  return false;
}

// ─── Helper: Deduct one C4 from player inventory ───

function deductC4FromInventory(inventory: InventoryComponent): boolean {
  for (let i = 0; i < inventory.slots.length; i++) {
    const slot = inventory.slots[i];
    if (slot && slot.itemId === C4_ITEM_ID && slot.quantity > 0) {
      slot.quantity -= 1;
      if (slot.quantity <= 0) {
        inventory.slots[i] = null;
      }
      return true;
    }
  }
  return false;
}

// ─── Helper: Drop material refund as item entities at a position ───

function dropMaterialRefund(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  building: BuildingComponent,
): void {
  const stats = BUILDING_REGISTRY[building.pieceType];
  if (!stats) return;

  const costs = stats.upgradeCosts[building.tier] ?? [];
  for (const cost of costs) {
    const refundAmount = Math.floor(cost.quantity * MATERIAL_REFUND_RATIO);
    if (refundAmount <= 0) continue;

    const maxStack = ITEM_REGISTRY[cost.itemId]?.maxStack ?? 999;
    const dropStack: ItemStack = {
      itemId: cost.itemId,
      quantity: Math.min(refundAmount, maxStack),
    };

    // Scatter drops slightly around the explosion position
    world.createItemDropEntity(dropStack, {
      x: position.x + (Math.random() - 0.5) * 1.5,
      y: position.y + 0.5,
      z: position.z + (Math.random() - 0.5) * 1.5,
    });
  }
}

// ─── Handle C4 Placement ───

export function handlePlaceC4(
  world: GameWorld,
  playerId: string,
  targetEntityId: EntityId,
): boolean {
  ensureExplosiveStore(world);

  // 1. Check player entity exists
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    logger.warn({ playerId }, 'C4 placement failed: player entity not found');
    return false;
  }

  // 2. Check player has C4 in inventory
  const inventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!inventory) {
    logger.warn({ playerId }, 'C4 placement failed: player inventory not found');
    return false;
  }

  const hasC4 = inventory.slots.some(
    (slot) => slot !== null && slot.itemId === C4_ITEM_ID && slot.quantity > 0,
  );
  if (!hasC4) {
    logger.debug({ playerId }, 'C4 placement failed: no C4 in inventory');
    return false;
  }

  // 3. Validate target is a building entity with all required components
  const targetBuilding = world.ecs.getComponent<BuildingComponent>(
    targetEntityId,
    ComponentType.Building,
  );
  const targetHealth = world.ecs.getComponent<HealthComponent>(
    targetEntityId,
    ComponentType.Health,
  );
  const targetOwnership = world.ecs.getComponent<OwnershipComponent>(
    targetEntityId,
    ComponentType.Ownership,
  );
  const targetPos = world.ecs.getComponent<PositionComponent>(
    targetEntityId,
    ComponentType.Position,
  );

  if (!targetBuilding || !targetHealth || !targetOwnership || !targetPos) {
    logger.debug(
      { playerId, targetEntityId },
      'C4 placement failed: target is not a valid building entity',
    );
    return false;
  }

  // 4. Check player is NOT authorized on the building (cannot C4 own base)
  if (targetOwnership.authPlayerIds.includes(playerId)) {
    logger.debug(
      { playerId, targetEntityId },
      'C4 placement failed: cannot place C4 on own building',
    );
    return false;
  }

  // 5. Check target is not within C4_MIN_DISTANCE_OWN_TC of placer's own TC
  if (isNearOwnTC(world, playerId, targetPos)) {
    logger.debug(
      { playerId, targetEntityId },
      'C4 placement failed: target too close to own tool cupboard',
    );
    return false;
  }

  // 6. Deduct 1 C4 from inventory
  if (!deductC4FromInventory(inventory)) {
    logger.warn({ playerId }, 'C4 placement failed: could not deduct C4 from inventory');
    return false;
  }

  // 7. Create C4 entity at the target building's position
  const c4EntityId = world.ecs.createEntity();

  world.ecs.addComponent<PositionComponent>(c4EntityId, ComponentType.Position, {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
    rotation: 0,
  });

  world.ecs.addComponent<ExplosiveComponent>(c4EntityId, ComponentType.Explosive, {
    placerId: playerId,
    targetEntityId,
    fuseStartTime: Date.now(),
    fuseDuration: C4_FUSE_DURATION,
    damage: C4_DAMAGE,
    splashDamage: C4_SPLASH_DAMAGE,
    splashRadius: C4_SPLASH_RADIUS,
  });

  world.ecs.addComponent<ColliderComponent>(c4EntityId, ComponentType.Collider, {
    width: 0.3,
    height: 0.3,
    depth: 0.3,
    isStatic: true,
  });

  // 8. Push base attack notification for the building owner
  baseAttackNotifications.push({
    ownerId: targetOwnership.ownerId,
    position: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
    attackerPlayerId: playerId,
  });

  logger.info(
    {
      playerId,
      targetEntityId,
      c4EntityId,
      pieceType: targetBuilding.pieceType,
      tier: targetBuilding.tier,
    },
    'C4 explosive placed on building',
  );

  return true;
}

// ─── Detonation Logic ───

function detonateExplosive(
  world: GameWorld,
  c4EntityId: EntityId,
  explosive: ExplosiveComponent,
  c4Pos: PositionComponent,
): void {
  const destroyedIds: number[] = [];

  // 1. Apply direct damage to the target building
  const targetExists = world.ecs.entityExists(explosive.targetEntityId);
  if (targetExists) {
    const targetHealth = world.ecs.getComponent<HealthComponent>(
      explosive.targetEntityId,
      ComponentType.Health,
    );
    const targetBuilding = world.ecs.getComponent<BuildingComponent>(
      explosive.targetEntityId,
      ComponentType.Building,
    );
    const targetPos = world.ecs.getComponent<PositionComponent>(
      explosive.targetEntityId,
      ComponentType.Position,
    );

    if (targetHealth && targetBuilding && targetPos) {
      targetHealth.current -= explosive.damage;

      if (targetHealth.current <= 0) {
        targetHealth.current = 0;
        dropMaterialRefund(world, targetPos, targetBuilding);
        destroyedIds.push(explosive.targetEntityId);

        logger.debug(
          {
            targetEntityId: explosive.targetEntityId,
            pieceType: targetBuilding.pieceType,
            tier: targetBuilding.tier,
          },
          'Building destroyed by C4 direct damage',
        );
      }
    }
  }

  // 2. Find all adjacent building entities within splash radius and apply splash damage
  const allBuildings = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
    ComponentType.Health,
  );

  for (const entityId of allBuildings) {
    // Skip the primary target (already handled above) and already-destroyed entities
    if (entityId === explosive.targetEntityId) continue;
    if (destroyedIds.includes(entityId)) continue;

    const buildingPos = world.ecs.getComponent<PositionComponent>(
      entityId,
      ComponentType.Position,
    )!;

    const dist = distance3D(c4Pos, buildingPos);
    if (dist > explosive.splashRadius) continue;

    const buildingHealth = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health)!;
    const building = world.ecs.getComponent<BuildingComponent>(entityId, ComponentType.Building)!;

    // Scale splash damage by distance (closer = more damage, linear falloff)
    const distanceFactor = 1 - dist / explosive.splashRadius;
    const scaledSplashDamage = explosive.splashDamage * distanceFactor;
    buildingHealth.current -= scaledSplashDamage;

    if (buildingHealth.current <= 0) {
      buildingHealth.current = 0;
      dropMaterialRefund(world, buildingPos, building);
      destroyedIds.push(entityId);

      logger.debug(
        { entityId, pieceType: building.pieceType, tier: building.tier },
        'Building destroyed by C4 splash damage',
      );
    }
  }

  // 3. Destroy all buildings that reached 0 HP
  for (const entityId of destroyedIds) {
    world.ecs.destroyEntity(entityId);
  }

  // 4. Push explosion notification
  explosionNotifications.push({
    position: { x: c4Pos.x, y: c4Pos.y, z: c4Pos.z },
    destroyedIds,
  });

  // 5. Destroy the C4 entity itself
  world.ecs.destroyEntity(c4EntityId);

  logger.info(
    {
      c4EntityId,
      position: { x: c4Pos.x, y: c4Pos.y, z: c4Pos.z },
      destroyedCount: destroyedIds.length,
      placerId: explosive.placerId,
    },
    'C4 detonated',
  );
}

// ─── Raiding System (per-tick at 20 TPS) ───

export const raidingSystem: SystemFn = (world: GameWorld, _dt: number): void => {
  // Query all entities with Explosive + Position components
  const explosiveEntities = world.ecs.query(ComponentType.Explosive, ComponentType.Position);

  if (explosiveEntities.length === 0) return;

  const currentTime = Date.now();

  // Collect detonations to process (avoid mutating query results during iteration)
  const toDetonate: {
    entityId: EntityId;
    explosive: ExplosiveComponent;
    position: PositionComponent;
  }[] = [];

  for (const entityId of explosiveEntities) {
    const explosive = world.ecs.getComponent<ExplosiveComponent>(entityId, ComponentType.Explosive);
    const position = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);

    if (!explosive || !position) continue;

    // Check if the fuse has expired
    const elapsedSeconds = (currentTime - explosive.fuseStartTime) / 1000;
    if (elapsedSeconds >= explosive.fuseDuration) {
      toDetonate.push({ entityId, explosive, position });
    }
  }

  // Process all pending detonations
  for (const { entityId, explosive, position } of toDetonate) {
    detonateExplosive(world, entityId, explosive, position);
  }
};

// ─── Drain Functions ───

/** Drain and return all pending explosion notifications since last call. */
export function drainExplosionNotifications(): ExplosionNotification[] {
  return explosionNotifications.splice(0);
}

/** Drain and return all pending base attack notifications since last call. */
export function drainBaseAttackNotifications(): BaseAttackNotification[] {
  return baseAttackNotifications.splice(0);
}
