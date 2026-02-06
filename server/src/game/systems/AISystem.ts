// ─── AI System ───
// State machine for NPC creatures: passive (idle→wander→flee→return),
// hostile (idle→wander→chase→attack→return), neutral (passive until hit,
// then hostile for 30s). Simple pathfinding with direct movement.

import type { GameWorld } from '../World.js';
import type { SystemFn } from '../World.js';
import {
  ComponentType,
  AIState,
  AIBehavior,
  type EntityId,
  type PositionComponent,
  type VelocityComponent,
  type HealthComponent,
  type AIComponent,
  type NPCTypeComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';

// ─── Constants ───

const WANDER_PAUSE_MIN_S = 3;
const WANDER_PAUSE_MAX_S = 8;
const FLEE_DURATION_S = 5;
const NEUTRAL_AGGRO_DURATION_S = 30;
const MAX_CHASE_DISTANCE = 40; // give up chasing if too far from home

// ─── Helpers ───

function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function moveToward(
  pos: PositionComponent,
  vel: VelocityComponent,
  targetX: number,
  targetZ: number,
  speed: number,
): void {
  const dx = targetX - pos.x;
  const dz = targetZ - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) {
    vel.vx = 0;
    vel.vz = 0;
    return;
  }
  vel.vx = (dx / dist) * speed;
  vel.vz = (dz / dist) * speed;
  // Face direction of movement
  pos.rotation = Math.atan2(dx, dz);
}

function pickRandomWanderTarget(
  homeX: number, homeZ: number, radius: number,
): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return {
    x: homeX + Math.cos(angle) * dist,
    z: homeZ + Math.sin(angle) * dist,
  };
}

function findNearestPlayer(
  world: GameWorld,
  pos: PositionComponent,
  maxRange: number,
): EntityId | null {
  const players = world.ecs.query(ComponentType.Position, ComponentType.Health, ComponentType.Equipment);
  let nearest: EntityId | null = null;
  let nearestDist = maxRange;

  for (const playerId of players) {
    // Skip dead players
    const health = world.ecs.getComponent<HealthComponent>(playerId, ComponentType.Health)!;
    if (health.current <= 0) continue;

    const playerPos = world.ecs.getComponent<PositionComponent>(playerId, ComponentType.Position)!;
    const dist = distanceXZ(pos.x, pos.z, playerPos.x, playerPos.z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = playerId;
    }
  }

  return nearest;
}

// ─── AI State Handlers ───

function handleIdle(
  world: GameWorld,
  _entityId: EntityId,
  ai: AIComponent,
  npcType: NPCTypeComponent,
  pos: PositionComponent,
  vel: VelocityComponent,
  now: number,
): void {
  vel.vx = 0;
  vel.vz = 0;

  // Check if wander wait is over
  if (now >= npcType.wanderWaitUntil) {
    // Pick a new wander target
    const target = pickRandomWanderTarget(ai.homePosition.x, ai.homePosition.z, ai.roamRadius);
    npcType.wanderTarget = { x: target.x, y: pos.y, z: target.z };
    ai.state = AIState.Roaming;
  }
}

function handleRoaming(
  world: GameWorld,
  _entityId: EntityId,
  ai: AIComponent,
  npcType: NPCTypeComponent,
  pos: PositionComponent,
  vel: VelocityComponent,
  now: number,
): void {
  if (!npcType.wanderTarget) {
    ai.state = AIState.Idle;
    npcType.wanderWaitUntil = now + (WANDER_PAUSE_MIN_S + Math.random() * (WANDER_PAUSE_MAX_S - WANDER_PAUSE_MIN_S)) * 1000;
    return;
  }

  const dist = distanceXZ(pos.x, pos.z, npcType.wanderTarget.x, npcType.wanderTarget.z);
  if (dist < 1.0) {
    // Reached wander target
    ai.state = AIState.Idle;
    npcType.wanderTarget = null;
    npcType.wanderWaitUntil = now + (WANDER_PAUSE_MIN_S + Math.random() * (WANDER_PAUSE_MAX_S - WANDER_PAUSE_MIN_S)) * 1000;
    vel.vx = 0;
    vel.vz = 0;
    return;
  }

  moveToward(pos, vel, npcType.wanderTarget.x, npcType.wanderTarget.z, npcType.walkSpeed);
}

