// ─── Chunk Request Handler ───
// Socket event handler for client chunk data requests.
// Validates coordinates, rate limits, and sends compressed chunk data.

import type { Server, Socket } from 'socket.io';
import type { GameWorld } from '../../game/World.js';
import {
  ClientMessage,
  ServerMessage,
  WORLD_SIZE_CHUNKS,
  type ChunkRequestPayload,
  type ChunkDataPayload,
} from '@lineremain/shared';
import { chunkRequestRateLimiter } from '../RateLimiter.js';
import { logger } from '../../utils/logger.js';

// ─── Validation ───

function isValidChunkRequest(payload: unknown): payload is ChunkRequestPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.chunkX === 'number' && Number.isInteger(p.chunkX) &&
    typeof p.chunkZ === 'number' && Number.isInteger(p.chunkZ) &&
    p.chunkX >= 0 && p.chunkX < WORLD_SIZE_CHUNKS &&
    p.chunkZ >= 0 && p.chunkZ < WORLD_SIZE_CHUNKS
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

    // Rate limit
    if (!chunkRequestRateLimiter.check(playerId, 'chunk')) return;

    // Validate
    if (!isValidChunkRequest(payload)) return;

    const { chunkX, chunkZ } = payload;

    // Get or lazily generate the chunk
    const chunkData = world.chunkStore.getOrGenerate(chunkX, chunkZ, world.terrainGenerator);

    // The chunk data is already a flat Uint8Array indexed by getBlockIndex(x, y, z)
    // Convert to number[] for JSON serialization
    const blocks: number[] = Array.from(chunkData);

    const response: ChunkDataPayload = {
      chunkX,
      chunkZ,
      blocks,
    };

    socket.emit(ServerMessage.ChunkData, response);
  });

  logger.debug({ socketId: socket.id }, 'Chunk request handlers registered');
}