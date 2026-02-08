// ─── Crafting System ───
// Processes craft queues each tick: advances progress timers,
// completes items when ready, and delivers results to player inventories.

import {
  ComponentType,
  ITEM_REGISTRY,
  RECIPE_REGISTRY,
  type CraftQueueComponent,
  type InventoryComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';
import { trackCraft } from './AchievementSystem.js';

// ─── System ───

export const craftingSystem: SystemFn = (world: GameWorld, dt: number): void => {
  const entities = world.ecs.query(ComponentType.CraftQueue);

  for (const entityId of entities) {
    const craftQueue = world.ecs.getComponent<CraftQueueComponent>(
      entityId,
      ComponentType.CraftQueue,
    );
    if (!craftQueue || craftQueue.queue.length === 0) continue;

    // Process the first item in the queue (sequential crafting)
    const current = craftQueue.queue[0];
    if (!current) continue;

    current.progress += dt;

    if (current.progress >= current.totalTime) {
      // Craft complete — deliver the result
      const recipe = RECIPE_REGISTRY[current.recipeId];
      if (!recipe) {
        // Invalid recipe, remove from queue
        craftQueue.queue.shift();
        continue;
      }

      const inventory = world.ecs.getComponent<InventoryComponent>(
        entityId,
        ComponentType.Inventory,
      );
      if (!inventory) {
        craftQueue.queue.shift();
        continue;
      }

      // Try to add result item to inventory
      const outputItemId = recipe.outputItemId;
      const outputQuantity = recipe.outputQuantity;
      const itemDef = ITEM_REGISTRY[outputItemId];
      const maxStack = itemDef?.maxStack ?? 999;

      let remaining = outputQuantity;

      // Stack into existing matching slots first
      for (const slot of inventory.slots) {
        if (remaining <= 0) break;
        if (slot && slot.itemId === outputItemId) {
          const canAdd = maxStack - slot.quantity;
          if (canAdd > 0) {
            const add = Math.min(remaining, canAdd);
            slot.quantity += add;
            remaining -= add;
          }
        }
      }

      // Place in empty slots
      for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
        if (inventory.slots[i] === null) {
          const add = Math.min(remaining, maxStack);
          inventory.slots[i] = { itemId: outputItemId, quantity: add };
          remaining -= add;
        }
      }

      if (remaining > 0) {
        // Inventory full — drop on ground via item drop entity
        const pos = world.ecs.getComponent(entityId, ComponentType.Position);
        if (pos) {
          const p = pos as { x: number; y: number; z: number };
          world.createItemDropEntity(
            { itemId: outputItemId, quantity: remaining },
            { x: p.x, y: p.y + 0.5, z: p.z },
          );
        }
      }

      // Remove completed item from queue
      craftQueue.queue.shift();

      // Track craft completion for achievements
      for (const [pid, eid] of world.getPlayerEntityMap()) {
        if (eid === entityId) {
          trackCraft(pid);
          break;
        }
      }

      logger.debug({ entityId, recipeId: recipe.id, recipeName: recipe.name }, 'Craft completed');
    }
  }
};
