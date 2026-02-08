// ─── Inventory Handler ───
// Socket event handlers for inventory move, drop, and split operations.
// All operations are server-validated before execution.

import {
  ClientMessage,
  ComponentType,
  INTERACT_RANGE,
  ITEM_REGISTRY,
  PLAYER_INVENTORY_SLOTS,
  type EntityId,
  type EquipmentComponent,
  type InteractPayload,
  type InventoryComponent,
  type InventoryDropPayload,
  type InventoryMovePayload,
  type InventorySplitPayload,
  type ItemStack,
  type PositionComponent,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import { trackItemDrop } from '../../game/systems/AchievementSystem.js';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';
import { inventoryRateLimiter } from '../RateLimiter.js';

// ─── Response Type ───

interface InventoryResponse {
  success: boolean;
  error?: string;
}

// ─── Validation Helpers ───

function isValidSlot(slot: number, maxSlots: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < maxSlots;
}

function isValidMovePayload(payload: unknown): payload is InventoryMovePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.fromSlot === 'number' &&
    Number.isInteger(p.fromSlot) &&
    typeof p.toSlot === 'number' &&
    Number.isInteger(p.toSlot)
  );
}

function isValidDropPayload(payload: unknown): payload is InventoryDropPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.slot === 'number' &&
    Number.isInteger(p.slot) &&
    typeof p.quantity === 'number' &&
    Number.isInteger(p.quantity) &&
    p.quantity > 0
  );
}

function isValidSplitPayload(payload: unknown): payload is InventorySplitPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.slot === 'number' && Number.isInteger(p.slot);
}

function isValidInteractPayload(payload: unknown): payload is InteractPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.entityId === 'number' && Number.isInteger(p.entityId);
}

// ─── Send Inventory Update ───

