// ─── Resource Node Renderer ───
// Renders harvestable resource nodes (stone, metal ore, sulfur ore) as
// procedural rock clusters in the 3D world. Scales geometry by depletion
// ratio and displays a floating health bar when damaged.

import * as THREE from 'three';

// ─── Constants ───

/** Resource item IDs (from shared/constants/items) */
const STONE_ITEM_ID = 2;
const METAL_ORE_ITEM_ID = 3;
const SULFUR_ORE_ITEM_ID = 4;

/** Visual configuration per resource type */
const NODE_VISUALS: Record<number, { color: number; emissive: number; name: string }> = {
  [STONE_ITEM_ID]: { color: 0x8a8a8a, emissive: 0x000000, name: 'Stone' },
  [METAL_ORE_ITEM_ID]: { color: 0x7a6a55, emissive: 0x221100, name: 'Metal Ore' },
  [SULFUR_ORE_ITEM_ID]: { color: 0xc8b832, emissive: 0x332800, name: 'Sulfur Ore' },
};

/** Cluster layout — offsets for sub-rocks within a node group */
const CLUSTER_OFFSETS: { x: number; y: number; z: number; scale: number }[] = [
  { x: 0, y: 0, z: 0, scale: 1.0 },
  { x: 0.6, y: -0.15, z: 0.4, scale: 0.65 },
  { x: -0.5, y: -0.1, z: 0.5, scale: 0.7 },
  { x: 0.3, y: -0.2, z: -0.5, scale: 0.55 },
  { x: -0.4, y: -0.05, z: -0.3, scale: 0.5 },
];

const HEALTH_BAR_WIDTH = 1.2;
const HEALTH_BAR_HEIGHT = 0.12;
const HEALTH_BAR_Y_OFFSET = 1.8; // above the node center
const HEALTH_BAR_BG_COLOR = 0x333333;
const HEALTH_BAR_FG_COLOR = 0x44cc44;
const HEALTH_BAR_LOW_COLOR = 0xcc4444;
const INTERACT_RANGE = 5.0;

// ─── Shared Geometry ───

let sharedRockGeo: THREE.DodecahedronGeometry | null = null;
let sharedBarBgGeo: THREE.PlaneGeometry | null = null;
let sharedBarFgGeo: THREE.PlaneGeometry | null = null;

function getRockGeometry(): THREE.DodecahedronGeometry {
  if (!sharedRockGeo) {
    sharedRockGeo = new THREE.DodecahedronGeometry(0.5, 1);
    // Distort vertices for a natural rocky look
    const pos = sharedRockGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const noise = 0.85 + Math.random() * 0.3;
      pos.setX(i, pos.getX(i) * noise);
      pos.setY(i, pos.getY(i) * noise);
      pos.setZ(i, pos.getZ(i) * noise);
    }
    pos.needsUpdate = true;
    sharedRockGeo.computeVertexNormals();
  }
  return sharedRockGeo;
}

function getBarBgGeometry(): THREE.PlaneGeometry {
  if (!sharedBarBgGeo) {
    sharedBarBgGeo = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
  }
  return sharedBarBgGeo;
}

function getBarFgGeometry(): THREE.PlaneGeometry {
  if (!sharedBarFgGeo) {
    sharedBarFgGeo = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
  }
  return sharedBarFgGeo;
}

// ─── Node Data ───

interface ResourceNodeData {
  entityId: number;
  resourceItemId: number;
  amountRemaining: number;
  maxAmount: number;
}

// ─── Per-Node Render Entry ───

interface NodeEntry {
  group: THREE.Group;
  rockMeshes: THREE.Mesh[];
  healthBarBg: THREE.Mesh;
  healthBarFg: THREE.Mesh;
  data: ResourceNodeData;
  baseScale: number;
}

// ─── Resource Node Renderer Class ───

export class ResourceNodeRenderer {
  private scene: THREE.Scene;
  private nodes = new Map<number, NodeEntry>();

