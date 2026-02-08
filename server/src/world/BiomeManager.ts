// ─── Biome Manager ───

import type { BiomeDefinition } from '@lineremain/shared';
import { BiomeType, BlockType, WORLD_SIZE } from '@lineremain/shared';
import { SeededNoise } from '../utils/noise.js';

// ─── Biome Definitions ───

const BIOME_DEFINITIONS: Record<BiomeType, BiomeDefinition> = {
  [BiomeType.Scorchlands]: {
    type: BiomeType.Scorchlands,
    name: 'Scorchlands',
    baseTemperature: 50,
    treeFrequency: 0,
    resourceMultipliers: { wood: 0.2, stone: 1.0, metal: 1.0, sulfur: 2.0, hqm: 0.8 },
    surfaceBlock: BlockType.Sand,
    subsurfaceBlock: BlockType.Sand,
    heightModifier: 0.5,
    treeStyle: 'none',
  },
  [BiomeType.AshwoodForest]: {
    type: BiomeType.AshwoodForest,
    name: 'Ashwood Forest',
    baseTemperature: 38,
    treeFrequency: 0.5,
    resourceMultipliers: { wood: 1.5, stone: 1.0, metal: 0.8, sulfur: 1.0, hqm: 0.5 },
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    heightModifier: 1.0,
    treeStyle: 'oak',
  },
  [BiomeType.MireHollows]: {
    type: BiomeType.MireHollows,
    name: 'Mire Hollows',
    baseTemperature: 35,
    treeFrequency: 0.3,
    resourceMultipliers: { wood: 1.0, stone: 0.8, metal: 0.6, sulfur: 0.8, hqm: 0.3 },
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Clay,
    heightModifier: 0.6,
    treeStyle: 'willow',
  },
  [BiomeType.DrygrassPlains]: {
    type: BiomeType.DrygrassPlains,
    name: 'Drygrass Plains',
    baseTemperature: 28,
    treeFrequency: 0.05,
    resourceMultipliers: { wood: 0.3, stone: 1.2, metal: 1.2, sulfur: 1.0, hqm: 0.6 },
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    heightModifier: 0.7,
    treeStyle: 'acacia',
  },
  [BiomeType.Greenhollow]: {
    type: BiomeType.Greenhollow,
    name: 'Greenhollow',
    baseTemperature: 22,
    treeFrequency: 0.4,
    resourceMultipliers: { wood: 1.2, stone: 1.0, metal: 1.0, sulfur: 0.8, hqm: 0.5 },
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    heightModifier: 1.0,
    treeStyle: 'oak',
  },
  [BiomeType.Mossreach]: {
    type: BiomeType.Mossreach,
    name: 'Mossreach',
    baseTemperature: 20,
    treeFrequency: 0.7,
    resourceMultipliers: { wood: 2.0, stone: 0.8, metal: 0.6, sulfur: 0.5, hqm: 0.4 },
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    heightModifier: 1.1,
    treeStyle: 'oak',
  },
  [BiomeType.FrostveilPeaks]: {
    type: BiomeType.FrostveilPeaks,
    name: 'Frostveil Peaks',
    baseTemperature: -10,
    treeFrequency: 0.02,
    resourceMultipliers: { wood: 0.1, stone: 1.5, metal: 1.5, sulfur: 0.5, hqm: 1.5 },
    surfaceBlock: BlockType.Snow,
    subsurfaceBlock: BlockType.Gravel,
    heightModifier: 1.8,
    treeStyle: 'pine',
  },
  [BiomeType.SnowmeltWoods]: {
    type: BiomeType.SnowmeltWoods,
    name: 'Snowmelt Woods',
    baseTemperature: 0,
    treeFrequency: 0.35,
    resourceMultipliers: { wood: 1.3, stone: 1.0, metal: 1.0, sulfur: 0.6, hqm: 0.8 },
    surfaceBlock: BlockType.Snow,
    subsurfaceBlock: BlockType.Dirt,
    heightModifier: 1.2,
    treeStyle: 'pine',
  },
  [BiomeType.GlacialExpanse]: {
    type: BiomeType.GlacialExpanse,
    name: 'Glacial Expanse',
    baseTemperature: -20,
    treeFrequency: 0,
    resourceMultipliers: { wood: 0, stone: 1.0, metal: 1.2, sulfur: 0.3, hqm: 1.2 },
    surfaceBlock: BlockType.Ice,
    subsurfaceBlock: BlockType.Gravel,
    heightModifier: 1.5,
    treeStyle: 'none',
  },
};

// ─── Temperature / Moisture classification thresholds ───

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

// 3×3 lookup grid: [temperature][moisture]
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

// ─── BiomeManager ───

export class BiomeManager {
  private temperatureNoise: SeededNoise;
  private moistureNoise: SeededNoise;
  private halfWorld: number;

  constructor(seed: number) {
    // Use offset seeds so the two noise fields are independent
    this.temperatureNoise = new SeededNoise(seed);
    this.moistureNoise = new SeededNoise(seed + 31337);
    this.halfWorld = WORLD_SIZE / 2;
  }

  /**
   * Determine the biome at a given world (x, z) coordinate.
   */
  getBiome(x: number, z: number): BiomeType {
    // Temperature: large-scale noise + latitudinal gradient
    // Distance from center (0..1), edges are colder
    const distFromCenter = Math.abs(z - this.halfWorld) / this.halfWorld; // 0 at center, 1 at edges
    const latGradient = 1 - distFromCenter; // 1 warm at center, 0 cold at edges

    // Noise in range [-1, 1], scale to [0, 1]
    const tempNoise = (this.temperatureNoise.noise2D(x, z, 0.0008, 1) + 1) / 2;
    const temperature = tempNoise * 0.6 + latGradient * 0.4; // blend noise and gradient

    // Moisture: noise only, range [0, 1]
    const moisture = (this.moistureNoise.noise2D(x, z, 0.001, 1) + 1) / 2;

    // Classify temperature
    let climate: Climate;
    if (temperature > 0.66) {
      climate = Climate.Hot;
    } else if (temperature > 0.33) {
      climate = Climate.Temperate;
    } else {
      climate = Climate.Cold;
    }

    // Classify moisture
    let moist: Moisture;
    if (moisture > 0.66) {
      moist = Moisture.Wet;
    } else if (moisture > 0.33) {
      moist = Moisture.Medium;
    } else {
      moist = Moisture.Dry;
    }

    return BIOME_GRID[climate][moist];
  }

  /**
   * Get the full definition for a biome type.
   */
  getBiomeProperties(biome: BiomeType): BiomeDefinition {
    return BIOME_DEFINITIONS[biome];
  }
}
