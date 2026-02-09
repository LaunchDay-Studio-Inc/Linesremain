// ─── Physics System ───
// Applies gravity, ground detection, water buoyancy, and terminal velocity.

import {
  BlockType,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  ComponentType,
  GRAVITY,
  TERMINAL_VELOCITY,
  type ColliderComponent,
  type PlayerWorldType,
  type PositionComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';

// ─── Block Query Helper ───

function getBlockAt(
  world: GameWorld,
  x: number,
  y: number,
  z: number,
  worldType: PlayerWorldType = 'main',
): number {
  if (y < 0 || y >= CHUNK_SIZE_Y) return 0; // air outside vertical bounds

  const chunkX = Math.floor(x / CHUNK_SIZE_X);
  const chunkZ = Math.floor(z / CHUNK_SIZE_Z);

  let chunk: Uint8Array | null | undefined;
  if (worldType === 'islands') {
    chunk = world.islandChunkStore.getChunk(chunkX, chunkZ);
  } else {
    chunk = world.chunkStore.getChunk(chunkX, chunkZ);
  }
  if (!chunk) return 0;

  const localX = ((Math.floor(x) % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
  const localY = Math.floor(y);
  const localZ = ((Math.floor(z) % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

  const index = localX + localZ * CHUNK_SIZE_X + localY * CHUNK_SIZE_X * CHUNK_SIZE_Z;
  return chunk[index] ?? 0;
}

function isSolidBlock(blockId: number): boolean {
  return (
    blockId > 0 &&
    blockId !== BlockType.Water &&
    blockId !== BlockType.TallGrass &&
    blockId !== BlockType.DeadBush &&
    blockId !== BlockType.Mushroom
  );
}

function isWaterBlock(blockId: number): boolean {
  return blockId === BlockType.Water;
}

// ─── Constants ───

const WATER_BUOYANCY = 3.0; // net upward force in water (counteracts gravity + lift)
const WATER_DRAG_FACTOR = 3.0; // exponential drag coefficient for water

// ─── System ───

export function physicsSystem(world: GameWorld, dt: number): void {
  const entities = world.ecs.query(ComponentType.Position, ComponentType.Velocity);

  // Build reverse map: entityId → worldType (only player entities differ)
  const entityWorldMap = new Map<number, PlayerWorldType>();
  for (const [playerId, entityId] of world.getPlayerEntityMap()) {
    entityWorldMap.set(entityId, world.playerWorldMap.get(playerId) ?? 'main');
  }

  for (const entityId of entities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const vel = world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity)!;
    const collider = world.ecs.getComponent<ColliderComponent>(entityId, ComponentType.Collider);

    // Skip static entities
    if (collider?.isStatic) continue;

    // Skip projectile entities — they have dedicated movement in ProjectileSystem
    if (world.ecs.hasComponent(entityId, ComponentType.Projectile)) continue;

    const worldType = entityWorldMap.get(entityId) ?? 'main';

    const halfHeight = collider ? collider.height / 2 : 0.9;
    const halfW = collider ? collider.width / 2 : 0.3;
    const halfD = collider ? collider.depth / 2 : 0.3;

    // ── Ground Detection (4-corner + center) ──
    const feetY = pos.y - 0.01;
    const grounded =
      isSolidBlock(getBlockAt(world, pos.x, feetY, pos.z, worldType)) ||
      isSolidBlock(getBlockAt(world, pos.x - halfW, feetY, pos.z - halfD, worldType)) ||
      isSolidBlock(getBlockAt(world, pos.x + halfW, feetY, pos.z - halfD, worldType)) ||
      isSolidBlock(getBlockAt(world, pos.x - halfW, feetY, pos.z + halfD, worldType)) ||
      isSolidBlock(getBlockAt(world, pos.x + halfW, feetY, pos.z + halfD, worldType));

    // ── Water Detection ──
    const blockAtCenter = getBlockAt(world, pos.x, pos.y + halfHeight, pos.z, worldType);
    const inWater = isWaterBlock(blockAtCenter);

    // ── Apply Gravity ──
    if (inWater) {
      // Water: apply normal gravity + buoyancy for net upward force
      vel.vy += GRAVITY * dt;
      vel.vy += WATER_BUOYANCY * dt;
    } else if (!grounded) {
      vel.vy += GRAVITY * dt;
    }

    // ── Ground Clamping ──
    if (grounded && vel.vy < 0) {
      vel.vy = 0;
      // Snap to ground level — use round to handle both 0.99 and 1.01 cases
      const snappedY = Math.round(pos.y);
      if (Math.abs(pos.y - snappedY) < 0.1) {
        pos.y = snappedY;
      }
    }

    // ── Terminal Velocity ──
    if (vel.vy < TERMINAL_VELOCITY) {
      vel.vy = TERMINAL_VELOCITY;
    }

    // ── Drag in water (frame-rate independent exponential decay) ──
    if (inWater) {
      const dragFactor = Math.exp(-WATER_DRAG_FACTOR * dt);
      vel.vx *= dragFactor;
      vel.vz *= dragFactor;
    }
  }
}

// ─── Exported Helpers ───

export { getBlockAt, isSolidBlock, isWaterBlock };
