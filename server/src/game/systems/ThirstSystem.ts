// ─── Thirst System ───
// Drains thirst over time, applies dehydration damage.

import type { GameWorld } from '../World.js';
import {
  ComponentType,
  type ThirstComponent,
  type HealthComponent,
} from '@lineremain/shared';

// ─── Constants ───

// Drain per 3-second check (runs every 60th tick)
const BASE_DRAIN = 0.2; // 4 mL/min

const LOW_THIRST_THRESHOLD = 50;
const LOW_THIRST_DAMAGE = 3; // per check
const DEHYDRATED_DAMAGE = 9; // per check when thirst == 0

// ─── System ───

export function thirstSystem(world: GameWorld, _dt: number): void {
  const entities = world.ecs.query(ComponentType.Thirst);

  for (const entityId of entities) {
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