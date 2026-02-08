// ─── Terrain Generator ───

import {
  BLOCKS_PER_CHUNK,
  BiomeType,
  BlockType,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  SEA_LEVEL,
  getBlockIndex,
} from '@lineremain/shared';
import { SeededNoise } from '../utils/noise.js';
import { BiomeManager } from './BiomeManager.js';

export class TerrainGenerator {
  private continentNoise: SeededNoise;
  private elevationNoise: SeededNoise;
  private detailNoise: SeededNoise;
  private caveNoise: SeededNoise;
  private oreNoise: SeededNoise;
  private treeNoise: SeededNoise;
  private decoNoise: SeededNoise;
  private _biomeManager: BiomeManager;

  /** Public accessor for biome lookups from other systems */
  get biomeManager(): BiomeManager {
    return this._biomeManager;
  }

  constructor(seed: number) {
    this.continentNoise = new SeededNoise(seed);
    this.elevationNoise = new SeededNoise(seed + 1);
    this.detailNoise = new SeededNoise(seed + 2);
    this.caveNoise = new SeededNoise(seed + 3);
    this.oreNoise = new SeededNoise(seed + 4);
    this.treeNoise = new SeededNoise(seed + 5);
    this.decoNoise = new SeededNoise(seed + 6);
    this._biomeManager = new BiomeManager(seed);
  }

