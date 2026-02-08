// ─── Container System ───
// Handles storage box entities: creation, interaction (open/close),
// and item transfer between player inventory and container slots.
// Event-driven — the per-tick system is a no-op; all logic runs
// via exported handler functions called from network message handlers.

import type { ItemStack } from '@lineremain/shared';
import {
  type ColliderComponent,
  ComponentType,
  type ContainerComponent,
  type EntityId,
  type HealthComponent,
  type InventoryComponent,
  ITEM_REGISTRY,
  type OwnershipComponent,
  type PositionComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const STORAGE_BOX_SLOTS = 12;
const LARGE_STORAGE_BOX_SLOTS = 24;
const INTERACT_RANGE = 4.0;

// ─── Module-level State ───

/** Tracks which player currently has which container open: playerId -> containerEntityId */
const openContainers: Map<string, number> = new Map();

/** Queued container content updates to send to clients */
const containerContentUpdates: {
  playerId: string;
  entityId: number;
  slots: (ItemStack | null)[];
  maxSlots: number;
  containerType: string;
}[] = [];

// ─── Helper: Distance squared check ───

function distSq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// ─── Create Storage Box Entity ───

export function createStorageBoxEntity(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  ownerId: string,
  isLarge: boolean,
): EntityId {
  const entityId = world.ecs.createEntity();
  const slotCount = isLarge ? LARGE_STORAGE_BOX_SLOTS : STORAGE_BOX_SLOTS;
  const maxHealth = isLarge ? 300 : 200;
  const containerType = isLarge ? 'large_storage_box' : 'storage_box';

  world.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
    x: position.x,
    y: position.y,
    z: position.z,
    rotation: 0,
  });

  world.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
    current: maxHealth,
    max: maxHealth,
  });

  world.ecs.addComponent<OwnershipComponent>(entityId, ComponentType.Ownership, {
    ownerId,
    teamId: null,
    isLocked: false,
    authPlayerIds: [ownerId],
  });

  world.ecs.addComponent<ContainerComponent>(entityId, ComponentType.Container, {
    containerType: containerType as ContainerComponent['containerType'],
    slots: new Array<ItemStack | null>(slotCount).fill(null),
    maxSlots: slotCount,
  });

  world.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
    width: 1.0,
    height: 0.8,
    depth: 1.0,
    isStatic: true,
  });

  logger.debug({ entityId, containerType, ownerId, position }, 'Storage box entity created');

  return entityId;
}

// ─── Handle Container Open ───

export function handleContainerOpen(world: GameWorld, playerId: string, entityId: number): void {
  // Validate container entity has a Container component
  const container = world.ecs.getComponent<ContainerComponent>(entityId, ComponentType.Container);
  if (!container) {
    logger.debug(
      { playerId, entityId },
      'Container open failed: entity has no Container component',
    );
    return;
  }

  // Validate player entity exists
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    logger.debug({ playerId }, 'Container open failed: player entity not found');
    return;
  }

  // Range check: player must be within INTERACT_RANGE of the container
  const playerPos = world.ecs.getComponent<PositionComponent>(
    playerEntityId,
    ComponentType.Position,
  );
  const containerPos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
  if (!playerPos || !containerPos) {
    logger.debug({ playerId, entityId }, 'Container open failed: missing position component');
    return;
  }

  if (distSq(playerPos, containerPos) > INTERACT_RANGE * INTERACT_RANGE) {
    logger.debug({ playerId, entityId }, 'Container open failed: out of range');
    return;
  }

  // Track this player as having this container open
  openContainers.set(playerId, entityId);

  // Push a content update so the client receives the current container state
  containerContentUpdates.push({
    playerId,
    entityId,
    slots: container.slots.map((slot) => (slot ? { ...slot } : null)),
    maxSlots: container.maxSlots,
    containerType: container.containerType,
  });

  logger.debug({ playerId, entityId, containerType: container.containerType }, 'Container opened');
}

// ─── Handle Container Close ───

export function handleContainerClose(world: GameWorld, playerId: string): void {
  const containerId = openContainers.get(playerId);
  if (containerId !== undefined) {
    openContainers.delete(playerId);
    logger.debug({ playerId, containerId }, 'Container closed');
    // Could persist container state to DB here if needed
  }
}

// ─── Handle Container Move Item ───

