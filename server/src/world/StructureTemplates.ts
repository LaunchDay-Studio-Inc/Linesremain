// ─── Structure Templates ───
// Procedurally-generated monument templates for world generation.
// Each template defines blocks and entity spawn points using loops — no hardcoded block-by-block data.

import { BlockType } from '@lineremain/shared';

// ─── Types ───

export interface StructureBlock {
  localX: number;
  localY: number;
  localZ: number;
  blockType: BlockType;
}

export interface EntitySpawn {
  localX: number;
  localY: number;
  localZ: number;
  entityType: string; // e.g. 'loot_container', 'hostile_npc'
}

export interface StructureTemplate {
  name: string;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  blocks: StructureBlock[];
  entitySpawns: EntitySpawn[];
  /** If true, this monument must be placed near water (sea level). */
  requiresWater?: boolean;
}

// ─── Helper Functions ───

function addBlock(blocks: StructureBlock[], x: number, y: number, z: number, type: BlockType): void {
  blocks.push({ localX: x, localY: y, localZ: z, blockType: type });
}

/** Build a filled rectangular box of blocks. */
function fillBox(
  blocks: StructureBlock[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  type: BlockType,
): void {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        addBlock(blocks, x, y, z, type);
      }
    }
  }
}

/** Build hollow walls of a rectangular room (floor included, no roof). */
function hollowBox(
  blocks: StructureBlock[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  wallType: BlockType,
  floorType: BlockType,
): void {
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      // Floor
      addBlock(blocks, x, y1, z, floorType);
      // Walls — only on edges
      if (x === x1 || x === x2 || z === z1 || z === z2) {
        for (let y = y1 + 1; y <= y2; y++) {
          addBlock(blocks, x, y, z, wallType);
        }
      }
    }
  }
}

/** Build a cylinder (approximated) centered at (cx, cz) with given radius and height range. */
function cylinder(
  blocks: StructureBlock[],
  cx: number, cz: number,
  radius: number,
  yStart: number, yEnd: number,
  type: BlockType,
  hollow: boolean,
): void {
  const r2 = radius * radius;
  const innerR2 = hollow ? (radius - 1) * (radius - 1) : -1;
  for (let x = cx - radius; x <= cx + radius; x++) {
    for (let z = cz - radius; z <= cz + radius; z++) {
      const dist2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (dist2 <= r2 && (!hollow || dist2 >= innerR2)) {
        for (let y = yStart; y <= yEnd; y++) {
          addBlock(blocks, x, y, z, type);
        }
      }
    }
  }
}

/** Deterministic pseudo-random based on position — used for collapse effects. */
function shouldCollapse(x: number, y: number, z: number, chance: number): boolean {
  // Simple hash
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  h = (h ^ (h >> 16)) >>> 0;
  return (h / 4294967296) < chance;
}

// ═══════════════════════════════════════════════════════════
// 1. Abandoned Outpost (24×8×24)
// ═══════════════════════════════════════════════════════════

function buildAbandonedOutpost(): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const spawns: EntitySpawn[] = [];

  const sizeX = 24, sizeY = 8, sizeZ = 24;

  // Stone floor
  fillBox(blocks, 0, 0, 0, sizeX - 1, 0, sizeZ - 1, BlockType.Stone);

  // Outer walls (cobblestone, 5 blocks high)
  const wallHeight = 5;
  for (let y = 1; y <= wallHeight; y++) {
    for (let x = 0; x < sizeX; x++) {
      for (let z = 0; z < sizeZ; z++) {
        const isEdge = x === 0 || x === sizeX - 1 || z === 0 || z === sizeZ - 1;
        if (!isEdge) continue;

        // Doorway gap: front wall center (z=0, x=10..13)
        if (z === 0 && x >= 10 && x <= 13 && y <= 3) continue;

        // Collapse: remove ~20% of top 2 rows on edges
        if (y >= wallHeight - 1 && shouldCollapse(x, y, z, 0.2)) continue;

        addBlock(blocks, x, y, z, BlockType.Cobblestone);
      }
    }
  }

  // Interior dividing wall creating 2 rooms (x=12, z=4..20)
  for (let y = 1; y <= 4; y++) {
    for (let z = 4; z <= 20; z++) {
      // Door gap in interior wall (z=11..13)
      if (z >= 11 && z <= 13 && y <= 3) continue;
      if (shouldCollapse(12, y, z, 0.15)) continue;
      addBlock(blocks, 12, y, z, BlockType.Cobblestone);
    }
  }

  // Loot container spawns (4 — two per room)
  spawns.push({ localX: 3, localY: 1, localZ: 5, entityType: 'loot_container' });
  spawns.push({ localX: 8, localY: 1, localZ: 18, entityType: 'loot_container' });
  spawns.push({ localX: 16, localY: 1, localZ: 6, entityType: 'loot_container' });
  spawns.push({ localX: 20, localY: 1, localZ: 17, entityType: 'loot_container' });

  // Hostile NPC spawns (2)
  spawns.push({ localX: 6, localY: 1, localZ: 12, entityType: 'hostile_npc' });
  spawns.push({ localX: 18, localY: 1, localZ: 12, entityType: 'hostile_npc' });

  return { name: 'Abandoned Outpost', sizeX, sizeY, sizeZ, blocks, entitySpawns: spawns };
}

