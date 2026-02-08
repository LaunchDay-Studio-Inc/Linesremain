// ─── Client-Side Terrain Generator ───
// Port of the server's TerrainGenerator + BiomeManager + SeededNoise
// for offline/local chunk generation with full biome variety, trees,
// caves, ores, and decorations.

import {
  BLOCKS_PER_CHUNK,
  BiomeType,
  BlockType,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  SEA_LEVEL,
  WORLD_SIZE,
  getBlockIndex,
} from '@lineremain/shared';
import { createNoise2D, createNoise3D } from 'simplex-noise';

// ─── Seeded PRNG ───

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Seeded Noise ───

class SeededNoise {
  private noise2d: ReturnType<typeof createNoise2D>;
  private noise3d: ReturnType<typeof createNoise3D>;

  constructor(seed: number) {
    const prng = mulberry32(seed);
    this.noise2d = createNoise2D(prng);
    this.noise3d = createNoise3D(prng);
  }

  noise2D(x: number, z: number, frequency: number, amplitude: number): number {
    return this.noise2d(x * frequency, z * frequency) * amplitude;
  }

  octaveNoise2D(
    x: number,
    z: number,
    frequency: number,
    amplitude: number,
    octaves: number,
    lacunarity = 2,
    persistence = 0.5,
  ): number {
    let value = 0;
    let freq = frequency;
    let amp = amplitude;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2d(x * freq, z * freq) * amp;
      freq *= lacunarity;
      amp *= persistence;
    }
    return value;
  }

  noise3D(x: number, y: number, z: number, frequency: number, amplitude: number): number {
    return this.noise3d(x * frequency, y * frequency, z * frequency) * amplitude;
  }
}

// ─── Biome Definitions ───

interface BiomeProps {
  surfaceBlock: BlockType;
  subsurfaceBlock: BlockType;
  treeFrequency: number;
}

const BIOME_PROPS: Record<BiomeType, BiomeProps> = {
  [BiomeType.Scorchlands]: {
    surfaceBlock: BlockType.Sand,
    subsurfaceBlock: BlockType.Sand,
    treeFrequency: 0,
  },
  [BiomeType.AshwoodForest]: {
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    treeFrequency: 0.5,
  },
  [BiomeType.MireHollows]: {
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Clay,
    treeFrequency: 0.3,
  },
  [BiomeType.DrygrassPlains]: {
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    treeFrequency: 0.05,
  },
  [BiomeType.Greenhollow]: {
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    treeFrequency: 0.4,
  },
  [BiomeType.Mossreach]: {
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    treeFrequency: 0.7,
  },
  [BiomeType.FrostveilPeaks]: {
    surfaceBlock: BlockType.Snow,
    subsurfaceBlock: BlockType.Gravel,
    treeFrequency: 0.02,
  },
  [BiomeType.SnowmeltWoods]: {
    surfaceBlock: BlockType.Snow,
    subsurfaceBlock: BlockType.Dirt,
    treeFrequency: 0.35,
  },
  [BiomeType.GlacialExpanse]: {
    surfaceBlock: BlockType.Ice,
    subsurfaceBlock: BlockType.Gravel,
    treeFrequency: 0,
  },
};

// ─── Biome Classification ───

const enum Climate {
  Cold,
  Temperate,
  Hot,
}
const enum Moisture {
  Dry,
  Medium,
  Wet,
}

const BIOME_GRID: Record<Climate, Record<Moisture, BiomeType>> = {
  [Climate.Hot]: {
    [Moisture.Dry]: BiomeType.Scorchlands,
    [Moisture.Medium]: BiomeType.AshwoodForest,
    [Moisture.Wet]: BiomeType.MireHollows,
  },
  [Climate.Temperate]: {
    [Moisture.Dry]: BiomeType.DrygrassPlains,
    [Moisture.Medium]: BiomeType.Greenhollow,
    [Moisture.Wet]: BiomeType.Mossreach,
  },
  [Climate.Cold]: {
    [Moisture.Dry]: BiomeType.FrostveilPeaks,
    [Moisture.Medium]: BiomeType.SnowmeltWoods,
    [Moisture.Wet]: BiomeType.GlacialExpanse,
  },
};

// ─── Client Terrain Generator ───

export class ClientTerrainGenerator {
  private continentNoise: SeededNoise;
  private elevationNoise: SeededNoise;
  private detailNoise: SeededNoise;
  private caveNoise: SeededNoise;
  private oreNoise: SeededNoise;
  private treeNoise: SeededNoise;
  private decoNoise: SeededNoise;
  private temperatureNoise: SeededNoise;
  private moistureNoise: SeededNoise;
  private halfWorld: number;

