// ─── Building Renderer ───
// Renders placed building pieces in the 3D world using Three.js.
// Creates tier-based materials, reuses geometries via pooling, and manages
// building meshes keyed by entity ID.

import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import * as THREE from 'three';
import type { LightingSystem } from '../systems/LightingSystem';

// ─── Constants ───

const FOUNDATION_SIZE = 3;
const WALL_HEIGHT = 3;

// ─── Tier Colors ───

const TIER_COLORS: Record<BuildingTier, number> = {
  [BuildingTier.Twig]: 0x8b7355, // brown twigs
  [BuildingTier.Wood]: 0xa0522d, // sienna wood
  [BuildingTier.Stone]: 0x808080, // gray stone
  [BuildingTier.Metal]: 0x708090, // slate gray metal
  [BuildingTier.Armored]: 0x2f4f4f, // dark slate armored
};

const TIER_ROUGHNESS: Record<BuildingTier, number> = {
  [BuildingTier.Twig]: 1.0,
  [BuildingTier.Wood]: 0.8,
  [BuildingTier.Stone]: 0.6,
  [BuildingTier.Metal]: 0.3,
  [BuildingTier.Armored]: 0.2,
};

const TIER_METALNESS: Record<BuildingTier, number> = {
  [BuildingTier.Twig]: 0.0,
  [BuildingTier.Wood]: 0.0,
  [BuildingTier.Stone]: 0.1,
  [BuildingTier.Metal]: 0.7,
  [BuildingTier.Armored]: 0.9,
};

// ─── Geometry Cache ───

const geometryCache = new Map<string, THREE.BufferGeometry>();

function getOrCreateGeometry(
  key: string,
  factory: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  let geo = geometryCache.get(key);
  if (!geo) {
    geo = factory();
    geometryCache.set(key, geo);
  }
  return geo;
}

// ─── Material Cache ───

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function getTierMaterial(tier: BuildingTier, opacity = 1): THREE.MeshStandardMaterial {
  const key = `tier-${tier}-${opacity}`;
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: TIER_COLORS[tier],
      roughness: TIER_ROUGHNESS[tier],
      metalness: TIER_METALNESS[tier],
      transparent: opacity < 1,
      opacity,
    });
    materialCache.set(key, mat);
  }
  return mat;
}

// ─── Geometry Factories ───

function createFoundationGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry(
    'foundation',
    () => new THREE.BoxGeometry(FOUNDATION_SIZE, 0.3, FOUNDATION_SIZE),
  );
}

function createFoundationTriangleGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('foundation-tri', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-FOUNDATION_SIZE / 2, -FOUNDATION_SIZE / 2);
    shape.lineTo(FOUNDATION_SIZE / 2, -FOUNDATION_SIZE / 2);
    shape.lineTo(0, FOUNDATION_SIZE / 2);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
}

function createWallGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry(
    'wall',
    () => new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT, 0.2),
  );
}

function createHalfWallGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry(
    'half-wall',
    () => new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT / 2, 0.2),
  );
}

function createDoorwayGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('doorway', () => {
    // Wall with a door-sized hole — use CSG-like approach via shape
    const shape = new THREE.Shape();
    const hw = FOUNDATION_SIZE / 2;
    const hh = WALL_HEIGHT / 2;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();

    // Door hole
    const doorWidth = 1;
    const doorHeight = 2;
    const hole = new THREE.Path();
    hole.moveTo(-doorWidth / 2, -hh);
    hole.lineTo(doorWidth / 2, -hh);
    hole.lineTo(doorWidth / 2, -hh + doorHeight);
    hole.lineTo(-doorWidth / 2, -hh + doorHeight);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    geo.translate(0, 0, -0.1);
    return geo;
  });
}

function createWindowFrameGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('window-frame', () => {
    const shape = new THREE.Shape();
    const hw = FOUNDATION_SIZE / 2;
    const hh = WALL_HEIGHT / 2;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();

    // Window hole
    const winW = 1;
    const winH = 0.8;
    const hole = new THREE.Path();
    hole.moveTo(-winW / 2, 0);
    hole.lineTo(winW / 2, 0);
    hole.lineTo(winW / 2, winH);
    hole.lineTo(-winW / 2, winH);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    geo.translate(0, 0, -0.1);
    return geo;
  });
}

function createFloorGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry(
    'floor',
    () => new THREE.BoxGeometry(FOUNDATION_SIZE, 0.2, FOUNDATION_SIZE),
  );
}

function createStairsGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('stairs', () => {
    const steps = 6;
    const stepHeight = WALL_HEIGHT / steps;
    const stepDepth = FOUNDATION_SIZE / steps;
    const geometries: THREE.BoxGeometry[] = [];

    for (let i = 0; i < steps; i++) {
      const step = new THREE.BoxGeometry(FOUNDATION_SIZE, stepHeight, stepDepth);
      step.translate(
        0,
        stepHeight * i + stepHeight / 2 - WALL_HEIGHT / 2,
        stepDepth * i + stepDepth / 2 - FOUNDATION_SIZE / 2,
      );
      geometries.push(step);
    }

    // Merge step geometries
    if (geometries.length > 0) {
      const merged = mergeGeometries(geometries);
      if (merged) return merged;
    }
    return new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT, FOUNDATION_SIZE);
  });
}

function createRoofGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('roof', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-FOUNDATION_SIZE / 2, 0);
    shape.lineTo(FOUNDATION_SIZE / 2, 0);
    shape.lineTo(0, 1.5);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: FOUNDATION_SIZE, bevelEnabled: false });
    geo.translate(0, 0, -FOUNDATION_SIZE / 2);
    return geo;
  });
}

function createDoorGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('door', () => new THREE.BoxGeometry(1, 2, 0.1));
}

function createFenceGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('fence', () => new THREE.BoxGeometry(FOUNDATION_SIZE, 1, 0.1));
}

function createPillarGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('pillar', () => new THREE.BoxGeometry(0.3, WALL_HEIGHT, 0.3));
}

function createCampfireGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('campfire', () => {
    // Low cylinder for the stone ring base
    return new THREE.CylinderGeometry(0.45, 0.5, 0.2, 8);
  });
}

function createSleepingBagGeometry(): THREE.BufferGeometry {
  return getOrCreateGeometry('sleeping_bag', () => {
    return new THREE.BoxGeometry(1.8, 0.2, 0.8);
  });
}

// ─── Helper: Merge BufferGeometries ───

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  // Simple manual merge for position + normal + uv
  let totalVerts = 0;
  for (const g of geometries) {
    totalVerts += g.getAttribute('position').count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];
  let vertOffset = 0;

  for (const g of geometries) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const norm = g.getAttribute('normal') as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      positions[(vertOffset + i) * 3] = pos.getX(i);
      positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);
      normals[(vertOffset + i) * 3] = norm.getX(i);
      normals[(vertOffset + i) * 3 + 1] = norm.getY(i);
      normals[(vertOffset + i) * 3 + 2] = norm.getZ(i);
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices.push(g.index.getX(i) + vertOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(vertOffset + i);
      }
    }

    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

// ─── Geometry by Piece Type ───

function getGeometryForPiece(pieceType: BuildingPieceType): THREE.BufferGeometry {
  switch (pieceType) {
    case BuildingPieceType.Foundation:
      return createFoundationGeometry();
    case BuildingPieceType.FoundationTriangle:
      return createFoundationTriangleGeometry();
    case BuildingPieceType.Wall:
      return createWallGeometry();
    case BuildingPieceType.HalfWall:
      return createHalfWallGeometry();
    case BuildingPieceType.Doorway:
      return createDoorwayGeometry();
    case BuildingPieceType.WindowFrame:
      return createWindowFrameGeometry();
    case BuildingPieceType.WallFrame:
      return createDoorwayGeometry(); // reuse doorway shape
    case BuildingPieceType.Floor:
      return createFloorGeometry();
    case BuildingPieceType.FloorTriangle:
      return createFoundationTriangleGeometry();
    case BuildingPieceType.FloorGrill:
      return createFloorGeometry();
    case BuildingPieceType.Stairs:
      return createStairsGeometry();
    case BuildingPieceType.Roof:
      return createRoofGeometry();
    case BuildingPieceType.Door:
      return createDoorGeometry();
    case BuildingPieceType.Fence:
      return createFenceGeometry();
    case BuildingPieceType.Pillar:
      return createPillarGeometry();
    case BuildingPieceType.Campfire:
      return createCampfireGeometry();
    case BuildingPieceType.SleepingBag:
      return createSleepingBagGeometry();
    default:
      return createFoundationGeometry();
  }
}

