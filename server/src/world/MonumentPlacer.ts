// ─── Monument Placer ───
// Places pre-designed structures (monuments) in the world during initial generation.

import {
  BlockType,
  CHUNK_SIZE_Y,
  SEA_LEVEL,
  WORLD_SIZE,
  getBlockIndex,
  worldToChunk,
  worldToLocal,
} from '@lineremain/shared';
import { logger } from '../utils/logger.js';
import type { ChunkStore } from './ChunkStore.js';
import { MONUMENT_TEMPLATES } from './StructureTemplates.js';
import type { TerrainGenerator } from './TerrainGenerator.js';

// ─── Types ───

export interface MonumentSite {
  x: number;
  z: number;
  monumentType: string;
}

// ─── Constants ───

/** Grid interval for scanning candidate sites (in blocks). */
const SCAN_INTERVAL = 400;

/** Minimum distance between monuments (in blocks). */
const MIN_MONUMENT_DISTANCE = 300;

/** Area to check for flatness (blocks). */
const FLATNESS_CHECK_SIZE = 20;

/** Maximum height variance in the flatness check area for a "good" score. */
const MAX_HEIGHT_VARIANCE = 8;

// ─── MonumentPlacer ───

export class MonumentPlacer {
  /**
   * Find suitable monument sites by scanning the world at grid intervals.
   * Scores positions based on flatness, elevation, and biome suitability.
   * Ensures minimum distance between selected sites.
   *
   * @param chunkStore  The chunk store (chunks will be lazily generated as needed)
   * @param generator   The terrain generator for lazy chunk generation
   * @param count       Desired number of monuments (will return up to this many)
   * @returns Array of selected monument sites
   */
  findSuitableSites(
    chunkStore: ChunkStore,
    generator: TerrainGenerator,
    count: number,
  ): MonumentSite[] {
    const templateKeys = Object.keys(MONUMENT_TEMPLATES);
    const waterTemplateKeys = templateKeys.filter((k) => MONUMENT_TEMPLATES[k]!.requiresWater);
    const landTemplateKeys = templateKeys.filter((k) => !MONUMENT_TEMPLATES[k]!.requiresWater);

    // Scan candidate positions
    interface Candidate {
      x: number;
      z: number;
      score: number;
      nearWater: boolean;
    }

    const candidates: Candidate[] = [];

    // Scan at grid intervals, with some margin from world edges
    const margin = 64;
    for (let x = margin; x < WORLD_SIZE - margin; x += SCAN_INTERVAL) {
      for (let z = margin; z < WORLD_SIZE - margin; z += SCAN_INTERVAL) {
        const result = this.scoreSite(chunkStore, generator, x, z);
        if (result.score > 0) {
          candidates.push({ x, z, score: result.score, nearWater: result.nearWater });
        }
      }
    }

    // Sort by score descending (best sites first)
    candidates.sort((a, b) => b.score - a.score);

    // Greedily select sites with minimum distance constraint
    const selected: MonumentSite[] = [];

    for (const candidate of candidates) {
      if (selected.length >= count) break;

      // Check minimum distance to all already-selected sites
      const tooClose = selected.some((s) => {
        const dx = s.x - candidate.x;
        const dz = s.z - candidate.z;
        return Math.sqrt(dx * dx + dz * dz) < MIN_MONUMENT_DISTANCE;
      });

      if (tooClose) continue;

      // Assign a monument type
      let monumentType: string;
      if (candidate.nearWater && waterTemplateKeys.length > 0) {
        // Prefer water monuments for near-water sites
        monumentType = waterTemplateKeys[selected.length % waterTemplateKeys.length]!;
      } else if (landTemplateKeys.length > 0) {
        monumentType = landTemplateKeys[selected.length % landTemplateKeys.length]!;
      } else {
        monumentType = templateKeys[selected.length % templateKeys.length]!;
      }

      selected.push({ x: candidate.x, z: candidate.z, monumentType });
    }

    return selected;
  }

