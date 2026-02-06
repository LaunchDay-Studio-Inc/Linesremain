// ─── Seeded Noise Utility ───

import { createNoise2D, createNoise3D } from 'simplex-noise';

/**
 * Simple seeded PRNG (Mulberry32) — returns a function compatible with simplex-noise RandomFn.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wraps simplex-noise with a deterministic seed and convenience helpers
 * for fractal (octave) noise used in terrain generation.
 */
export class SeededNoise {
  private noise2d: ReturnType<typeof createNoise2D>;
  private noise3d: ReturnType<typeof createNoise3D>;

  constructor(seed: number) {
    const prng = mulberry32(seed);
    this.noise2d = createNoise2D(prng);
    this.noise3d = createNoise3D(prng);
  }

  /**
   * Simple 2D noise scaled by frequency and amplitude.
   * Returns a value in [-amplitude, +amplitude].
   */
  noise2D(x: number, z: number, frequency: number, amplitude: number): number {
    return this.noise2d(x * frequency, z * frequency) * amplitude;
  }

  /**
   * Fractal Brownian Motion (fBm) 2D noise.
   * Layers multiple octaves for more natural-looking terrain.
   */
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

  /**
   * Simple 3D noise scaled by frequency and amplitude.
   * Returns a value in [-amplitude, +amplitude].
   */
  noise3D(x: number, y: number, z: number, frequency: number, amplitude: number): number {
    return this.noise3d(x * frequency, y * frequency, z * frequency) * amplitude;
  }
}