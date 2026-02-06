// ─── Tool Cupboard System ───
// Manages TC (Tool Cupboard) authorization zones, checks building privilege,
// and calculates upkeep costs for buildings within a TC radius.

import type { GameWorld } from '../World.js';
import type { SystemFn } from '../World.js';
import {
  ComponentType,
  BUILDING_REGISTRY,
  UPKEEP_COST_MULTIPLIER,
  type EntityId,
  type PositionComponent,
  type BuildingComponent,
  type OwnershipComponent,
  type InventoryComponent,
  type UpgradeCost,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';

// ─── TC Constants ───

/** Tool cupboard protection radius in world units */
const TC_RADIUS = 50;
/** How often to process upkeep (in seconds of game time) */
const UPKEEP_INTERVAL_SECONDS = 300; // every 5 minutes

// ─── TC State ───

/** Track elapsed time for periodic upkeep processing (per-world via WeakMap) */
const upkeepTimers = new WeakMap<GameWorld, number>();

/** Set of TC entity IDs whose last upkeep payment failed (cleared each cycle) */
const failedUpkeepTCs = new WeakMap<GameWorld, Set<EntityId>>();

// ─── Helper: Distance squared ───

function distSq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// ─── Helper: Find all TC entities ───

function findToolCupboards(world: GameWorld): EntityId[] {
  const buildingEntities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
    ComponentType.Ownership,
    ComponentType.Inventory, // TCs have inventory for upkeep resources
  );

  const tcs: EntityId[] = [];
  for (const entityId of buildingEntities) {
    const building = world.ecs.getComponent<BuildingComponent>(
      entityId,
      ComponentType.Building,
    );
    // Identify TCs by a special piece type or convention
    // For now, we'll treat any building with an Inventory + Building component
    // that has a pieceType we designate as TC. Since there's no explicit TC
    // piece type in the enum, we use a convention: a Foundation-type entity
    // with an Inventory component is treated as a deployable TC.
    // In practice, TCs would be a deployable item. We check for entities that
    // have both Building and Inventory components — the Inventory holds upkeep materials.
    if (building) {
      tcs.push(entityId);
    }
  }

  return tcs;
}

// ─── Public: Check if a player has building privilege at a position ───

export function hasBuilderPrivilege(
  world: GameWorld,
  playerId: string,
  position: { x: number; y: number; z: number },
): boolean {
  const buildingEntities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
    ComponentType.Ownership,
    ComponentType.Inventory,
  );

  for (const entityId of buildingEntities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const ownership = world.ecs.getComponent<OwnershipComponent>(entityId, ComponentType.Ownership)!;

    // Check if position is within TC radius
    if (distSq(pos, position) > TC_RADIUS * TC_RADIUS) continue;

    // If this TC exists and player is NOT authorized → no privilege
    if (!ownership.authPlayerIds.includes(playerId)) {
      return false;
    }

    // Player is authorized on this TC → has privilege
    return true;
  }

  // No TC covers this area → anyone can build (open area)
  return true;
}

// ─── Public: Check if a position is covered by any TC ───

export function isInTCRange(
  world: GameWorld,
  position: { x: number; y: number; z: number },
): boolean {
  const buildingEntities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
    ComponentType.Ownership,
    ComponentType.Inventory,
  );

  for (const entityId of buildingEntities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    if (distSq(pos, position) <= TC_RADIUS * TC_RADIUS) {
      return true;
    }
  }

  return false;
}

// ─── Public: Get the TC entity covering a position ───

export function findCoveringTC(
  world: GameWorld,
  position: { x: number; y: number; z: number },
): EntityId | null {
  const buildingEntities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
    ComponentType.Ownership,
    ComponentType.Inventory,
  );

  let closestTC: EntityId | null = null;
  let closestDist = Infinity;

  for (const entityId of buildingEntities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const d = distSq(pos, position);
    if (d <= TC_RADIUS * TC_RADIUS && d < closestDist) {
      closestDist = d;
      closestTC = entityId;
    }
  }

  return closestTC;
}

// ─── Public: Authorize a player on a TC ───

export function authorizePlayer(
  world: GameWorld,
  tcEntityId: EntityId,
  playerId: string,
): boolean {
  const ownership = world.ecs.getComponent<OwnershipComponent>(
    tcEntityId,
    ComponentType.Ownership,
  );
  if (!ownership) return false;

  if (!ownership.authPlayerIds.includes(playerId)) {
    ownership.authPlayerIds.push(playerId);
  }
  return true;
}

// ─── Public: Deauthorize a player from a TC ───

