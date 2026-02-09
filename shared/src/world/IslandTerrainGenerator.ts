// ─── Island Terrain Generator ───
// Pre-generates two small islands with distinct terrain.
// Island 1 (Haven): green, flat, oak trees, berry bushes, small pond.
// Island 2 (Ember): volcanic, steep, dead trees, sulfur/metal ore, lava pools.
// Ocean between them.
// Pure math — no framework dependencies. Used by both client and server.

import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../constants/game.js';
import { EMBER_ISLAND, HAVEN_ISLAND, ISLAND_WORLD, PORTAL_RADIUS } from '../constants/islands.js';
import { BlockType } from '../types/blocks.js';
import { BLOCKS_PER_CHUNK, getBlockIndex } from '../utils/chunkUtils.js';

// ─── Minimal Noise (inline, no dependencies) ───

function hash2D(x: number, z: number, seed: number): number {
  let h = (seed + x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff; // 0..1
}

function smoothNoise(wx: number, wz: number, scale: number, seed: number): number {
  const sx = wx / scale;
  const sz = wz / scale;
  const ix = Math.floor(sx);
  const iz = Math.floor(sz);
  const fx = sx - ix;
  const fz = sz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}

function octaveNoise(wx: number, wz: number, scale: number, octaves: number, seed: number): number {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(wx, wz, scale / freq, seed + i * 31) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / maxAmp;
}

// ─── Island Shape ───

function islandMask(
  wx: number,
  wz: number,
  centerX: number,
  centerZ: number,
  radius: number,
): number {
  const dx = wx - centerX;
  const dz = wz - centerZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= radius) return 0;
  const t = dist / radius;
  return Math.max(0, 1 - t * t); // quadratic falloff
}

// ─── Generator ───

export class IslandTerrainGenerator {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  generateChunk(chunkX: number, chunkZ: number): Uint8Array {
    const blocks = new Uint8Array(BLOCKS_PER_CHUNK);
    const seaLevel = ISLAND_WORLD.seaLevel;

    // Island 1 (Haven) center in world coords
    const havenCX =
      ((HAVEN_ISLAND.minCX + HAVEN_ISLAND.maxCX) / 2) * CHUNK_SIZE_X + CHUNK_SIZE_X / 2;
    const havenCZ =
      ((HAVEN_ISLAND.minCZ + HAVEN_ISLAND.maxCZ) / 2) * CHUNK_SIZE_Z + CHUNK_SIZE_Z / 2;
    const havenRadius = 2.5 * CHUNK_SIZE_X;

    // Island 2 (Ember) center
    const emberCX =
      ((EMBER_ISLAND.minCX + EMBER_ISLAND.maxCX) / 2) * CHUNK_SIZE_X + CHUNK_SIZE_X / 2;
    const emberCZ =
      ((EMBER_ISLAND.minCZ + EMBER_ISLAND.maxCZ) / 2) * CHUNK_SIZE_Z + CHUNK_SIZE_Z / 2;
    const emberRadius = 2.5 * CHUNK_SIZE_X;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const wx = chunkX * CHUNK_SIZE_X + lx;
        const wz = chunkZ * CHUNK_SIZE_Z + lz;

        const havenMaskVal = islandMask(wx, wz, havenCX, havenCZ, havenRadius);
        const emberMaskVal = islandMask(wx, wz, emberCX, emberCZ, emberRadius);

        let surfaceY: number;
        let isHaven = false;
        let isEmber = false;

        if (havenMaskVal > 0.01) {
          isHaven = true;
          const noise = octaveNoise(wx, wz, 40, 3, this.seed);
          surfaceY = seaLevel + Math.floor(havenMaskVal * (noise * 10 + 2));
        } else if (emberMaskVal > 0.01) {
          isEmber = true;
          const noise = octaveNoise(wx, wz, 25, 4, this.seed + 100);
          surfaceY = seaLevel + Math.floor(emberMaskVal * (noise * 18 + 3));
        } else {
          surfaceY = seaLevel - 5;
        }

        surfaceY = Math.max(1, Math.min(surfaceY, CHUNK_SIZE_Y - 2));

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const idx = getBlockIndex(lx, y, lz);