  constructor(seed = 42) {
    this.continentNoise = new SeededNoise(seed);
    this.elevationNoise = new SeededNoise(seed + 1);
    this.detailNoise = new SeededNoise(seed + 2);
    this.caveNoise = new SeededNoise(seed + 3);
    this.oreNoise = new SeededNoise(seed + 4);
    this.treeNoise = new SeededNoise(seed + 5);
    this.decoNoise = new SeededNoise(seed + 6);
    this.temperatureNoise = new SeededNoise(seed);
    this.moistureNoise = new SeededNoise(seed + 31337);
    this.halfWorld = WORLD_SIZE / 2;
  }

  // ─── Biome lookup ───

  public getBiome(x: number, z: number): BiomeType {
    const distFromCenter = Math.abs(z - this.halfWorld) / this.halfWorld;
    const latGradient = 1 - distFromCenter;
    const tempNoise = (this.temperatureNoise.noise2D(x, z, 0.0008, 1) + 1) / 2;
    const temperature = tempNoise * 0.6 + latGradient * 0.4;
    const moisture = (this.moistureNoise.noise2D(x, z, 0.001, 1) + 1) / 2;

    let climate: Climate;
    if (temperature > 0.66) climate = Climate.Hot;
    else if (temperature > 0.33) climate = Climate.Temperate;
    else climate = Climate.Cold;

    let moist: Moisture;
    if (moisture > 0.66) moist = Moisture.Wet;
    else if (moisture > 0.33) moist = Moisture.Medium;
    else moist = Moisture.Dry;

    return BIOME_GRID[climate][moist];
  }

  // ─── Ore placement ───

  private getOreOrStone(worldX: number, y: number, worldZ: number, biome: BiomeType): BlockType {
    if (y < 20) {
      const hqmVal = this.oreNoise.noise3D(worldX, y, worldZ, 0.15, 1);
      if (hqmVal > 0.85) return BlockType.HQMOre;
    }
    if (y < 30) {
      const sulfurThreshold = biome === BiomeType.Scorchlands ? 0.72 : 0.8;
      const sulfurVal = this.oreNoise.noise3D(worldX + 1000, y, worldZ, 0.12, 1);
      if (sulfurVal > sulfurThreshold) return BlockType.SulfurOre;
    }
    if (y < 40) {
      const metalVal = this.oreNoise.noise3D(worldX + 2000, y, worldZ, 0.1, 1);
      if (metalVal > 0.75) return BlockType.MetalOre;
    }
    return BlockType.Stone;
  }

  // ─── Main generation ───

