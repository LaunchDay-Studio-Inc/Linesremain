// ─── Projectile System ───
// Per-tick projectile movement with gravity, terrain/entity collision,
// hitzone damage, max range (200 blocks) and lifetime (10s) limits.

import {
  ComponentType,
  GRAVITY,
  type ColliderComponent,
  type PositionComponent,
  type ProjectileComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';
import { applyProjectileDamage } from './CombatSystem.js';

// ─── Constants ───

const PROJECTILE_GRAVITY = GRAVITY * 0.5; // arrows affected by gravity but less than players
const MAX_PROJECTILE_LIFETIME_S = 10;
const MAX_PROJECTILE_RANGE = 200;

// ─── AABB Collision Check ───

function aabbOverlap(
  px: number,
  py: number,
  pz: number,
  tx: number,
  ty: number,
  tz: number,
  tw: number,
  th: number,
  td: number,
): boolean {
  return (
    px >= tx - tw / 2 &&
    px <= tx + tw / 2 &&
    py >= ty &&
    py <= ty + th &&
    pz >= tz - td / 2 &&
    pz <= tz + td / 2
  );
}

// ─── Projectile System ───

export const projectileSystem: SystemFn = (world: GameWorld, dt: number): void => {
  const projectiles = world.ecs.query(
    ComponentType.Projectile,
    ComponentType.Position,
    ComponentType.Velocity,
  );
  if (projectiles.length === 0) return;

  const now = Date.now();

  // Hoist target query outside per-projectile loop
  const targets = world.ecs.query(
    ComponentType.Position,
    ComponentType.Health,
    ComponentType.Collider,
  );

  for (const projectileId of projectiles) {
    const proj = world.ecs.getComponent<ProjectileComponent>(
      projectileId,
      ComponentType.Projectile,
    )!;
    const pos = world.ecs.getComponent<PositionComponent>(projectileId, ComponentType.Position)!;
    const vel = world.ecs.getComponent<VelocityComponent>(projectileId, ComponentType.Velocity)!;

    // Check lifetime
    const aliveSeconds = (now - proj.spawnTime) / 1000;
    if (aliveSeconds > (proj.maxLifetime || MAX_PROJECTILE_LIFETIME_S)) {
      world.ecs.destroyEntity(projectileId);
      continue;
    }

    // Check max range
    if (proj.distanceTraveled >= (proj.maxRange || MAX_PROJECTILE_RANGE)) {
      world.ecs.destroyEntity(projectileId);
      continue;
    }

    // Apply gravity to velocity
    vel.vy += PROJECTILE_GRAVITY * dt;

    // Calculate movement this tick
    const dx = vel.vx * dt;
    const dy = vel.vy * dt;
    const dz = vel.vz * dt;
    const moveDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Update position
    pos.x += dx;
    pos.y += dy;
    pos.z += dz;
    proj.distanceTraveled += moveDist;

    // Check terrain collision (below ground = hit terrain)
    if (pos.y < 0) {
      world.ecs.destroyEntity(projectileId);
      continue;
    }

    // Check block collision via chunk store
    const blockX = Math.floor(pos.x);
    const blockY = Math.floor(pos.y);
    const blockZ = Math.floor(pos.z);
    const block = world.chunkStore.getBlock(blockX, blockY, blockZ);
    if (block !== undefined && block !== 0) {
      // Hit a solid block
      world.ecs.destroyEntity(projectileId);
      continue;
    }

    // Check entity collision
    let hitTarget = false;

    for (const targetId of targets) {
      // Don't hit source entity
      if (targetId === proj.sourceEntityId) continue;
      // Don't hit other projectiles
      if (world.ecs.hasComponent(targetId, ComponentType.Projectile)) continue;

      const targetPos = world.ecs.getComponent<PositionComponent>(
        targetId,
        ComponentType.Position,
      )!;
      const targetCollider = world.ecs.getComponent<ColliderComponent>(
        targetId,
        ComponentType.Collider,
      )!;

      // AABB overlap check
      if (
        aabbOverlap(
          pos.x,
          pos.y,
          pos.z,
          targetPos.x,
          targetPos.y,
          targetPos.z,
          targetCollider.width,
          targetCollider.height,
          targetCollider.depth,
        )
      ) {
        // Hit! Apply damage (includes AI notification and kill tracking)
        const result = applyProjectileDamage(
          world,
          targetId,
          proj.damage,
          proj.weaponId,
          pos,
          { x: pos.x - dx, y: pos.y - dy, z: pos.z - dz, rotation: 0 },
          proj.sourceEntityId,
          proj.sourcePlayerId,
        );

        logger.debug(
          {
            projectile: projectileId,
            target: targetId,
            hitZone: result.hitZone,
            damage: result.finalDamage,
            source: proj.sourcePlayerId,
          },
          'Projectile hit entity',
        );

        // Destroy projectile on hit
        world.ecs.destroyEntity(projectileId);
        hitTarget = true;
        break;
      }
    }

    if (hitTarget) continue;
  }
};
