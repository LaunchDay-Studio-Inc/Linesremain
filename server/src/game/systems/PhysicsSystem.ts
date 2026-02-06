// ─── Physics System ───
// Applies gravity, ground detection, water buoyancy, and terminal velocity.

import type { GameWorld } from '../World.js';
import {
  ComponentType,
  GRAVITY,
  TERMINAL_VELOCITY,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  type PositionComponent,
  type VelocityComponent,
  type ColliderComponent,
} from '@lineremain/shared';

// ─── Block Query Helper ───

function getBlockAt(world: GameWorld, x: number, y: number, z: number): number {
  if (y < 0 || y >= CHUNK_SIZE_Y) return 0; // air outside vertical bounds

  const chunkX = Math.floor(x / CHUNK_SIZE_X);
  const chunkZ = Math.floor(z / CHUNK_SIZE_Z);

  const chunk = world.chunkStore.getChunk(chunkX, chunkZ);
  if (!chunk) return 0;

  const localX = ((Math.floor(x) % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
  const localY = Math.floor(y);
  const localZ = ((Math.floor(z) % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

  const index = localX + localZ * CHUNK_SIZE_X + localY * CHUNK_SIZE_X * CHUNK_SIZE_Z;
  return chunk[index] ?? 0;
}

function isSolidBlock(blockId: number): boolean {
  // 0 = air, block IDs 1+ are solid (water handled separately)
  return blockId > 0 && blockId !== 9; // 9 = water (convention)
}

function isWaterBlock(blockId: number): boolean {
  return blockId === 9;
}

// ─── Constants ───

const WATER_GRAVITY = -5.0;
const BUOYANCY_FORCE = 4.0;

// ─── System ───

export function physicsSystem(world: GameWorld, dt: number): void {
  const entities = world.ecs.query(ComponentType.Position, ComponentType.Velocity);

  for (const entityId of entities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const vel = world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity)!;
    const collider = world.ecs.getComponent<ColliderComponent>(entityId, ComponentType.Collider);

    // Skip static entities
    if (collider?.isStatic) continue;

    const halfHeight = collider ? collider.height / 2 : 0.9;

    // ── Ground Detection ──
    const feetY = pos.y - 0.01;
    const blockBelow = getBlockAt(world, pos.x, feetY, pos.z);
    const grounded = isSolidBlock(blockBelow);

    // ── Water Detection ──
    const blockAtCenter = getBlockAt(world, pos.x, pos.y + halfHeight, pos.z);
    const inWater = isWaterBlock(blockAtCenter);

    // ── Apply Gravity ──
    if (inWater) {
      // Reduced gravity + buoyancy in water
      vel.vy += WATER_GRAVITY * dt;
      if (vel.vy < -2.0) {
        vel.vy += BUOYANCY_FORCE * dt;
      }
    } else if (!grounded) {
      vel.vy += GRAVITY * dt;
    }

    // ── Ground Clamping ──
    if (grounded && vel.vy < 0) {
      vel.vy = 0;
      // Snap to ground level
      const groundY = Math.floor(pos.y);
      if (pos.y - groundY < 0.05) {
        pos.y = groundY;
      }
    }

    // ── Terminal Velocity ──
    if (vel.vy < TERMINAL_VELOCITY) {
      vel.vy = TERMINAL_VELOCITY;
    }

    // ── Drag in water ──
    if (inWater) {
      vel.vx *= (1 - 3.0 * dt);
      vel.vz *= (1 - 3.0 * dt);
    }
  }
}

// ─── Exported Helpers ───

export { getBlockAt, isSolidBlock, isWaterBlock };