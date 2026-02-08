// ─── Block Interaction System ───
// Handles block breaking (left mouse) and block placing (right mouse) via
// DDA voxel raycasting. Renders a wireframe highlight on the targeted block
// and tracks break progress with per-block hardness timing.

import * as THREE from 'three';
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
} from '@shared/constants/game';
import { BlockType } from '@shared/types/blocks';
import { BLOCK_REGISTRY } from '@shared/constants/blocks';
import { ITEM_REGISTRY } from '@shared/constants/items';
import { ClientMessage } from '@shared/types/network';
import type { ChunkManager } from '../world/ChunkManager';
import type { ParticleSystem } from '../engine/ParticleSystem';
import { InputManager } from '../engine/InputManager';
import { AudioManager } from '../engine/AudioManager';
import { socketClient } from '../network/SocketClient';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useGameStore } from '../stores/useGameStore';

// ─── Types ───

interface RaycastHit {
  /** World position of the solid block that was hit */
  blockPos: { x: number; y: number; z: number };
  /** World position of the air block adjacent to the hit face (for placing) */
  adjacentPos: { x: number; y: number; z: number };
}

// ─── Item-to-Block Mapping ───
// Maps item IDs to the block type they place when right-clicking
const ITEM_TO_BLOCK: Partial<Record<number, BlockType>> = {
  1: BlockType.Planks,        // Wood → Planks
  2: BlockType.Cobblestone,   // Stone → Cobblestone
  4: BlockType.Sand,          // Sand resource (Sulfur Ore) → Sand block
};

// ─── Constants ───

const MAX_REACH = 6; // blocks
const HIGHLIGHT_SIZE = 1.01; // slightly larger than a block to avoid z-fighting

// Approximate block colors for break particles (keyed by BlockType)
const BLOCK_COLORS: Partial<Record<BlockType, number>> = {
  [BlockType.Dirt]: 0x8b6b3d,
  [BlockType.Grass]: 0x5a8f29,
  [BlockType.Stone]: 0x888888,
  [BlockType.Sand]: 0xd2c47f,
  [BlockType.Snow]: 0xe8e8f0,
  [BlockType.Log]: 0x6b4226,
  [BlockType.Leaves]: 0x3a7a2a,
  [BlockType.Planks]: 0xb8954a,
  [BlockType.Cobblestone]: 0x777777,
  [BlockType.MetalOre]: 0x9a6e44,
  [BlockType.SulfurOre]: 0xb8a832,
  [BlockType.HQMOre]: 0x4488aa,
  [BlockType.Gravel]: 0x808080,
  [BlockType.Clay]: 0xa0887a,
  [BlockType.Cactus]: 0x2d7a3a,
  [BlockType.Ice]: 0xaaddff,
  [BlockType.MossyStone]: 0x6a8a6a,
};

// ─── Helpers ───

function blockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
}

// ─── Block Interaction System ───

export class BlockInteraction {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private chunkManager: ChunkManager;
  private particleSystem: ParticleSystem;
  private input: InputManager;

  // Highlight wireframe
  private highlightMesh: THREE.LineSegments;
  private highlightVisible = false;

  // Break overlay (darkens block as progress increases)
  private breakOverlayMesh: THREE.Mesh;
  private breakOverlayMat: THREE.MeshBasicMaterial;

  // Current target
  private targetBlock: { x: number; y: number; z: number } | null = null;
  private adjacentBlock: { x: number; y: number; z: number } | null = null;

  // Break progress
  private breakProgress = 0;
  private breakingBlock: { x: number; y: number; z: number } | null = null;

  // Right-click debounce (prevent placing every frame)
  private rightClickConsumed = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    chunkManager: ChunkManager,
    particleSystem: ParticleSystem,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.chunkManager = chunkManager;
    this.particleSystem = particleSystem;
    this.input = InputManager.getInstance();

