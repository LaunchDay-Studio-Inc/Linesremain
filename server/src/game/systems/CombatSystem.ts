// ─── Combat System ───
// Processes melee attacks with cone detection, hitzone determination,
// damage calculation with armor reduction, and ranged projectile creation.

import {
  ARMOR_STATS,
  ComponentType,
  HEADSHOT_MULT,
  LEG_MULT,
  MAX_ARMOR_REDUCTION,
  MELEE_KNOCKBACK_FORCE,
  PLAYER_EYE_HEIGHT,
  TORSO_MULT,
  WEAPON_STATS,
  type ColliderComponent,
  type EntityId,
  type EquipmentComponent,
  type HealthComponent,
  type InventoryComponent,
  type LastDamageSourceComponent,
  type PositionComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';
import { trackNPCKill, trackPVPKill } from './AchievementSystem.js';
import { onNPCDamaged } from './AISystem.js';

// ─── Constants ───

const MELEE_CONE_ANGLE_RAD = (60 * Math.PI) / 180; // 60° cone
const HALF_CONE = MELEE_CONE_ANGLE_RAD / 2;

// Hitzone Y-height thresholds (relative to entity base Y)
const HEAD_MIN_RATIO = 0.8; // top 20% of height = head
const TORSO_MIN_RATIO = 0.4; // 40%-80% = torso
// below 40% = legs

// ─── Attack Request Queue ───

export interface AttackRequest {
  attackerEntityId: EntityId;
  attackerPlayerId: string;
  direction: { x: number; y: number; z: number }; // normalized look direction
  timestamp: number;
}

const pendingAttacks: AttackRequest[] = [];

// Per-player attack cooldown tracking (playerId → last attack timestamp in ms)
const lastAttackTime = new Map<string, number>();

/** Queue an attack to be processed next tick */
export function queueAttack(request: AttackRequest): void {
  // Validate direction — reject garbage input
  const { x, y, z } = request.direction;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 0.1 || !isFinite(mag)) return;

  // Re-normalize (don't trust client normalization)
  request.direction.x = x / mag;
  request.direction.y = y / mag;
  request.direction.z = z / mag;

  pendingAttacks.push(request);
}

// ─── Hit Zone Determination ───

export type HitZone = 'head' | 'torso' | 'legs';

function determineHitZone(
  attackerPos: PositionComponent,
  attackerDir: { x: number; y: number; z: number },
  targetPos: PositionComponent,
  targetHeight: number,
): HitZone {
  // Calculate where the attack ray intersects the target's vertical extent
  const eyeY = attackerPos.y + PLAYER_EYE_HEIGHT;
  const dx = targetPos.x - attackerPos.x;
  const dz = targetPos.z - attackerPos.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // Project the look direction to find approximate hit Y
  let hitY: number;
  if (horizontalDist > 0.01) {
    const t = horizontalDist; // approximate ray parameter
    hitY = eyeY + attackerDir.y * t;
  } else {
    hitY = eyeY + attackerDir.y;
  }

  // Relative position within target's height
  const relativeY = (hitY - targetPos.y) / targetHeight;

  if (relativeY >= HEAD_MIN_RATIO) return 'head';
  if (relativeY >= TORSO_MIN_RATIO) return 'torso';
  return 'legs';
}

function getHitZoneMultiplier(zone: HitZone): number {
  switch (zone) {
    case 'head':
      return HEADSHOT_MULT;
    case 'torso':
      return TORSO_MULT;
    case 'legs':
      return LEG_MULT;
  }
}

// ─── Armor Damage Reduction ───

export function calculateArmorReduction(world: GameWorld, targetEntityId: EntityId): number {
  const equipment = world.ecs.getComponent<EquipmentComponent>(
    targetEntityId,
    ComponentType.Equipment,
  );
  if (!equipment) return 0;

  let totalReduction = 0;
  const slots = [equipment.head, equipment.chest, equipment.legs, equipment.feet];

  for (const slot of slots) {
    if (slot) {
      const armorStats = ARMOR_STATS[slot.itemId];
      if (armorStats) {
        totalReduction += armorStats.damageReduction;
      }
    }
  }

  return Math.min(totalReduction, MAX_ARMOR_REDUCTION);
}

// ─── Reduce Weapon Durability ───

function reduceWeaponDurability(world: GameWorld, entityId: EntityId): void {
  const equipment = world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment);
  if (!equipment?.held) return;

  if (equipment.held.durability !== undefined) {
    equipment.held.durability -= 1;
    if (equipment.held.durability <= 0) {
      const brokeItemId = equipment.held.itemId;
      equipment.held = null; // weapon broke
      logger.info({ entityId, itemId: brokeItemId }, 'Weapon broke from durability loss');
      // TODO: emit weapon-broke event to client via world.emitToPlayer()
      // so the player sees a notification that their weapon broke
    }
  }
}