  /** Material cache keyed by resourceItemId */
  private materialCache = new Map<number, THREE.MeshStandardMaterial>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ─── Get or create material for a resource type ───

  private getMaterial(resourceItemId: number): THREE.MeshStandardMaterial {
    let mat = this.materialCache.get(resourceItemId);
    if (!mat) {
      const visual = NODE_VISUALS[resourceItemId] ?? {
        color: 0x888888,
        emissive: 0x000000,
        name: 'Unknown',
      };
      mat = new THREE.MeshStandardMaterial({
        color: visual.color,
        emissive: visual.emissive,
        roughness: 0.85,
        metalness: resourceItemId === METAL_ORE_ITEM_ID ? 0.4 : 0.1,
        flatShading: true,
      });
      this.materialCache.set(resourceItemId, mat);
    }
    return mat;
  }

  // ─── Add a resource node to the scene ───

  addNode(
    entityId: number,
    resourceItemId: number,
    amountRemaining: number,
    maxAmount: number,
    position: { x: number; y: number; z: number },
    rotation: number = 0,
  ): void {
    // Remove existing if present
    this.removeNode(entityId);

    const group = new THREE.Group();
    group.position.set(position.x, position.y, position.z);
    group.rotation.y = rotation;

    const geo = getRockGeometry();
    const mat = this.getMaterial(resourceItemId);

    // Create rock cluster
    const rockMeshes: THREE.Mesh[] = [];
    for (const offset of CLUSTER_OFFSETS) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offset.x, offset.y + offset.scale * 0.5, offset.z);
      mesh.scale.setScalar(offset.scale);
      // Randomize rotation per sub-rock for variety
      mesh.rotation.set(
        Math.random() * Math.PI * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 0.3,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      rockMeshes.push(mesh);
    }

    // Health bar (hidden when full)
    const barBgMat = new THREE.MeshBasicMaterial({
      color: HEALTH_BAR_BG_COLOR,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.7,
    });
    const barFgMat = new THREE.MeshBasicMaterial({
      color: HEALTH_BAR_FG_COLOR,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });

    const healthBarBg = new THREE.Mesh(getBarBgGeometry(), barBgMat);
    healthBarBg.position.set(0, HEALTH_BAR_Y_OFFSET, 0);
    healthBarBg.renderOrder = 999;
    healthBarBg.visible = false;
    group.add(healthBarBg);

    const healthBarFg = new THREE.Mesh(getBarFgGeometry(), barFgMat);
    healthBarFg.position.set(0, HEALTH_BAR_Y_OFFSET, 0);
    healthBarFg.renderOrder = 1000;
    healthBarFg.visible = false;
    group.add(healthBarFg);

    this.scene.add(group);

    const entry: NodeEntry = {
      group,
      rockMeshes,
      healthBarBg,
      healthBarFg,
      data: { entityId, resourceItemId, amountRemaining, maxAmount },
      baseScale: 1.0,
    };

    this.nodes.set(entityId, entry);

