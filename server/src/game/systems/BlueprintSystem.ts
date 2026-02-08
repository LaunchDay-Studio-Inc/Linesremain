// ─── Blueprint System ───
// Handles Research Table interaction, blueprint learning, and craft gating.
// Players place an item reference from their inventory into the research table,
// pay a scrap cost, and after a duration the blueprint is learned.

import {
  ComponentType,
  ITEM_REGISTRY,
  RECIPE_REGISTRY,
  type ColliderComponent,
  type EntityId,
  type InventoryComponent,
  type OwnershipComponent,
  type PositionComponent,
  type ResearchComponent,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Constants ───

const RESEARCH_DURATION = 10; // seconds
const SCRAP_COST = 100; // scrap per research
const SCRAP_ITEM_ID = 96;
const INTERACT_RANGE = 4.0;

// ─── Module-level State ───

/** Learned blueprints per player (loaded from DB on connect) */
const playerBlueprints: Map<string, Set<number>> = new Map(); // playerId -> Set of recipeIds

/** Notification queues drained by the network layer each tick */
const blueprintLearnedNotifications: { playerId: string; recipeId: number; recipeName: string }[] =
  [];
const researchProgressUpdates: {
  playerId: string;
  entityId: number;
  progress: number;
  isComplete: boolean;
  itemName?: string;
}[] = [];

/** Progress-update throttle: track the last time we pushed an update per entity */
const lastProgressUpdateTime: Map<EntityId, number> = new Map();
const PROGRESS_UPDATE_INTERVAL_MS = 1000; // ~1 second between progress updates

// ─── Player Blueprint Management ───

/**
 * Load a player's previously-learned blueprints (called on connect, from DB).
 */
export function loadPlayerBlueprints(playerId: string, recipeIds: number[]): void {
  playerBlueprints.set(playerId, new Set(recipeIds));
  logger.debug({ playerId, count: recipeIds.length }, 'Loaded player blueprints');
}

/**
 * Remove a player's blueprint data (called on disconnect).
 */
export function unloadPlayerBlueprints(playerId: string): void {
  playerBlueprints.delete(playerId);
  // Progress tracking is keyed by entity ID, not player, so no cleanup needed here.
  // Research table entities will naturally reset when the researcher disconnects
  // or the table is destroyed.
  logger.debug({ playerId }, 'Unloaded player blueprints');
}

/**
 * Check whether a player has learned a specific blueprint.
 * Recipes that do not require a blueprint always return true.
 */
export function hasBlueprint(playerId: string, recipeId: number): boolean {
  const recipe = RECIPE_REGISTRY[recipeId];
  if (!recipe || !recipe.requiredBlueprint) {
    return true; // No blueprint requirement
  }
  const learned = playerBlueprints.get(playerId);
  if (!learned) return false;
  return learned.has(recipeId);
}

/**
 * Check whether a player can craft the given recipe, taking blueprints into account.
 * Recipes without requiredBlueprint=true are always craftable (from a blueprint perspective).
 */
export function canCraftRecipe(playerId: string, recipeId: number): boolean {
  const recipe = RECIPE_REGISTRY[recipeId];
  if (!recipe) return false;
  if (!recipe.requiredBlueprint) return true;
  return hasBlueprint(playerId, recipeId);
}

/**
 * Return the list of recipe IDs this player has learned.
 */
export function getLearnedBlueprints(playerId: string): number[] {
  const learned = playerBlueprints.get(playerId);
  if (!learned) return [];
  return Array.from(learned);
}

// ─── Recipe Lookup ───

/**
 * Find the first recipe whose outputItemId matches the given item ID.
 * Returns the recipe ID, or null if no recipe produces this item.
 */
export function findRecipeForItem(itemId: number): number | null {
  for (const key of Object.keys(RECIPE_REGISTRY)) {
    const recipeId = Number(key);
    const recipe = RECIPE_REGISTRY[recipeId];
    if (recipe && recipe.outputItemId === itemId) {
      return recipeId;
    }
  }
  return null;
}

// ─── Research Table Entity Factory ───

/**
 * Create a Research Table entity with the required components.
 */
export function createResearchTableEntity(
  world: GameWorld,
  position: { x: number; y: number; z: number },
  ownerId: string,
): EntityId {
  const entityId = world.ecs.createEntity();

  world.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
    x: position.x,
    y: position.y,
    z: position.z,
    rotation: 0,
  });

  world.ecs.addComponent<ResearchComponent>(entityId, ComponentType.Research, {
    researchingItemId: null,
    researchStartTime: null,
    researchDuration: RESEARCH_DURATION,
    researcherId: null,
  });

  world.ecs.addComponent<OwnershipComponent>(entityId, ComponentType.Ownership, {
    ownerId,
    teamId: null,
    isLocked: false,
    authPlayerIds: [ownerId],
  });

  world.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
    width: 1.2,
    height: 1.0,
    depth: 1.2,
    isStatic: true,
  });

  world.ecs.addComponent(entityId, ComponentType.Health, {
    current: 200,
    max: 200,
  });

  logger.debug({ entityId, ownerId }, 'Research table entity created');
  return entityId;
}

