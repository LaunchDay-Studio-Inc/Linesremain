// ─── Building Placement System ───
// Server-authoritative validation and placement of building pieces.
// Handles placement requests, upgrades, and demolition.

import type { GameWorld } from '../World.js';
import type { SystemFn } from '../World.js';
import {
  ComponentType,
  BuildingPieceType,
  BuildingTier,
  BUILD_RANGE,
  BUILDING_REGISTRY,
  ITEM_REGISTRY,
  DECAY_TIME_PER_TIER,
  type EntityId,
  type PositionComponent,
  type BuildingComponent,
  type HealthComponent,
  type InventoryComponent,
  type OwnershipComponent,
  type ColliderComponent,
  type DecayComponent,
  type UpgradeCost,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';

// ─── Grid Snapping Constants ───

/** Foundation grid cell size in world units (blocks) */
const FOUNDATION_SIZE = 3;
/** Wall height in world units */
const WALL_HEIGHT = 3;
/** Snap tolerance — how close a placement must be to a snap point */
const SNAP_TOLERANCE = 0.5;

// ─── Piece Dimensions ───

interface PieceDimensions {
  width: number;
  height: number;
  depth: number;
}

const PIECE_DIMENSIONS: Record<string, PieceDimensions> = {
  [BuildingPieceType.Foundation]: { width: FOUNDATION_SIZE, height: 0.3, depth: FOUNDATION_SIZE },
  [BuildingPieceType.FoundationTriangle]: { width: FOUNDATION_SIZE, height: 0.3, depth: FOUNDATION_SIZE },
  [BuildingPieceType.Wall]: { width: FOUNDATION_SIZE, height: WALL_HEIGHT, depth: 0.2 },
  [BuildingPieceType.HalfWall]: { width: FOUNDATION_SIZE, height: WALL_HEIGHT / 2, depth: 0.2 },
  [BuildingPieceType.Doorway]: { width: FOUNDATION_SIZE, height: WALL_HEIGHT, depth: 0.2 },
  [BuildingPieceType.WindowFrame]: { width: FOUNDATION_SIZE, height: WALL_HEIGHT, depth: 0.2 },
  [BuildingPieceType.WallFrame]: { width: FOUNDATION_SIZE, height: WALL_HEIGHT, depth: 0.2 },
  [BuildingPieceType.Floor]: { width: FOUNDATION_SIZE, height: 0.2, depth: FOUNDATION_SIZE },
  [BuildingPieceType.FloorTriangle]: { width: FOUNDATION_SIZE, height: 0.2, depth: FOUNDATION_SIZE },
  [BuildingPieceType.FloorGrill]: { width: FOUNDATION_SIZE, height: 0.2, depth: FOUNDATION_SIZE },
  [BuildingPieceType.Stairs]: { width: FOUNDATION_SIZE, height: WALL_HEIGHT, depth: FOUNDATION_SIZE },
  [BuildingPieceType.Roof]: { width: FOUNDATION_SIZE, height: 0.2, depth: FOUNDATION_SIZE },
  [BuildingPieceType.Door]: { width: 1, height: 2, depth: 0.1 },
  [BuildingPieceType.Fence]: { width: FOUNDATION_SIZE, height: 1, depth: 0.1 },
  [BuildingPieceType.Pillar]: { width: 0.3, height: WALL_HEIGHT, depth: 0.3 },
};

// ─── Placement Result ───

export interface PlacementResult {
  success: boolean;
  entityId?: EntityId;
  snappedPosition?: { x: number; y: number; z: number };
  error?: string;
}

export interface UpgradeResult {
  success: boolean;
  error?: string;
}

export interface DemolishResult {
  success: boolean;
  error?: string;
}

// ─── Helper: Check if player has required materials ───

function playerHasMaterials(
  inventory: InventoryComponent,
  costs: UpgradeCost[],
): boolean {
  for (const cost of costs) {
    let total = 0;
    for (const slot of inventory.slots) {
      if (slot && slot.itemId === cost.itemId) {
        total += slot.quantity;
      }
    }
    if (total < cost.quantity) return false;
  }
  return true;
}

// ─── Helper: Deduct materials from inventory ───

function deductMaterials(
  inventory: InventoryComponent,
  costs: UpgradeCost[],
): void {
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
}

// ─── Helper: Refund materials to inventory ───

function refundMaterials(
  inventory: InventoryComponent,
  costs: UpgradeCost[],
  refundRatio: number,
): void {
  for (const cost of costs) {
    let toRefund = Math.floor(cost.quantity * refundRatio);
    if (toRefund <= 0) continue;

    const maxStack = ITEM_REGISTRY[cost.itemId]?.maxStack ?? 999;

    // Try to stack into existing slots first
    for (let i = 0; i < inventory.slots.length && toRefund > 0; i++) {
      const slot = inventory.slots[i];
      if (slot && slot.itemId === cost.itemId) {
        const add = Math.min(toRefund, maxStack - slot.quantity);
        slot.quantity += add;
        toRefund -= add;
      }
    }
    // Place remainder in empty slots
    for (let i = 0; i < inventory.slots.length && toRefund > 0; i++) {
      if (inventory.slots[i] === null) {
        const add = Math.min(toRefund, maxStack);
        inventory.slots[i] = { itemId: cost.itemId, quantity: add };
        toRefund -= add;
      }
    }
  }
}

// ─── Helper: Distance squared check ───

function distSq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// ─── Helper: AABB overlap check ───

function aabbOverlap(
  posA: { x: number; y: number; z: number },
  dimA: PieceDimensions,
  posB: { x: number; y: number; z: number },
  dimB: PieceDimensions,
): boolean {
  const eps = 0.01; // small tolerance to allow touching surfaces
  return (
    posA.x - dimA.width / 2 < posB.x + dimB.width / 2 - eps &&
    posA.x + dimA.width / 2 > posB.x - dimB.width / 2 + eps &&
    posA.y < posB.y + dimB.height - eps &&
    posA.y + dimA.height > posB.y + eps &&
    posA.z - dimA.depth / 2 < posB.z + dimB.depth / 2 - eps &&
    posA.z + dimA.depth / 2 > posB.z - dimB.depth / 2 + eps
  );
}

// ─── Snap position to foundation grid ───

function snapToGrid(
  position: { x: number; y: number; z: number },
  pieceType: BuildingPieceType,
  rotation: number,
): { x: number; y: number; z: number } {
  const snapped = { ...position };

  switch (pieceType) {
    case BuildingPieceType.Foundation:
    case BuildingPieceType.FoundationTriangle:
      // Foundations snap to a 3×3 grid on X/Z
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      // Y can snap to ground or adjacent foundation height
      snapped.y = Math.round(position.y * 2) / 2; // half-block Y precision
      break;

    case BuildingPieceType.Wall:
    case BuildingPieceType.HalfWall:
    case BuildingPieceType.Doorway:
    case BuildingPieceType.WindowFrame:
    case BuildingPieceType.WallFrame:
    case BuildingPieceType.Fence:
      // Walls snap to foundation edges
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      // Offset to edge based on rotation (0, π/2, π, 3π/2)
      {
        const normalizedRot = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const quadrant = Math.round(normalizedRot / (Math.PI / 2)) % 4;
        if (quadrant === 0) snapped.z -= FOUNDATION_SIZE / 2;
        else if (quadrant === 1) snapped.x += FOUNDATION_SIZE / 2;
        else if (quadrant === 2) snapped.z += FOUNDATION_SIZE / 2;
        else snapped.x -= FOUNDATION_SIZE / 2;
      }
      break;

    case BuildingPieceType.Floor:
    case BuildingPieceType.FloorTriangle:
    case BuildingPieceType.FloorGrill:
    case BuildingPieceType.Roof:
      // Floors snap to the same grid as foundations, at wall-height multiples
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.y = Math.round(position.y / WALL_HEIGHT) * WALL_HEIGHT;
      break;

    case BuildingPieceType.Stairs:
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      break;

    case BuildingPieceType.Pillar:
      // Pillars snap to foundation corners
      snapped.x =
        Math.round((position.x + FOUNDATION_SIZE / 2) / FOUNDATION_SIZE) *
          FOUNDATION_SIZE -
        FOUNDATION_SIZE / 2;
      snapped.z =
        Math.round((position.z + FOUNDATION_SIZE / 2) / FOUNDATION_SIZE) *
          FOUNDATION_SIZE -
        FOUNDATION_SIZE / 2;
      break;

    case BuildingPieceType.Door:
      // Doors snap inside doorways — handled by snap-to-entity logic
      break;
  }

  return snapped;
}

// ─── Check if position has structural support ───

function hasSupport(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  pieceType: BuildingPieceType,
): boolean {
  // Foundations at ground level always have support
  if (
    (pieceType === BuildingPieceType.Foundation ||
      pieceType === BuildingPieceType.FoundationTriangle) &&
    position.y <= 1
  ) {
    return true;
  }

  // Check for adjacent/below building entities that provide support
  const buildingEntities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Building,
  );

  for (const entityId of buildingEntities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const building = world.ecs.getComponent<BuildingComponent>(entityId, ComponentType.Building)!;

    const dist = distSq(position, pos);
    // Support within ~1.5x foundation size
    const supportRange = FOUNDATION_SIZE * 1.8;
    if (dist > supportRange * supportRange) continue;

    // Foundation supports things directly above or adjacent
    if (
      building.pieceType === BuildingPieceType.Foundation ||
      building.pieceType === BuildingPieceType.FoundationTriangle
    ) {
      // Adjacent foundation → supports another foundation
      if (
        pieceType === BuildingPieceType.Foundation ||
        pieceType === BuildingPieceType.FoundationTriangle
      ) {
        if (Math.abs(pos.y - position.y) < 1) return true;
      }
      // Foundation supports walls/stairs on top of it
      if (Math.abs(pos.x - position.x) < FOUNDATION_SIZE &&
          Math.abs(pos.z - position.z) < FOUNDATION_SIZE &&
          position.y >= pos.y - 0.5) {
        return true;
      }
    }

    // Walls support floors/roofs at the top
    if (
      building.pieceType === BuildingPieceType.Wall ||
      building.pieceType === BuildingPieceType.Doorway ||
      building.pieceType === BuildingPieceType.WindowFrame ||
      building.pieceType === BuildingPieceType.WallFrame
    ) {
      if (
        pieceType === BuildingPieceType.Floor ||
        pieceType === BuildingPieceType.FloorTriangle ||
        pieceType === BuildingPieceType.FloorGrill ||
        pieceType === BuildingPieceType.Roof
      ) {
        const wallTop = pos.y + WALL_HEIGHT;
        if (Math.abs(position.y - wallTop) < SNAP_TOLERANCE) return true;
      }
    }

    // Floors support walls on top
    if (
      building.pieceType === BuildingPieceType.Floor ||
      building.pieceType === BuildingPieceType.FloorTriangle
    ) {
      if (Math.abs(pos.x - position.x) < FOUNDATION_SIZE &&
          Math.abs(pos.z - position.z) < FOUNDATION_SIZE &&
          Math.abs(position.y - pos.y) < SNAP_TOLERANCE) {
        return true;
      }
    }

    // Doorways support doors
    if (building.pieceType === BuildingPieceType.Doorway &&
        pieceType === BuildingPieceType.Door) {
      if (dist < 2) return true;
    }
  }

  return false;
}