// ─── Distance Helpers ───

/** Maximum vertical difference allowed for melee hits (blocks) */
const MELEE_Y_TOLERANCE = 3.0;

function distanceXZ(a: PositionComponent, b: PositionComponent): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// ─── Angle Between Vectors (XZ plane) ───

function angleBetweenXZ(dir: { x: number; z: number }, toTarget: { x: number; z: number }): number {
  const dot = dir.x * toTarget.x + dir.z * toTarget.z;
  const magA = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
  const magB = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
  if (magA < 0.001 || magB < 0.001) return Math.PI;
  return Math.acos(Math.min(1, Math.max(-1, dot / (magA * magB))));
}

// ─── Process Melee Attack ───

function processMeleeAttack(
  world: GameWorld,
  request: AttackRequest,
  weaponStats: (typeof WEAPON_STATS)[number],
): void {
  const attackerPos = world.ecs.getComponent<PositionComponent>(
    request.attackerEntityId,
    ComponentType.Position,
  );
  if (!attackerPos) return;

  const range = weaponStats.range;

  // Find all entities with Position + Health + Collider (potential targets)
  const targets = world.ecs.query(
    ComponentType.Position,
    ComponentType.Health,
    ComponentType.Collider,
  );

  let closestTarget: EntityId | null = null;
  let closestDist = Infinity;

  for (const targetId of targets) {
    if (targetId === request.attackerEntityId) continue;

    // Only hit combatants: NPCs or players (entities with Equipment)
    const isNPC = world.ecs.hasComponent(targetId, ComponentType.NPCType);
    const isPlayer = world.ecs.hasComponent(targetId, ComponentType.Equipment);
    if (!isNPC && !isPlayer) continue;

    const targetPos = world.ecs.getComponent<PositionComponent>(targetId, ComponentType.Position)!;
    const targetCollider = world.ecs.getComponent<ColliderComponent>(
      targetId,
      ComponentType.Collider,
    )!;

    // Distance check (XZ plane + vertical tolerance)
    const dy = Math.abs(attackerPos.y - targetPos.y);
    if (dy > MELEE_Y_TOLERANCE) continue;
    const dist = distanceXZ(attackerPos, targetPos);
    if (dist > range + targetCollider.width / 2) continue;

    // Cone check (XZ plane)
    const toTarget = {
      x: targetPos.x - attackerPos.x,
      z: targetPos.z - attackerPos.z,
    };
    const angle = angleBetweenXZ({ x: request.direction.x, z: request.direction.z }, toTarget);
    if (angle > HALF_CONE) continue;

    // Pick closest target in cone
    if (dist < closestDist) {
      closestDist = dist;
      closestTarget = targetId;
    }
  }

  if (closestTarget === null) return;

  const targetPos = world.ecs.getComponent<PositionComponent>(
    closestTarget,
    ComponentType.Position,
  )!;
  const targetHealth = world.ecs.getComponent<HealthComponent>(
    closestTarget,
    ComponentType.Health,
  )!;
  const targetCollider = world.ecs.getComponent<ColliderComponent>(
    closestTarget,
    ComponentType.Collider,
  )!;

  // Determine hit zone
  const hitZone = determineHitZone(
    attackerPos,
    request.direction,
    targetPos,
    targetCollider.height,
  );
  const zoneMult = weaponStats.headshotCapable ? getHitZoneMultiplier(hitZone) : TORSO_MULT;

  // Calculate damage
  let damage = weaponStats.baseDamage * zoneMult;

  // Armor reduction (percentage-based)
  const armorPercent = calculateArmorReduction(world, closestTarget);
  damage = Math.max(1, Math.round(damage * (1 - armorPercent)));

  // Apply damage
  targetHealth.current = Math.max(0, targetHealth.current - damage);

  // Record damage source for death cause tracking (Issue 124)
  world.ecs.addComponent<LastDamageSourceComponent>(closestTarget, ComponentType.LastDamageSource, {
    cause: 'combat',
    attackerEntityId: request.attackerEntityId,
    attackerPlayerId: request.attackerPlayerId,
    timestamp: Date.now(),
  });

  // Notify AI system of damage (triggers flee, aggro, retarget behaviors)
  if (world.ecs.getComponent(closestTarget, ComponentType.NPCType) !== undefined) {
    onNPCDamaged(world, closestTarget, request.attackerEntityId);
  }

  // Track kill for achievements
  if (targetHealth.current <= 0) {
    const isNPC = world.ecs.getComponent(closestTarget, ComponentType.NPCType) !== undefined;
    if (isNPC) {
      trackNPCKill(request.attackerPlayerId);
    } else {
      trackPVPKill(request.attackerPlayerId);
    }
  }

  // Knockback (scaled by target mass approximation from collider volume)
  const targetVel = world.ecs.getComponent<VelocityComponent>(
    closestTarget,
    ComponentType.Velocity,
  );
  if (targetVel) {
    const knockDir = {
      x: targetPos.x - attackerPos.x,
      z: targetPos.z - attackerPos.z,
    };
    const knockMag = Math.sqrt(knockDir.x * knockDir.x + knockDir.z * knockDir.z);
    if (knockMag > 0.01) {
      // Approximate mass from collider volume (larger entities resist knockback more)
      const volume = targetCollider.width * targetCollider.height * targetCollider.depth;
      const massScale = 1 / Math.max(0.5, volume);
      const force = MELEE_KNOCKBACK_FORCE * massScale;
      targetVel.vx += (knockDir.x / knockMag) * force;
      targetVel.vz += (knockDir.z / knockMag) * force;
    }
  }

  // Reduce weapon durability
  reduceWeaponDurability(world, request.attackerEntityId);

  logger.debug(
    {
      attacker: request.attackerPlayerId,
      target: closestTarget,
      damage,
      hitZone,
      remaining: targetHealth.current,
    },
    'Melee hit',
  );
}

