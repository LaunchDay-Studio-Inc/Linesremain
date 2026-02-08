// ─── Door System ───
// Handles door entity management: placement into doorways, open/close toggling,
// code lock attachment, and lock code authorization.

import {
  type BuildingComponent,
  BuildingPieceType,
  type ColliderComponent,
  ComponentType,
  type DoorStateComponent,
  type EntityId,
  type HealthComponent,
  type InventoryComponent,
  type OwnershipComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Door HP Constants ───

/** Hit points for a Wooden Door (item 61) */
const WOODEN_DOOR_HP = 200;
/** Hit points for a Metal Door (item 62) */
const METAL_DOOR_HP = 800;

/** Item IDs */
const WOODEN_DOOR_ITEM_ID = 61;
const METAL_DOOR_ITEM_ID = 62;
const CODE_LOCK_ITEM_ID = 63;

// ─── Module-Level Notification Arrays ───

const doorStateNotifications: { entityId: number; isOpen: boolean; isLocked: boolean }[] = [];
const codeLockPrompts: { playerId: string; entityId: number; isOwner: boolean }[] = [];

// ─── Helper: Deduct a single item from player inventory ───

function deductItem(inventory: InventoryComponent, itemId: number, quantity: number): boolean {
  // First verify the player has enough
  let total = 0;
  for (const slot of inventory.slots) {
    if (slot && slot.itemId === itemId) {
      total += slot.quantity;
    }
  }
  if (total < quantity) return false;

  // Deduct
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

// ─── Helper: Check if player is authorized on a building's ownership ───

function isPlayerAuthorizedOnBuilding(
  world: GameWorld,
  playerId: string,
  entityId: EntityId,
): boolean {
  const ownership = world.ecs.getComponent<OwnershipComponent>(entityId, ComponentType.Ownership);
  if (!ownership) {
    // No ownership component means anyone can interact
    return true;
  }
  return ownership.ownerId === playerId || ownership.authPlayerIds.includes(playerId);
}

// ─── handlePlaceDoor ───
// Places a door into an existing doorway entity.
// Returns true on success, false on failure.

export function handlePlaceDoor(
  world: GameWorld,
  playerId: string,
  doorwayEntityId: EntityId,
  doorItemId: number,
): boolean {
  // 1. Validate player entity exists
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    logger.warn({ playerId }, 'Door placement failed: player entity not found');
    return false;
  }

  // 2. Validate doorway entity has a Building component with pieceType=Doorway
  const building = world.ecs.getComponent<BuildingComponent>(
    doorwayEntityId,
    ComponentType.Building,
  );
  if (!building || building.pieceType !== BuildingPieceType.Doorway) {
    logger.warn({ playerId, doorwayEntityId }, 'Door placement failed: target is not a doorway');
    return false;
  }

  // 3. Check if a door is already placed (DoorState already exists)
  const existingDoorState = world.ecs.getComponent<DoorStateComponent>(
    doorwayEntityId,
    ComponentType.DoorState,
  );
  if (existingDoorState) {
    logger.warn({ playerId, doorwayEntityId }, 'Door placement failed: doorway already has a door');
    return false;
  }

  // 4. Check player owns or is authorized on the building
  if (!isPlayerAuthorizedOnBuilding(world, playerId, doorwayEntityId)) {
    logger.warn(
      { playerId, doorwayEntityId },
      'Door placement failed: player not authorized on this building',
    );
    return false;
  }

  // 5. Validate door item is a valid door type
  if (doorItemId !== WOODEN_DOOR_ITEM_ID && doorItemId !== METAL_DOOR_ITEM_ID) {
    logger.warn({ playerId, doorItemId }, 'Door placement failed: invalid door item ID');
    return false;
  }

  // 6. Deduct door item from player inventory
  const inventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!inventory) {
    logger.warn({ playerId }, 'Door placement failed: player inventory not found');
    return false;
  }

  if (!deductItem(inventory, doorItemId, 1)) {
    logger.warn(
      { playerId, doorItemId },
      'Door placement failed: player does not have the door item',
    );
    return false;
  }

  // 7. Add DoorState component to the doorway entity
  world.ecs.addComponent<DoorStateComponent>(doorwayEntityId, ComponentType.DoorState, {
    isOpen: false,
    lockCode: null,
    authorizedPlayerIds: [playerId],
    ownerId: playerId,
    doorItemId,
  });

  // 8. Update the Building component pieceType to Door
  building.pieceType = BuildingPieceType.Door;

  // 9. Set the Health component based on door type
  const doorHP = doorItemId === METAL_DOOR_ITEM_ID ? METAL_DOOR_HP : WOODEN_DOOR_HP;
  const health = world.ecs.getComponent<HealthComponent>(doorwayEntityId, ComponentType.Health);
  if (health) {
    health.current = doorHP;
    health.max = doorHP;
  }

  // 10. Update the Collider to door dimensions
  const collider = world.ecs.getComponent<ColliderComponent>(
    doorwayEntityId,
    ComponentType.Collider,
  );
  if (collider) {
    collider.width = 1;
    collider.height = 2;
    collider.depth = 0.1;
  }

  logger.debug({ playerId, doorwayEntityId, doorItemId }, 'Door placed successfully');

  return true;
}