  /**
   * Score a site for monument placement.
   * Higher score = better site.
   */
  private scoreSite(
    chunkStore: ChunkStore,
    generator: TerrainGenerator,
    centerX: number,
    centerZ: number,
  ): { score: number; nearWater: boolean } {
    const halfSize = Math.floor(FLATNESS_CHECK_SIZE / 2);
    let minHeight = CHUNK_SIZE_Y;
    let maxHeight = 0;
    let totalHeight = 0;
    let sampleCount = 0;
    let waterCount = 0;

    // Sample heights in the check area (every 2 blocks for efficiency)
    for (let dx = -halfSize; dx <= halfSize; dx += 2) {
      for (let dz = -halfSize; dz <= halfSize; dz += 2) {
        const wx = centerX + dx;
        const wz = centerZ + dz;

        // Bounds check
        if (wx < 0 || wx >= WORLD_SIZE || wz < 0 || wz >= WORLD_SIZE) {
          return { score: 0, nearWater: false };
        }

        const height = this.getTerrainHeight(chunkStore, generator, wx, wz);
        if (height < 0) {
          return { score: 0, nearWater: false };
        }

        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
        totalHeight += height;
        sampleCount++;

        // Check for water at surface
        if (height < SEA_LEVEL) {
          waterCount++;
        }
      }
    }

    if (sampleCount === 0) return { score: 0, nearWater: false };

    const avgHeight = totalHeight / sampleCount;
    const heightVariance = maxHeight - minHeight;
    const nearWater = waterCount > 0 && waterCount < sampleCount * 0.5;

    // Score components
    let score = 0;

    // Prefer flat terrain (low variance)
    if (heightVariance <= MAX_HEIGHT_VARIANCE) {
      score += 100 - heightVariance * 10;
    } else {
      // Too hilly — very low score
      score += Math.max(0, 30 - heightVariance * 2);
    }

    // Prefer above sea level
    if (avgHeight >= SEA_LEVEL) {
      score += 50;
    } else if (avgHeight >= SEA_LEVEL - 5) {
      score += 20;
    }

    // Bonus for near-water sites (good for harbor ruin)
    if (nearWater) {
      score += 15;
    }

    // Penalize very low or very high terrain
    if (avgHeight < 10 || avgHeight > CHUNK_SIZE_Y - 15) {
      score -= 30;
    }

    return { score: Math.max(0, score), nearWater };
  }

  /**
   * Get the surface height at a world (x, z) coordinate.
   * Generates the chunk if not loaded.
   * Returns the Y of the highest non-air block, or -1 on failure.
   */
  private getTerrainHeight(
    chunkStore: ChunkStore,
    generator: TerrainGenerator,
    worldX: number,
    worldZ: number,
  ): number {
    const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
    const chunk = chunkStore.getOrGenerate(chunkX, chunkZ, generator);
    const { localX, localZ } = worldToLocal(worldX, 0, worldZ);

    // Scan downward from top to find surface
    for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
      const block = chunk[getBlockIndex(localX, y, localZ)] as BlockType;
      if (block !== BlockType.Air && block !== BlockType.Water) {
        return y;
      }
    }