    // Create wireframe highlight box
    const boxGeo = new THREE.BoxGeometry(HIGHLIGHT_SIZE, HIGHLIGHT_SIZE, HIGHLIGHT_SIZE);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 1,
      depthTest: true,
      transparent: true,
      opacity: 0.4,
    });

    this.highlightMesh = new THREE.LineSegments(edgesGeo, lineMat);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Create break overlay — a slightly inset dark box that darkens as break progress increases
    const overlayGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.breakOverlayMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.breakOverlayMesh = new THREE.Mesh(overlayGeo, this.breakOverlayMat);
    this.breakOverlayMesh.visible = false;
    this.breakOverlayMesh.renderOrder = 1;
    this.scene.add(this.breakOverlayMesh);
  }

  // ─── Update ───

  update(dt: number): void {
    // Perform raycast from camera
    const hit = this.raycast();

    if (hit) {
      // Update target
      this.targetBlock = hit.blockPos;
      this.adjacentBlock = hit.adjacentPos;

      // Position highlight at center of targeted block
      this.highlightMesh.position.set(
        hit.blockPos.x + 0.5,
        hit.blockPos.y + 0.5,
        hit.blockPos.z + 0.5,
      );
      this.highlightMesh.visible = true;
      this.highlightVisible = true;
    } else {
      this.targetBlock = null;
      this.adjacentBlock = null;

      if (this.highlightVisible) {
        this.highlightMesh.visible = false;
        this.highlightVisible = false;
      }

      // No target -- reset break progress
      this.breakProgress = 0;
      this.breakingBlock = null;
    }

    // Only process interactions when pointer is locked
    if (!this.input.isPointerLocked()) {
      this.breakProgress = 0;
      this.breakingBlock = null;
      this.rightClickConsumed = false;
      return;
    }

    // ── Block Breaking (left mouse held) ──
    this.updateBreaking(dt);

    // ── Block Placing (right mouse click) ──
    this.updatePlacing();

    // ── Update break overlay visibility ──
    if (this.breakingBlock && this.breakProgress > 0) {
      this.breakOverlayMesh.position.set(
        this.breakingBlock.x + 0.5,
        this.breakingBlock.y + 0.5,
        this.breakingBlock.z + 0.5,
      );
      this.breakOverlayMat.opacity = this.breakProgress * 0.6;
      this.breakOverlayMesh.visible = true;
    } else {
      this.breakOverlayMesh.visible = false;
      this.breakOverlayMat.opacity = 0;
    }
  }

  // ─── Breaking Logic ───

  private updateBreaking(dt: number): void {
    const leftDown = this.input.isMouseButtonDown(0);

    if (!leftDown || !this.targetBlock) {
      // Released or lost target
      this.breakProgress = 0;
      this.breakingBlock = null;
      return;
    }

    // Check if player is looking at a different block than the one being broken
    if (
      this.breakingBlock &&
      (this.breakingBlock.x !== this.targetBlock.x ||
        this.breakingBlock.y !== this.targetBlock.y ||
        this.breakingBlock.z !== this.targetBlock.z)
    ) {
      // Target changed -- reset progress
      this.breakProgress = 0;
    }

    this.breakingBlock = { ...this.targetBlock };

    // Get the block type at the target position
    const blockType = this.getBlockType(this.targetBlock.x, this.targetBlock.y, this.targetBlock.z);
    if (blockType === null || blockType === BlockType.Air) {
      this.breakProgress = 0;
      this.breakingBlock = null;
      return;
    }

    const def = BLOCK_REGISTRY[blockType];
    if (!def || def.hardness <= 0) {
      // Unbreakable (hardness -1) or zero-hardness
      if (def && def.hardness < 0) {
        // Unbreakable block -- do not progress
        this.breakProgress = 0;
        return;
      }
    }

    const hardness = def ? def.hardness : 1;
    if (hardness <= 0) {
      // Instant break for zero-hardness blocks
      this.breakBlock(this.targetBlock.x, this.targetBlock.y, this.targetBlock.z, blockType);
      this.breakProgress = 0;
      this.breakingBlock = null;
      return;
    }

    // Progress rate: 1 / hardness per second, modified by tool effectiveness
    let multiplier = 1;
    const held = usePlayerStore.getState().equipment?.held;
    if (held) {
      const toolDef = ITEM_REGISTRY[held.itemId];
      if (toolDef?.gatherMultiplier) {
        // Full multiplier if tool type matches block requirement, or no requirement
        if (!def?.toolRequired || toolDef.toolType === def.toolRequired) {
          multiplier = toolDef.gatherMultiplier;
        } else {
          // Wrong tool type -- still slightly faster than bare hands
          multiplier = Math.max(1, toolDef.gatherMultiplier * 0.25);
        }
      }
    }
    this.breakProgress += (multiplier / hardness) * dt;

    if (this.breakProgress >= 1) {
      this.breakBlock(this.targetBlock.x, this.targetBlock.y, this.targetBlock.z, blockType);
      this.breakProgress = 0;
      this.breakingBlock = null;
    }
  }

  private breakBlock(x: number, y: number, z: number, blockType: number): void {
    // Remove locally
    this.chunkManager.onBlockChanged(x, y, z, BlockType.Air);

    // Notify server (only if not in offline mode)
    const isOffline = useGameStore.getState().isOffline;
    if (!isOffline) {
      socketClient.emit(ClientMessage.BlockBreak, { x, y, z });
    }

    // Spawn break particles
    const color = BLOCK_COLORS[blockType as BlockType] ?? 0x888888;
    this.particleSystem.emitBlockBreak(
      new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
      new THREE.Color(color),
    );

    // Play break sound
    AudioManager.getInstance().play('blockBreak');
  }

  // ─── Placing Logic ───

  private updatePlacing(): void {
    const rightDown = this.input.isMouseButtonDown(2);

    if (!rightDown) {
      // Button released -- allow next click
      this.rightClickConsumed = false;
      return;
    }

    // Only place once per click
    if (this.rightClickConsumed) return;
    this.rightClickConsumed = true;

    if (!this.adjacentBlock) return;

    const { x, y, z } = this.adjacentBlock;

    // Bounds check
    if (y < 0 || y >= CHUNK_SIZE_Y) return;

    // Ensure the adjacent position is actually air
    const existing = this.getBlockType(x, y, z);
    if (existing !== null && existing !== BlockType.Air) return;

    // Determine block type from active hotbar item
    const store = usePlayerStore.getState();
    const heldItem = store.inventory[store.hotbarIndex];
    if (!heldItem) return; // Nothing in hotbar slot

    const placeType = ITEM_TO_BLOCK[heldItem.itemId];
    if (placeType === undefined) return; // Item is not placeable

    // Place locally
    this.chunkManager.onBlockChanged(x, y, z, placeType);

    // Notify server (only if not in offline mode)
    const isOffline = useGameStore.getState().isOffline;
    if (!isOffline) {
      socketClient.emit(ClientMessage.BlockPlace, { x, y, z, blockType: placeType });
    }

    // Consume one item from hotbar slot
    const updatedInventory = [...store.inventory];
    const slot = updatedInventory[store.hotbarIndex];
    if (slot) {
      if (slot.quantity <= 1) {
        updatedInventory[store.hotbarIndex] = null;
      } else {
        updatedInventory[store.hotbarIndex] = { ...slot, quantity: slot.quantity - 1 };
      }
      store.setInventory(updatedInventory);
    }

    // Play place sound
    AudioManager.getInstance().play('blockPlace');
  }

  // ─── DDA Voxel Raycast ───

  private raycast(): RaycastHit | null {
    // Get camera world position and forward direction
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    direction.normalize();

    // Current voxel coordinates
    let voxelX = Math.floor(origin.x);
    let voxelY = Math.floor(origin.y);
    let voxelZ = Math.floor(origin.z);

    // Step direction (+1 or -1)
    const stepX = direction.x >= 0 ? 1 : -1;
    const stepY = direction.y >= 0 ? 1 : -1;
    const stepZ = direction.z >= 0 ? 1 : -1;

    // tDelta: how far along the ray (in t) to move one full voxel in each axis
    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    // tMax: t value at which the ray crosses the first voxel boundary in each axis
    let tMaxX: number;
    let tMaxY: number;
    let tMaxZ: number;

    if (direction.x > 0) {
      tMaxX = (Math.floor(origin.x) + 1 - origin.x) / direction.x;
    } else if (direction.x < 0) {
      tMaxX = (Math.floor(origin.x) - origin.x) / direction.x;
    } else {
      tMaxX = Infinity;
    }

    if (direction.y > 0) {
      tMaxY = (Math.floor(origin.y) + 1 - origin.y) / direction.y;
    } else if (direction.y < 0) {
      tMaxY = (Math.floor(origin.y) - origin.y) / direction.y;
    } else {
      tMaxY = Infinity;
    }

    if (direction.z > 0) {
      tMaxZ = (Math.floor(origin.z) + 1 - origin.z) / direction.z;
    } else if (direction.z < 0) {
      tMaxZ = (Math.floor(origin.z) - origin.z) / direction.z;
    } else {
      tMaxZ = Infinity;
    }

    // Previous voxel (for adjacent/placing position)
    let prevX = voxelX;
    let prevY = voxelY;
    let prevZ = voxelZ;

    // Maximum number of steps to avoid infinite loops
    const maxSteps = Math.ceil(MAX_REACH * Math.SQRT2) + 2;

    for (let step = 0; step < maxSteps; step++) {
      // Check if we are out of vertical bounds
      if (voxelY < 0 || voxelY >= CHUNK_SIZE_Y) {
        // Step to next voxel (we still need to traverse through out-of-bounds)
        // but skip block checks
      } else {
        // Check current voxel for solid block
        const blockType = this.getBlockType(voxelX, voxelY, voxelZ);

        if (blockType !== null && blockType !== BlockType.Air && blockType !== BlockType.Water) {
          return {
            blockPos: { x: voxelX, y: voxelY, z: voxelZ },
            adjacentPos: { x: prevX, y: prevY, z: prevZ },
          };
        }
      }

      // Save previous position before stepping
      prevX = voxelX;
      prevY = voxelY;
      prevZ = voxelZ;

      // Step to the next voxel boundary (whichever axis is closest)
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          // Check distance
          if (tMaxX > MAX_REACH) break;
          voxelX += stepX;
          tMaxX += tDeltaX;
        } else {
          if (tMaxZ > MAX_REACH) break;
          voxelZ += stepZ;
          tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          if (tMaxY > MAX_REACH) break;
          voxelY += stepY;
          tMaxY += tDeltaY;
        } else {
          if (tMaxZ > MAX_REACH) break;
          voxelZ += stepZ;
          tMaxZ += tDeltaZ;
        }
      }
    }

    return null;
  }

  // ─── Block Lookups ───

  /**
   * Get the block type at a world position by resolving the chunk and local offset.
   * Returns null if the chunk is not loaded.
   */
  private getBlockType(worldX: number, worldY: number, worldZ: number): number | null {
    if (worldY < 0 || worldY >= CHUNK_SIZE_Y) return null;

    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);

    const data = this.chunkManager.getChunkData(cx, cz);
    if (!data) return null;

    const localX = ((worldX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((worldZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    return data[blockIndex(localX, worldY, localZ)] ?? null;
  }

  // ─── Queries ───

  /** Returns the current break progress as a value from 0 to 1. */
  getBreakProgress(): number {
    return this.breakProgress;
  }

  /** Returns the world position of the currently targeted block, or null. */
  getTargetBlock(): { x: number; y: number; z: number } | null {
    return this.targetBlock;
  }

  // ─── Cleanup ───

  dispose(): void {
    this.scene.remove(this.highlightMesh);
    this.highlightMesh.geometry.dispose();
    (this.highlightMesh.material as THREE.LineBasicMaterial).dispose();

    this.scene.remove(this.breakOverlayMesh);
    this.breakOverlayMesh.geometry.dispose();
    this.breakOverlayMat.dispose();

    this.targetBlock = null;
    this.adjacentBlock = null;
    this.breakingBlock = null;
    this.breakProgress = 0;
  }
}
