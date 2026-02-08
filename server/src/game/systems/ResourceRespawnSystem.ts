// ─── Resource Respawn System ───
// Runs every 30 seconds, tracks depleted resource node respawn timers.
// Trees respawn after 1200s, ore/stone nodes after 900s.

import {
  ComponentType,
  type HealthComponent,
  type ResourceNodeComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const CHECK_INTERVAL_S = 30;
let timeSinceLastCheck = 0;

// ─── Resource Respawn System ───

export const resourceRespawnSystem: SystemFn = (world: GameWorld, dt: number): void => {
  timeSinceLastCheck += dt;
  if (timeSinceLastCheck < CHECK_INTERVAL_S) return;
  timeSinceLastCheck = 0;

  const now = Date.now();
  const resourceNodes = world.ecs.query(ComponentType.ResourceNode, ComponentType.Health);

  for (const entityId of resourceNodes) {
    const node = world.ecs.getComponent<ResourceNodeComponent>(
      entityId,
      ComponentType.ResourceNode,
    )!;
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health)!;

    // Check if depleted
    if (node.amountRemaining <= 0 || health.current <= 0) {
      // Mark depletion time if not already set
      if (node.lastDepletedTime == null) {
        // Matches both null and undefined
        node.lastDepletedTime = now;
        continue;
      }

      // Check if respawn timer has elapsed
      const elapsedSeconds = (now - node.lastDepletedTime) / 1000;
      if (elapsedSeconds >= node.respawnTimeSeconds) {
        // Respawn the resource
        node.amountRemaining = node.maxAmount;
        health.current = health.max;
        node.lastDepletedTime = null;

        logger.debug(
          {
            entityId,
            resourceItemId: node.resourceItemId,
            amount: node.maxAmount,
          },
          'Resource node respawned',
        );
      }
    }
  }
};