          if (y === 0) {
            blocks[idx] = BlockType.Bedrock;
          } else if (y < surfaceY - 4) {
            blocks[idx] = BlockType.Stone;
            if (isEmber && y > 10 && y < surfaceY - 6) {
              const oreNoise = hash2D(wx + y * 7, wz + y * 13, this.seed + 200);
              if (oreNoise > 0.92) {
                blocks[idx] = BlockType.MetalOre;
              } else if (oreNoise > 0.88) {
                blocks[idx] = BlockType.SulfurOre;
              }
            }
          } else if (y < surfaceY) {
            if (isHaven) {
              blocks[idx] = BlockType.Dirt;
            } else if (isEmber) {
              blocks[idx] = BlockType.Cobblestone;
            } else {
              blocks[idx] = BlockType.Sand;
            }
          } else if (y === surfaceY) {
            if (isHaven) {
              blocks[idx] = BlockType.Grass;
            } else if (isEmber) {
              const surfNoise = hash2D(wx, wz, this.seed + 300);
              blocks[idx] = surfNoise > 0.5 ? BlockType.Gravel : BlockType.Stone;
            } else {
              blocks[idx] = BlockType.Sand;
            }
          } else if (y <= seaLevel && !isHaven && !isEmber) {
            blocks[idx] = BlockType.Water;
          } else if (isEmber && y === surfaceY + 1 && surfaceY < seaLevel + 2) {
            const lavaChance = hash2D(wx * 3, wz * 3, this.seed + 400);
            if (lavaChance > 0.7) {
              blocks[idx] = BlockType.Water;
            }
          } else {
            blocks[idx] = BlockType.Air;
          }
        }