// ─── Check for collisions with existing buildings ───

function hasCollision(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  dimensions: PieceDimensions,
  excludeEntity?: EntityId,
): boolean {
  const buildingEntities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Collider,
    ComponentType.Building,
  );

  for (const entityId of buildingEntities) {
    if (entityId === excludeEntity) continue;

    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const collider = world.ecs.getComponent<ColliderComponent>(entityId, ComponentType.Collider)!;

    const existingDim: PieceDimensions = {
      width: collider.width,
      height: collider.height,
      depth: collider.depth,
    };

    if (aabbOverlap(position, dimensions, pos, existingDim)) {
      return true;
    }
  }

  return false;
}

// ─── Placement Request Handler ───

export function handlePlacement(
  world: GameWorld,
  playerId: string,
  pieceType: BuildingPieceType,
  tier: BuildingTier,
  position: { x: number; y: number; z: number },
  rotation: number,
): PlacementResult {
  // 1. Check player entity exists
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    return { success: false, error: 'Player entity not found' };
  }

  // 2. Check registry entry exists
  const stats = BUILDING_REGISTRY[pieceType];
  if (!stats) {
    return { success: false, error: 'Unknown building piece type' };
  }

  // 3. Check tier health is valid (non-zero)
  const maxHealth = stats.healthPerTier[tier];
  if (!maxHealth || maxHealth <= 0) {
    return { success: false, error: 'Invalid tier for this piece type' };
  }

  // 4. Range check
  const playerPos = world.ecs.getComponent<PositionComponent>(
    playerEntityId,
    ComponentType.Position,
  );
  if (!playerPos) {
    return { success: false, error: 'Player position not found' };
  }
  if (distSq(playerPos, position) > BUILD_RANGE * BUILD_RANGE) {
    return { success: false, error: 'Too far away to build' };
  }

  // 5. Material cost check (Twig tier is free; upgrade costs for initial tier)
  const inventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!inventory) {
    return { success: false, error: 'Player inventory not found' };
  }

  const upgradeCosts = stats.upgradeCosts[tier] ?? [];
  if (upgradeCosts.length > 0 && !playerHasMaterials(inventory, upgradeCosts)) {
    return { success: false, error: 'Insufficient materials' };
  }

  // 6. Snap to grid
  const snappedPos = snapToGrid(position, pieceType, rotation);

  // 7. Get dimensions
  const dimensions = PIECE_DIMENSIONS[pieceType];
  if (!dimensions) {
    return { success: false, error: 'Unknown piece dimensions' };
  }

  // 8. Collision check
  if (hasCollision(world, snappedPos, dimensions)) {
    return { success: false, error: 'Placement blocked by existing structure' };
  }

  // 9. Structural support check
  if (!hasSupport(world, snappedPos, pieceType)) {
    return { success: false, error: 'No structural support' };
  }

  // 10. Deduct materials
  if (upgradeCosts.length > 0) {
    deductMaterials(inventory, upgradeCosts);
  }

  // 11. Create building entity
  const entityId = world.createBuildingEntity({
    pieceType,
    tier,
    position: snappedPos,
    rotation,
    ownerId: playerId,
    dimensions,
  });

  logger.debug(
    { playerId, pieceType, tier, position: snappedPos, entityId },
    'Building placed',
  );

  return { success: true, entityId, snappedPosition: snappedPos };
}

