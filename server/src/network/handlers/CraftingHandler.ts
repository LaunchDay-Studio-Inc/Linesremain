// ─── Crafting Handler ───
// Socket event handlers for starting and cancelling crafting operations.
// The CraftingSystem (run per tick) advances craft timers.

import type { Server, Socket } from 'socket.io';
import type { GameWorld } from '../../game/World.js';
import {
  ComponentType,
  ClientMessage,
  RECIPE_REGISTRY,
  ITEM_REGISTRY,
  type InventoryComponent,
  type EquipmentComponent,
  type CraftQueueComponent,
  type CraftStartPayload,
  type CraftCancelPayload,
} from '@lineremain/shared';
import { craftingRateLimiter } from '../RateLimiter.js';
import { logger } from '../../utils/logger.js';

// ─── Constants ───

const MAX_CRAFT_QUEUE = 5;

// ─── Response Type ───

interface CraftResponse {
  success: boolean;
  error?: string;
}

// ─── Validation ───

function isValidCraftStart(payload: unknown): payload is CraftStartPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.recipeId === 'number' && Number.isInteger(p.recipeId);
}

function isValidCraftCancel(payload: unknown): payload is CraftCancelPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.recipeId === 'number' && Number.isInteger(p.recipeId);
}

// ─── Helpers ───

function sendInventoryUpdate(
  world: GameWorld,
  entityId: number,
  socket: Socket,
): void {
  const inventory = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
  const equipment = world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment);
  if (!inventory || !equipment) return;

  socket.emit('s:inv_update', {
    slots: inventory.slots,
    equipment: {
      head: equipment.head,
      chest: equipment.chest,
      legs: equipment.legs,
      feet: equipment.feet,
      held: equipment.held,
    },
  });
}

function sendCraftQueueUpdate(
  world: GameWorld,
  entityId: number,
  socket: Socket,
): void {
  const craftQueue = world.ecs.getComponent<CraftQueueComponent>(entityId, ComponentType.CraftQueue);
  if (!craftQueue) return;

  socket.emit('s:craft_queue', {
    queue: craftQueue.queue.map((item) => ({
      recipeId: item.recipeId,
      progress: item.progress / item.totalTime, // normalize to 0-1
      totalTime: item.totalTime,
    })),
  });
}

// ─── Register Crafting Handlers ───

