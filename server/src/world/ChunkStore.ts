// ─── Chunk Store ───

import pako from 'pako';
import {
  CHUNK_SIZE_Y,
  getBlockIndex,
  worldToChunk,
  worldToLocal,
} from '@lineremain/shared';
import { BlockType } from '@lineremain/shared';
import type { TerrainGenerator } from './TerrainGenerator.js';

/**
 * In-memory chunk storage with lazy generation, block access, and
 * compression helpers for persistence/network transfer.
 */
export class ChunkStore {
  private chunks = new Map<string, Uint8Array>();
  private dirty = new Set<string>();

  // ── Key helpers ──

  private static key(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  // ── Chunk Access ──

  /**
   * Get a chunk from the store, or null if not loaded.
   */
  getChunk(chunkX: number, chunkZ: number): Uint8Array | null {
    return this.chunks.get(ChunkStore.key(chunkX, chunkZ)) ?? null;
  }

  /**
   * Store chunk data.
   */
  setChunk(chunkX: number, chunkZ: number, data: Uint8Array): void {
    this.chunks.set(ChunkStore.key(chunkX, chunkZ), data);
  }

  /**
   * Get a chunk from memory, or lazily generate it using the terrain generator.
   */
  getOrGenerate(chunkX: number, chunkZ: number, generator: TerrainGenerator): Uint8Array {
    const key = ChunkStore.key(chunkX, chunkZ);
    let data = this.chunks.get(key);
    if (!data) {
      data = generator.generateChunk(chunkX, chunkZ);
      this.chunks.set(key, data);
    }
    return data;
  }

  // ── Block Access ──

  /**
   * Get the block type at a world coordinate.
   * Returns null if the chunk is not loaded.
   */
  getBlock(worldX: number, worldY: number, worldZ: number): BlockType | null {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return null;

    const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk) return null;

    const { localX, localY, localZ } = worldToLocal(worldX, worldY, worldZ);
    return chunk[getBlockIndex(localX, localY, localZ)] as BlockType;
  }

  /**
   * Set the block type at a world coordinate.
   * Marks the owning chunk as dirty.
   * Returns false if the chunk is not loaded.
   */
  setBlock(worldX: number, worldY: number, worldZ: number, blockType: BlockType): boolean {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return false;

    const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
    const key = ChunkStore.key(chunkX, chunkZ);
    const chunk = this.chunks.get(key);
    if (!chunk) return false;

    const { localX, localY, localZ } = worldToLocal(worldX, worldY, worldZ);
    chunk[getBlockIndex(localX, localY, localZ)] = blockType;
    this.dirty.add(key);
    return true;
  }

  // ── Dirty Tracking ──

  /**
   * Returns a list of chunk keys that have been modified since the last clearDirty().
   */
  getDirtyChunks(): Array<{ chunkX: number; chunkZ: number; data: Uint8Array }> {
    const result: Array<{ chunkX: number; chunkZ: number; data: Uint8Array }> = [];
    for (const key of this.dirty) {
      const [cx, cz] = key.split(',').map(Number) as [number, number];
      const data = this.chunks.get(key);
      if (data) {
        result.push({ chunkX: cx, chunkZ: cz, data });
      }
    }
    return result;
  }

  /**
   * Clear all dirty flags (call after saving).
   */
  clearDirty(): void {
    this.dirty.clear();
  }

  // ── Compression (pako) ──

  /**
   * Compress chunk data using pako deflate for storage / network transfer.
   */
  static compress(data: Uint8Array): Uint8Array {
    return pako.deflate(data);
  }

  /**
   * Decompress chunk data from pako deflate.
   */
  static decompress(compressed: Uint8Array): Uint8Array {
    return pako.inflate(compressed);
  }

  // ── Stats ──

  /**
   * Number of chunks currently loaded in memory.
   */
  get loadedCount(): number {
    return this.chunks.size;
  }

  /**
   * Check if a chunk is loaded.
   */
  isLoaded(chunkX: number, chunkZ: number): boolean {
    return this.chunks.has(ChunkStore.key(chunkX, chunkZ));
  }

  /**
   * Unload a chunk from memory (e.g. when no players are nearby).
   */
  unload(chunkX: number, chunkZ: number): void {
    const key = ChunkStore.key(chunkX, chunkZ);
    this.chunks.delete(key);
    this.dirty.delete(key);
  }
}