  generateChunk(chunkX: number, chunkZ: number): Uint8Array {
    const blocks = new Uint8Array(BLOCKS_PER_CHUNK);
    const heightMap = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
    const biomeMap = new Array<BiomeType>(CHUNK_SIZE_X * CHUNK_SIZE_Z);

    // Pass 1: Base terrain
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = chunkX * CHUNK_SIZE_X + lx;
        const worldZ = chunkZ * CHUNK_SIZE_Z + lz;

        const continental = this.continentNoise.noise2D(worldX, worldZ, 0.0005, 1) * 15 + 35;
        const elevation = this.elevationNoise.octaveNoise2D(worldX, worldZ, 0.003, 15, 4);
        const detail = this.detailNoise.octaveNoise2D(worldX, worldZ, 0.02, 1.5, 2);

        let finalHeight = Math.floor(continental + elevation + detail);
        finalHeight = Math.max(1, Math.min(finalHeight, CHUNK_SIZE_Y - 2));

        heightMap[lx + lz * CHUNK_SIZE_X] = finalHeight;

        const biome = this.getBiome(worldX, worldZ);
        biomeMap[lx + lz * CHUNK_SIZE_X] = biome;
        const props = BIOME_PROPS[biome];

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const idx = getBlockIndex(lx, y, lz);

          if (y === 0) {
            blocks[idx] = BlockType.Bedrock;
          } else if (y < finalHeight - 4) {
            const caveVal = this.caveNoise.noise3D(worldX, y, worldZ, 0.05, 1);
            if (caveVal > 0.6 && y > 5) {
              blocks[idx] = BlockType.Air;
            } else {
              blocks[idx] = this.getOreOrStone(worldX, y, worldZ, biome);
            }
          } else if (y < finalHeight) {
            blocks[idx] = props.subsurfaceBlock;
          } else if (y === finalHeight) {
            if (finalHeight < SEA_LEVEL) {
              blocks[idx] =
                biome === BiomeType.GlacialExpanse || biome === BiomeType.FrostveilPeaks
                  ? BlockType.Gravel
                  : BlockType.Sand;
            } else {
              blocks[idx] = props.surfaceBlock;
            }
          } else if (y <= SEA_LEVEL && finalHeight < SEA_LEVEL) {
            blocks[idx] = BlockType.Water;
          }
          // else Air (0, default)
        }
      }
    }

    // Pass 2: Trees
    this.generateTrees(chunkX, chunkZ, blocks, heightMap, biomeMap);

    // Pass 3: Decorations
    this.generateDecorations(chunkX, chunkZ, blocks, heightMap, biomeMap);

    return blocks;
  }

  // ─── Trees ───

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
        if (surfaceY <= SEA_LEVEL - 1 || surfaceY >= CHUNK_SIZE_Y - 10) continue;

        const biome = biomeMap[lx + lz * CHUNK_SIZE_X]!;
        const props = BIOME_PROPS[biome];
        if (props.treeFrequency <= 0) continue;

        const surfaceBlock = blocks[getBlockIndex(lx, surfaceY, lz)];
        if (
          surfaceBlock === BlockType.Sand ||
          surfaceBlock === BlockType.Snow ||
          surfaceBlock === BlockType.Ice ||
          surfaceBlock === BlockType.Water
        )
          continue;

        const treeVal = (this.treeNoise.noise2D(worldX, worldZ, 0.4, 1) + 1) / 2;
        const threshold = 1 - props.treeFrequency * 0.15;
        if (treeVal < threshold) continue;

        const trunkHeight =
          5 + Math.floor(((this.treeNoise.noise2D(worldX, worldZ, 1.7, 1) + 1) / 2) * 3);
        const leafRadius = 2;

        // Build trunk
        for (let ty = 1; ty <= trunkHeight; ty++) {
          const y = surfaceY + ty;
          if (y >= CHUNK_SIZE_Y) break;
          blocks[getBlockIndex(lx, y, lz)] = BlockType.Log;
        }

        // Build leaf sphere
        const leafCenterY = surfaceY + trunkHeight;
        for (let dx = -leafRadius; dx <= leafRadius; dx++) {
          for (let dy = -1; dy <= leafRadius; dy++) {
            for (let dz = -leafRadius; dz <= leafRadius; dz++) {
              const nx = lx + dx;
              const ny = leafCenterY + dy;
              const nz = lz + dz;

              if (nx < 0 || nx >= CHUNK_SIZE_X) continue;
              if (nz < 0 || nz >= CHUNK_SIZE_Z) continue;
              if (ny < 0 || ny >= CHUNK_SIZE_Y) continue;

              const dist = dx * dx + dy * dy + dz * dz;
              if (dist > leafRadius * leafRadius + 1) continue;

              const existingIdx = getBlockIndex(nx, ny, nz);
              if (blocks[existingIdx] === BlockType.Air) {
                blocks[existingIdx] = BlockType.Leaves;
              }
            }
          }
        }
      }
    }
  }

  // ─── Decorations ───

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
        if (blocks[aboveIdx] !== BlockType.Air) continue;

        const surfaceBlock = blocks[getBlockIndex(lx, surfaceY, lz)];
        const biome = biomeMap[lx + lz * CHUNK_SIZE_X]!;
        const decoVal = (this.decoNoise.noise2D(worldX, worldZ, 0.8, 1) + 1) / 2;

        if (surfaceBlock === BlockType.Grass) {
          if (decoVal > 0.85) {
            blocks[aboveIdx] = BlockType.TallGrass;
          } else if (
            decoVal < 0.02 &&
            (biome === BiomeType.Mossreach ||
              biome === BiomeType.AshwoodForest ||
              biome === BiomeType.MireHollows)
          ) {
            blocks[aboveIdx] = BlockType.Mushroom;
          }
        } else if (surfaceBlock === BlockType.Sand) {
          if (biome === BiomeType.Scorchlands) {
            if (decoVal > 0.97) {
              blocks[aboveIdx] = BlockType.Cactus;
              const cactusHeight = decoVal > 0.985 ? 3 : 2;
              for (let cy = 2; cy <= cactusHeight; cy++) {
                const cIdx = getBlockIndex(lx, surfaceY + cy, lz);
                if (surfaceY + cy < CHUNK_SIZE_Y && blocks[cIdx] === BlockType.Air) {
                  blocks[cIdx] = BlockType.Cactus;
                }
              }
            } else if (decoVal > 0.92) {
              blocks[aboveIdx] = BlockType.DeadBush;
            }
          } else {
            if (decoVal > 0.97) {
              blocks[aboveIdx] = BlockType.DeadBush;
            }
          }
        }
      }
    }
  }
}