    // Apply initial depletion
    this.updateDepletion(entityId, amountRemaining, maxAmount);
  }

  // ─── Update resource depletion (scale + health bar) ───

  updateDepletion(entityId: number, amountRemaining: number, maxAmount: number): void {
    const entry = this.nodes.get(entityId);
    if (!entry) return;

    entry.data.amountRemaining = amountRemaining;
    entry.data.maxAmount = maxAmount;

    const ratio = maxAmount > 0 ? amountRemaining / maxAmount : 0;

    // Scale rocks by depletion: minimum 30% scale when nearly depleted
    const depletionScale = 0.3 + ratio * 0.7;
    entry.baseScale = depletionScale;

    for (let i = 0; i < entry.rockMeshes.length; i++) {
      const offset = CLUSTER_OFFSETS[i];
      if (!offset) continue;
      const mesh = entry.rockMeshes[i];
      if (!mesh) continue;
      const s = offset.scale * depletionScale;
      mesh.scale.setScalar(s);
      // Adjust Y so rocks sink as they shrink
      mesh.position.y = offset.y + s * 0.5;
    }

    // Show/hide health bar
    const isDamaged = ratio < 1.0 && ratio > 0;
    entry.healthBarBg.visible = isDamaged;
    entry.healthBarFg.visible = isDamaged;

    if (isDamaged) {
      // Scale foreground bar width by ratio
      entry.healthBarFg.scale.x = ratio;
      // Shift left so bar drains from right
      entry.healthBarFg.position.x = -(HEALTH_BAR_WIDTH * (1 - ratio)) / 2;

      // Color: green → red as health decreases
      const fgMat = entry.healthBarFg.material as THREE.MeshBasicMaterial;
      fgMat.color.setHex(ratio > 0.35 ? HEALTH_BAR_FG_COLOR : HEALTH_BAR_LOW_COLOR);
    }

    // If depleted, hide the whole group
    if (amountRemaining <= 0) {
      entry.group.visible = false;
    } else {
      entry.group.visible = true;
    }
  }

  // ─── Remove a resource node from the scene ───

  removeNode(entityId: number): void {
    const entry = this.nodes.get(entityId);
    if (entry) {
      // Dispose per-instance health bar materials (not shared)
      (entry.healthBarBg.material as THREE.Material).dispose();
      (entry.healthBarFg.material as THREE.Material).dispose();

      this.scene.remove(entry.group);
      this.nodes.delete(entityId);
    }
  }

  // ─── Update each frame: billboard health bars toward camera ───

  update(camera: THREE.Camera, playerPosition?: THREE.Vector3): { nearbyNodes: number[] } {
    const nearbyNodes: number[] = [];

    for (const [entityId, entry] of this.nodes) {
      if (!entry.group.visible) continue;

      // Billboard health bar to face camera
      if (entry.healthBarBg.visible) {
        entry.healthBarBg.quaternion.copy(camera.quaternion);
        entry.healthBarFg.quaternion.copy(camera.quaternion);
      }

      // Check interaction proximity
      if (playerPosition) {
        const dx = entry.group.position.x - playerPosition.x;
        const dy = entry.group.position.y - playerPosition.y;
        const dz = entry.group.position.z - playerPosition.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= INTERACT_RANGE * INTERACT_RANGE) {
          nearbyNodes.push(entityId);
        }
      }
    }

    return { nearbyNodes };
  }

  // ─── Get node data by entity ID ───

  getNodeData(entityId: number): ResourceNodeData | undefined {
    return this.nodes.get(entityId)?.data;
  }

  // ─── Get all node entity IDs ───

  getAllNodeIds(): number[] {
    return Array.from(this.nodes.keys());
  }

  // ─── Get the display name for a resource node ───

  getNodeName(entityId: number): string {
    const entry = this.nodes.get(entityId);
    if (!entry) return 'Unknown';
    const visual = NODE_VISUALS[entry.data.resourceItemId];
    return visual ? visual.name : 'Resource Node';
  }

  // ─── Dispose all resources ───

  dispose(): void {
    for (const [, entry] of this.nodes) {
      (entry.healthBarBg.material as THREE.Material).dispose();
      (entry.healthBarFg.material as THREE.Material).dispose();
      this.scene.remove(entry.group);
    }
    this.nodes.clear();

    for (const [, mat] of this.materialCache) {
      mat.dispose();
    }
    this.materialCache.clear();
  }

  // ─── Static: dispose shared geometries (call on app shutdown) ───

  static disposeSharedGeometries(): void {
    if (sharedRockGeo) {
      sharedRockGeo.dispose();
      sharedRockGeo = null;
    }
    if (sharedBarBgGeo) {
      sharedBarBgGeo.dispose();
      sharedBarBgGeo = null;
    }
    if (sharedBarFgGeo) {
      sharedBarFgGeo.dispose();
      sharedBarFgGeo = null;
    }
  }
}