        // ── Haven decorations ──
        if (isHaven && surfaceY > seaLevel) {
          const decoRng = hash2D(wx, wz, this.seed + 500);

          if (
            decoRng > 0.9 &&
            lx >= 2 &&
            lx < CHUNK_SIZE_X - 2 &&
            lz >= 2 &&
            lz < CHUNK_SIZE_Z - 2
          ) {
            const trunkH = 4 + Math.floor(hash2D(wx, wz, this.seed + 600) * 3);
            for (let ty = 1; ty <= trunkH; ty++) {
              const treeY = surfaceY + ty;
              if (treeY < CHUNK_SIZE_Y) {
                blocks[getBlockIndex(lx, treeY, lz)] = BlockType.Log;
              }
            }
            const leafBase = surfaceY + trunkH - 1;
            for (let dy = 0; dy <= 3; dy++) {
              const radius = dy === 0 ? 2 : dy === 3 ? 1 : 2;
              for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                  if (dx === 0 && dz === 0 && dy < 3) continue;
                  const lxx = lx + dx;
                  const lzz = lz + dz;
                  const lyy = leafBase + dy;
                  if (
                    lxx >= 0 &&
                    lxx < CHUNK_SIZE_X &&
                    lzz >= 0 &&
                    lzz < CHUNK_SIZE_Z &&
                    lyy < CHUNK_SIZE_Y
                  ) {
                    if (blocks[getBlockIndex(lxx, lyy, lzz)] === BlockType.Air) {
                      blocks[getBlockIndex(lxx, lyy, lzz)] = BlockType.Leaves;
                    }
                  }
                }
              }
            }
          } else if (decoRng > 0.75) {
            const grassY = surfaceY + 1;
            if (grassY < CHUNK_SIZE_Y) {
              blocks[getBlockIndex(lx, grassY, lz)] = BlockType.TallGrass;
            }
          } else if (decoRng > 0.72) {
            const mushY = surfaceY + 1;
            if (mushY < CHUNK_SIZE_Y) {
              blocks[getBlockIndex(lx, mushY, lz)] = BlockType.Mushroom;
            }
          }
        }

        // ── Ember decorations ──
        if (isEmber && surfaceY > seaLevel) {
          const decoRng = hash2D(wx, wz, this.seed + 700);

          if (
            decoRng > 0.92 &&
            lx >= 2 &&
            lx < CHUNK_SIZE_X - 2 &&
            lz >= 2 &&
            lz < CHUNK_SIZE_Z - 2
          ) {
            const trunkH = 3 + Math.floor(hash2D(wx, wz, this.seed + 800) * 2);
            for (let ty = 1; ty <= trunkH; ty++) {
              const treeY = surfaceY + ty;
              if (treeY < CHUNK_SIZE_Y) {
                blocks[getBlockIndex(lx, treeY, lz)] = BlockType.Log;
              }
            }
            const topY = surfaceY + trunkH;
            if (topY < CHUNK_SIZE_Y && lx + 1 < CHUNK_SIZE_X) {
              blocks[getBlockIndex(lx + 1, topY, lz)] = BlockType.Log;
            }
            if (topY - 1 > surfaceY && lx - 1 >= 0) {
              blocks[getBlockIndex(lx - 1, topY - 1, lz)] = BlockType.Log;
            }
          } else if (decoRng > 0.85) {
            const bushY = surfaceY + 1;
            if (bushY < CHUNK_SIZE_Y) {
              blocks[getBlockIndex(lx, bushY, lz)] = BlockType.DeadBush;
            }
          }

          if (decoRng < 0.03 && surfaceY + 1 < CHUNK_SIZE_Y) {
            blocks[getBlockIndex(lx, surfaceY + 1, lz)] = BlockType.MetalOre;
          } else if (decoRng < 0.05 && surfaceY + 1 < CHUNK_SIZE_Y) {
            blocks[getBlockIndex(lx, surfaceY + 1, lz)] = BlockType.SulfurOre;
          }
        }
      }
    }

    this.buildPortal(blocks, chunkX, chunkZ);

    return blocks;
  }

  private buildPortal(blocks: Uint8Array, chunkX: number, chunkZ: number): void {
    const px = EMBER_ISLAND.portalX;
    const pz = EMBER_ISLAND.portalZ;
    const py = EMBER_ISLAND.portalY;

    const chunkMinX = chunkX * CHUNK_SIZE_X;
    const chunkMinZ = chunkZ * CHUNK_SIZE_Z;
    const chunkMaxX = chunkMinX + CHUNK_SIZE_X;
    const chunkMaxZ = chunkMinZ + CHUNK_SIZE_Z;

    if (px + PORTAL_RADIUS < chunkMinX || px - PORTAL_RADIUS >= chunkMaxX) return;
    if (pz + PORTAL_RADIUS < chunkMinZ || pz - PORTAL_RADIUS >= chunkMaxZ) return;

    for (let dx = -PORTAL_RADIUS; dx <= PORTAL_RADIUS; dx++) {
      for (let dz = -PORTAL_RADIUS; dz <= PORTAL_RADIUS; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > PORTAL_RADIUS) continue;

        const bx = px + dx;
        const bz = pz + dz;
        const lx = bx - chunkMinX;
        const lz = bz - chunkMinZ;
        if (lx < 0 || lx >= CHUNK_SIZE_X || lz < 0 || lz >= CHUNK_SIZE_Z) continue;

        // Platform floor + clear column below for support
        for (let sy = 1; sy <= py; sy++) {
          if (sy < py - 3) {
            if (blocks[getBlockIndex(lx, sy, lz)] !== BlockType.Bedrock) {
              blocks[getBlockIndex(lx, sy, lz)] = BlockType.Stone;
            }
          } else if (sy < py) {
            blocks[getBlockIndex(lx, sy, lz)] = BlockType.Cobblestone;
          }
        }

        if (py < CHUNK_SIZE_Y) {
          blocks[getBlockIndex(lx, py, lz)] = BlockType.Cobblestone;
        }

        // Clear air above platform
        for (let ay = py + 1; ay < Math.min(py + 5, CHUNK_SIZE_Y); ay++) {
          blocks[getBlockIndex(lx, ay, lz)] = BlockType.Air;
        }

        // Ring pillars at edge
        if (dist > PORTAL_RADIUS - 1.5 && dist <= PORTAL_RADIUS) {
          if (py + 1 < CHUNK_SIZE_Y) blocks[getBlockIndex(lx, py + 1, lz)] = BlockType.HQMOre;
          if (py + 2 < CHUNK_SIZE_Y) blocks[getBlockIndex(lx, py + 2, lz)] = BlockType.MetalOre;
          if (py + 3 < CHUNK_SIZE_Y) blocks[getBlockIndex(lx, py + 3, lz)] = BlockType.HQMOre;
        }
      }
    }
  }

  findSurfaceY(wx: number, wz: number): number {
    const havenCX =
      ((HAVEN_ISLAND.minCX + HAVEN_ISLAND.maxCX) / 2) * CHUNK_SIZE_X + CHUNK_SIZE_X / 2;
    const havenCZ =
      ((HAVEN_ISLAND.minCZ + HAVEN_ISLAND.maxCZ) / 2) * CHUNK_SIZE_Z + CHUNK_SIZE_Z / 2;
    const havenR = 2.5 * CHUNK_SIZE_X;
    const hMask = islandMask(wx, wz, havenCX, havenCZ, havenR);

    if (hMask > 0.01) {
      const noise = octaveNoise(wx, wz, 40, 3, this.seed);
      return ISLAND_WORLD.seaLevel + Math.floor(hMask * (noise * 10 + 2));
    }

    const emberCX =
      ((EMBER_ISLAND.minCX + EMBER_ISLAND.maxCX) / 2) * CHUNK_SIZE_X + CHUNK_SIZE_X / 2;
    const emberCZ =
      ((EMBER_ISLAND.minCZ + EMBER_ISLAND.maxCZ) / 2) * CHUNK_SIZE_Z + CHUNK_SIZE_Z / 2;
    const emberR = 2.5 * CHUNK_SIZE_X;
    const eMask = islandMask(wx, wz, emberCX, emberCZ, emberR);

    if (eMask > 0.01) {
      const noise = octaveNoise(wx, wz, 25, 4, this.seed + 100);
      return ISLAND_WORLD.seaLevel + Math.floor(eMask * (noise * 18 + 3));
    }

    return ISLAND_WORLD.seaLevel - 5;
  }
}