// ─── Upgrade Request Handler ───

export function handleUpgrade(
  world: GameWorld,
  playerId: string,
  targetEntityId: EntityId,
  newTier: BuildingTier,
): UpgradeResult {
  // 1. Validate player
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    return { success: false, error: 'Player entity not found' };
  }

  // 2. Validate target is a building
  const building = world.ecs.getComponent<BuildingComponent>(
    targetEntityId,
    ComponentType.Building,
  );
  if (!building) {
    return { success: false, error: 'Target is not a building' };
  }

  // 3. Check new tier is an upgrade
  if (newTier <= building.tier) {
    return { success: false, error: 'Can only upgrade to a higher tier' };
  }

  // 4. Check ownership/authorization
  const ownership = world.ecs.getComponent<OwnershipComponent>(
    targetEntityId,
    ComponentType.Ownership,
  );
  if (ownership && !ownership.authPlayerIds.includes(playerId)) {
    return { success: false, error: 'Not authorized to upgrade this building' };
  }

  // 5. Range check
  const playerPos = world.ecs.getComponent<PositionComponent>(
    playerEntityId,
    ComponentType.Position,
  );
  const targetPos = world.ecs.getComponent<PositionComponent>(
    targetEntityId,
    ComponentType.Position,
  );
  if (playerPos && targetPos && distSq(playerPos, targetPos) > BUILD_RANGE * BUILD_RANGE) {
    return { success: false, error: 'Too far away to upgrade' };
  }

  // 6. Check materials
  const stats = BUILDING_REGISTRY[building.pieceType];
  if (!stats) {
    return { success: false, error: 'Unknown building piece type' };
  }

  const upgradeCosts = stats.upgradeCosts[newTier] ?? [];
  const inventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!inventory) {
    return { success: false, error: 'Player inventory not found' };
  }
  if (upgradeCosts.length > 0 && !playerHasMaterials(inventory, upgradeCosts)) {
    return { success: false, error: 'Insufficient materials for upgrade' };
  }

  // 7. Deduct materials
  if (upgradeCosts.length > 0) {
    deductMaterials(inventory, upgradeCosts);
  }

  // 8. Update building component
  building.tier = newTier;
  const newMaxHealth = stats.healthPerTier[newTier] ?? 100;
  const health = world.ecs.getComponent<HealthComponent>(targetEntityId, ComponentType.Health);
  if (health) {
    health.max = newMaxHealth;
    health.current = newMaxHealth; // Full health on upgrade
  }

  // 9. Update decay rate
  const decay = world.ecs.getComponent<DecayComponent>(targetEntityId, ComponentType.Decay);
  if (decay) {
    const decayTime = DECAY_TIME_PER_TIER[newTier] ?? 10800;
    decay.decayRate = newMaxHealth / decayTime;
    decay.lastInteractionTime = Date.now();
  }

  logger.debug(
    { playerId, targetEntityId, newTier },
    'Building upgraded',
  );

  return { success: true };
}

