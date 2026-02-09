// ─── Chunk Manager ───

import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  VIEW_DISTANCE_CHUNKS,
} from '@shared/constants/game';
import * as THREE from 'three';
import type { ChunkMeshData, NeighborChunks } from './ChunkMesher';
import { meshChunk } from './ChunkMesher';
import { createTextureAtlas, disposeTextureAtlas } from './TextureAtlas';

// ─── Types ───

interface LoadedChunk {
  data: Uint8Array;
  mesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  cx: number;
  cz: number;
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

  // Reusable set for needed chunks (avoids per-frame allocation)
  private neededChunks = new Set<string>();

  // Cached chunk meshes array (invalidated when meshes change)
  private chunkMeshesCache: THREE.Mesh[] = [];
  private chunkMeshesDirty = true;

  // Pooled AO color buffer
  private aoColorBuffer: Float32Array = new Float32Array(0);

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

    // Determine which chunks should be loaded (reuse set)
    this.neededChunks.clear();

    for (let dx = -this.viewDistance; dx <= this.viewDistance; dx++) {
      for (let dz = -this.viewDistance; dz <= this.viewDistance; dz++) {
        // Circular view distance
        if (dx * dx + dz * dz > this.viewDistance * this.viewDistance) continue;

        const cx = playerCX + dx;
        const cz = playerCZ + dz;
        const key = chunkKey(cx, cz);
        this.neededChunks.add(key);

        // Request if not loaded and not pending
        if (!this.loadedChunks.has(key) && !this.pendingChunks.has(key)) {
          this.pendingChunks.add(key);
          this.onChunkRequest?.(cx, cz);
        }
      }
    }

    // Unload chunks too far away
    for (const [key, chunk] of this.loadedChunks) {
      if (!this.neededChunks.has(key)) {
        this.removeChunkMeshes(chunk);
        this.loadedChunks.delete(key);
        this.dirtyChunks.delete(key);
        this.loadedKeySetDirty = true;
      }
    }

    // Re-mesh dirty chunks (rate-limited to avoid frame spikes)
    let rebuilds = 0;
    for (const key of this.dirtyChunks) {
      if (rebuilds >= ChunkManager.MAX_REBUILDS_PER_FRAME) break;
      const chunk = this.loadedChunks.get(key);
      if (chunk) {
        this.buildChunkMesh(chunk.cx, chunk.cz, chunk);
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

    const chunk: LoadedChunk = { data, mesh: null, waterMesh: null, cx: chunkX, cz: chunkZ };
    this.loadedChunks.set(key, chunk);
    this.loadedKeySetDirty = true;

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
      this.chunkMeshesDirty = true;
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

    // Use AO values as vertex colors (grayscale) — reuse pooled buffer
    const needed = meshData.aoValues.length * 3;
    if (this.aoColorBuffer.length < needed) {
      this.aoColorBuffer = new Float32Array(needed);
    }
    for (let i = 0; i < meshData.aoValues.length; i++) {
      const ao = meshData.aoValues[i]!;
      this.aoColorBuffer[i * 3] = ao;
      this.aoColorBuffer[i * 3 + 1] = ao;
      this.aoColorBuffer[i * 3 + 2] = ao;
    }
    // Slice to exact size for the buffer attribute
    const colors = this.aoColorBuffer.subarray(0, needed);
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return mesh;
  }

  // ─── Helpers ───

  private removeChunkMeshes(chunk: LoadedChunk): void {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
      this.chunkMeshesDirty = true;
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
  }

  private markNeighborsDirty(cx: number, cz: number): void {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
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

  // Cached key set for getLoadedChunkKeys (avoids per-call allocation)
  private loadedKeySetCache = new Set<string>();
  private loadedKeySetDirty = true;

  getLoadedChunkKeys(): Set<string> {
    if (!this.loadedKeySetDirty) return this.loadedKeySetCache;
    this.loadedKeySetCache.clear();
    for (const key of this.loadedChunks.keys()) {
      this.loadedKeySetCache.add(key);
    }
    this.loadedKeySetDirty = false;
    return this.loadedKeySetCache;
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
            Math.sin((worldX + worldZ) * 0.03) * 2,
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

  /** Returns all opaque chunk meshes (for raycasting against terrain) */
  getChunkMeshes(): THREE.Mesh[] {
    if (!this.chunkMeshesDirty) return this.chunkMeshesCache;
    this.chunkMeshesCache.length = 0;
    for (const [, chunk] of this.loadedChunks) {
      if (chunk.mesh) this.chunkMeshesCache.push(chunk.mesh);
    }
    this.chunkMeshesDirty = false;
    return this.chunkMeshesCache;
  }

  // ─── Cleanup ───

  /** Remove all loaded chunks and meshes (for world switching). Does NOT dispose materials. */
  clearAll(): void {
    for (const [, chunk] of this.loadedChunks) {
      this.removeChunkMeshes(chunk);
    }
    this.loadedChunks.clear();
    this.pendingChunks.clear();
    this.dirtyChunks.clear();
    this.chunkMeshesCache.length = 0;
    this.chunkMeshesDirty = true;
    this.loadedKeySetDirty = true;
  }

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