    return -1;
  }

  /**
   * Place a monument at a site.
   * Flattens terrain in the monument footprint, then places structure blocks.
   */
  placeMonument(chunkStore: ChunkStore, generator: TerrainGenerator, site: MonumentSite): void {
    const template = MONUMENT_TEMPLATES[site.monumentType];
    if (!template) {
      logger.warn({ monumentType: site.monumentType }, 'Unknown monument template');
      return;
    }

    // Calculate base Y from terrain height at site center
    const centerX = site.x + Math.floor(template.sizeX / 2);
    const centerZ = site.z + Math.floor(template.sizeZ / 2);
    let baseY = this.getTerrainHeight(chunkStore, generator, centerX, centerZ);

    if (baseY < 0) baseY = SEA_LEVEL;

    // For water monuments, place at sea level
    if (template.requiresWater) {
      baseY = Math.min(baseY, SEA_LEVEL);
    }

    // Flatten terrain in monument footprint
    this.flattenArea(chunkStore, generator, site.x, site.z, template.sizeX, template.sizeZ, baseY);

    // Place structure blocks
    for (const block of template.blocks) {
      const worldX = site.x + block.localX;
      const worldY = baseY + block.localY;
      const worldZ = site.z + block.localZ;

      if (worldY < 0 || worldY >= CHUNK_SIZE_Y) continue;

      // Ensure chunk is loaded
      const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
      chunkStore.getOrGenerate(chunkX, chunkZ, generator);

      chunkStore.setBlock(worldX, worldY, worldZ, block.blockType);
    }

    // Note: entity spawns are recorded but not placed here — the game's entity
    // system should read monument data and spawn entities at runtime.
    // The spawn positions are stored in the template for later use.
  }

  /**
   * Flatten terrain in a rectangular area to a target height.
   * Sets all columns to the target height by filling with stone below
   * and clearing to air above.
   */
  private flattenArea(
    chunkStore: ChunkStore,
    generator: TerrainGenerator,
    startX: number,
    startZ: number,
    width: number,
    depth: number,
    targetY: number,
  ): void {
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < depth; dz++) {
        const worldX = startX + dx;
        const worldZ = startZ + dz;

        // Ensure chunk is loaded
        const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
        chunkStore.getOrGenerate(chunkX, chunkZ, generator);

        // Fill below targetY with stone, clear above with air
        for (let y = 1; y < CHUNK_SIZE_Y; y++) {
          if (y <= targetY) {
            const currentBlock = chunkStore.getBlock(worldX, y, worldZ);
            if (currentBlock === BlockType.Air || currentBlock === BlockType.Water) {
              chunkStore.setBlock(worldX, y, worldZ, BlockType.Stone);
            }
          } else {
            const currentBlock = chunkStore.getBlock(worldX, y, worldZ);
            if (currentBlock !== BlockType.Air) {
              chunkStore.setBlock(worldX, y, worldZ, BlockType.Air);
            }
          }
        }
      }
    }
  }

  /**
   * Find and place all monuments in the world.
   * Finds 8-12 suitable sites and places a monument at each.
   * Then performs a second pass to scatter additional abandoned camps.
   */
  placeAllMonuments(chunkStore: ChunkStore, generator: TerrainGenerator): MonumentSite[] {
    const targetCount = 8 + Math.floor(Math.random() * 5); // 8-12 monuments
    const sites = this.findSuitableSites(chunkStore, generator, targetCount);

    for (const site of sites) {
      const template = MONUMENT_TEMPLATES[site.monumentType];
      this.placeMonument(chunkStore, generator, site);
      logger.info(
        {
          monument: template?.name ?? site.monumentType,
          x: site.x,
          z: site.z,
        },
        'Placed monument',
      );
    }

    // ── Second pass: scatter additional abandoned camps ──
    // Uses smaller scan interval and minimum distance for denser camp coverage.
    const campScanInterval = 200;
    const campMinDistance = 150;
    const maxCamps = 6;
    const margin = 64;

    interface CampCandidate {
      x: number;
      z: number;
      score: number;
    }

    const campCandidates: CampCandidate[] = [];

    for (let x = margin; x < WORLD_SIZE - margin; x += campScanInterval) {
      for (let z = margin; z < WORLD_SIZE - margin; z += campScanInterval) {
        const result = this.scoreSite(chunkStore, generator, x, z);
        if (result.score > 0) {
          campCandidates.push({ x, z, score: result.score });
        }
      }
    }

    campCandidates.sort((a, b) => b.score - a.score);

    const campSites: MonumentSite[] = [];

    for (const candidate of campCandidates) {
      if (campSites.length >= maxCamps) break;

      // Check minimum distance to all existing monuments and other camps
      const tooCloseToMonument = sites.some((s) => {
        const dx = s.x - candidate.x;
        const dz = s.z - candidate.z;
        return Math.sqrt(dx * dx + dz * dz) < campMinDistance;
      });

      const tooCloseToCamp = campSites.some((s) => {
        const dx = s.x - candidate.x;
        const dz = s.z - candidate.z;
        return Math.sqrt(dx * dx + dz * dz) < campMinDistance;
      });

      if (tooCloseToMonument || tooCloseToCamp) continue;

      const campSite: MonumentSite = {
        x: candidate.x,
        z: candidate.z,
        monumentType: 'abandoned_camp',
      };
      this.placeMonument(chunkStore, generator, campSite);
      campSites.push(campSite);
      sites.push(campSite);

      logger.info(
        {
          monument: 'Abandoned Camp',
          x: candidate.x,
          z: candidate.z,
        },
        'Placed abandoned camp',
      );
    }

    logger.info({ count: sites.length, camps: campSites.length }, 'Monument placement complete');
    return sites;
  }
}