// ─── Process Ranged Attack (Create Projectile) ───

function processRangedAttack(
  world: GameWorld,
  request: AttackRequest,
  weaponStats: (typeof WEAPON_STATS)[number],
): void {
  const attackerPos = world.ecs.getComponent<PositionComponent>(
    request.attackerEntityId,
    ComponentType.Position,
  );
  if (!attackerPos) return;

  // Check ammo
  if (weaponStats.ammoItemId !== undefined) {
    const inventory = world.ecs.getComponent<InventoryComponent>(
      request.attackerEntityId,
      ComponentType.Inventory,
    );
    if (!inventory) return;

    // Find ammo in inventory
    const ammoSlotIdx = inventory.slots.findIndex(
      (s) => s !== null && s.itemId === weaponStats.ammoItemId,
    );
    if (ammoSlotIdx === -1) return; // no ammo

    // Consume one ammo
    const ammoSlot = inventory.slots[ammoSlotIdx]!;
    ammoSlot.quantity -= 1;
    if (ammoSlot.quantity <= 0) {
      inventory.slots[ammoSlotIdx] = null;
    }
  }

  // Calculate projectile spawn position (at eye height, slightly forward)
  const spawnPos = {
    x: attackerPos.x + request.direction.x * 0.5,
    y: attackerPos.y + PLAYER_EYE_HEIGHT + request.direction.y * 0.5,
    z: attackerPos.z + request.direction.z * 0.5,
  };

  // Apply spread using proper spherical perturbation
  let dirX = request.direction.x;
  let dirY = request.direction.y;
  let dirZ = request.direction.z;

  if (weaponStats.spreadDegrees) {
    const spreadRad = (weaponStats.spreadDegrees * Math.PI) / 180;
    // Random rotation angle around the direction vector
    const phi = Math.random() * Math.PI * 2;
    // Random deflection angle, uniform within cone
    const theta = Math.random() * spreadRad;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    // Build an orthonormal basis around the direction
    // Pick an arbitrary vector not parallel to dir to cross with
    const ax = Math.abs(dirX) < 0.9 ? 1 : 0;
    const ay = Math.abs(dirX) < 0.9 ? 0 : 1;
    // right = dir × arbitrary
    let rx = dirY * 0 - dirZ * ay;
    let ry = dirZ * ax - dirX * 0;
    let rz = dirX * ay - dirY * ax;
    const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (rMag > 0.001) {
      rx /= rMag;
      ry /= rMag;
      rz /= rMag;
    }
    // up = dir × right
    const ux = dirY * rz - dirZ * ry;
    const uy = dirZ * rx - dirX * rz;
    const uz = dirX * ry - dirY * rx;

    // Perturbed direction = dir * cosTheta + (right * cos(phi) + up * sin(phi)) * sinTheta
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    dirX = dirX * cosTheta + (rx * cosPhi + ux * sinPhi) * sinTheta;
    dirY = dirY * cosTheta + (ry * cosPhi + uy * sinPhi) * sinTheta;
    dirZ = dirZ * cosTheta + (rz * cosPhi + uz * sinPhi) * sinTheta;

    // Normalize (should already be ~1 but ensure)
    const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    if (mag > 0.001) {
      dirX /= mag;
      dirY /= mag;
      dirZ /= mag;
    }
  }

  const speed = weaponStats.projectileSpeed ?? 100; // hitscan fallback speed if no projectile
  const velocity = {
    vx: dirX * speed,
    vy: dirY * speed,
    vz: dirZ * speed,
  };

  world.createProjectileEntity(
    request.attackerEntityId,
    request.attackerPlayerId,
    weaponStats.itemId,
    weaponStats.baseDamage,
    spawnPos,
    velocity,
    weaponStats.range,
    10, // 10 second max lifetime
  );

  // Reduce weapon durability
  reduceWeaponDurability(world, request.attackerEntityId);

  logger.debug(
    {
      attacker: request.attackerPlayerId,
      weapon: weaponStats.itemId,
    },
    'Projectile fired',
  );
}