// ─── Interaction Helpers ───

/**
 * Distance squared between two 3D points.
 */
function distSq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Count how many of a specific item the player has across all inventory slots.
 */
function countItemInInventory(inventory: InventoryComponent, itemId: number): number {
  let total = 0;
  for (const slot of inventory.slots) {
    if (slot && slot.itemId === itemId) {
      total += slot.quantity;
    }
  }
  return total;
}

/**
 * Deduct a quantity of a specific item from the player's inventory.
 * Assumes the caller has already verified there is enough.
 */
function deductItemFromInventory(
  inventory: InventoryComponent,
  itemId: number,
  amount: number,
): void {
  let remaining = amount;
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
}

// ─── Research Start / Cancel ───

/**
 * Begin researching an item from the player's inventory.
 * Returns true if research successfully started, false otherwise.
 */
export function handleResearchStart(
  world: GameWorld,
  playerId: string,
  entityId: EntityId,
  itemSlot: number,
): boolean {
  // Get the Research component on the table
  const research = world.ecs.getComponent<ResearchComponent>(entityId, ComponentType.Research);
  if (!research) {
    logger.debug({ entityId }, 'handleResearchStart: entity has no Research component');
    return false;
  }

  // Already researching something
  if (research.researchingItemId !== null) {
    logger.debug({ entityId, playerId }, 'handleResearchStart: table is already researching');
    return false;
  }

  // Range check: get player entity position and table position
  const playerEntityId = world.getPlayerEntity(playerId);
  if (playerEntityId === undefined) {
    logger.debug({ playerId }, 'handleResearchStart: no player entity found');
    return false;
  }

  const playerPos = world.ecs.getComponent<PositionComponent>(
    playerEntityId,
    ComponentType.Position,
  );
  const tablePos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
  if (!playerPos || !tablePos) {
    return false;
  }

  if (distSq(playerPos, tablePos) > INTERACT_RANGE * INTERACT_RANGE) {
    logger.debug({ playerId, entityId }, 'handleResearchStart: player too far from research table');
    return false;
  }

  // Get player inventory and the item at the specified slot
  const inventory = world.ecs.getComponent<InventoryComponent>(
    playerEntityId,
    ComponentType.Inventory,
  );
  if (!inventory) {
    return false;
  }

  if (itemSlot < 0 || itemSlot >= inventory.slots.length) {
    logger.debug({ playerId, itemSlot }, 'handleResearchStart: invalid item slot');
    return false;
  }

  const itemStack = inventory.slots[itemSlot];
  if (!itemStack) {
    logger.debug({ playerId, itemSlot }, 'handleResearchStart: empty item slot');
    return false;
  }

  // Find a recipe that produces this item
  const recipeId = findRecipeForItem(itemStack.itemId);
  if (recipeId === null) {
    logger.debug(
      { playerId, itemId: itemStack.itemId },
      'handleResearchStart: no recipe found for item',
    );
    return false;
  }

  // Check if the player already has this blueprint
  if (hasBlueprint(playerId, recipeId)) {
    logger.debug({ playerId, recipeId }, 'handleResearchStart: player already has this blueprint');
    return false;
  }

  // Check the player has enough scrap
  const scrapCount = countItemInInventory(inventory, SCRAP_ITEM_ID);
  if (scrapCount < SCRAP_COST) {
    logger.debug(
      { playerId, scrapCount, required: SCRAP_COST },
      'handleResearchStart: not enough scrap',
    );
    return false;
  }

  // Deduct scrap cost
  deductItemFromInventory(inventory, SCRAP_ITEM_ID, SCRAP_COST);

  // Set research state
  research.researchingItemId = itemStack.itemId;
  research.researchStartTime = Date.now();
  research.researcherId = playerId;

  const itemDef = ITEM_REGISTRY[itemStack.itemId];
  logger.info(
    { playerId, entityId, itemId: itemStack.itemId, itemName: itemDef?.name ?? 'unknown' },
    'Research started',
  );

  return true;
}