export function registerCraftingHandlers(
  _io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  // ─── Start Crafting ───
  socket.on(ClientMessage.CraftStart, (payload: unknown, callback?: (res: CraftResponse) => void) => {
    const playerId = getPlayerId(socket);
    if (!playerId) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!craftingRateLimiter.check(playerId, 'craft_start')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    if (!isValidCraftStart(payload)) {
      callback?.({ success: false, error: 'Invalid payload' });
      return;
    }

    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) {
      callback?.({ success: false, error: 'No player entity' });
      return;
    }

    // Validate recipe exists
    const recipe = RECIPE_REGISTRY[payload.recipeId];
    if (!recipe) {
      callback?.({ success: false, error: 'Unknown recipe' });
      return;
    }

    // Check craft queue capacity
    let craftQueue = world.ecs.getComponent<CraftQueueComponent>(entityId, ComponentType.CraftQueue);
    if (!craftQueue) {
      // Initialize craft queue if it doesn't exist
      world.ecs.addComponent<CraftQueueComponent>(entityId, ComponentType.CraftQueue, {
        queue: [],
        maxQueue: MAX_CRAFT_QUEUE,
      });
      craftQueue = world.ecs.getComponent<CraftQueueComponent>(entityId, ComponentType.CraftQueue)!;
    }

    if (craftQueue.queue.length >= craftQueue.maxQueue) {
      callback?.({ success: false, error: 'Craft queue full' });
      return;
    }

    // Check player has required ingredients
    const inventory = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
    if (!inventory) {
      callback?.({ success: false, error: 'No inventory' });
      return;
    }

    // Verify all ingredients are available
    for (const ingredient of recipe.ingredients) {
      let available = 0;
      for (const slot of inventory.slots) {
        if (slot && slot.itemId === ingredient.itemId) {
          available += slot.quantity;
        }
      }
      if (available < ingredient.quantity) {
        const itemName = ITEM_REGISTRY[ingredient.itemId]?.name ?? `Item #${ingredient.itemId}`;
        callback?.({ success: false, error: `Not enough ${itemName}` });
        return;
      }
    }

    // Consume ingredients
    for (const ingredient of recipe.ingredients) {
      let remaining = ingredient.quantity;
      for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
        const slot = inventory.slots[i];
        if (slot && slot.itemId === ingredient.itemId) {
          const take = Math.min(slot.quantity, remaining);
          slot.quantity -= take;
          remaining -= take;
          if (slot.quantity <= 0) {
            inventory.slots[i] = null;
          }
        }
      }
    }

    // Add to craft queue
    craftQueue.queue.push({
      recipeId: recipe.id,
      progress: 0,
      totalTime: recipe.craftTimeSeconds,
    });

    callback?.({ success: true });
    sendInventoryUpdate(world, entityId, socket);
    sendCraftQueueUpdate(world, entityId, socket);

    logger.debug({ playerId, recipeId: recipe.id, recipeName: recipe.name }, 'Crafting started');
  });

  // ─── Cancel Crafting ───
  socket.on(ClientMessage.CraftCancel, (payload: unknown, callback?: (res: CraftResponse) => void) => {
    const playerId = getPlayerId(socket);
    if (!playerId) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!craftingRateLimiter.check(playerId, 'craft_cancel')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    if (!isValidCraftCancel(payload)) {
      callback?.({ success: false, error: 'Invalid payload' });
      return;
    }

    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) {
      callback?.({ success: false, error: 'No player entity' });
      return;
    }

    const craftQueue = world.ecs.getComponent<CraftQueueComponent>(entityId, ComponentType.CraftQueue);
    if (!craftQueue) {
      callback?.({ success: false, error: 'No craft queue' });
      return;
    }

    // Find the recipe in the queue
    const queueIdx = craftQueue.queue.findIndex((item) => item.recipeId === payload.recipeId);
    if (queueIdx === -1) {
      callback?.({ success: false, error: 'Recipe not in queue' });
      return;
    }

    // Remove from queue
    craftQueue.queue.splice(queueIdx, 1);

    // Refund ingredients
    const recipe = RECIPE_REGISTRY[payload.recipeId];
    if (recipe) {
      const inventory = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
      if (inventory) {
        for (const ingredient of recipe.ingredients) {
          let remaining = ingredient.quantity;
          // Try stacking into existing slots first
          for (const slot of inventory.slots) {
            if (remaining <= 0) break;
            if (slot && slot.itemId === ingredient.itemId) {
              const maxStack = ITEM_REGISTRY[ingredient.itemId]?.maxStack ?? 999;
              const canAdd = maxStack - slot.quantity;
              if (canAdd > 0) {
                const add = Math.min(remaining, canAdd);
                slot.quantity += add;
                remaining -= add;
              }
            }
          }
          // Place remainder in empty slots
          for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
            if (inventory.slots[i] === null) {
              const maxStack = ITEM_REGISTRY[ingredient.itemId]?.maxStack ?? 999;
              const add = Math.min(remaining, maxStack);
              inventory.slots[i] = { itemId: ingredient.itemId, quantity: add };
              remaining -= add;
            }
          }
        }
        sendInventoryUpdate(world, entityId, socket);
      }
    }

    callback?.({ success: true });
    sendCraftQueueUpdate(world, entityId, socket);

    logger.debug({ playerId, recipeId: payload.recipeId }, 'Crafting cancelled');
  });

  logger.debug({ socketId: socket.id }, 'Crafting handlers registered');
}