// ─── Hunger System ───
// Drains hunger based on activity level, applies starvation damage and health regen.

import {
  ComponentType,
  type HealthComponent,
  type HungerComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';

// ─── Constants ───

// Drain per 3-second check (runs every 60th tick at 20 TPS)
const IDLE_DRAIN = 0.25; // 5 cal/min
const WALK_DRAIN = 0.4; // 8 cal/min
const SPRINT_DRAIN = 0.75; // 15 cal/min

const WALK_THRESHOLD = 0.5; // velocity magnitude
const SPRINT_THRESHOLD = 5.0;

const REGEN_HUNGER_THRESHOLD = 400; // hunger above this → health regen
const REGEN_HP_PER_CHECK = 1.5; // 0.5 HP/sec

const LOW_HUNGER_THRESHOLD = 100;
const LOW_HUNGER_DAMAGE = 3; // per check (1/sec)
const STARVE_DAMAGE = 9; // per check (3/sec) when hunger == 0

// ─── Tick Counter ───

/** Run hunger checks every 60 ticks (3 seconds at 20 TPS) */
const HUNGER_CHECK_INTERVAL = 60;
let tickCounter = 0;

// ─── System ───

export function hungerSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter % HUNGER_CHECK_INTERVAL !== 0) return;

  // Only drain player entities — NPCs should not starve
  const playerMap = world.getPlayerEntityMap();
  const entities = world.ecs.query(ComponentType.Hunger);

  for (const entityId of entities) {
    // Skip non-player entities
    let isPlayer = false;
    for (const [, eid] of playerMap) {
      if (eid === entityId) {
        isPlayer = true;
        break;
      }
    }
    if (!isPlayer) continue;
    const hunger = world.ecs.getComponent<HungerComponent>(entityId, ComponentType.Hunger)!;

    // Determine activity level from velocity
    let drain = IDLE_DRAIN;
    const vel = world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity);
    if (vel) {
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vz * vel.vz);
      if (speed >= SPRINT_THRESHOLD) {
        drain = SPRINT_DRAIN;
      } else if (speed >= WALK_THRESHOLD) {
        drain = WALK_DRAIN;
      }
    }

    // Drain hunger
    hunger.current = Math.max(0, hunger.current - drain);

    // Health effects
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
    if (!health) continue;

    if (hunger.current >= REGEN_HUNGER_THRESHOLD && health.current < health.max) {
      // Regen health when well-fed
      health.current = Math.min(health.max, health.current + REGEN_HP_PER_CHECK);
    } else if (hunger.current <= 0) {
      // Rapid starvation damage
      health.current = Math.max(0, health.current - STARVE_DAMAGE);
    } else if (hunger.current < LOW_HUNGER_THRESHOLD) {
      // Slow starvation damage
      health.current = Math.max(0, health.current - LOW_HUNGER_DAMAGE);
    }
  }
}

// TODO: Implement food consumption handler
// Items with hungerRestore/thirstRestore/healAmount fields exist in shared/constants/items.ts
// (e.g., Cooked Meat id=53, Grilled Fish id=54, Berry Mix id=55, etc.)
// but no server-side handler processes eating/drinking actions.
// Needs: a UseItem message handler that checks ITEM_REGISTRY for consumable
// properties, applies hungerRestore/thirstRestore/healAmount to player stats,
// and removes the consumed item from inventory.
