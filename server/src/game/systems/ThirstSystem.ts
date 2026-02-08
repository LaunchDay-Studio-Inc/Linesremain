// ─── Thirst System ───
// Drains thirst over time, applies dehydration damage.

import { ComponentType, type HealthComponent, type ThirstComponent } from '@lineremain/shared';
import type { GameWorld } from '../World.js';

// ─── Constants ───

// Drain per 3-second check (runs every 60th tick)
const BASE_DRAIN = 0.2; // 4 mL/min

const LOW_THIRST_THRESHOLD = 50;
const LOW_THIRST_DAMAGE = 3; // per check
const DEHYDRATED_DAMAGE = 9; // per check when thirst == 0

// ─── Tick Counter ───

/** Run thirst checks every 60 ticks (3 seconds at 20 TPS) */
const THIRST_CHECK_INTERVAL = 60;
let tickCounter = 0;

// ─── System ───

export function thirstSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter % THIRST_CHECK_INTERVAL !== 0) return;

  // Only drain player entities — NPCs should not dehydrate
  const playerMap = world.getPlayerEntityMap();
  const entities = world.ecs.query(ComponentType.Thirst);

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
    const thirst = world.ecs.getComponent<ThirstComponent>(entityId, ComponentType.Thirst)!;

    // Drain thirst
    thirst.current = Math.max(0, thirst.current - BASE_DRAIN);

    // Health effects
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
    if (!health) continue;

    if (thirst.current <= 0) {
      health.current = Math.max(0, health.current - DEHYDRATED_DAMAGE);
    } else if (thirst.current < LOW_THIRST_THRESHOLD) {
      health.current = Math.max(0, health.current - LOW_THIRST_DAMAGE);
    }
  }
}
