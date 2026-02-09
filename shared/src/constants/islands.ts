// ─── Island World Constants ───
// Layout for the two pre-generated starter islands.
// All coordinates are in CHUNK space (multiply by CHUNK_SIZE_X/Z for world blocks).

/** Island 1 (Haven) — green, safe, resource-rich starter island */
export const HAVEN_ISLAND = {
  /** Chunk bounds (inclusive) */
  minCX: 0,
  minCZ: 0,
  maxCX: 4,
  maxCZ: 4,
  /** Player spawn point in WORLD coordinates (center of island) */
  spawnX: 2 * 32 + 16, // chunk 2, middle = block 80
  spawnZ: 2 * 32 + 16, // chunk 2, middle = block 80
  /** Surface Y will be determined by terrain gen, but approximate */
  spawnY: 40,
} as const;

/** Island 2 (Ember Isle) — volcanic, dangerous, has teleport portal */
export const EMBER_ISLAND = {
  minCX: 8,
  minCZ: 0,
  maxCX: 12,
  maxCZ: 4,
  /** Teleport portal location in WORLD coordinates (center of island) */
  portalX: 10 * 32 + 16, // chunk 10, middle = block 336
  portalZ: 2 * 32 + 16, // chunk 2, middle = block 80
  portalY: 42, // slightly raised platform
} as const;

/** Ocean fills everything between/around the islands */
export const ISLAND_WORLD = {
  /** Total chunk bounds for the island world */
  minCX: -1,
  minCZ: -1,
  maxCX: 13,
  maxCZ: 5,
  /** Sea level for islands (same as main world) */
  seaLevel: 32,
} as const;

/** Teleport portal radius in blocks (circular platform) */
export const PORTAL_RADIUS = 5;

/** Teleport trigger radius in blocks (how close player must be to teleport) */
export const PORTAL_TRIGGER_RADIUS = 3;

/** Main world spawn point (where player lands after teleporting) */
export const MAIN_WORLD_SPAWN = {
  x: 2048,
  y: 50, // will be adjusted to surface
  z: 2048,
} as const;

/** Player world type */
export type PlayerWorldType = 'islands' | 'main';
