// ─── Biome Tracker ───
// Tracks the player's current biome and provides smooth atmosphere
// transitions as they move between biomes. Each biome has a unique
// atmosphere configuration (fog, particles, ambient tint, mood).

import { BiomeType } from '@shared/types/biomes';
import type { BiomeAtmosphereData } from '@shared/types/events';
import type { ClientTerrainGenerator } from './ClientTerrainGenerator';

// ─── Biome Atmosphere Definitions ───

export const BIOME_ATMOSPHERES: Record<BiomeType, BiomeAtmosphereData> = {
  [BiomeType.Scorchlands]: {
    fogColor: '#cc6622',
    fogNear: 40,
    fogFar: 180,
    ambientTint: '#ff8844',
    particleType: 'dust',
    particleDensity: 0.6,
    mood: 'tense',
  },
  [BiomeType.AshwoodForest]: {
    fogColor: '#777777',
    fogNear: 30,
    fogFar: 150,
    ambientTint: '#998888',
    particleType: 'ash',
    particleDensity: 0.5,
    mood: 'melancholy',
  },
  [BiomeType.MireHollows]: {
    fogColor: '#336633',
    fogNear: 20,
    fogFar: 120,
    ambientTint: '#558855',
    particleType: 'spores',
    particleDensity: 0.7,
    mood: 'eerie',
  },
  [BiomeType.DrygrassPlains]: {
    fogColor: '#ccaa77',
    fogNear: 60,
    fogFar: 250,
    ambientTint: '#ddcc99',
    particleType: 'dust',
    particleDensity: 0.3,
    mood: 'peaceful',
  },
  [BiomeType.Greenhollow]: {
    fogColor: '#88aa77',
    fogNear: 50,
    fogFar: 220,
    ambientTint: '#aaccaa',
    particleType: 'none',
    particleDensity: 0,
    mood: 'peaceful',
  },
  [BiomeType.Mossreach]: {
    fogColor: '#99aaaa',
    fogNear: 25,
    fogFar: 140,
    ambientTint: '#88bb99',
    particleType: 'fireflies',
    particleDensity: 0.6,
    mood: 'peaceful',
  },
  [BiomeType.FrostveilPeaks]: {
    fogColor: '#ddeeff',
    fogNear: 30,
    fogFar: 160,
    ambientTint: '#bbccdd',
    particleType: 'blizzard',
    particleDensity: 0.8,
    mood: 'tense',
  },
  [BiomeType.SnowmeltWoods]: {
    fogColor: '#99aabb',
    fogNear: 35,
    fogFar: 170,
    ambientTint: '#aabbcc',
    particleType: 'snow',
    particleDensity: 0.5,
    mood: 'melancholy',
  },
  [BiomeType.GlacialExpanse]: {
    fogColor: '#ccddee',
    fogNear: 25,
    fogFar: 140,
    ambientTint: '#ccddef',
    particleType: 'blizzard',
    particleDensity: 0.9,
    mood: 'tense',
  },
};

// ─── Helpers ───

/** Parse a hex color string to [r, g, b] in 0-1 range */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

/** Convert [r, g, b] in 0-1 range back to hex string */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Linearly interpolate two hex colors */
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Linearly interpolate two numbers */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Constants ───

const TRANSITION_DURATION = 5.0; // seconds for full biome transition

// ─── Biome Tracker ───

export class BiomeTracker {
  private terrainGenerator: ClientTerrainGenerator;
  private currentBiome: BiomeType = BiomeType.Greenhollow;
  private targetBiome: BiomeType = BiomeType.Greenhollow;

  private currentAtmosphere: BiomeAtmosphereData;
  private sourceAtmosphere: BiomeAtmosphereData;
  private targetAtmosphere: BiomeAtmosphereData;

  private transitionProgress = 1.0; // 1 = fully transitioned

  constructor(terrainGenerator: ClientTerrainGenerator) {
    this.terrainGenerator = terrainGenerator;

    const initial = BIOME_ATMOSPHERES[this.currentBiome];
    this.currentAtmosphere = { ...initial };
    this.sourceAtmosphere = { ...initial };
    this.targetAtmosphere = { ...initial };
  }

  // ─── Update ───

  update(playerX: number, playerZ: number, dt: number): void {
    // Sample the biome at the player's world position
    const sampledBiome = this.terrainGenerator.getBiome(playerX, playerZ);

    // If the biome changed, start a new transition
    if (sampledBiome !== this.targetBiome) {
      this.targetBiome = sampledBiome;
      this.targetAtmosphere = { ...BIOME_ATMOSPHERES[sampledBiome] };
      this.sourceAtmosphere = { ...this.currentAtmosphere };
      this.transitionProgress = 0;
    }

    // Advance transition
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + dt / TRANSITION_DURATION);
      const t = this.smoothstep(this.transitionProgress);

      // Interpolate atmosphere values
      this.currentAtmosphere.fogColor = lerpColor(
        this.sourceAtmosphere.fogColor,
        this.targetAtmosphere.fogColor,
        t,
      );
      this.currentAtmosphere.fogNear = lerp(
        this.sourceAtmosphere.fogNear,
        this.targetAtmosphere.fogNear,
        t,
      );
      this.currentAtmosphere.fogFar = lerp(
        this.sourceAtmosphere.fogFar,
        this.targetAtmosphere.fogFar,
        t,
      );
      this.currentAtmosphere.ambientTint = lerpColor(
        this.sourceAtmosphere.ambientTint,
        this.targetAtmosphere.ambientTint,
        t,
      );
      this.currentAtmosphere.particleDensity = lerp(
        this.sourceAtmosphere.particleDensity,
        this.targetAtmosphere.particleDensity,
        t,
      );

      // Snap discrete values at midpoint
      if (t >= 0.5) {
        this.currentAtmosphere.particleType = this.targetAtmosphere.particleType;
        this.currentAtmosphere.mood = this.targetAtmosphere.mood;
        this.currentBiome = this.targetBiome;
      }
    }
  }

  // ─── Queries ───

  getCurrentAtmosphere(): BiomeAtmosphereData {
    return this.currentAtmosphere;
  }

  getCurrentBiome(): BiomeType {
    return this.currentBiome;
  }

  getBiomeDisplayName(): string {
    return BiomeTracker.BIOME_DISPLAY_NAMES[this.currentBiome];
  }

  private static readonly BIOME_DISPLAY_NAMES: Record<BiomeType, string> = {
    [BiomeType.Scorchlands]: 'Scorchlands',
    [BiomeType.AshwoodForest]: 'Ashwood Forest',
    [BiomeType.MireHollows]: 'Mire Hollows',
    [BiomeType.DrygrassPlains]: 'Drygrass Plains',
    [BiomeType.Greenhollow]: 'Greenhollow',
    [BiomeType.Mossreach]: 'Mossreach',
    [BiomeType.FrostveilPeaks]: 'Frostveil Peaks',
    [BiomeType.SnowmeltWoods]: 'Snowmelt Woods',
    [BiomeType.GlacialExpanse]: 'Glacial Expanse',
  };

  // ─── Helpers ───

  /** Smooth hermite interpolation for organic transitions */
  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  // ─── Cleanup ───

  dispose(): void {
    // No GPU resources to clean up
  }
}