function handleChasing(
  world: GameWorld,
  entityId: EntityId,
  ai: AIComponent,
  npcType: NPCTypeComponent,
  pos: PositionComponent,
  vel: VelocityComponent,
  _now: number,
): void {
  if (ai.targetEntityId === null) {
    ai.state = AIState.Idle;
    vel.vx = 0;
    vel.vz = 0;
    return;
  }

  // Check target still exists and is alive
  const targetPos = world.ecs.getComponent<PositionComponent>(ai.targetEntityId, ComponentType.Position);
  const targetHealth = world.ecs.getComponent<HealthComponent>(ai.targetEntityId, ComponentType.Health);
  if (!targetPos || !targetHealth || targetHealth.current <= 0) {
    ai.targetEntityId = null;
    ai.state = AIState.Idle;
    vel.vx = 0;
    vel.vz = 0;
    return;
  }

  // Check if too far from home
  const homeDistSq = distanceXZ(pos.x, pos.z, ai.homePosition.x, ai.homePosition.z);
  if (homeDistSq > MAX_CHASE_DISTANCE) {
    ai.targetEntityId = null;
    ai.state = AIState.Roaming;
    npcType.wanderTarget = { x: ai.homePosition.x, y: ai.homePosition.y, z: ai.homePosition.z };
    return;
  }

  const dist = distanceXZ(pos.x, pos.z, targetPos.x, targetPos.z);

  // Within attack range?
  if (dist <= ai.attackRange) {
    ai.state = AIState.Attacking;
    vel.vx = 0;
    vel.vz = 0;
    return;
  }

  // Move toward target
  moveToward(pos, vel, targetPos.x, targetPos.z, npcType.runSpeed);
}

function handleAttacking(
  world: GameWorld,
  entityId: EntityId,
  ai: AIComponent,
  npcType: NPCTypeComponent,
  pos: PositionComponent,
  vel: VelocityComponent,
  now: number,
): void {
  vel.vx = 0;
  vel.vz = 0;

  if (ai.targetEntityId === null) {
    ai.state = AIState.Idle;
    return;
  }

  const targetPos = world.ecs.getComponent<PositionComponent>(ai.targetEntityId, ComponentType.Position);
  const targetHealth = world.ecs.getComponent<HealthComponent>(ai.targetEntityId, ComponentType.Health);
  if (!targetPos || !targetHealth || targetHealth.current <= 0) {
    ai.targetEntityId = null;
    ai.state = AIState.Idle;
    return;
  }

  const dist = distanceXZ(pos.x, pos.z, targetPos.x, targetPos.z);

  // Out of attack range — chase again
  if (dist > ai.attackRange * 1.2) {
    ai.state = AIState.Chasing;
    return;
  }

  // Face target
  pos.rotation = Math.atan2(targetPos.x - pos.x, targetPos.z - pos.z);

  // Attack cooldown check
  const cooldownMs = ai.attackCooldown * 1000;
  if (now - ai.lastAttackTime < cooldownMs) return;

  // Deal damage
  ai.lastAttackTime = now;
  targetHealth.current = Math.max(0, targetHealth.current - ai.attackDamage);

  logger.debug({
    npc: entityId,
    target: ai.targetEntityId,
    damage: ai.attackDamage,
    remaining: targetHealth.current,
  }, 'NPC attacked');
}

