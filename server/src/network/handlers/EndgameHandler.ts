// ─── Endgame Network Handler ───
// Socket event handlers for raiding, doors, containers, deployables, and research.

import {
  ClientMessage,
  ComponentType,
  ServerMessage,
  type ContainerMoveItemPayload,
  type ContainerOpenPayload,
  type DoorInteractPayload,
  type EnterLockCodePayload,
  type InventoryComponent,
  type PlaceC4Payload,
  type PlaceDeployablePayload,
  type PositionComponent,
  type ResearchCancelPayload,
  type ResearchStartPayload,
  type SetLockCodePayload,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import {
  createResearchTableEntity,
  handleResearchCancel,
  handleResearchStart,
} from '../../game/systems/BlueprintSystem.js';
import {
  createStorageBoxEntity,
  handleContainerClose,
  handleContainerMoveItem,
  handleContainerOpen,
} from '../../game/systems/ContainerSystem.js';
import {
  createBarricadeEntity,
  createLandmineEntity,
  createSleepingBagEntity,
} from '../../game/systems/DefenseSystem.js';
import {
  handleAttachCodeLock,
  handleDoorInteract,
  handleEnterLockCode,
  handlePlaceDoor,
  handleSetLockCode,
} from '../../game/systems/DoorSystem.js';
import { handlePlaceC4 } from '../../game/systems/RaidingSystem.js';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';

// ─── Constants ───

const INTERACT_RANGE_SQ = 4.0 * 4.0;
const PLACE_RANGE_SQ = 10.0 * 10.0;

// ─── Item IDs ───

const STORAGE_BOX_ITEM_ID = 91;
const LARGE_STORAGE_BOX_ITEM_ID = 92;
const LANDMINE_ITEM_ID = 93;
const BARRICADE_ITEM_ID = 94;
const RESEARCH_TABLE_ITEM_ID = 95;
const WOODEN_DOOR_ITEM_ID = 61;
const METAL_DOOR_ITEM_ID = 62;
const CODE_LOCK_ITEM_ID = 63;
const SLEEPING_BAG_ITEM_ID = 64;

// ─── Helper: deduct item from inventory ───

function deductItem(inventory: InventoryComponent, itemId: number, quantity: number): boolean {
  let total = 0;
  for (const slot of inventory.slots) {
    if (slot && slot.itemId === itemId) {
      total += slot.quantity;
    }
  }
  if (total < quantity) return false;

  let remaining = quantity;
  for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
    const slot = inventory.slots[i];
    if (slot && slot.itemId === itemId) {
      const deduct = Math.min(slot.quantity, remaining);
      slot.quantity -= deduct;
      remaining -= deduct;
      if (slot.quantity <= 0) {
        inventory.slots[i] = null;
      }
    }
  }
  return true;
}

// ─── Register Endgame Handlers ───