// ═══════════════════════════════════════════════════════════
// 2. Collapsed Silo (12×20×12)
// ═══════════════════════════════════════════════════════════

function buildCollapsedSilo(): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const spawns: EntitySpawn[] = [];

  const sizeX = 12, sizeY = 20, sizeZ = 12;
  const cx = 6, cz = 6;
  const radius = 5;

  // Base floor
  cylinder(blocks, cx, cz, radius, 0, 0, BlockType.Stone, false);

  // Cylindrical tower walls (cobblestone, hollow)
  for (let y = 1; y <= 18; y++) {
    // Top 1/3 (y >= 13): broken open — remove ~50% of blocks
    const isTopSection = y >= 13;

    const r2 = radius * radius;
    const innerR2 = (radius - 1) * (radius - 1);

    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let z = cz - radius; z <= cz + radius; z++) {
        const dist2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        if (dist2 <= r2 && dist2 >= innerR2) {
          if (isTopSection && shouldCollapse(x, y, z, 0.5)) continue;
          addBlock(blocks, x, y, z, BlockType.Cobblestone);
        }
      }
    }
  }

  // Spiral staircase inside (stone blocks going up in a circle)
  for (let y = 1; y <= 16; y++) {
    const angle = (y / 16) * Math.PI * 4; // 2 full rotations
    const stairX = cx + Math.round(Math.cos(angle) * 3);
    const stairZ = cz + Math.round(Math.sin(angle) * 3);
    addBlock(blocks, stairX, y, stairZ, BlockType.Stone);
    // Add adjacent block for wider stairs
    const adjX = cx + Math.round(Math.cos(angle) * 2);
    const adjZ = cz + Math.round(Math.sin(angle) * 2);
    addBlock(blocks, adjX, y, adjZ, BlockType.Stone);
  }

  // Small room at base (interior floor area)
  fillBox(blocks, cx - 3, 0, cz - 3, cx + 3, 0, cz + 3, BlockType.Stone);

  // Metal accents at top (decorative antenna remnants)
  for (let y = 17; y <= 19; y++) {
    if (!shouldCollapse(cx, y, cz, 0.3)) {
      addBlock(blocks, cx, y, cz, BlockType.MetalOre);
    }
  }

  // Loot spawns (3: 1 at base, 2 at mid-level)
  spawns.push({ localX: cx, localY: 1, localZ: cz, entityType: 'loot_container' });
  spawns.push({ localX: cx + 2, localY: 8, localZ: cz, entityType: 'loot_container' });
  spawns.push({ localX: cx - 2, localY: 12, localZ: cz, entityType: 'loot_container' });

  // Hostile NPC spawns (3)
  spawns.push({ localX: cx - 1, localY: 1, localZ: cz + 2, entityType: 'hostile_npc' });
  spawns.push({ localX: cx + 1, localY: 6, localZ: cz - 1, entityType: 'hostile_npc' });
  spawns.push({ localX: cx, localY: 10, localZ: cz + 1, entityType: 'hostile_npc' });

  return { name: 'Collapsed Silo', sizeX, sizeY, sizeZ, blocks, entitySpawns: spawns };
}

// ═══════════════════════════════════════════════════════════
// 3. Reclamation Yard (32×6×32)
// ═══════════════════════════════════════════════════════════

