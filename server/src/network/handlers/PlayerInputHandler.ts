// ─── Player Input Handler ───
// Receives client input packets, validates them, applies movement,
// and queues attack actions for the combat system.

import {
  ClientMessage,
  ComponentType,
  HOTBAR_SLOTS,
  INTERACT_RANGE,
  ITEM_REGISTRY,
  PICKUP_RANGE,
  PLAYER_CROUCH_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  type EntityId,
  type EquipmentComponent,
  type InputPayload,
  type InventoryComponent,
  type PositionComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import { queueAttack } from '../../game/systems/CombatSystem.js';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';
import { inputRateLimiter } from '../RateLimiter.js';

// ─── Validation ───

function isValidInput(payload: unknown): payload is InputPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  return (
    typeof p.seq === 'number' &&
    Number.isInteger(p.seq) &&
    typeof p.forward === 'number' &&
    p.forward >= -1 &&
    p.forward <= 1 &&
    typeof p.right === 'number' &&
    p.right >= -1 &&
    p.right <= 1 &&
    typeof p.jump === 'boolean' &&
    typeof p.crouch === 'boolean' &&
    typeof p.sprint === 'boolean' &&
    typeof p.rotation === 'number' &&
    isFinite(p.rotation) &&
    typeof p.primaryAction === 'boolean' &&
    typeof p.secondaryAction === 'boolean' &&
    typeof p.selectedSlot === 'number' &&
    Number.isInteger(p.selectedSlot) &&
    p.selectedSlot >= 0 &&
    p.selectedSlot < HOTBAR_SLOTS
  );
}

// ─── Movement Processing ───

function processMovement(
  world: GameWorld,
  entityId: EntityId,
  input: InputPayload,
  _dt: number,
): void {
  const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
  const vel = world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity);
  if (!pos || !vel) return;

  // Update rotation
  pos.rotation = input.rotation;

  // Determine movement speed
  let speed = PLAYER_WALK_SPEED;
  if (input.sprint && !input.crouch) {
    speed = PLAYER_SPRINT_SPEED;
  } else if (input.crouch) {
    speed = PLAYER_CROUCH_SPEED;
  }

  // Calculate movement direction relative to player rotation
  const sinR = Math.sin(pos.rotation);
  const cosR = Math.cos(pos.rotation);

  // Forward/backward and strafe
  let moveX = 0;
  let moveZ = 0;

  if (input.forward !== 0 || input.right !== 0) {
    // Forward is along -Z in local space (standard FPS convention)
    moveX = input.forward * -sinR + input.right * cosR;
    moveZ = input.forward * -cosR + input.right * -sinR;

    // Normalize diagonal movement
    const mag = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (mag > 0.001) {
      moveX = (moveX / mag) * speed;
      moveZ = (moveZ / mag) * speed;
    }
  }

  vel.vx = moveX;
  vel.vz = moveZ;

  // Jump is handled by GameLoop.processInputs() which has proper 5-point
  // ground detection (Issue 102). No duplicate jump logic here.
}

// ─── Selected Slot Sync ───

function syncSelectedSlot(world: GameWorld, entityId: EntityId, selectedSlot: number): void {
  const inventory = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
  const equipment = world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment);
  if (!inventory || !equipment) return;

  // The held item corresponds to the selected hotbar slot
  const item = inventory.slots[selectedSlot] ?? null;
  equipment.held = item;
}

// ─── Primary Action (Attack / Gather) ───

function processPrimaryAction(
  world: GameWorld,
  entityId: EntityId,
  playerId: string,
  input: InputPayload,
): void {
  if (!input.primaryAction) return;

  const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
  if (!pos) return;

  // Calculate look direction from rotation
  // Assume pitch is encoded in the vertical component of rotation
  // For simplicity, use a flat horizontal direction (pitch handled by client)
  const direction = {
    x: -Math.sin(pos.rotation),
    y: 0, // vertical aim would come from pitch if available
    z: -Math.cos(pos.rotation),
  };

  queueAttack({
    attackerEntityId: entityId,
    attackerPlayerId: playerId,
    direction,
    timestamp: Date.now(),
  });
}