export function handleContainerMoveItem(
  world: GameWorld,
  playerId: string,
  fromSlot: number,
  toSlot: number,
  fromContainer: boolean,
  toContainer: boolean,
): void {
  // Resolve player entity and inventory
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    logger.debug({ playerId }, 'Container move failed: player entity not found');
    return;
  }

  const playerInventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!playerInventory) {
    logger.debug({ playerId }, 'Container move failed: player has no inventory');
    return;
  }

  // Resolve container entity the player currently has open
  const containerEntityId = openContainers.get(playerId);
  if (containerEntityId === undefined) {
    logger.debug({ playerId }, 'Container move failed: no container open');
    return;
  }

  const container = world.ecs.getComponent<ContainerComponent>(
    containerEntityId,
    ComponentType.Container,
  );
  if (!container) {
    logger.debug(
      { playerId, containerEntityId },
      'Container move failed: container component missing',
    );
    openContainers.delete(playerId);
    return;
  }

  // Determine source and destination slot arrays
  const sourceSlots: (ItemStack | null)[] = fromContainer ? container.slots : playerInventory.slots;
  const destSlots: (ItemStack | null)[] = toContainer ? container.slots : playerInventory.slots;

  // Validate slot indices
  if (fromSlot < 0 || fromSlot >= sourceSlots.length) {
    logger.debug(
      { playerId, fromSlot, max: sourceSlots.length },
      'Container move failed: fromSlot out of range',
    );
    return;
  }
  if (toSlot < 0 || toSlot >= destSlots.length) {
    logger.debug(
      { playerId, toSlot, max: destSlots.length },
      'Container move failed: toSlot out of range',
    );
    return;
  }

  const sourceItem = sourceSlots[fromSlot];
  const destItem = destSlots[toSlot];

  // Nothing to move
  if (!sourceItem) {
    return;
  }

  if (!destItem) {
    // Destination is empty — move the item directly
    destSlots[toSlot] = { ...sourceItem };
    sourceSlots[fromSlot] = null;
  } else if (destItem.itemId === sourceItem.itemId) {
    // Same item type — try to stack
    const itemDef = ITEM_REGISTRY[sourceItem.itemId];
    const maxStack = itemDef?.maxStack ?? 999;
    const canAdd = maxStack - destItem.quantity;

    if (canAdd >= sourceItem.quantity) {
      // All source items fit into the destination stack
      destItem.quantity += sourceItem.quantity;
      sourceSlots[fromSlot] = null;
    } else if (canAdd > 0) {
      // Partial stack — fill destination to max, leave remainder in source
      destItem.quantity += canAdd;
      sourceItem.quantity -= canAdd;
    }
    // If canAdd === 0, stacks are full, fall through to swap below
    // only if we didn't partially merge
    if (canAdd <= 0) {
      // Full destination stack of same type — swap
      destSlots[toSlot] = { ...sourceItem };
      sourceSlots[fromSlot] = { ...destItem };
    }
  } else {
    // Different item types — swap
    destSlots[toSlot] = { ...sourceItem };
    sourceSlots[fromSlot] = { ...destItem };
  }

  // Push container content update so client sees the new state
  containerContentUpdates.push({
    playerId,
    entityId: containerEntityId,
    slots: container.slots.map((slot) => (slot ? { ...slot } : null)),
    maxSlots: container.maxSlots,
    containerType: container.containerType,
  });

  logger.debug(
    {
      playerId,
      containerEntityId,
      fromSlot,
      toSlot,
      fromContainer,
      toContainer,
    },
    'Container item moved',
  );
}

// ─── Quick-Transfer: Move an item to first available slot ───

export function handleContainerQuickTransfer(
  world: GameWorld,
  playerId: string,
  fromSlot: number,
  fromContainer: boolean,
): void {
  // Resolve player entity and inventory
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    return;
  }

  const playerInventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!playerInventory) {
    return;
  }

  // Resolve container
  const containerEntityId = openContainers.get(playerId);
  if (containerEntityId === undefined) {
    return;
  }

  const container = world.ecs.getComponent<ContainerComponent>(
    containerEntityId,
    ComponentType.Container,
  );
  if (!container) {
    openContainers.delete(playerId);
    return;
  }

  // Source and destination
  const sourceSlots: (ItemStack | null)[] = fromContainer ? container.slots : playerInventory.slots;
  const destSlots: (ItemStack | null)[] = fromContainer ? playerInventory.slots : container.slots;

  if (fromSlot < 0 || fromSlot >= sourceSlots.length) {
    return;
  }

  const sourceItem = sourceSlots[fromSlot];
  if (!sourceItem) {
    return;
  }

  const itemDef = ITEM_REGISTRY[sourceItem.itemId];
  const maxStack = itemDef?.maxStack ?? 999;
  let remaining = sourceItem.quantity;

  // Try to stack into existing matching slots first
  for (let i = 0; i < destSlots.length && remaining > 0; i++) {
    const slot = destSlots[i];
    if (slot && slot.itemId === sourceItem.itemId) {
      const canAdd = maxStack - slot.quantity;
      if (canAdd > 0) {
        const add = Math.min(remaining, canAdd);
        slot.quantity += add;
        remaining -= add;
      }
    }
  }

  // Place remainder in empty slots
  for (let i = 0; i < destSlots.length && remaining > 0; i++) {
    if (destSlots[i] === null) {
      const add = Math.min(remaining, maxStack);
      destSlots[i] = { itemId: sourceItem.itemId, quantity: add };
      remaining -= add;
    }
  }

  // Update source slot
  if (remaining <= 0) {
    sourceSlots[fromSlot] = null;
  } else {
    sourceItem.quantity = remaining;
  }

  // Push container content update
  containerContentUpdates.push({
    playerId,
    entityId: containerEntityId,
    slots: container.slots.map((slot) => (slot ? { ...slot } : null)),
    maxSlots: container.maxSlots,
    containerType: container.containerType,
  });

  logger.debug(
    { playerId, containerEntityId, fromSlot, fromContainer },
    'Container quick-transfer completed',
  );
}

// ─── Container System (per-tick — event-driven, no-op tick) ───

export const containerSystem: SystemFn = (_world: GameWorld, _dt: number): void => {
  // All container logic is event-driven via the exported handler functions.
  // This system is registered for consistency with the ECS pipeline but
  // performs no per-tick work.
};

// ─── Accessors ───

export function getPlayerOpenContainer(playerId: string): number | undefined {
  return openContainers.get(playerId);
}

export function closePlayerContainer(playerId: string): void {
  openContainers.delete(playerId);
}

export function drainContainerContentUpdates(): typeof containerContentUpdates {
  return containerContentUpdates.splice(0);
}