function buildReclamationYard(): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const spawns: EntitySpawn[] = [];

  const sizeX = 32, sizeY = 6, sizeZ = 32;

  // Gravel ground
  fillBox(blocks, 0, 0, 0, sizeX - 1, 0, sizeZ - 1, BlockType.Gravel);

  // Perimeter walls (partial, with gaps — scattered barriers)
  // North wall segments
  for (let x = 0; x < sizeX; x++) {
    if ((x >= 5 && x <= 10) || (x >= 20 && x <= 26)) {
      for (let y = 1; y <= 3; y++) {
        if (shouldCollapse(x, y, 0, 0.15)) continue;
        addBlock(blocks, x, y, 0, BlockType.Stone);
      }
    }
  }
  // South wall segments
  for (let x = 0; x < sizeX; x++) {
    if ((x >= 2 && x <= 8) || (x >= 16 && x <= 22)) {
      for (let y = 1; y <= 3; y++) {
        if (shouldCollapse(x, y, sizeZ - 1, 0.15)) continue;
        addBlock(blocks, x, y, sizeZ - 1, BlockType.Stone);
      }
    }
  }

  // Container structures — 3 small boxes (5×4×5 of planks with openings)
  const containers: Array<{ x: number; z: number }> = [
    { x: 3, z: 5 },
    { x: 14, z: 14 },
    { x: 24, z: 6 },
  ];
  for (const c of containers) {
    // Floor
    fillBox(blocks, c.x, 0, c.z, c.x + 4, 0, c.z + 4, BlockType.Planks);
    // Walls (4 high)
    for (let y = 1; y <= 3; y++) {
      for (let x = c.x; x <= c.x + 4; x++) {
        for (let z = c.z; z <= c.z + 4; z++) {
          const isEdge = x === c.x || x === c.x + 4 || z === c.z || z === c.z + 4;
          if (!isEdge) continue;
          // Opening on south face center
          if (z === c.z + 4 && x >= c.x + 1 && x <= c.x + 3 && y <= 2) continue;
          addBlock(blocks, x, y, z, BlockType.Planks);
        }
      }
    }
  }

  // Broken vehicle shape (cobblestone blocks in rough car outline at x=8..14, z=22..26)
  // Base/wheels
  fillBox(blocks, 8, 1, 22, 14, 1, 26, BlockType.Cobblestone);
  // Body
  fillBox(blocks, 9, 2, 23, 13, 2, 25, BlockType.Cobblestone);
  // Cabin
  fillBox(blocks, 10, 3, 23, 12, 3, 25, BlockType.Cobblestone);

  // Interior barriers/walls (scattered stone walls)
  for (let z = 10; z <= 12; z++) {
    for (let y = 1; y <= 2; y++) {
      addBlock(blocks, 20, y, z, BlockType.Stone);
    }
  }
  for (let x = 5; x <= 8; x++) {
    for (let y = 1; y <= 2; y++) {
      addBlock(blocks, x, y, 20, BlockType.Stone);
    }
  }

  // Loot spawns (6)
  spawns.push({ localX: 4, localY: 1, localZ: 7, entityType: 'loot_container' });
  spawns.push({ localX: 15, localY: 1, localZ: 16, entityType: 'loot_container' });
  spawns.push({ localX: 25, localY: 1, localZ: 8, entityType: 'loot_container' });
  spawns.push({ localX: 11, localY: 2, localZ: 24, entityType: 'loot_container' });
  spawns.push({ localX: 28, localY: 1, localZ: 20, entityType: 'loot_container' });
  spawns.push({ localX: 6, localY: 1, localZ: 28, entityType: 'loot_container' });

  // NPC spawns (4)
  spawns.push({ localX: 10, localY: 1, localZ: 10, entityType: 'hostile_npc' });
  spawns.push({ localX: 22, localY: 1, localZ: 15, entityType: 'hostile_npc' });
  spawns.push({ localX: 5, localY: 1, localZ: 25, entityType: 'hostile_npc' });
  spawns.push({ localX: 26, localY: 1, localZ: 26, entityType: 'hostile_npc' });

  return { name: 'Reclamation Yard', sizeX, sizeY, sizeZ, blocks, entitySpawns: spawns };
}

// ═══════════════════════════════════════════════════════════
// 4. Signal Tower (8×30×8)
// ═══════════════════════════════════════════════════════════