// ─── Demolish Request Handler ───

export function handleDemolish(
  world: GameWorld,
  playerId: string,
  targetEntityId: EntityId,
): DemolishResult {
  // 1. Validate player
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    return { success: false, error: 'Player entity not found' };
  }

  // 2. Validate target is a building
  const building = world.ecs.getComponent<BuildingComponent>(
    targetEntityId,
    ComponentType.Building,
  );
  if (!building) {
    return { success: false, error: 'Target is not a building' };
  }

  // 3. Check ownership/authorization
  const ownership = world.ecs.getComponent<OwnershipComponent>(
    targetEntityId,
    ComponentType.Ownership,
  );
  if (ownership && !ownership.authPlayerIds.includes(playerId)) {
    return { success: false, error: 'Not authorized to demolish this building' };
  }

  // 4. Range check
  const playerPos = world.ecs.getComponent<PositionComponent>(
    playerEntityId,
    ComponentType.Position,
  );
  const targetPos = world.ecs.getComponent<PositionComponent>(
    targetEntityId,
    ComponentType.Position,
  );
  if (playerPos && targetPos && distSq(playerPos, targetPos) > BUILD_RANGE * BUILD_RANGE) {
    return { success: false, error: 'Too far away to demolish' };
  }

  // 5. Refund 50% of upgrade cost for current tier
  const stats = BUILDING_REGISTRY[building.pieceType];
  if (stats) {
    const costs = stats.upgradeCosts[building.tier] ?? [];
    const inventory = world.ecs.getComponent<InventoryComponent>(
      playerEntityId,
      ComponentType.Inventory,
    );
    if (inventory && costs.length > 0) {
      refundMaterials(inventory, costs, 0.5);
    }
  }

  // 6. Destroy entity
  world.ecs.destroyEntity(targetEntityId);

  logger.debug(
    { playerId, targetEntityId, pieceType: building.pieceType, tier: building.tier },
    'Building demolished',
  );

  return { success: true };
}

// ─── Building Placement System (per-tick — currently a no-op placeholder) ───
// The actual placement logic is event-driven via handlePlacement/handleUpgrade/handleDemolish.
// This system can be used for deferred placement validation or queued actions.

export const buildingPlacementSystem: SystemFn = (_world: GameWorld, _dt: number): void => {
  // Reserved for future batch processing / placement queue
};