// ─── Building Renderer Class ───

export class BuildingRenderer {
  private scene: THREE.Scene;
  private meshes = new Map<number, THREE.Mesh>();
  private lightingSystem: LightingSystem | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Wire up the lighting system for campfire point lights */
  setLightingSystem(lightingSystem: LightingSystem): void {
    this.lightingSystem = lightingSystem;
  }

  // ─── Add a building piece to the scene ───

  addBuilding(
    entityId: number,
    pieceType: BuildingPieceType,
    tier: BuildingTier,
    position: { x: number; y: number; z: number },
    rotation: number,
  ): THREE.Mesh {
    // Remove existing if re-adding
    this.removeBuilding(entityId);

    const geometry = getGeometryForPiece(pieceType);
    const material = getTierMaterial(tier);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { entityId, pieceType, tier };

    // Campfire: replace material with stone gray and register with lighting system
    if (pieceType === BuildingPieceType.Campfire) {
      mesh.material = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });
      if (this.lightingSystem) {
        this.lightingSystem.addLight(
          entityId,
          new THREE.Vector3(position.x, position.y, position.z),
          'campfire',
        );
      } else {
        // Fallback: inline point light if no lighting system
        const fireLight = new THREE.PointLight(0xff8c00, 1.5, 15, 2);
        fireLight.position.set(0, 0.5, 0);
        fireLight.castShadow = false;
        mesh.add(fireLight);
      }
    }

    // Sleeping bag: dark red-brown material
    if (pieceType === BuildingPieceType.SleepingBag) {
      mesh.material = new THREE.MeshStandardMaterial({ color: 0x8b2500, roughness: 0.8 });
    }

    this.scene.add(mesh);
    this.meshes.set(entityId, mesh);

    return mesh;
  }

  // ─── Update building tier (upgrade visual) ───

  upgradeTier(entityId: number, newTier: BuildingTier): void {
    const mesh = this.meshes.get(entityId);
    if (!mesh) return;

    mesh.material = getTierMaterial(newTier);
    mesh.userData.tier = newTier;
  }

  // ─── Remove a building from the scene ───

  removeBuilding(entityId: number): void {
    const mesh = this.meshes.get(entityId);
    if (mesh) {
      this.scene.remove(mesh);
      // Remove associated dynamic light if any
      if (this.lightingSystem) {
        this.lightingSystem.removeLight(entityId);
      }
      // Dispose cloned materials (non-shared) to prevent memory leaks
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const tier = mesh.userData.tier as BuildingTier;
      if (mat && mat !== getTierMaterial(tier)) {
        mat.dispose();
      }
      this.meshes.delete(entityId);
    }
  }

  // ─── Get mesh by entity ID ───

  getMesh(entityId: number): THREE.Mesh | undefined {
    return this.meshes.get(entityId);
  }

  // ─── Update health-based damage visual ───

  updateDamageVisual(entityId: number, healthPercent: number): void {
    const mesh = this.meshes.get(entityId);
    if (!mesh) return;

    // Darken the material as health decreases
    const baseMat = mesh.material as THREE.MeshStandardMaterial;
    const tier = mesh.userData.tier as BuildingTier;
    const baseColor = new THREE.Color(TIER_COLORS[tier]);

    // Lerp towards black as health drops
    const damageColor = baseColor.clone().lerp(new THREE.Color(0x1a1a1a), 1 - healthPercent);

    // Clone material only if needed (avoid shared material mutation)
    if (baseMat === getTierMaterial(tier)) {
      const cloned = baseMat.clone();
      cloned.color.copy(damageColor);
      mesh.material = cloned;
    } else {
      baseMat.color.copy(damageColor);
    }
  }

  // ─── Dispose all resources ───

  dispose(): void {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
    }
    this.meshes.clear();
  }

  // ─── Static: Cleanup shared caches ───

  static disposeSharedCaches(): void {
    for (const geo of geometryCache.values()) {
      geo.dispose();
    }
    geometryCache.clear();

    for (const mat of materialCache.values()) {
      mat.dispose();
    }
    materialCache.clear();
  }
}