export function registerEndgameHandlers(
  _io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (s: Socket) => string | undefined,
): void {
  // ── C4 Placement ──
  socket.on(ClientMessage.PlaceC4, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as PlaceC4Payload;
    if (typeof payload?.targetEntityId !== 'number') return;

    const success = handlePlaceC4(world, playerId, payload.targetEntityId);
    if (success) {
      // Client receives notification via StateBroadcaster (explosion/base attack drains)
      logger.debug({ playerId, targetEntityId: payload.targetEntityId }, 'C4 placed via handler');
    }
  });

  // ── Door Interact (open/close/prompt) ──
  socket.on(ClientMessage.DoorInteract, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as DoorInteractPayload;
    if (typeof payload?.entityId !== 'number') return;

    handleDoorInteract(world, playerId, payload.entityId);
  });

  // ── Set Lock Code ──
  socket.on(ClientMessage.SetLockCode, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as SetLockCodePayload;
    if (typeof payload?.entityId !== 'number' || typeof payload?.code !== 'string') return;

    const success = handleSetLockCode(world, playerId, payload.entityId, payload.code);
    if (success) {
      socket.emit(ServerMessage.Notification, {
        type: 'info',
        message: 'Lock code set successfully.',
        duration: 3000,
      });
    } else {
      socket.emit(ServerMessage.Notification, {
        type: 'error',
        message: 'Failed to set lock code.',
        duration: 3000,
      });
    }
  });

  // ── Enter Lock Code ──
  socket.on(ClientMessage.EnterLockCode, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as EnterLockCodePayload;
    if (typeof payload?.entityId !== 'number' || typeof payload?.code !== 'string') return;

    const success = handleEnterLockCode(world, playerId, payload.entityId, payload.code);
    if (success) {
      socket.emit(ServerMessage.Notification, {
        type: 'info',
        message: 'Code accepted. Door unlocked.',
        duration: 3000,
      });
    } else {
      socket.emit(ServerMessage.Notification, {
        type: 'error',
        message: 'Incorrect code.',
        duration: 3000,
      });
    }
  });

  // ── Container Open ──
  socket.on(ClientMessage.ContainerOpen, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as ContainerOpenPayload;
    if (typeof payload?.entityId !== 'number') return;

    handleContainerOpen(world, playerId, payload.entityId);
  });

  // ── Container Close ──
  socket.on(ClientMessage.ContainerClose, () => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    handleContainerClose(world, playerId);
  });

  // ── Container Move Item ──
  socket.on(ClientMessage.ContainerMoveItem, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as ContainerMoveItemPayload;
    if (
      typeof payload?.fromSlot !== 'number' ||
      typeof payload?.toSlot !== 'number' ||
      typeof payload?.fromContainer !== 'boolean' ||
      typeof payload?.toContainer !== 'boolean'
    ) {
      return;
    }

    handleContainerMoveItem(
      world,
      playerId,
      payload.fromSlot,
      payload.toSlot,
      payload.fromContainer,
      payload.toContainer,
    );
  });

  // ── Research Start ──
  socket.on(ClientMessage.ResearchStart, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as ResearchStartPayload;
    if (typeof payload?.entityId !== 'number' || typeof payload?.itemSlot !== 'number') return;

    const success = handleResearchStart(world, playerId, payload.entityId, payload.itemSlot);
    if (!success) {
      socket.emit(ServerMessage.Notification, {
        type: 'error',
        message: 'Cannot start research. Check requirements.',
        duration: 3000,
      });
    }
  });

  // ── Research Cancel ──
  socket.on(ClientMessage.ResearchCancel, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as ResearchCancelPayload;
    if (typeof payload?.entityId !== 'number') return;

    handleResearchCancel(world, playerId, payload.entityId);
  });

  // ── Place Deployable (storage boxes, landmines, barricades, research table, doors) ──
  socket.on(ClientMessage.PlaceDeployable, (data: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const payload = data as PlaceDeployablePayload;
    if (
      typeof payload?.itemId !== 'number' ||
      !payload?.position ||
      typeof payload.position.x !== 'number' ||
      typeof payload.position.y !== 'number' ||
      typeof payload.position.z !== 'number'
    ) {
      return;
    }

    const playerEntityId = world.getPlayerEntity(playerId);
    if (playerEntityId === undefined) return;

    // Range check
    const playerPos = world.ecs.getComponent<PositionComponent>(
      playerEntityId,
      ComponentType.Position,
    );
    if (!playerPos) return;

    const dx = playerPos.x - payload.position.x;
    const dy = playerPos.y - payload.position.y;
    const dz = playerPos.z - payload.position.z;
    if (dx * dx + dy * dy + dz * dz > PLACE_RANGE_SQ) {
      socket.emit(ServerMessage.Notification, {
        type: 'error',
        message: 'Too far away to place.',
        duration: 3000,
      });
      return;
    }

    // Get inventory
    const inventory = world.ecs.getComponent<InventoryComponent>(
      playerEntityId,
      ComponentType.Inventory,
    );
    if (!inventory) return;

    const pos = payload.position;

    switch (payload.itemId) {
      case STORAGE_BOX_ITEM_ID: {
        if (!deductItem(inventory, STORAGE_BOX_ITEM_ID, 1)) return;
        createStorageBoxEntity(world, pos, playerId, false);
        break;
      }
      case LARGE_STORAGE_BOX_ITEM_ID: {
        if (!deductItem(inventory, LARGE_STORAGE_BOX_ITEM_ID, 1)) return;
        createStorageBoxEntity(world, pos, playerId, true);
        break;
      }
      case LANDMINE_ITEM_ID: {
        if (!deductItem(inventory, LANDMINE_ITEM_ID, 1)) return;
        createLandmineEntity(world, pos, playerId);
        break;
      }
      case BARRICADE_ITEM_ID: {
        if (!deductItem(inventory, BARRICADE_ITEM_ID, 1)) return;
        createBarricadeEntity(world, pos, playerId);
        break;
      }
      case RESEARCH_TABLE_ITEM_ID: {
        if (!deductItem(inventory, RESEARCH_TABLE_ITEM_ID, 1)) return;
        createResearchTableEntity(world, pos, playerId);
        break;
      }
      case WOODEN_DOOR_ITEM_ID:
      case METAL_DOOR_ITEM_ID: {
        // Doors are placed into existing doorway entities via PlaceDeployable
        // The rotation field doubles as the doorway entity ID for door placement
        const doorwayEntityId = Math.floor(payload.rotation);
        handlePlaceDoor(world, playerId, doorwayEntityId, payload.itemId);
        break;
      }
      case CODE_LOCK_ITEM_ID: {
        // Code lock is attached to an existing door entity
        const doorEntityId = Math.floor(payload.rotation);
        handleAttachCodeLock(world, playerId, doorEntityId);
        break;
      }
      case SLEEPING_BAG_ITEM_ID: {
        if (!deductItem(inventory, SLEEPING_BAG_ITEM_ID, 1)) return;
        createSleepingBagEntity(world, pos, playerId);
        break;
      }
      default: {
        logger.debug({ playerId, itemId: payload.itemId }, 'PlaceDeployable: unknown item ID');
        return;
      }
    }

    logger.debug({ playerId, itemId: payload.itemId, position: pos }, 'Deployable placed');
  });
}