// ─── handleDoorInteract ───
// Handles a player interacting with a door (open/close toggle or code lock prompt).

export function handleDoorInteract(world: GameWorld, playerId: string, entityId: EntityId): void {
  const doorState = world.ecs.getComponent<DoorStateComponent>(entityId, ComponentType.DoorState);
  if (!doorState) {
    return;
  }

  const ownership = world.ecs.getComponent<OwnershipComponent>(entityId, ComponentType.Ownership);
  const isLocked = ownership?.isLocked ?? false;

  if (isLocked) {
    // Check if the player is authorized (owner or in authorized list)
    const isAuthorized =
      doorState.ownerId === playerId || doorState.authorizedPlayerIds.includes(playerId);

    if (isAuthorized) {
      // Toggle the door open/close
      doorState.isOpen = !doorState.isOpen;

      doorStateNotifications.push({
        entityId,
        isOpen: doorState.isOpen,
        isLocked: true,
      });

      logger.debug(
        { playerId, entityId, isOpen: doorState.isOpen },
        'Authorized player toggled locked door',
      );
    } else {
      // Player is not authorized — prompt for code lock entry
      const isOwner = doorState.ownerId === playerId;
      codeLockPrompts.push({ playerId, entityId, isOwner });

      logger.debug(
        { playerId, entityId },
        'Unauthorized player attempted locked door — prompting code entry',
      );
    }
  } else {
    // Door is not locked — anyone can toggle it
    doorState.isOpen = !doorState.isOpen;

    doorStateNotifications.push({
      entityId,
      isOpen: doorState.isOpen,
      isLocked: false,
    });

    logger.debug({ playerId, entityId, isOpen: doorState.isOpen }, 'Player toggled unlocked door');
  }
}

// ─── handleSetLockCode ───
// Allows the door owner to set a 4-digit lock code.
// Returns true on success, false on failure.

export function handleSetLockCode(
  world: GameWorld,
  playerId: string,
  entityId: EntityId,
  code: string,
): boolean {
  // 1. Validate code is exactly 4 digits
  if (!/^\d{4}$/.test(code)) {
    logger.warn(
      { playerId, entityId, code },
      'Set lock code failed: code must be exactly 4 digits',
    );
    return false;
  }

  // 2. Get DoorState component
  const doorState = world.ecs.getComponent<DoorStateComponent>(entityId, ComponentType.DoorState);
  if (!doorState) {
    logger.warn({ playerId, entityId }, 'Set lock code failed: entity has no DoorState component');
    return false;
  }

  // 3. Check player is the owner
  if (doorState.ownerId !== playerId) {
    logger.warn({ playerId, entityId }, 'Set lock code failed: player is not the door owner');
    return false;
  }

  // 4. Set the lock code
  doorState.lockCode = code;

  // 5. Add player to authorizedPlayerIds if not already present
  if (!doorState.authorizedPlayerIds.includes(playerId)) {
    doorState.authorizedPlayerIds.push(playerId);
  }

  logger.debug({ playerId, entityId }, 'Lock code set successfully');

  return true;
}

