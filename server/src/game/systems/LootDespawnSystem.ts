// ─── Loot Despawn System ───
// Runs every 5 seconds, destroys Lootable entities past their despawn time.

import type { GameWorld } from '../World.js';
import type { SystemFn } from '../World.js';
import {
  ComponentType,
  type DecayComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';

// ─── Constants ───

const CHECK_INTERVAL_S = 5; // only check every 5 seconds
let timeSinceLastCheck = 0;

// ─── Loot Despawn System ───

export const lootDespawnSystem: SystemFn = (world: GameWorld, dt: number): void => {
  timeSinceLastCheck += dt;
  if (timeSinceLastCheck < CHECK_INTERVAL_S) return;
  timeSinceLastCheck = 0;

  const now = Date.now();
  const lootEntities = world.ecs.query(ComponentType.Lootable, ComponentType.Decay);

  for (const entityId of lootEntities) {
    const decay = world.ecs.getComponent<DecayComponent>(entityId, ComponentType.Decay);
    if (!decay) continue;

    const elapsedSeconds = (now - decay.lastInteractionTime) / 1000;
    if (elapsedSeconds >= decay.decayStartDelay) {
      logger.debug({ entityId, elapsed: elapsedSeconds }, 'Loot entity despawned');
      world.ecs.destroyEntity(entityId);
    }
  }
};