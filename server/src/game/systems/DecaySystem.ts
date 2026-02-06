// ─── Decay System ───
// Applies building decay over time. Buildings without TC coverage decay after
// a delay. Buildings with TC coverage only decay if upkeep is not maintained.

import type { GameWorld } from '../World.js';
import type { SystemFn } from '../World.js';
import {
  ComponentType,
  type EntityId,
  type PositionComponent,
  type HealthComponent,
  type DecayComponent,
  type BuildingComponent,
} from '@lineremain/shared';
import { findCoveringTC, didTCFailUpkeep } from './ToolCupboardSystem.js';
import { logger } from '../../utils/logger.js';

// ─── Decay Processing Interval ───

/** How often to process decay (seconds). Decay ticks every 5 minutes. */
const DECAY_TICK_INTERVAL = 300;

/** Accumulated time since last decay tick (per-world to avoid cross-instance bleed) */
const decayTimers = new WeakMap<GameWorld, number>();

// ─── Decay System (per-tick) ───

export const decaySystem: SystemFn = (world: GameWorld, dt: number): void => {
  const timer = (decayTimers.get(world) ?? 0) + dt;
  if (timer < DECAY_TICK_INTERVAL) {
    decayTimers.set(world, timer);
    return;
  }

  const elapsed = timer;
  decayTimers.set(world, 0);

  // Query all entities with Decay + Health + Building + Position
  const decayEntities = world.ecs.query(
    ComponentType.Decay,
    ComponentType.Health,
    ComponentType.Building,
    ComponentType.Position,
  );

  const toDestroy: EntityId[] = [];

  for (const entityId of decayEntities) {
    const decay = world.ecs.getComponent<DecayComponent>(entityId, ComponentType.Decay)!;
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health)!;
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;

    // Check if building is within a TC zone
    const coveringTC = findCoveringTC(world, pos);

    if (coveringTC !== null) {
      // TC covers this building — only protect if upkeep was paid
      if (!didTCFailUpkeep(world, coveringTC)) {
        // Upkeep succeeded — reset decay timer, building is protected
        decay.lastInteractionTime = Date.now();
        continue;
      }
      // Upkeep failed — fall through and let decay proceed normally
    }

    // No TC coverage — check if decay delay has elapsed
    const now = Date.now();
    const timeSinceInteraction = (now - decay.lastInteractionTime) / 1000; // convert ms → s

    if (timeSinceInteraction < decay.decayStartDelay) {
      // Still within grace period
      continue;
    }

    // Apply decay damage
    const decayDamage = decay.decayRate * elapsed;
    health.current -= decayDamage;

    if (health.current <= 0) {
      health.current = 0;
      toDestroy.push(entityId);
    }
  }

  // Destroy fully decayed buildings
  for (const entityId of toDestroy) {
    const building = world.ecs.getComponent<BuildingComponent>(entityId, ComponentType.Building);
    logger.debug(
      { entityId, pieceType: building?.pieceType, tier: building?.tier },
      'Building fully decayed and destroyed',
    );
    world.ecs.destroyEntity(entityId);
  }
};