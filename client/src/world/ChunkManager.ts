// ─── Chunk Manager ───

import * as THREE from 'three';
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  VIEW_DISTANCE_CHUNKS,
} from '@shared/constants/game';
import { meshChunk } from './ChunkMesher';
import type { NeighborChunks, ChunkMeshData } from './ChunkMesher';
import { createTextureAtlas, disposeTextureAtlas } from './TextureAtlas';

// ─── Types ───

interface LoadedChunk {
  data: Uint8Array;
  mesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
}

export type ChunkRequestCallback = (chunkX: number, chunkZ: number) => void;

// ─── Helpers ───

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function blockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
}

// ─── Chunk Manager ───

export class ChunkManager {
  private loadedChunks = new Map<string, LoadedChunk>();
  private pendingChunks = new Set<string>();
  private dirtyChunks = new Set<string>();

  // Rate-limit chunk rebuilds per frame to avoid frame spikes
  private static readonly MAX_REBUILDS_PER_FRAME = 2;

  private scene: THREE.Scene;
  private opaqueMaterial: THREE.MeshLambertMaterial;
  private transparentMaterial: THREE.MeshLambertMaterial;
  private onChunkRequest: ChunkRequestCallback | null = null;

  private viewDistance: number;

  constructor(scene: THREE.Scene, viewDistance = VIEW_DISTANCE_CHUNKS) {
    this.scene = scene;
    this.viewDistance = viewDistance;

    const atlas = createTextureAtlas();

    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      side: THREE.FrontSide,
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  // ─── Callbacks ───

  setChunkRequestCallback(cb: ChunkRequestCallback): void {
    this.onChunkRequest = cb;
  }

  // ─── Update Loop ───

  update(playerX: number, playerZ: number): void {
    const playerCX = Math.floor(playerX / CHUNK_SIZE_X);
    const playerCZ = Math.floor(playerZ / CHUNK_SIZE_Z);

    // Determine which chunks should be loaded
    const neededChunks = new Set<string>();

    for (let dx = -this.viewDistance; dx <= this.viewDistance; dx++) {
      for (let dz = -this.viewDistance; dz <= this.viewDistance; dz++) {
        // Circular view distance
        if (dx * dx + dz * dz > this.viewDistance * this.viewDistance) continue;

        const cx = playerCX + dx;
        const cz = playerCZ + dz;
        const key = chunkKey(cx, cz);
        neededChunks.add(key);

        // Request if not loaded and not pending
        if (!this.loadedChunks.has(key) && !this.pendingChunks.has(key)) {
          this.pendingChunks.add(key);
          this.onChunkRequest?.(cx, cz);
        }
      }
    }

    // Unload chunks too far away
    for (const [key, chunk] of this.loadedChunks) {
      if (!neededChunks.has(key)) {
        this.removeChunkMeshes(chunk);
        this.loadedChunks.delete(key);
        this.dirtyChunks.delete(key);
      }
    }

    // Re-mesh dirty chunks (rate-limited to avoid frame spikes)
    let rebuilds = 0;
    for (const key of this.dirtyChunks) {
      if (rebuilds >= ChunkManager.MAX_REBUILDS_PER_FRAME) break;
      const chunk = this.loadedChunks.get(key);
      if (chunk) {
        const [cx, cz] = key.split(',').map(Number) as [number, number];
        this.buildChunkMesh(cx, cz, chunk);
        rebuilds++;
      }
      this.dirtyChunks.delete(key);
    }
  }

  // ─── Chunk Data ───

  onChunkDataReceived(chunkX: number, chunkZ: number, data: Uint8Array): void {
    const key = chunkKey(chunkX, chunkZ);
    this.pendingChunks.delete(key);

    // Remove existing meshes if any
    const existing = this.loadedChunks.get(key);
    if (existing) {
      this.removeChunkMeshes(existing);
    }

    const chunk: LoadedChunk = { data, mesh: null, waterMesh: null };
    this.loadedChunks.set(key, chunk);

    this.buildChunkMesh(chunkX, chunkZ, chunk);

    // Mark neighbors as dirty so they re-mesh their border faces
    this.markNeighborsDirty(chunkX, chunkZ);
  }

  onBlockChanged(worldX: number, worldY: number, worldZ: number, newBlockType: number): void {
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const localX = ((worldX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((worldZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    const key = chunkKey(cx, cz);
    const chunk = this.loadedChunks.get(key);
    if (!chunk) return;

    chunk.data[blockIndex(localX, worldY, localZ)] = newBlockType;
    this.dirtyChunks.add(key);

    // If block is on a chunk border, mark neighbor as dirty
    if (localX === 0) this.dirtyChunks.add(chunkKey(cx - 1, cz));
    if (localX === CHUNK_SIZE_X - 1) this.dirtyChunks.add(chunkKey(cx + 1, cz));
    if (localZ === 0) this.dirtyChunks.add(chunkKey(cx, cz - 1));
    if (localZ === CHUNK_SIZE_Z - 1) this.dirtyChunks.add(chunkKey(cx, cz + 1));
  }

  // ─── Mesh Building ───

  private buildChunkMesh(cx: number, cz: number, chunk: LoadedChunk): void {
    // Remove old meshes
    this.removeChunkMeshes(chunk);

    // Gather neighbor data
    const neighbors: NeighborChunks = {};
    const north = this.loadedChunks.get(chunkKey(cx, cz + 1));
    const south = this.loadedChunks.get(chunkKey(cx, cz - 1));
    const east = this.loadedChunks.get(chunkKey(cx + 1, cz));
    const west = this.loadedChunks.get(chunkKey(cx - 1, cz));

    if (north) neighbors.north = north.data;
    if (south) neighbors.south = south.data;
    if (east) neighbors.east = east.data;
    if (west) neighbors.west = west.data;

    const result = meshChunk(chunk.data, cx, cz, neighbors);

    // Build opaque mesh
    if (result.opaque.positions.length > 0) {
      chunk.mesh = this.createMesh(result.opaque, this.opaqueMaterial);
      this.scene.add(chunk.mesh);
    }

    // Build transparent mesh
    if (result.transparent.positions.length > 0) {
      chunk.waterMesh = this.createMesh(result.transparent, this.transparentMaterial);
      chunk.waterMesh.renderOrder = 1; // Render after opaque
      this.scene.add(chunk.waterMesh);
    }
  }

  private createMesh(meshData: ChunkMeshData, material: THREE.MeshLambertMaterial): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

    // Use AO values as vertex colors (grayscale)
    const colors = new Float32Array(meshData.aoValues.length * 3);
    for (let i = 0; i < meshData.aoValues.length; i++) {
      const ao = meshData.aoValues[i]!;
      colors[i * 3] = ao;
      colors[i * 3 + 1] = ao;
      colors[i * 3 + 2] = ao;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  // ─── Helpers ───

  private removeChunkMeshes(chunk: LoadedChunk): void {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
  }

  private markNeighborsDirty(cx: number, cz: number): void {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (const [dx, dz] of dirs) {
      const key = chunkKey(cx + dx, cz + dz);
      if (this.loadedChunks.has(key)) {
        this.dirtyChunks.add(key);
      }
    }
  }

  // ─── Accessors ───

  getMaterial(): THREE.MeshLambertMaterial {
    return this.opaqueMaterial;
  }

  getTransparentMaterial(): THREE.MeshLambertMaterial {
    return this.transparentMaterial;
  }

  getChunkData(cx: number, cz: number): Uint8Array | undefined {
    return this.loadedChunks.get(chunkKey(cx, cz))?.data;
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.loadedChunks.has(chunkKey(cx, cz));
  }

  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  // ─── Local Test Terrain Generation ───

  /**
   * Generate simple test chunks locally without needing a server.
   * Creates basic terrain with grass, dirt, stone layers.
   */
  generateLocalTestChunks(centerX: number, centerZ: number, radius = 3): void {
    const playerCX = Math.floor(centerX / CHUNK_SIZE_X);
    const playerCZ = Math.floor(centerZ / CHUNK_SIZE_Z);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz > radius * radius) continue;

        const cx = playerCX + dx;
        const cz = playerCZ + dz;
        const key = chunkKey(cx, cz);

        if (this.loadedChunks.has(key)) continue;

        const data = this.generateTestChunkData(cx, cz);
        this.onChunkDataReceived(cx, cz, data);
      }
    }
  }

  private generateTestChunkData(cx: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
    const seaLevel = 32;

    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const worldX = cx * CHUNK_SIZE_X + x;
        const worldZ = cz * CHUNK_SIZE_Z + z;

        // Simple height generation using sine waves
        const height = Math.floor(
          seaLevel +
          Math.sin(worldX * 0.05) * 4 +
          Math.cos(worldZ * 0.07) * 3 +
          Math.sin((worldX + worldZ) * 0.03) * 2
        );

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const idx = blockIndex(x, y, z);
          if (y === 0) {
            data[idx] = 13; // Bedrock
          } else if (y < height - 4) {
            data[idx] = 3; // Stone
          } else if (y < height) {
            data[idx] = 1; // Dirt
          } else if (y === height) {
            data[idx] = 2; // Grass
          } else if (y <= seaLevel) {
            data[idx] = 14; // Water
          } else {
            data[idx] = 0; // Air
          }
        }
      }
    }

    return data;
  }

  // ─── Cleanup ───

  dispose(): void {
    for (const [, chunk] of this.loadedChunks) {
      this.removeChunkMeshes(chunk);
    }
    this.loadedChunks.clear();
    this.pendingChunks.clear();
    this.dirtyChunks.clear();

    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
    disposeTextureAtlas();
  }
}