// ─── Item Pickup System ───
// Auto-collects item drop entities when a player walks within pickup range.
// Runs each tick, checks proximity between all players and item drops,
// transfers items to player inventories, and destroys collected drops.

import {
  ComponentType,
  ITEM_REGISTRY,
  PICKUP_RANGE,
  type HealthComponent,
  type InventoryComponent,
  type PositionComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const PICKUP_RANGE_SQ = PICKUP_RANGE * PICKUP_RANGE;
const PICKUP_CHECK_INTERVAL = 3; // every 3 ticks (~150ms at 20 TPS)
let tickCounter = 0;

// ─── Module-level reusable containers ───

const playerEntityIds = new Set<number>();
const playerEntries: { entityId: number; pos: PositionComponent; inv: InventoryComponent }[] = [];
const toDestroy: number[] = [];

// ─── System ───

export const itemPickupSystem: SystemFn = (world: GameWorld, _dt: number): void => {
  tickCounter++;
  if (tickCounter % PICKUP_CHECK_INTERVAL !== 0) return;

  const playerMap = world.getPlayerEntityMap();
  if (playerMap.size === 0) return;

  // Query all entities that have Position + Inventory (includes players, NPCs,
  // containers — filtered below via hasComponent checks to find item drops only)
  const candidates = world.ecs.query(ComponentType.Position, ComponentType.Inventory);
  if (candidates.length === 0) return;

  // Clear and reuse module-level containers
  playerEntityIds.clear();
  playerEntries.length = 0;
  toDestroy.length = 0;

  for (const [, entityId] of playerMap) {
    playerEntityIds.add(entityId);
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    const inv = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
    // Skip dead players — they shouldn't pick up items (Issue 139)
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
    if (pos && inv && health && health.current > 0) {
      playerEntries.push({ entityId, pos, inv });
    }
  }

  for (const dropId of candidates) {
    // Skip player entities
    if (playerEntityIds.has(dropId)) continue;

    // Skip entities that aren't simple item drops
    if (world.ecs.hasComponent(dropId, ComponentType.Health)) continue;
    if (world.ecs.hasComponent(dropId, ComponentType.Lootable)) continue;
    if (world.ecs.hasComponent(dropId, ComponentType.AI)) continue;
    if (world.ecs.hasComponent(dropId, ComponentType.Building)) continue;

    const dropPos = world.ecs.getComponent<PositionComponent>(dropId, ComponentType.Position);
    if (!dropPos) continue;

    // Find closest player in range
    let closestPlayer: (typeof playerEntries)[0] | null = null;
    let closestDistSq = PICKUP_RANGE_SQ;

    for (const player of playerEntries) {
      const dx = dropPos.x - player.pos.x;
      const dy = dropPos.y - player.pos.y;
      const dz = dropPos.z - player.pos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestPlayer = player;
      }
    }

    if (!closestPlayer) continue;

    // Try to transfer items from drop to player inventory
    const dropInv = world.ecs.getComponent<InventoryComponent>(dropId, ComponentType.Inventory);
    if (!dropInv) continue;

    let allPickedUp = true;

    for (let i = 0; i < dropInv.slots.length; i++) {
      const item = dropInv.slots[i];
      if (!item) continue;

      const maxStack = ITEM_REGISTRY[item.itemId]?.maxStack ?? 999;
      let remaining = item.quantity;

      // Try stacking into existing matching slots first
      for (const slot of closestPlayer.inv.slots) {
        if (remaining <= 0) break;
        if (slot && slot.itemId === item.itemId) {
          const canAdd = maxStack - slot.quantity;
          if (canAdd > 0) {
            const add = Math.min(remaining, canAdd);
            slot.quantity += add;
            remaining -= add;
          }
        }
      }

      // Place in empty slots
      for (let j = 0; j < closestPlayer.inv.slots.length && remaining > 0; j++) {
        if (closestPlayer.inv.slots[j] === null) {
          const add = Math.min(remaining, maxStack);
          closestPlayer.inv.slots[j] = { itemId: item.itemId, quantity: add };
          remaining -= add;
        }
      }

      if (remaining > 0) {
        // Couldn't pick up everything — update the drop's remaining quantity
        item.quantity = remaining;
        allPickedUp = false;
      } else {
        dropInv.slots[i] = null;
      }
    }

    if (allPickedUp) {
      toDestroy.push(dropId);
      // TODO: emit pickup sound/event to client via world.emitToPlayer()
      logger.debug({ dropId, playerEntityId: closestPlayer.entityId }, 'Item drop auto-collected');
    }
  }

  // Destroy fully collected drops
  for (const id of toDestroy) {
    world.ecs.destroyEntity(id);
  }
};