// ─── Secondary Action (Interact / Use) ───

function processSecondaryAction(
  world: GameWorld,
  entityId: EntityId,
  _playerId: string,
  input: InputPayload,
  socket: Socket,
): void {
  if (!input.secondaryAction) return;

  const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
  if (!pos) return;

  // Find nearest interactable entity in range
  const lootables = world.ecs.query(
    ComponentType.Position,
    ComponentType.Lootable,
    ComponentType.Inventory,
  );

  let closestId: EntityId | null = null;
  let closestDist = INTERACT_RANGE;

  for (const targetId of lootables) {
    if (targetId === entityId) continue;
    const targetPos = world.ecs.getComponent<PositionComponent>(targetId, ComponentType.Position)!;
    const dx = targetPos.x - pos.x;
    const dy = targetPos.y - pos.y;
    const dz = targetPos.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < closestDist) {
      closestDist = dist;
      closestId = targetId;
    }
  }

  if (closestId !== null) {
    // Send loot container contents to the player
    const lootInv = world.ecs.getComponent<InventoryComponent>(closestId, ComponentType.Inventory);
    if (lootInv) {
      socket.emit('s:container_open', {
        entityId: closestId,
        slots: lootInv.slots,
      });
    }
    return;
  }

  // Check for item pickups
  const drops = world.ecs.query(ComponentType.Position, ComponentType.Inventory);
  let closestDrop: EntityId | null = null;
  let closestDropDist = PICKUP_RANGE;

  for (const dropId of drops) {
    if (dropId === entityId) continue;
    // Skip entities that have other components indicating they're not simple drops
    if (world.ecs.hasComponent(dropId, ComponentType.Health)) continue;
    if (world.ecs.hasComponent(dropId, ComponentType.Lootable)) continue;

    const dropPos = world.ecs.getComponent<PositionComponent>(dropId, ComponentType.Position)!;
    const dx = dropPos.x - pos.x;
    const dy = dropPos.y - pos.y;
    const dz = dropPos.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < closestDropDist) {
      closestDropDist = dist;
      closestDrop = dropId;
    }
  }

  if (closestDrop !== null) {
    const dropInv = world.ecs.getComponent<InventoryComponent>(
      closestDrop,
      ComponentType.Inventory,
    );
    const playerInv = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
    if (dropInv && playerInv) {
      // Try to add items to player inventory
      let pickedUp = false;
      for (const item of dropInv.slots) {
        if (!item) continue;
        // Find first empty slot
        const emptyIdx = playerInv.slots.findIndex((s) => s === null);
        if (emptyIdx !== -1) {
          playerInv.slots[emptyIdx] = item;
          pickedUp = true;
        } else {
          // Try stacking
          const stackIdx = playerInv.slots.findIndex(
            (s) =>
              s !== null &&
              s.itemId === item.itemId &&
              s.quantity < (ITEM_REGISTRY[item.itemId]?.maxStack ?? 999),
          );
          if (stackIdx !== -1) {
            playerInv.slots[stackIdx]!.quantity += item.quantity;
            pickedUp = true;
          }
        }
      }

      if (pickedUp) {
        world.ecs.destroyEntity(closestDrop);
        // Notify player of inventory update
        socket.emit('s:inv_update', {
          slots: playerInv.slots,
          equipment: world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment),
        });
      }
    }
  }
}

// ─── Register Player Input Handlers ───

export function registerPlayerInputHandlers(
  _io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  socket.on(ClientMessage.Input, (payload: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    // Rate limit
    if (!inputRateLimiter.check(playerId, 'input')) return;

    // Validate
    if (!isValidInput(payload)) return;

    // Get player entity
    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) return;

    // Verify entity still exists
    if (!world.ecs.entityExists(entityId)) return;

    // Process input
    const dt = 1 / 20; // Approximate tick interval

    syncSelectedSlot(world, entityId, payload.selectedSlot);
    processMovement(world, entityId, payload, dt);
    processPrimaryAction(world, entityId, playerId, payload);
    processSecondaryAction(world, entityId, playerId, payload, socket);
  });

  logger.debug({ socketId: socket.id }, 'Player input handlers registered');
}