export function deauthorizePlayer(
  world: GameWorld,
  tcEntityId: EntityId,
  playerId: string,
): boolean {
  const ownership = world.ecs.getComponent<OwnershipComponent>(
    tcEntityId,
    ComponentType.Ownership,
  );
  if (!ownership) return false;

  const idx = ownership.authPlayerIds.indexOf(playerId);
  if (idx !== -1) {
    ownership.authPlayerIds.splice(idx, 1);
  }
  return true;
}

// ─── Public: Calculate upkeep costs for all buildings in a TC's range ───

export function calculateUpkeepCosts(
  world: GameWorld,
  tcEntityId: EntityId,
): UpgradeCost[] {
  const tcPos = world.ecs.getComponent<PositionComponent>(tcEntityId, ComponentType.Position);
  if (!tcPos) return [];

  const allBuildings = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
  );

  // Aggregate upkeep costs
  const costMap = new Map<number, number>();

  for (const entityId of allBuildings) {
    if (entityId === tcEntityId) continue;

    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    if (distSq(tcPos, pos) > TC_RADIUS * TC_RADIUS) continue;

    const building = world.ecs.getComponent<BuildingComponent>(entityId, ComponentType.Building)!;
    const stats = BUILDING_REGISTRY[building.pieceType];
    if (!stats) continue;

    const tierCosts = stats.upgradeCosts[building.tier] ?? [];
    for (const cost of tierCosts) {
      const upkeepAmount = Math.ceil(cost.quantity * UPKEEP_COST_MULTIPLIER);
      costMap.set(cost.itemId, (costMap.get(cost.itemId) ?? 0) + upkeepAmount);
    }
  }

  const result: UpgradeCost[] = [];
  for (const [itemId, quantity] of costMap) {
    result.push({ itemId, quantity });
  }
  return result;
}

// ─── Helper: Consume upkeep from TC inventory ───

function consumeUpkeep(
  inventory: InventoryComponent,
  costs: UpgradeCost[],
): boolean {
  // Check if TC has enough materials
  for (const cost of costs) {
    let total = 0;
    for (const slot of inventory.slots) {
      if (slot && slot.itemId === cost.itemId) {
        total += slot.quantity;
      }
    }
    if (total < cost.quantity) return false; // Not enough → upkeep fails
  }

  // Deduct materials
  for (const cost of costs) {
    let remaining = cost.quantity;
    for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
      const slot = inventory.slots[i];
      if (slot && slot.itemId === cost.itemId) {
        const deduct = Math.min(slot.quantity, remaining);
        slot.quantity -= deduct;
        remaining -= deduct;
        if (slot.quantity <= 0) {
          inventory.slots[i] = null;
        }
      }
    }
  }

  return true;
}

// ─── Tool Cupboard System (per-tick) ───
// Periodically processes upkeep for all TCs.

/**
 * Check whether a given TC entity failed its last upkeep payment.
 * Used by DecaySystem to decide whether buildings should still decay
 * even while inside a TC zone.
 */
export function didTCFailUpkeep(
  world: GameWorld,
  tcEntityId: EntityId,
): boolean {
  const failed = failedUpkeepTCs.get(world);
  return failed?.has(tcEntityId) ?? false;
}

export const toolCupboardSystem: SystemFn = (world: GameWorld, dt: number): void => {
  const timer = (upkeepTimers.get(world) ?? 0) + dt;
  if (timer < UPKEEP_INTERVAL_SECONDS) {
    upkeepTimers.set(world, timer);
    return;
  }
  upkeepTimers.set(world, timer - UPKEEP_INTERVAL_SECONDS);

  // Reset failed set each upkeep cycle
  const failed = new Set<EntityId>();
  failedUpkeepTCs.set(world, failed);

  // Find all TC entities (buildings with inventory)
  const tcEntities = findToolCupboards(world);

  for (const tcEntityId of tcEntities) {
    const inventory = world.ecs.getComponent<InventoryComponent>(
      tcEntityId,
      ComponentType.Inventory,
    );
    if (!inventory) continue;

    // Calculate upkeep for buildings in range
    const upkeepCosts = calculateUpkeepCosts(world, tcEntityId);
    if (upkeepCosts.length === 0) continue;

    // Try to consume upkeep materials from TC inventory
    const success = consumeUpkeep(inventory, upkeepCosts);

    if (!success) {
      failed.add(tcEntityId);
      logger.debug(
        { tcEntityId, upkeepCosts },
        'TC upkeep failed — insufficient materials, buildings will decay',
      );
    }
  }
};