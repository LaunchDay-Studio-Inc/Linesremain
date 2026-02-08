// ─── Decay System ───
// Applies building decay over time. Buildings without TC coverage decay after
// a delay. Buildings with TC coverage only decay if upkeep is not maintained.

import {
  ComponentType,
  type BuildingComponent,
  type DecayComponent,
  type EntityId,
  type HealthComponent,
  type PositionComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';
import { didTCFailUpkeep, findCoveringTC } from './ToolCupboardSystem.js';

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
  decayTimers.set(world, elapsed - Math.floor(elapsed / DECAY_TICK_INTERVAL) * DECAY_TICK_INTERVAL);

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
    // TODO: findCoveringTC runs per-building per-decay-tick. Consider caching TC coverage
    // zones or using a spatial hash to reduce O(buildings × TCs) to O(buildings).
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

    // Apply decay damage (use intended interval, not accumulated timer drift)
    const decayDamage = decay.decayRate * DECAY_TICK_INTERVAL;
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