function buildSignalTower(): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const spawns: EntitySpawn[] = [];

  const sizeX = 8, sizeY = 30, sizeZ = 8;

  // Base building (8×4×8 cobblestone)
  hollowBox(blocks, 0, 0, 0, 7, 4, 7, BlockType.Cobblestone, BlockType.Stone);
  // Doorway (front wall z=0, x=3..4, y=1..3)
  // Remove door blocks after hollowBox
  // We re-populate by adding air entries isn't needed — just skip the add.
  // Actually hollowBox already placed them, so we need to filter or just build walls manually.
  // Let's rebuild the base properly:
  // Clear the blocks list and redo the base...

  // Actually, let's just build this from scratch more carefully:
  blocks.length = 0;

  // Base floor
  fillBox(blocks, 0, 0, 0, 7, 0, 7, BlockType.Stone);

  // Base walls (y 1-4)
  for (let y = 1; y <= 4; y++) {
    for (let x = 0; x <= 7; x++) {
      for (let z = 0; z <= 7; z++) {
        const isEdge = x === 0 || x === 7 || z === 0 || z === 7;
        if (!isEdge) continue;
        // Doorway on south face
        if (z === 0 && (x === 3 || x === 4) && y <= 3) continue;
        addBlock(blocks, x, y, z, BlockType.Cobblestone);
      }
    }
  }

  // Roof of base building
  fillBox(blocks, 0, 5, 0, 7, 5, 7, BlockType.Cobblestone);

  // Lattice tower pillars (4 corner pillars from y=5 to y=25)
  const pillars: Array<[number, number]> = [[1, 1], [1, 6], [6, 1], [6, 6]];
  for (const [px, pz] of pillars) {
    for (let y = 5; y <= 25; y++) {
      addBlock(blocks, px, y, pz, BlockType.Cobblestone);
    }
  }

  // Cross-braces every 5 blocks (y=10, 15, 20, 25)
  for (const braceY of [10, 15, 20, 25]) {
    // X-axis braces
    for (let x = 2; x <= 5; x++) {
      addBlock(blocks, x, braceY, 1, BlockType.Cobblestone);
      addBlock(blocks, x, braceY, 6, BlockType.Cobblestone);
    }
    // Z-axis braces
    for (let z = 2; z <= 5; z++) {
      addBlock(blocks, 1, braceY, z, BlockType.Cobblestone);
      addBlock(blocks, 6, braceY, z, BlockType.Cobblestone);
    }
  }

  // Antenna at top (thin column of metal ore blocks — decorative, y=26..29)
  for (let y = 26; y <= 29; y++) {
    addBlock(blocks, 3, y, 3, BlockType.MetalOre);
    addBlock(blocks, 4, y, 4, BlockType.MetalOre);
  }

  // Loot spawns (2 in base building)
  spawns.push({ localX: 2, localY: 1, localZ: 2, entityType: 'loot_container' });
  spawns.push({ localX: 5, localY: 1, localZ: 5, entityType: 'loot_container' });

  // NPC spawn (1)
  spawns.push({ localX: 4, localY: 1, localZ: 4, entityType: 'hostile_npc' });

  return { name: 'Signal Tower', sizeX, sizeY, sizeZ, blocks, entitySpawns: spawns };
}

// ═══════════════════════════════════════════════════════════
// 5. Harbor Ruin (40×8×20)
// ═══════════════════════════════════════════════════════════

