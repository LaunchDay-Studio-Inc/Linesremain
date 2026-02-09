// ─── Island Chunk Store ───
// Pre-generates all island world chunks at startup.
// Immutable after construction — no lazy generation, no dirty tracking.

import { ISLAND_WORLD, IslandTerrainGenerator } from '@lineremain/shared';

export class IslandChunkStore {
  private chunks = new Map<string, Uint8Array>();
  private generator: IslandTerrainGenerator;

  private static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  constructor(seed: number = 12345) {
    this.generator = new IslandTerrainGenerator(seed);

    const { minCX, minCZ, maxCX, maxCZ } = ISLAND_WORLD;
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const data = this.generator.generateChunk(cx, cz);
        this.chunks.set(IslandChunkStore.key(cx, cz), data);
      }
    }
  }

  getChunk(cx: number, cz: number): Uint8Array | null {
    return this.chunks.get(IslandChunkStore.key(cx, cz)) ?? null;
  }

  getBlock(worldX: number, worldY: number, worldZ: number): number {
    const cx = Math.floor(worldX / 32);
    const cz = Math.floor(worldZ / 32);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0;
    const lx = ((Math.floor(worldX) % 32) + 32) % 32;
    const ly = Math.floor(worldY);
    const lz = ((Math.floor(worldZ) % 32) + 32) % 32;
    if (ly < 0 || ly >= 64) return 0;
    return chunk[lx + lz * 32 + ly * 32 * 32] ?? 0;
  }

  isInBounds(cx: number, cz: number): boolean {
    return (
      cx >= ISLAND_WORLD.minCX &&
      cx <= ISLAND_WORLD.maxCX &&
      cz >= ISLAND_WORLD.minCZ &&
      cz <= ISLAND_WORLD.maxCZ
    );
  }

  getGenerator(): IslandTerrainGenerator {
    return this.generator;
  }

  get loadedCount(): number {
    return this.chunks.size;
  }
}