// ─── handleEnterLockCode ───
// Allows a player to enter the lock code to gain authorization.
// Returns true if code matches, false otherwise.

export function handleEnterLockCode(
  world: GameWorld,
  playerId: string,
  entityId: EntityId,
  code: string,
): boolean {
  // 1. Get DoorState component
  const doorState = world.ecs.getComponent<DoorStateComponent>(entityId, ComponentType.DoorState);
  if (!doorState) {
    logger.warn(
      { playerId, entityId },
      'Enter lock code failed: entity has no DoorState component',
    );
    return false;
  }

  // 2. Check if code matches
  if (doorState.lockCode === null) {
    logger.warn({ playerId, entityId }, 'Enter lock code failed: no lock code has been set');
    return false;
  }

  if (code !== doorState.lockCode) {
    logger.debug({ playerId, entityId }, 'Enter lock code failed: incorrect code');
    return false;
  }

  // 3. Code matches — add player to authorized list
  if (!doorState.authorizedPlayerIds.includes(playerId)) {
    doorState.authorizedPlayerIds.push(playerId);
  }

  logger.debug({ playerId, entityId }, 'Player entered correct lock code and is now authorized');

  return true;
}

// ─── handleAttachCodeLock ───
// Attaches a code lock to a door. Deducts the Code Lock item from inventory.
// Returns true on success, false on failure.

export function handleAttachCodeLock(
  world: GameWorld,
  playerId: string,
  entityId: EntityId,
): boolean {
  // 1. Validate player entity exists
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    logger.warn({ playerId }, 'Attach code lock failed: player entity not found');
    return false;
  }

  // 2. Validate entity has a DoorState component
  const doorState = world.ecs.getComponent<DoorStateComponent>(entityId, ComponentType.DoorState);
  if (!doorState) {
    logger.warn(
      { playerId, entityId },
      'Attach code lock failed: entity has no DoorState component',
    );
    return false;
  }

  // 3. Check the door is not already locked
  const ownership = world.ecs.getComponent<OwnershipComponent>(entityId, ComponentType.Ownership);
  if (ownership && ownership.isLocked) {
    logger.warn({ playerId, entityId }, 'Attach code lock failed: door already has a code lock');
    return false;
  }

  // 4. Check player is authorized on the door (owner or in auth list)
  if (doorState.ownerId !== playerId && !doorState.authorizedPlayerIds.includes(playerId)) {
    logger.warn(
      { playerId, entityId },
      'Attach code lock failed: player not authorized on this door',
    );
    return false;
  }

  // 5. Deduct Code Lock item from player inventory
  const inventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!inventory) {
    logger.warn({ playerId }, 'Attach code lock failed: player inventory not found');
    return false;
  }

  if (!deductItem(inventory, CODE_LOCK_ITEM_ID, 1)) {
    logger.warn({ playerId }, 'Attach code lock failed: player does not have a Code Lock');
    return false;
  }

  // 6. Mark isLocked true on the Ownership component
  // The door's lockCode is set to null initially — the owner uses handleSetLockCode to set it
  if (ownership) {
    ownership.isLocked = true;
  }

  logger.debug(
    { playerId, entityId },
    'Code lock attached to door. Owner must set a code using SetLockCode.',
  );

  return true;
}

// ─── Door System (per-tick — no-op, event-driven) ───
// Door logic is entirely event-driven via the handler functions above.
// This system is registered for consistency with the SystemFn pattern.

export const doorSystem: SystemFn = (_world: GameWorld, _dt: number): void => {};

// ─── Notification Drains ───

export function drainDoorStateNotifications(): {
  entityId: number;
  isOpen: boolean;
  isLocked: boolean;
}[] {
  return doorStateNotifications.splice(0);
}

export function drainCodeLockPrompts(): { playerId: string; entityId: number; isOwner: boolean }[] {
  return codeLockPrompts.splice(0);
}