function buildHarborRuin(): StructureTemplate {
  const blocks: StructureBlock[] = [];
  const spawns: EntitySpawn[] = [];

  const sizeX = 40, sizeY = 8, sizeZ = 20;

  // Shore area (z=0..9): gravel ground
  fillBox(blocks, 0, 0, 0, sizeX - 1, 0, 9, BlockType.Gravel);

  // Warehouse on shore (cobblestone walls, no roof) at x=2..14, z=1..8
  for (let y = 1; y <= 4; y++) {
    for (let x = 2; x <= 14; x++) {
      for (let z = 1; z <= 8; z++) {
        const isEdge = x === 2 || x === 14 || z === 1 || z === 8;
        if (!isEdge) continue;
        // Front door (z=1, x=7..9)
        if (z === 1 && x >= 7 && x <= 9 && y <= 3) continue;
        // Collapse on upper rows
        if (y >= 3 && shouldCollapse(x, y, z, 0.25)) continue;
        addBlock(blocks, x, y, z, BlockType.Cobblestone);
      }
    }
  }
  // Warehouse floor
  fillBox(blocks, 3, 0, 2, 13, 0, 7, BlockType.Stone);

  // Wooden dock extending from shore into water (z=10..19)
  // Log supports (every 4 blocks along x, at z=10,14,18)
  for (let x = 4; x < sizeX - 4; x += 4) {
    for (const dockZ of [10, 14, 18]) {
      if (dockZ >= sizeZ) continue;
      // Support posts go from y=0 down (underwater) — just place at y=0 and y=1
      addBlock(blocks, x, 0, dockZ, BlockType.Log);
      addBlock(blocks, x, 1, dockZ, BlockType.Log);
    }
  }

  // Plank deck on dock (y=2, z=10..19)
  for (let x = 2; x < sizeX - 2; x++) {
    for (let z = 10; z <= 19; z++) {
      // Partially sunken section (z >= 16): some planks below water level at y=1
      if (z >= 16 && shouldCollapse(x, 2, z, 0.35)) {
        addBlock(blocks, x, 1, z, BlockType.Planks); // sunken plank
      } else if (z >= 16 && shouldCollapse(x, 1, z, 0.2)) {
        // Missing plank — gap in dock
        continue;
      } else {
        addBlock(blocks, x, 2, z, BlockType.Planks);
      }
    }
  }

  // Dock railings (planks at y=3 on edges of dock, sparse)
  for (let x = 3; x < sizeX - 3; x += 2) {
    if (!shouldCollapse(x, 3, 10, 0.4)) {
      addBlock(blocks, x, 3, 10, BlockType.Planks);
    }
    if (!shouldCollapse(x, 3, 19, 0.5)) {
      addBlock(blocks, x, 3, 19, BlockType.Planks);
    }
  }

  // Crane shape (logs + cobblestone in L-shape) at x=18..20, z=8..10
  // Vertical arm
  for (let y = 1; y <= 7; y++) {
    addBlock(blocks, 19, y, 9, BlockType.Log);
  }
  // Horizontal arm
  for (let x = 19; x <= 25; x++) {
    addBlock(blocks, x, 7, 9, BlockType.Log);
  }
  // Counterweight
  addBlock(blocks, 25, 6, 9, BlockType.Cobblestone);
  addBlock(blocks, 25, 5, 9, BlockType.Cobblestone);
  // Base
  addBlock(blocks, 18, 1, 9, BlockType.Cobblestone);
  addBlock(blocks, 20, 1, 9, BlockType.Cobblestone);
  addBlock(blocks, 19, 1, 8, BlockType.Cobblestone);
  addBlock(blocks, 19, 1, 10, BlockType.Cobblestone);

  // Loot spawns (5)
  spawns.push({ localX: 5, localY: 1, localZ: 4, entityType: 'loot_container' });
  spawns.push({ localX: 11, localY: 1, localZ: 6, entityType: 'loot_container' });
  spawns.push({ localX: 10, localY: 3, localZ: 13, entityType: 'loot_container' });
  spawns.push({ localX: 25, localY: 3, localZ: 12, entityType: 'loot_container' });
  spawns.push({ localX: 34, localY: 3, localZ: 15, entityType: 'loot_container' });

  // NPC spawns (3)
  spawns.push({ localX: 8, localY: 1, localZ: 3, entityType: 'hostile_npc' });
  spawns.push({ localX: 20, localY: 3, localZ: 14, entityType: 'hostile_npc' });
  spawns.push({ localX: 30, localY: 3, localZ: 11, entityType: 'hostile_npc' });

  return {
    name: 'Harbor Ruin',
    sizeX, sizeY, sizeZ,
    blocks,
    entitySpawns: spawns,
    requiresWater: true,
  };
}

// ═══════════════════════════════════════════════════════════
// Export all templates
// ═══════════════════════════════════════════════════════════

export const MONUMENT_TEMPLATES: Record<string, StructureTemplate> = {
  abandoned_outpost: buildAbandonedOutpost(),
  collapsed_silo: buildCollapsedSilo(),
  reclamation_yard: buildReclamationYard(),
  signal_tower: buildSignalTower(),
  harbor_ruin: buildHarborRuin(),
};