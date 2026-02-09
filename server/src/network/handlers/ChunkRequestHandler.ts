// ─── Chunk Request Handler ───
// Socket event handler for client chunk data requests.
// Routes to island chunk store or main world chunk store based on player world.

import {
  BLOCKS_PER_CHUNK,
  ClientMessage,
  ISLAND_WORLD,
  ServerMessage,
  WORLD_SIZE_CHUNKS,
  type ChunkDataPayload,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';
import { chunkRequestRateLimiter } from '../RateLimiter.js';

// ─── Validation ───

function isValidChunkCoords(payload: unknown): payload is { chunkX: number; chunkZ: number } {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.chunkX === 'number' &&
    Number.isInteger(p.chunkX) &&
    typeof p.chunkZ === 'number' &&
    Number.isInteger(p.chunkZ)
  );
}

function isInMainWorldBounds(cx: number, cz: number): boolean {
  return cx >= 0 && cx < WORLD_SIZE_CHUNKS && cz >= 0 && cz < WORLD_SIZE_CHUNKS;
}

function isInIslandBounds(cx: number, cz: number): boolean {
  return (
    cx >= ISLAND_WORLD.minCX &&
    cx <= ISLAND_WORLD.maxCX &&
    cz >= ISLAND_WORLD.minCZ &&
    cz <= ISLAND_WORLD.maxCZ
  );
}

// ─── Register Chunk Request Handlers ───

export function registerChunkRequestHandlers(
  _io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  socket.on(ClientMessage.ChunkRequest, (payload: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    if (!chunkRequestRateLimiter.check(playerId, 'chunk')) return;

    if (!isValidChunkCoords(payload)) return;

    const { chunkX, chunkZ } = payload;

    // Determine which world the player is in
    const playerWorld = world.playerWorldMap.get(playerId) ?? 'islands';

    let chunkData: Uint8Array;

    if (playerWorld === 'islands') {
      if (!isInIslandBounds(chunkX, chunkZ)) {
        // Out of island bounds — send empty chunk
        chunkData = new Uint8Array(BLOCKS_PER_CHUNK);
      } else {
        const islandData = world.islandChunkStore.getChunk(chunkX, chunkZ);
        chunkData = islandData ?? new Uint8Array(BLOCKS_PER_CHUNK);
      }
    } else {
      if (!isInMainWorldBounds(chunkX, chunkZ)) return;
      chunkData = world.chunkStore.getOrGenerate(chunkX, chunkZ, world.terrainGenerator);
    }

    const blocks: number[] = Array.from(chunkData);

    const response: ChunkDataPayload = { chunkX, chunkZ, blocks };
    socket.emit(ServerMessage.ChunkData, response);
  });

  logger.debug({ socketId: socket.id }, 'Chunk request handlers registered');
}
