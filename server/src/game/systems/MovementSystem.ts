// ─── Movement System ───
// Applies velocity to position with axis-separated block collision resolution.

import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  ComponentType,
  FALL_DAMAGE_PER_BLOCK,
  FALL_DAMAGE_THRESHOLD,
  type ColliderComponent,
  type HealthComponent,
  type PositionComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';
import { isSolidBlock } from './PhysicsSystem.js';

// ─── Block Query (Movement-specific: unloaded chunks → solid) ───

function getBlockAt(world: GameWorld, x: number, y: number, z: number): number {
  if (y < 0 || y >= CHUNK_SIZE_Y) return 0;

  const chunkX = Math.floor(x / CHUNK_SIZE_X);
  const chunkZ = Math.floor(z / CHUNK_SIZE_Z);

  const chunk = world.chunkStore.getChunk(chunkX, chunkZ);
  if (!chunk) return 1; // Treat unloaded chunks as solid — prevents falling through world

  const localX = ((Math.floor(x) % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
  const localY = Math.floor(y);
  const localZ = ((Math.floor(z) % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

  const index = localX + localZ * CHUNK_SIZE_X + localY * CHUNK_SIZE_X * CHUNK_SIZE_Z;
  return chunk[index] ?? 0;
}

// ─── AABB Collision Check ───

/**
 * Check if an AABB at (cx, baseY, cz) with given dimensions overlaps any solid block.
 * Returns true if collision detected.
 */
function checkBlockCollision(
  world: GameWorld,
  cx: number,
  baseY: number,
  cz: number,
  halfW: number,
  height: number,
  halfD: number,
): boolean {
  // Check all block positions the AABB could overlap
  const minBx = Math.floor(cx - halfW);
  const maxBx = Math.floor(cx + halfW);
  const minBy = Math.floor(baseY);
  const maxBy = Math.floor(baseY + height);
  const minBz = Math.floor(cz - halfD);
  const maxBz = Math.floor(cz + halfD);

  for (let bx = minBx; bx <= maxBx; bx++) {
    for (let by = minBy; by <= maxBy; by++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        if (isSolidBlock(getBlockAt(world, bx, by, bz))) {
          return true;
        }
      }
    }
  }
  return false;
}

// ─── System ───

export function movementSystem(world: GameWorld, dt: number): void {
  const entities = world.ecs.query(
    ComponentType.Position,
    ComponentType.Velocity,
    ComponentType.Collider,
  );

  for (const entityId of entities) {
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const vel = world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity)!;
    const col = world.ecs.getComponent<ColliderComponent>(entityId, ComponentType.Collider)!;

    // Skip static entities
    if (col.isStatic) continue;

    const halfW = col.width / 2;
    const halfD = col.depth / 2;
    const height = col.height;

    // ── X Axis ──
    const newX = pos.x + vel.vx * dt;
    if (!checkBlockCollision(world, newX, pos.y, pos.z, halfW, height, halfD)) {
      pos.x = newX;
    } else {
      // Push back to nearest block surface
      if (vel.vx > 0) {
        pos.x = Math.floor(newX + halfW) - halfW - 0.001;
      } else {
        pos.x = Math.ceil(newX - halfW) + halfW + 0.001;
      }
      vel.vx = 0;
    }

    // ── Y Axis ──
    const prevVy = vel.vy;
    const newY = pos.y + vel.vy * dt;
    if (!checkBlockCollision(world, pos.x, newY, pos.z, halfW, height, halfD)) {
      pos.y = newY;
    } else {
      if (vel.vy < 0) {
        // Falling — land on top of block
        pos.y = Math.floor(newY) + 1;

        // Fall damage based on impact velocity (Issue 112)
        const fallSpeed = -prevVy; // prevVy is negative when falling
        const fallBlocks = (fallSpeed * fallSpeed) / (2 * 9.81); // approximate blocks fallen
        if (fallBlocks > FALL_DAMAGE_THRESHOLD) {
          const damage = (fallBlocks - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_PER_BLOCK;
          const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
          if (health) {
            health.current = Math.max(0, health.current - damage);
          }
        }
      } else {
        // Jumping — hit ceiling
        pos.y = Math.ceil(newY + height) - height - 0.001;
      }
      vel.vy = 0;
    }

    // ── Z Axis ──
    const newZ = pos.z + vel.vz * dt;
    if (!checkBlockCollision(world, pos.x, pos.y, newZ, halfW, height, halfD)) {
      pos.z = newZ;
    } else {
      if (vel.vz > 0) {
        pos.z = Math.floor(newZ + halfD) - halfD - 0.001;
      } else {
        pos.z = Math.ceil(newZ - halfD) + halfD + 0.001;
      }
      vel.vz = 0;
    }

    // ── Floor Clamp (above bedrock) ──
    if (pos.y < 1) {
      pos.y = 1;
      vel.vy = 0;
    }
  }
}