function sendInventoryUpdate(world: GameWorld, entityId: EntityId, socket: Socket): void {
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

// ─── Register Inventory Handlers ───

export function registerInventoryHandlers(
  _io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  // ─── Inventory Move ───
  socket.on(
    ClientMessage.InventoryMove,
    (payload: unknown, callback?: (res: InventoryResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!inventoryRateLimiter.check(playerId, 'inv_move')) {
        callback?.({ success: false, error: 'Rate limited' });
        return;
      }

      if (!isValidMovePayload(payload)) {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      const entityId = world.getPlayerEntity(playerId);
      if (entityId === undefined) {
        callback?.({ success: false, error: 'No player entity' });
        return;
      }

      // Determine source inventory (player or container)
      let sourceInv: InventoryComponent | undefined;
      let sourceEntityId: EntityId = entityId;

      if (payload.fromContainer !== undefined) {
        const containerId = Number(payload.fromContainer);
        if (!Number.isInteger(containerId) || !world.ecs.entityExists(containerId as EntityId)) {
          callback?.({ success: false, error: 'Invalid source container' });
          return;
        }
        // Range check
        const playerPos = world.ecs.getComponent<PositionComponent>(
          entityId,
          ComponentType.Position,
        );
        const containerPos = world.ecs.getComponent<PositionComponent>(
          containerId as EntityId,
          ComponentType.Position,
        );
        if (playerPos && containerPos) {
          const dx = playerPos.x - containerPos.x;
          const dy = playerPos.y - containerPos.y;
          const dz = playerPos.z - containerPos.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) > INTERACT_RANGE) {
            callback?.({ success: false, error: 'Too far from container' });
            return;
          }
        }
        sourceInv = world.ecs.getComponent<InventoryComponent>(
          containerId as EntityId,
          ComponentType.Inventory,
        );
        sourceEntityId = containerId as EntityId;
      } else {
        sourceInv = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
      }

      // Determine destination inventory
      let destInv: InventoryComponent | undefined;

      if (payload.toContainer !== undefined) {
        const containerId = Number(payload.toContainer);
        if (!Number.isInteger(containerId) || !world.ecs.entityExists(containerId as EntityId)) {
          callback?.({ success: false, error: 'Invalid dest container' });
          return;
        }
        destInv = world.ecs.getComponent<InventoryComponent>(
          containerId as EntityId,
          ComponentType.Inventory,
        );
      } else {
        destInv = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
      }

      if (!sourceInv || !destInv) {
        callback?.({ success: false, error: 'Inventory not found' });
        return;
      }

      if (
        !isValidSlot(payload.fromSlot, sourceInv.maxSlots) ||
        !isValidSlot(payload.toSlot, destInv.maxSlots)
      ) {
        callback?.({ success: false, error: 'Invalid slot index' });
        return;
      }

      // Perform swap or stack
      const fromItem = sourceInv.slots[payload.fromSlot];
      const toItem = destInv.slots[payload.toSlot];

      if (fromItem && toItem && fromItem.itemId === toItem.itemId) {
        // Try to stack
        const maxStack = ITEM_REGISTRY[fromItem.itemId]?.maxStack ?? 999;
        const canAdd = maxStack - toItem.quantity;
        if (canAdd > 0) {
          const transferAmount = Math.min(fromItem.quantity, canAdd);
          toItem.quantity += transferAmount;
          fromItem.quantity -= transferAmount;
          if (fromItem.quantity <= 0) {
            sourceInv.slots[payload.fromSlot] = null;
          }
        } else {
          // Swap if can't stack
          sourceInv.slots[payload.fromSlot] = toItem;
          destInv.slots[payload.toSlot] = fromItem;
        }
      } else {
        // Simple swap
        sourceInv.slots[payload.fromSlot] = toItem ?? null;
        destInv.slots[payload.toSlot] = fromItem ?? null;
      }

      callback?.({ success: true });
      sendInventoryUpdate(world, entityId, socket);

      // If interacting with a container, send container update too
      if (sourceEntityId !== entityId) {
        socket.emit('s:container_update', {
          entityId: sourceEntityId,
          slots: sourceInv.slots,
        });
      }
    },
  );

  // ─── Inventory Drop ───
  socket.on(
    ClientMessage.InventoryDrop,
    (payload: unknown, callback?: (res: InventoryResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!inventoryRateLimiter.check(playerId, 'inv_drop')) {
        callback?.({ success: false, error: 'Rate limited' });
        return;
      }

      if (!isValidDropPayload(payload)) {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      const entityId = world.getPlayerEntity(playerId);
      if (entityId === undefined) {
        callback?.({ success: false, error: 'No player entity' });
        return;
      }

      const inventory = world.ecs.getComponent<InventoryComponent>(
        entityId,
        ComponentType.Inventory,
      );
      if (!inventory) {
        callback?.({ success: false, error: 'No inventory' });
        return;
      }

      if (!isValidSlot(payload.slot, PLAYER_INVENTORY_SLOTS)) {
        callback?.({ success: false, error: 'Invalid slot' });
        return;
      }

      const item = inventory.slots[payload.slot];
      if (!item) {
        callback?.({ success: false, error: 'Slot is empty' });
        return;
      }

      const dropQuantity = Math.min(payload.quantity, item.quantity);

      // Create dropped item stack
      const droppedItem: ItemStack = {
        itemId: item.itemId,
        quantity: dropQuantity,
      };
      if (item.durability !== undefined) {
        droppedItem.durability = item.durability;
      }

      // Remove from inventory
      item.quantity -= dropQuantity;
      if (item.quantity <= 0) {
        inventory.slots[payload.slot] = null;
      }

      // Spawn item drop entity in front of player
      const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
      if (pos) {
        const dropPos = {
          x: pos.x + Math.sin(pos.rotation) * -1.5,
          y: pos.y + 0.5,
          z: pos.z + Math.cos(pos.rotation) * -1.5,
        };
        const dropEntityId = world.createItemDropEntity(droppedItem, dropPos);

        // Track item drop for achievements
        trackItemDrop(playerId);

        // Broadcast to nearby players
        socket.broadcast.emit('s:item_dropped', {
          entityId: dropEntityId,
          itemId: droppedItem.itemId,
          quantity: droppedItem.quantity,
          position: dropPos,
        });
      }

      callback?.({ success: true });
      sendInventoryUpdate(world, entityId, socket);
    },
  );

  // ─── Inventory Split ───
  socket.on(
    ClientMessage.InventorySplit,
    (payload: unknown, callback?: (res: InventoryResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!inventoryRateLimiter.check(playerId, 'inv_split')) {
        callback?.({ success: false, error: 'Rate limited' });
        return;
      }

      if (!isValidSplitPayload(payload)) {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      const entityId = world.getPlayerEntity(playerId);
      if (entityId === undefined) {
        callback?.({ success: false, error: 'No player entity' });
        return;
      }

      const inventory = world.ecs.getComponent<InventoryComponent>(
        entityId,
        ComponentType.Inventory,
      );
      if (!inventory) {
        callback?.({ success: false, error: 'No inventory' });
        return;
      }

      if (!isValidSlot(payload.slot, PLAYER_INVENTORY_SLOTS)) {
        callback?.({ success: false, error: 'Invalid slot' });
        return;
      }

      const item = inventory.slots[payload.slot];
      if (!item || item.quantity < 2) {
        callback?.({ success: false, error: 'Cannot split' });
        return;
      }

      // Find empty slot for the split half
      const emptyIdx = inventory.slots.findIndex((s) => s === null);
      if (emptyIdx === -1) {
        callback?.({ success: false, error: 'No empty slot' });
        return;
      }

      const splitAmount = Math.floor(item.quantity / 2);
      item.quantity -= splitAmount;

      inventory.slots[emptyIdx] = {
        itemId: item.itemId,
        quantity: splitAmount,
        durability: item.durability,
      };

      callback?.({ success: true });
      sendInventoryUpdate(world, entityId, socket);
    },
  );

  // ─── Interact (open container, loot body, etc.) ───
  socket.on(
    ClientMessage.Interact,
    (payload: unknown, callback?: (res: InventoryResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!inventoryRateLimiter.check(playerId, 'interact')) {
        callback?.({ success: false, error: 'Rate limited' });
        return;
      }

      if (!isValidInteractPayload(payload)) {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      const entityId = world.getPlayerEntity(playerId);
      if (entityId === undefined) {
        callback?.({ success: false, error: 'No player entity' });
        return;
      }

      const targetId = payload.entityId as EntityId;
      if (!world.ecs.entityExists(targetId)) {
        callback?.({ success: false, error: 'Entity does not exist' });
        return;
      }

      // Range check
      const playerPos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
      const targetPos = world.ecs.getComponent<PositionComponent>(targetId, ComponentType.Position);
      if (!playerPos || !targetPos) {
        callback?.({ success: false, error: 'Position not found' });
        return;
      }

      const dx = playerPos.x - targetPos.x;
      const dy = playerPos.y - targetPos.y;
      const dz = playerPos.z - targetPos.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > INTERACT_RANGE) {
        callback?.({ success: false, error: 'Too far away' });
        return;
      }

      // Check if target has inventory (container/loot bag)
      const targetInv = world.ecs.getComponent<InventoryComponent>(
        targetId,
        ComponentType.Inventory,
      );
      if (!targetInv) {
        callback?.({ success: false, error: 'Not interactable' });
        return;
      }

      callback?.({ success: true });

      // Send container contents to player
      socket.emit('s:container_open', {
        entityId: targetId,
        slots: targetInv.slots,
      });
    },
  );

  logger.debug({ socketId: socket.id }, 'Inventory handlers registered');
}
