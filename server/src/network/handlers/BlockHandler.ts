// ─── Block Network Handler ───
// Socket event handlers for block breaking and placing.
// All requests are validated server-side: distance checks, block validity,
// rate limiting, and state consistency before mutating the chunk store.

import {
  BLOCK_REGISTRY,
  BlockType,
  ClientMessage,
  ComponentType,
  ITEM_REGISTRY,
  ServerMessage,
  worldToChunk,
  worldToLocal,
  type BlockBreakPayload,
  type BlockPlacePayload,
  type ChunkUpdatePayload,
  type EquipmentComponent,
  type ItemStack,
  type PositionComponent,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';
import { trackBlockPlace, trackGather } from '../../game/systems/AchievementSystem.js';
import { RateLimiter } from '../RateLimiter.js';

// ─── Constants ───

/** Maximum distance (in blocks) a player can interact with */
const MAX_INTERACT_DISTANCE = 7;

/** Rate limiter for block actions: 10 per second */
const blockRateLimiter = new RateLimiter(10, 1000);

// ─── Validation Helpers ───

function isValidBlockBreakPayload(payload: unknown): payload is BlockBreakPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    Number.isInteger(p.x) &&
    typeof p.y === 'number' &&
    Number.isInteger(p.y) &&
    typeof p.z === 'number' &&
    Number.isInteger(p.z)
  );
}

function isValidBlockPlacePayload(payload: unknown): payload is BlockPlacePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    Number.isInteger(p.x) &&
    typeof p.y === 'number' &&
    Number.isInteger(p.y) &&
    typeof p.z === 'number' &&
    Number.isInteger(p.z) &&
    typeof p.blockType === 'number' &&
    Number.isInteger(p.blockType)
  );
}

function getDistanceSq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// ─── Broadcast Helper ───

function broadcastChunkUpdate(
  io: Server,
  worldX: number,
  worldY: number,
  worldZ: number,
  blockType: number,
): void {
  const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
  const { localX, localY, localZ } = worldToLocal(worldX, worldY, worldZ);

  const update: ChunkUpdatePayload = {
    chunkX,
    chunkZ,
    updates: [{ localX, localY, localZ, blockType }],
  };

  io.emit(ServerMessage.ChunkUpdate, update);
}

// ─── Register Block Handlers ───

export function registerBlockHandlers(
  io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  // ─── Block Break ───
  socket.on(ClientMessage.BlockBreak, (payload: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    // Rate limit
    if (!blockRateLimiter.check(playerId, 'block')) return;

    // Validate payload
    if (!isValidBlockBreakPayload(payload)) {
      logger.warn({ socketId: socket.id }, 'Invalid block break payload');
      return;
    }

    const { x, y, z } = payload;

    // Get player entity and position
    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) return;

    const position = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!position) return;

    // Distance check
    const distSq = getDistanceSq(position, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (distSq > MAX_INTERACT_DISTANCE * MAX_INTERACT_DISTANCE) {
      logger.debug({ playerId, x, y, z, distSq }, 'Block break rejected: too far');
      return;
    }

    // Get the current block
    const currentBlock = world.chunkStore.getBlock(x, y, z);
    if (currentBlock === null) return; // Chunk not loaded

    // Cannot break Air or Bedrock
    if (currentBlock === BlockType.Air || currentBlock === BlockType.Bedrock) {
      return;
    }

    // Set the block to Air
    const success = world.chunkStore.setBlock(x, y, z, BlockType.Air);
    if (!success) return;

    // Track block break for achievements
    trackGather(playerId);

    // Drop items based on block registry
    const blockDef = BLOCK_REGISTRY[currentBlock];
    if (blockDef && blockDef.dropItemId !== undefined && blockDef.dropQuantity !== undefined) {
      const dropItemDef = ITEM_REGISTRY[blockDef.dropItemId];
      if (dropItemDef) {
        const itemStack: ItemStack = {
          itemId: blockDef.dropItemId,
          quantity: blockDef.dropQuantity,
        };

        world.createItemDropEntity(itemStack, {
          x: x + 0.5,
          y: y + 0.5,
          z: z + 0.5,
        });
      }
    }

    // Broadcast chunk update to all clients
    broadcastChunkUpdate(io, x, y, z, BlockType.Air);

    // Reduce held tool durability
    const equipment = world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment);
    if (equipment?.held && equipment.held.durability !== undefined) {
      equipment.held.durability -= 1;
      if (equipment.held.durability <= 0) {
        equipment.held = null;
      }
    }

    logger.debug({ playerId, x, y, z, blockType: currentBlock }, 'Block broken');
  });

  // ─── Block Place ───
  socket.on(ClientMessage.BlockPlace, (payload: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    // Rate limit
    if (!blockRateLimiter.check(playerId, 'block')) return;

    // Validate payload
    if (!isValidBlockPlacePayload(payload)) {
      logger.warn({ socketId: socket.id }, 'Invalid block place payload');
      return;
    }

    const { x, y, z, blockType } = payload;

    // Get player entity and position
    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) return;

    const position = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!position) return;

    // Distance check
    const distSq = getDistanceSq(position, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (distSq > MAX_INTERACT_DISTANCE * MAX_INTERACT_DISTANCE) {
      logger.debug({ playerId, x, y, z, distSq }, 'Block place rejected: too far');
      return;
    }

    // Check that the target position is currently Air
    const currentBlock = world.chunkStore.getBlock(x, y, z);
    if (currentBlock === null) return; // Chunk not loaded
    if (currentBlock !== BlockType.Air) {
      return;
    }

    // Validate the block type being placed
    if (blockType === BlockType.Air || blockType === BlockType.Bedrock) {
      return;
    }

    const blockDef = BLOCK_REGISTRY[blockType];
    if (!blockDef) {
      logger.warn({ socketId: socket.id, blockType }, 'Block place rejected: unknown block type');
      return;
    }

    // Set the block
    const success = world.chunkStore.setBlock(x, y, z, blockType);
    if (!success) return;

    // Track block place for achievements
    trackBlockPlace(playerId);

    // Broadcast chunk update to all clients
    broadcastChunkUpdate(io, x, y, z, blockType);

    logger.debug({ playerId, x, y, z, blockType }, 'Block placed');
  });

  logger.debug({ socketId: socket.id }, 'Block handlers registered');
}
