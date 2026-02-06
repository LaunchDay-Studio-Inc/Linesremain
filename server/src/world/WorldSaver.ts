// ─── World Saver ───
// Handles world persistence: auto-save dirty chunks, player states, and buildings
// to the database, and loading the world back from DB on startup.

import { logger } from '../utils/logger.js';
import { worldRepository } from '../database/repositories/WorldRepository.js';
import { playerRepository } from '../database/repositories/PlayerRepository.js';
import { buildingRepository } from '../database/repositories/BuildingRepository.js';
import { ChunkStore } from './ChunkStore.js';
import type { NewPlayerState } from '../database/schema.js';
import type { NewBuilding } from '../database/schema.js';

// ─── Types ───

export interface PlayerStateData {
  playerId: string;
  state: Omit<NewPlayerState, 'playerId'>;
}

// ─── WorldSaver ───

export class WorldSaver {
  /**
   * Auto-save: persist all dirty chunks, player states, and buildings to the database.
   *
   * @param chunkStore    The chunk store containing in-memory chunk data
   * @param playerStates  Array of player states to persist
   * @param buildings     Array of buildings to persist
   */
  async autoSave(
    chunkStore: ChunkStore,
    playerStates: PlayerStateData[],
    buildings: NewBuilding[],
  ): Promise<void> {
    const startTime = Date.now();

    // ── Save dirty chunks (batched in parallel) ──
    const dirtyChunks = chunkStore.getDirtyChunks();
    const chunkPromises = dirtyChunks.map(({ chunkX, chunkZ, data }) => {
      const compressed = ChunkStore.compress(data);
      return worldRepository.saveChunk(chunkX, chunkZ, Buffer.from(compressed));
    });
    await Promise.all(chunkPromises);
    const chunkCount = chunkPromises.length;

    chunkStore.clearDirty();

    // ── Save player states (batched in parallel) ──
    const playerResults = await Promise.allSettled(
      playerStates.map(({ playerId, state }) =>
        playerRepository.savePlayerState(playerId, state).then(() => playerId),
      ),
    );
    let playerCount = 0;
    for (const result of playerResults) {
      if (result.status === 'fulfilled') {
        playerCount++;
      } else {
        logger.error({ err: result.reason }, 'Failed to save player state');
      }
    }

    // ── Save buildings ──
    let buildingCount = 0;
    if (buildings.length > 0) {
      try {
        await buildingRepository.saveBuildingBatch(buildings);
        buildingCount = buildings.length;
      } catch (err) {
        logger.error({ err }, 'Failed to save buildings batch');
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(
      {
        chunks: chunkCount,
        players: playerCount,
        buildings: buildingCount,
        ms: elapsed,
      },
      `World saved: ${chunkCount} chunks, ${playerCount} players, ${buildingCount} buildings in ${elapsed}ms`,
    );
  }

  /**
   * Load the entire world from the database into the ChunkStore.
   *
   * @param chunkStore  The chunk store to populate
   * @returns Object with counts of loaded chunks and buildings
   */
  async loadWorld(chunkStore: ChunkStore): Promise<{
    chunkCount: number;
    buildingCount: number;
  }> {
    // ── Load all chunks ──
    const dbChunks = await worldRepository.loadAllChunks();
    let chunkCount = 0;

    for (const dbChunk of dbChunks) {
      try {
        const decompressed = ChunkStore.decompress(new Uint8Array(dbChunk.blockData));
        chunkStore.setChunk(dbChunk.chunkX, dbChunk.chunkZ, decompressed);
        chunkCount++;
      } catch (err) {
        logger.error(
          { chunkX: dbChunk.chunkX, chunkZ: dbChunk.chunkZ, err },
          'Failed to decompress chunk',
        );
      }
    }

    // ── Load all buildings ──
    const dbBuildings = await buildingRepository.loadAllBuildings();
    const buildingCount = dbBuildings.length;

    logger.info(
      { chunks: chunkCount, buildings: buildingCount },
      `World loaded: ${chunkCount} chunks, ${buildingCount} buildings`,
    );

    return { chunkCount, buildingCount };
  }
}

// ─── Auto-Save Timer ───

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start an auto-save interval.
 *
 * @param intervalMs    Save interval in milliseconds
 * @param worldSaver    The WorldSaver instance
 * @param chunkStore    The chunk store
 * @param getPlayers    Callback to get current player states
 * @param getBuildings  Callback to get current buildings
 * @returns A function to stop the auto-save timer
 */
export function startAutoSave(
  intervalMs: number,
  worldSaver: WorldSaver,
  chunkStore: ChunkStore,
  getPlayers: () => PlayerStateData[],
  getBuildings: () => NewBuilding[],
): () => void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }

  autoSaveTimer = setInterval(() => {
    worldSaver
      .autoSave(chunkStore, getPlayers(), getBuildings())
      .catch((err) => {
        logger.error({ err }, 'Auto-save failed');
      });
  }, intervalMs);

  logger.info({ intervalMs }, 'Auto-save started');

  return () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
      logger.info('Auto-save stopped');
    }
  };
}