function handleFleeing(
  world: GameWorld,
  _entityId: EntityId,
  ai: AIComponent,
  npcType: NPCTypeComponent,
  pos: PositionComponent,
  vel: VelocityComponent,
  now: number,
): void {
  // Flee until timer expires
  if (now >= npcType.fleeUntil) {
    ai.state = AIState.Roaming;
    npcType.wanderTarget = { x: ai.homePosition.x, y: ai.homePosition.y, z: ai.homePosition.z };
    vel.vx = 0;
    vel.vz = 0;
    return;
  }

  // Flee away from target
  if (ai.targetEntityId !== null) {
    const targetPos = world.ecs.getComponent<PositionComponent>(ai.targetEntityId, ComponentType.Position);
    if (targetPos) {
      const dx = pos.x - targetPos.x;
      const dz = pos.z - targetPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.1) {
        vel.vx = (dx / dist) * npcType.runSpeed;
        vel.vz = (dz / dist) * npcType.runSpeed;
        pos.rotation = Math.atan2(dx, dz);
      }
    }
  } else {
    // Flee toward home
    moveToward(pos, vel, ai.homePosition.x, ai.homePosition.z, npcType.runSpeed);
  }
}

// ─── AI System ───

export const aiSystem: SystemFn = (world: GameWorld, _dt: number): void => {
  const npcs = world.ecs.query(ComponentType.AI, ComponentType.NPCType, ComponentType.Position, ComponentType.Velocity);
  const now = Date.now();

  for (const entityId of npcs) {
    const ai = world.ecs.getComponent<AIComponent>(entityId, ComponentType.AI)!;
    const npcType = world.ecs.getComponent<NPCTypeComponent>(entityId, ComponentType.NPCType)!;
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const vel = world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity)!;
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);

    // Skip dead NPCs
    if (health && health.current <= 0) {
      vel.vx = 0;
      vel.vz = 0;
      continue;
    }

    // Determine effective behavior
    let effectiveBehavior = npcType.behavior;
    if (npcType.behavior === AIBehavior.Neutral && now < npcType.neutralAggroUntil) {
      effectiveBehavior = AIBehavior.Hostile;
    }

    // Behavior-specific aggro detection (when idle or roaming)
    if (ai.state === AIState.Idle || ai.state === AIState.Roaming) {
      if (effectiveBehavior === AIBehavior.Hostile) {
        const nearestPlayer = findNearestPlayer(world, pos, ai.aggroRange);
        if (nearestPlayer !== null) {
          ai.targetEntityId = nearestPlayer;
          ai.state = AIState.Chasing;
        }
      }
    }

    // State machine dispatch
    switch (ai.state) {
      case AIState.Idle:
        handleIdle(world, entityId, ai, npcType, pos, vel, now);
        break;
      case AIState.Roaming:
        handleRoaming(world, entityId, ai, npcType, pos, vel, now);
        break;
      case AIState.Chasing:
        handleChasing(world, entityId, ai, npcType, pos, vel, now);
        break;
      case AIState.Attacking:
        handleAttacking(world, entityId, ai, npcType, pos, vel, now);
        break;
      case AIState.Fleeing:
        handleFleeing(world, entityId, ai, npcType, pos, vel, now);
        break;
    }
  }
};

// ─── Called when an NPC takes damage (from CombatSystem) ───

export function onNPCDamaged(
  world: GameWorld,
  entityId: EntityId,
  attackerEntityId: EntityId,
): void {
  const ai = world.ecs.getComponent<AIComponent>(entityId, ComponentType.AI);
  const npcType = world.ecs.getComponent<NPCTypeComponent>(entityId, ComponentType.NPCType);
  if (!ai || !npcType) return;

  const now = Date.now();

  switch (npcType.behavior) {
    case AIBehavior.Passive:
      // Flee from attacker
      ai.targetEntityId = attackerEntityId;
      ai.state = AIState.Fleeing;
      npcType.fleeUntil = now + FLEE_DURATION_S * 1000;
      break;

    case AIBehavior.Neutral:
      // Become hostile toward attacker for 30 seconds
      ai.targetEntityId = attackerEntityId;
      ai.state = AIState.Chasing;
      npcType.neutralAggroUntil = now + NEUTRAL_AGGRO_DURATION_S * 1000;
      break;

    case AIBehavior.Hostile:
      // Already hostile — retarget to attacker if not already chasing
      if (ai.state !== AIState.Chasing && ai.state !== AIState.Attacking) {
        ai.targetEntityId = attackerEntityId;
        ai.state = AIState.Chasing;
      }
      break;
  }
}