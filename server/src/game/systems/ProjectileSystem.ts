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
import { isSolidBlock } from './PhysicsSystem.js';

// ─── Constants ───

const PROJECTILE_GRAVITY = GRAVITY * 0.5; // arrows affected by gravity but less than players
const MAX_PROJECTILE_LIFETIME_S = 10;
const MAX_PROJECTILE_RANGE = 200;
const SUBSTEP_MAX_DISTANCE = 1.5; // max distance per substep (blocks) to prevent tunneling

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

  const now = performance.now();

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

    // Calculate total movement this tick
    const totalDx = vel.vx * dt;
    const totalDy = vel.vy * dt;
    const totalDz = vel.vz * dt;
    const totalMoveDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy + totalDz * totalDz);

    // Substep to prevent tunneling through thin walls/entities (Issue 119)
    const numSteps = Math.max(1, Math.ceil(totalMoveDist / SUBSTEP_MAX_DISTANCE));
    const stepDx = totalDx / numSteps;
    const stepDy = totalDy / numSteps;
    const stepDz = totalDz / numSteps;
    const stepDist = totalMoveDist / numSteps;

    let hitSomething = false;

    for (let step = 0; step < numSteps; step++) {
      // Update position for this substep
      pos.x += stepDx;
      pos.y += stepDy;
      pos.z += stepDz;
      proj.distanceTraveled += stepDist;

      // Check terrain collision (below ground = hit terrain)
      if (pos.y < 0) {
        world.ecs.destroyEntity(projectileId);
        hitSomething = true;
        break;
      }

      // Check block collision via chunk store — use isSolidBlock (Issue 118)
      const blockX = Math.floor(pos.x);
      const blockY = Math.floor(pos.y);
      const blockZ = Math.floor(pos.z);
      const block = world.chunkStore.getBlock(blockX, blockY, blockZ);
      if (block !== undefined && block !== null && isSolidBlock(block)) {
        world.ecs.destroyEntity(projectileId);
        hitSomething = true;
        break;
      }

      // Check entity collision
      for (const targetId of targets) {
        // Don't hit source entity
        if (targetId === proj.sourceEntityId) continue;
        // Don't hit other projectiles
        if (world.ecs.hasComponent(targetId, ComponentType.Projectile)) continue;
        // Skip non-combatant entities (resource nodes, loot bags) (Issue 120)
        const isNPC = world.ecs.hasComponent(targetId, ComponentType.NPCType);
        const isPlayer = world.ecs.hasComponent(targetId, ComponentType.Equipment);
        if (!isNPC && !isPlayer) continue;

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
            { x: pos.x - stepDx, y: pos.y - stepDy, z: pos.z - stepDz, rotation: 0 },
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
          hitSomething = true;
          break;
        }
      }

      if (hitSomething) break;
    }

    if (hitSomething) continue;
  }
};