  /**
   * Generate a complete chunk at the given chunk coordinates.
   * Returns a Uint8Array of size BLOCKS_PER_CHUNK (32 × 64 × 32).
   */
  generateChunk(chunkX: number, chunkZ: number): Uint8Array {
    const blocks = new Uint8Array(BLOCKS_PER_CHUNK);
    const heightMap = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
    const biomeMap = new Array<BiomeType>(CHUNK_SIZE_X * CHUNK_SIZE_Z);

    // ── Pass 1: Generate base terrain ──
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = chunkX * CHUNK_SIZE_X + lx;
        const worldZ = chunkZ * CHUNK_SIZE_Z + lz;

        // Get biome for this column and cache it
        const biome = this.biomeManager.getBiome(worldX, worldZ);
        biomeMap[lx + lz * CHUNK_SIZE_X] = biome;
        const biomeProps = this.biomeManager.getBiomeProperties(biome);

        // Height calculation with biome-specific scaling
        const continental = this.continentNoise.noise2D(worldX, worldZ, 0.0005, 1) * 15 + 35; // range ~20-50
        const elevation = this.elevationNoise.octaveNoise2D(worldX, worldZ, 0.003, 15, 4); // range ~-15 to +15
        const detail = this.detailNoise.octaveNoise2D(worldX, worldZ, 0.02, 1.5, 2); // range ~-1.5 to +1.5

        const scaledElevation = elevation * biomeProps.heightModifier;
        let finalHeight = Math.floor(continental + scaledElevation + detail);
        finalHeight = Math.max(1, Math.min(finalHeight, CHUNK_SIZE_Y - 2));

        heightMap[lx + lz * CHUNK_SIZE_X] = finalHeight;

        // ── Fill column ──
        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const idx = getBlockIndex(lx, y, lz);

          if (y === 0) {
            // Bedrock layer
            blocks[idx] = BlockType.Bedrock;
          } else if (y < finalHeight - 4) {
            // Deep stone layer — check for caves and ores
            const caveVal = this.caveNoise.noise3D(worldX, y, worldZ, 0.05, 1);
            if (caveVal > 0.6 && y > 5) {
              blocks[idx] = BlockType.Air; // cave
            } else {
              // Ore placement
              blocks[idx] = this.getOreOrStone(worldX, y, worldZ, biome);
            }
          } else if (y < finalHeight) {
            // Subsurface layer (4 blocks thick)
            blocks[idx] = biomeProps.subsurfaceBlock;
          } else if (y === finalHeight) {
            // Surface block
            if (finalHeight < SEA_LEVEL) {
              // Underwater surfaces are sand/gravel
              blocks[idx] =
                biome === BiomeType.GlacialExpanse || biome === BiomeType.FrostveilPeaks
                  ? BlockType.Gravel
                  : BlockType.Sand;
            } else {
              blocks[idx] = biomeProps.surfaceBlock;
            }
          } else if (y <= SEA_LEVEL && finalHeight < SEA_LEVEL) {
            // Water fill
            blocks[idx] = BlockType.Water;
          } else {
            // Air above surface
            blocks[idx] = BlockType.Air;
          }
        }
      }
    }

    // ── Pass 2: Trees (reuse biomeMap from Pass 1) ──
    this.generateTrees(chunkX, chunkZ, blocks, heightMap, biomeMap);

    // ── Pass 3: Decorations (reuse biomeMap from Pass 1) ──
    this.generateDecorations(chunkX, chunkZ, blocks, heightMap, biomeMap);

    return blocks;
  }

  // ─── Ore Placement ───

  private getOreOrStone(worldX: number, y: number, worldZ: number, biome: BiomeType): BlockType {
    const multipliers = this.biomeManager.getBiomeProperties(biome).resourceMultipliers;

    // HQM ore: Y < 20, base ~1% of stone, scaled by biome multiplier
    if (y < 20) {
      const threshold = 1 - (1 - 0.85) * multipliers.hqm;
      const hqmVal = this.oreNoise.noise3D(worldX, y, worldZ, 0.15, 1);
      if (hqmVal > threshold) return BlockType.HQMOre;
    }

    // Sulfur ore: Y < 30, base ~3% of stone, scaled by biome multiplier
    if (y < 30) {
      const threshold = 1 - (1 - 0.80) * multipliers.sulfur;
      const sulfurVal = this.oreNoise.noise3D(worldX + 1000, y, worldZ, 0.12, 1);
      if (sulfurVal > threshold) return BlockType.SulfurOre;
    }

    // Metal ore: Y < 40, base ~5% of stone, scaled by biome multiplier
    if (y < 40) {
      const threshold = 1 - (1 - 0.75) * multipliers.metal;
      const metalVal = this.oreNoise.noise3D(worldX + 2000, y, worldZ, 0.1, 1);
      if (metalVal > threshold) return BlockType.MetalOre;
    }

    return BlockType.Stone;
  }

  // ─── Tree Generation ───

  private generateTrees(
    chunkX: number,
    chunkZ: number,
    blocks: Uint8Array,
    heightMap: Uint8Array,
    biomeMap: BiomeType[],
  ): void {
    for (let lx = 2; lx < CHUNK_SIZE_X - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE_Z - 2; lz++) {
        const worldX = chunkX * CHUNK_SIZE_X + lx;
        const worldZ = chunkZ * CHUNK_SIZE_Z + lz;

        const surfaceY = heightMap[lx + lz * CHUNK_SIZE_X]!;

        // Skip underwater or too high
        if (surfaceY <= SEA_LEVEL - 1 || surfaceY >= CHUNK_SIZE_Y - 10) continue;

        // Get biome tree density (cached from Pass 1)
        const biome = biomeMap[lx + lz * CHUNK_SIZE_X]!;
        const biomeProps = this.biomeManager.getBiomeProperties(biome);

        if (biomeProps.treeFrequency <= 0 || biomeProps.treeStyle === 'none') continue;

        // Check surface block — don't place trees on sand, ice, or water (allow snow for pines)
        const surfaceBlock = blocks[getBlockIndex(lx, surfaceY, lz)];
        if (
          surfaceBlock === BlockType.Sand ||
          surfaceBlock === BlockType.Ice ||
          surfaceBlock === BlockType.Water
        )
          continue;

        // Noise-based tree placement threshold
        const treeVal = (this.treeNoise.noise2D(worldX, worldZ, 0.4, 1) + 1) / 2;
        const threshold = 1 - biomeProps.treeFrequency * 0.15; // higher density = lower threshold

        if (treeVal < threshold) continue;

        // Dispatch to biome-specific tree shape
        const treeVariation = (this.treeNoise.noise2D(worldX, worldZ, 1.7, 1) + 1) / 2;
        this.buildTree(blocks, lx, surfaceY, lz, biomeProps.treeStyle, treeVariation);
      }
    }
  }

  private buildTree(
    blocks: Uint8Array,
    lx: number,
    surfaceY: number,
    lz: number,
    style: string,
    variation: number,
  ): void {
    switch (style) {
      case 'pine':
        this.buildPineTree(blocks, lx, surfaceY, lz, variation);
        break;
      case 'acacia':
        this.buildAcaciaTree(blocks, lx, surfaceY, lz, variation);
        break;
      case 'willow':
        this.buildWillowTree(blocks, lx, surfaceY, lz, variation);
        break;
      default:
        this.buildOakTree(blocks, lx, surfaceY, lz, variation);
        break;
    }
  }

  private setLeaf(blocks: Uint8Array, x: number, y: number, z: number): void {
    if (x < 0 || x >= CHUNK_SIZE_X || z < 0 || z >= CHUNK_SIZE_Z || y < 0 || y >= CHUNK_SIZE_Y)
      return;
    const idx = getBlockIndex(x, y, z);
    if (blocks[idx] === BlockType.Air) {
      blocks[idx] = BlockType.Leaves;
    }
  }

  // Oak: sphere canopy, trunk 5-7
  private buildOakTree(
    blocks: Uint8Array,
    lx: number,
    surfaceY: number,
    lz: number,
    variation: number,
  ): void {
    const trunkHeight = 5 + Math.floor(variation * 3);
    const leafRadius = 2;

    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = surfaceY + ty;
      if (y >= CHUNK_SIZE_Y) break;
      blocks[getBlockIndex(lx, y, lz)] = BlockType.Log;
    }

    const leafCenterY = surfaceY + trunkHeight;
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
      for (let dy = -1; dy <= leafRadius; dy++) {
        for (let dz = -leafRadius; dz <= leafRadius; dz++) {
          const dist = dx * dx + dy * dy + dz * dz;
          if (dist > leafRadius * leafRadius + 1) continue;
          this.setLeaf(blocks, lx + dx, leafCenterY + dy, lz + dz);
        }
      }
    }
  }

  // Pine: conical canopy, trunk 7-9, tapering leaf layers
  private buildPineTree(
    blocks: Uint8Array,
    lx: number,
    surfaceY: number,
    lz: number,
    variation: number,
  ): void {
    const trunkHeight = 7 + Math.floor(variation * 3);

    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = surfaceY + ty;
      if (y >= CHUNK_SIZE_Y) break;
      blocks[getBlockIndex(lx, y, lz)] = BlockType.Log;
    }

    // Conical canopy: 4 layers of decreasing radius
    const layers = [
      { yOffset: -1, radius: 3 },
      { yOffset: 0, radius: 2 },
      { yOffset: 1, radius: 2 },
      { yOffset: 2, radius: 1 },
    ];

    const canopyBase = surfaceY + trunkHeight;
    for (const layer of layers) {
      const ly = canopyBase + layer.yOffset;
      for (let dx = -layer.radius; dx <= layer.radius; dx++) {
        for (let dz = -layer.radius; dz <= layer.radius; dz++) {
          if (Math.abs(dx) === layer.radius && Math.abs(dz) === layer.radius) continue; // skip corners
          this.setLeaf(blocks, lx + dx, ly, lz + dz);
        }
      }
    }
    // Tip
    this.setLeaf(blocks, lx, canopyBase + 3, lz);
  }

  // Acacia: flat-top canopy, tall thin trunk 7-9
  private buildAcaciaTree(
    blocks: Uint8Array,
    lx: number,
    surfaceY: number,
    lz: number,
    variation: number,
  ): void {
    const trunkHeight = 7 + Math.floor(variation * 3);

    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = surfaceY + ty;
      if (y >= CHUNK_SIZE_Y) break;
      blocks[getBlockIndex(lx, y, lz)] = BlockType.Log;
    }

    // Flat disc canopy at top (radius 3, 2 blocks thick)
    const canopyY = surfaceY + trunkHeight;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          // Circular shape
          if (dx * dx + dz * dz > 10) continue;
          this.setLeaf(blocks, lx + dx, canopyY + dy, lz + dz);
        }
      }
    }
  }

  // Willow: short wide canopy, trunk 3-5, hanging leaf columns
  private buildWillowTree(
    blocks: Uint8Array,
    lx: number,
    surfaceY: number,
    lz: number,
    variation: number,
  ): void {
    const trunkHeight = 3 + Math.floor(variation * 3);

    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = surfaceY + ty;
      if (y >= CHUNK_SIZE_Y) break;
      blocks[getBlockIndex(lx, y, lz)] = BlockType.Log;
    }

    // Wide sphere canopy (radius 3)
    const leafCenterY = surfaceY + trunkHeight;
    const leafRadius = 3;
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
      for (let dy = -1; dy <= leafRadius; dy++) {
        for (let dz = -leafRadius; dz <= leafRadius; dz++) {
          const dist = dx * dx + dy * dy + dz * dz;
          if (dist > leafRadius * leafRadius + 1) continue;
          this.setLeaf(blocks, lx + dx, leafCenterY + dy, lz + dz);
        }
      }
    }

    // Hanging leaf columns from canopy edge (droop 2-3 blocks down)
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
      for (let dz = -leafRadius; dz <= leafRadius; dz++) {
        const dist = dx * dx + dz * dz;
        // Only at edges
        if (dist < (leafRadius - 1) * (leafRadius - 1) || dist > leafRadius * leafRadius) continue;
        const hangLength = 2 + Math.floor(variation * 2);
        for (let hy = 1; hy <= hangLength; hy++) {
          this.setLeaf(blocks, lx + dx, leafCenterY - 1 - hy, lz + dz);
        }
      }
    }
  }

  // ─── Decoration Generation ───

  private generateDecorations(
    chunkX: number,
    chunkZ: number,
    blocks: Uint8Array,
    heightMap: Uint8Array,
    biomeMap: BiomeType[],
  ): void {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = chunkX * CHUNK_SIZE_X + lx;
        const worldZ = chunkZ * CHUNK_SIZE_Z + lz;

        const surfaceY = heightMap[lx + lz * CHUNK_SIZE_X]!;
        if (surfaceY <= SEA_LEVEL - 1 || surfaceY >= CHUNK_SIZE_Y - 2) continue;

        const aboveIdx = getBlockIndex(lx, surfaceY + 1, lz);
        // Only decorate if the block above surface is air
        if (blocks[aboveIdx] !== BlockType.Air) continue;

        const surfaceBlock = blocks[getBlockIndex(lx, surfaceY, lz)];
        const biome = biomeMap[lx + lz * CHUNK_SIZE_X]!;
        const decoVal = (this.decoNoise.noise2D(worldX, worldZ, 0.8, 1) + 1) / 2;

        if (surfaceBlock === BlockType.Grass) {
          // Tall grass (~15% coverage)
          if (decoVal > 0.85) {
            blocks[aboveIdx] = BlockType.TallGrass;
          }
          // Mushrooms in forested biomes (~2%)
          else if (
            decoVal < 0.02 &&
            (biome === BiomeType.Mossreach ||
              biome === BiomeType.AshwoodForest ||
              biome === BiomeType.MireHollows)
          ) {
            blocks[aboveIdx] = BlockType.Mushroom;
          }
        } else if (surfaceBlock === BlockType.Sand) {
          if (biome === BiomeType.Scorchlands) {
            // Cactus (~3%)
            if (decoVal > 0.97) {
              blocks[aboveIdx] = BlockType.Cactus;
              // Stack 2-3 blocks for cactus height
              const cactusHeight = decoVal > 0.985 ? 3 : 2;
              for (let cy = 2; cy <= cactusHeight; cy++) {
                const cIdx = getBlockIndex(lx, surfaceY + cy, lz);
                if (surfaceY + cy < CHUNK_SIZE_Y && blocks[cIdx] === BlockType.Air) {
                  blocks[cIdx] = BlockType.Cactus;
                }
              }
            }
            // Dead bushes (~5%)
            else if (decoVal > 0.92) {
              blocks[aboveIdx] = BlockType.DeadBush;
            }
          } else {
            // Dead bushes on other sandy areas (~3%)
            if (decoVal > 0.97) {
              blocks[aboveIdx] = BlockType.DeadBush;
            }
          }
        }
      }
    }
  }
}