// ─── Combat System (run each tick) ───

export const combatSystem: SystemFn = (world: GameWorld, _dt: number): void => {
  // Process all pending attack requests
  for (let i = 0; i < pendingAttacks.length; i++) {
    const request = pendingAttacks[i]!;

    // Get attacker's held weapon
    const equipment = world.ecs.getComponent<EquipmentComponent>(
      request.attackerEntityId,
      ComponentType.Equipment,
    );
    const heldItem = equipment?.held;
    const weaponId = heldItem?.itemId ?? 21; // default to Rock (id 21)
    const weaponStats = WEAPON_STATS[weaponId];

    if (!weaponStats) {
      logger.warn({ weaponId }, 'Unknown weapon ID in combat');
      continue;
    }

    // Per-player attack cooldown: enforce weapon attack rate
    const cooldownMs = (1 / weaponStats.attackRate) * 1000;
    const lastTime = lastAttackTime.get(request.attackerPlayerId) ?? 0;
    if (request.timestamp - lastTime < cooldownMs) {
      continue; // attack too fast — skip
    }
    lastAttackTime.set(request.attackerPlayerId, request.timestamp);

    // Determine melee vs ranged
    if (weaponStats.projectileSpeed !== undefined || weaponStats.ammoItemId !== undefined) {
      processRangedAttack(world, request, weaponStats);
    } else {
      processMeleeAttack(world, request, weaponStats);
    }
  }
  pendingAttacks.length = 0;
};

// ─── Apply Projectile Damage (called by ProjectileSystem on hit) ───

export function applyProjectileDamage(
  world: GameWorld,
  targetEntityId: EntityId,
  damage: number,
  weaponId: number,
  hitPosition: PositionComponent,
  _sourcePosition: PositionComponent,
  sourceEntityId: EntityId,
  sourcePlayerId: string,
): { hitZone: HitZone; finalDamage: number } {
  const targetHealth = world.ecs.getComponent<HealthComponent>(
    targetEntityId,
    ComponentType.Health,
  );
  const targetCollider = world.ecs.getComponent<ColliderComponent>(
    targetEntityId,
    ComponentType.Collider,
  );
  const targetPos = world.ecs.getComponent<PositionComponent>(
    targetEntityId,
    ComponentType.Position,
  );
  if (!targetHealth || !targetCollider || !targetPos) {
    return { hitZone: 'torso', finalDamage: 0 };
  }

  const weaponStats = WEAPON_STATS[weaponId];
  const headshotCapable = weaponStats?.headshotCapable ?? false;

  // Determine hit zone from projectile impact Y
  const relativeY = (hitPosition.y - targetPos.y) / targetCollider.height;
  let hitZone: HitZone;
  if (relativeY >= HEAD_MIN_RATIO) hitZone = 'head';
  else if (relativeY >= TORSO_MIN_RATIO) hitZone = 'torso';
  else hitZone = 'legs';

  const zoneMult = headshotCapable ? getHitZoneMultiplier(hitZone) : TORSO_MULT;
  let finalDamage = damage * zoneMult;

  // Armor reduction (percentage-based)
  const armorPercent = calculateArmorReduction(world, targetEntityId);
  finalDamage = Math.max(1, Math.round(finalDamage * (1 - armorPercent)));

  // Apply damage
  targetHealth.current = Math.max(0, targetHealth.current - finalDamage);

  // Record damage source for death cause tracking (Issue 124)
  world.ecs.addComponent<LastDamageSourceComponent>(targetEntityId, ComponentType.LastDamageSource, {
    cause: 'combat',
    attackerEntityId: sourceEntityId,
    attackerPlayerId: sourcePlayerId,
    timestamp: Date.now(),
  });

  // Notify AI system (triggers flee, aggro, retarget behaviors)
  if (finalDamage > 0) {
    const isNPC = world.ecs.hasComponent(targetEntityId, ComponentType.NPCType);
    if (isNPC && targetHealth.current > 0) {
      onNPCDamaged(world, targetEntityId, sourceEntityId);
    }

    // Track kill for achievements
    if (targetHealth.current <= 0) {
      if (isNPC) {
        trackNPCKill(sourcePlayerId);
      } else {
        trackPVPKill(sourcePlayerId);
      }
    }
  }

  return { hitZone, finalDamage };
}