/**
 * Cancel an in-progress research. Only the player who started it can cancel.
 * Note: scrap is NOT refunded on cancel (by design).
 */
export function handleResearchCancel(world: GameWorld, playerId: string, entityId: EntityId): void {
  const research = world.ecs.getComponent<ResearchComponent>(entityId, ComponentType.Research);
  if (!research) return;

  // Only the researcher can cancel
  if (research.researcherId !== playerId) return;

  logger.debug({ playerId, entityId }, 'Research cancelled');

  // Reset research state
  research.researchingItemId = null;
  research.researchStartTime = null;
  research.researcherId = null;

  // Clean up progress tracking for this entity
  lastProgressUpdateTime.delete(entityId);
}

// ─── Blueprint System (per-tick) ───

export const blueprintSystem: SystemFn = (world: GameWorld, _dt: number): void => {
  const entities = world.ecs.query(ComponentType.Research);

  const now = Date.now();

  for (const entityId of entities) {
    const research = world.ecs.getComponent<ResearchComponent>(entityId, ComponentType.Research);
    if (!research) continue;

    // Only process entities that are actively researching
    if (
      research.researchingItemId === null ||
      research.researchStartTime === null ||
      research.researcherId === null
    ) {
      continue;
    }

    const elapsed = (now - research.researchStartTime) / 1000; // seconds
    const itemDef = ITEM_REGISTRY[research.researchingItemId];
    const itemName = itemDef?.name ?? 'Unknown Item';

    if (elapsed >= research.researchDuration) {
      // Research complete
      const recipeId = findRecipeForItem(research.researchingItemId);
      if (recipeId !== null) {
        // Add blueprint to player's learned set
        let learned = playerBlueprints.get(research.researcherId);
        if (!learned) {
          learned = new Set();
          playerBlueprints.set(research.researcherId, learned);
        }
        learned.add(recipeId);

        const recipe = RECIPE_REGISTRY[recipeId];
        const recipeName = recipe?.name ?? 'Unknown Recipe';

        // Push completion notification
        blueprintLearnedNotifications.push({
          playerId: research.researcherId,
          recipeId,
          recipeName,
        });

        // Push final progress update (isComplete = true)
        researchProgressUpdates.push({
          playerId: research.researcherId,
          entityId,
          progress: 1.0,
          isComplete: true,
          itemName,
        });

        logger.info(
          { playerId: research.researcherId, recipeId, recipeName, entityId },
          'Blueprint learned via research',
        );
      }

      // Reset research state
      research.researchingItemId = null;
      research.researchStartTime = null;
      research.researcherId = null;

      // Clean up progress tracking
      lastProgressUpdateTime.delete(entityId);
    } else {
      // Research in progress — throttle progress updates to ~1 per second
      const lastUpdate = lastProgressUpdateTime.get(entityId) ?? 0;
      if (now - lastUpdate >= PROGRESS_UPDATE_INTERVAL_MS) {
        lastProgressUpdateTime.set(entityId, now);

        const progress = elapsed / research.researchDuration;
        researchProgressUpdates.push({
          playerId: research.researcherId,
          entityId,
          progress,
          isComplete: false,
          itemName,
        });
      }
    }
  }
};

// ─── Notification Drains ───

/**
 * Drain and return all pending blueprint-learned notifications since the last drain.
 */
export function drainBlueprintLearnedNotifications() {
  return blueprintLearnedNotifications.splice(0);
}

/**
 * Drain and return all pending research progress updates since the last drain.
 */
export function drainResearchProgressUpdates() {
  return researchProgressUpdates.splice(0);
}
