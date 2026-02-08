// ─── Water Renderer ───

import { CHUNK_SIZE_X, CHUNK_SIZE_Z, SEA_LEVEL } from '@shared/constants/game';
import * as THREE from 'three';

// ─── Water Shader ───

const waterVertexShader = `
uniform float uTime;
varying vec3 vWorldPos;

void main() {
  vec3 pos = position;

  // Compute world position for seamless cross-chunk waves
  vec3 worldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

  // Gentle wave displacement using world-space coordinates
  float wave1 = sin(worldPos.x * 0.3 + uTime * 0.8) * 0.08;
  float wave2 = sin(worldPos.z * 0.4 + uTime * 0.6) * 0.06;
  float wave3 = sin((worldPos.x + worldPos.z) * 0.2 + uTime * 1.2) * 0.04;
  pos.y += wave1 + wave2 + wave3;

  vWorldPos = worldPos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const waterFragmentShader = `
uniform float uTime;
uniform vec3 uWaterColor;
uniform float uOpacity;

varying vec3 vWorldPos;

void main() {
  // Animated UV using world-space for seamless cross-chunk patterns
  vec2 wuv = vWorldPos.xz;
  wuv.x += uTime * 0.5;
  wuv.y += sin(uTime * 0.3) * 0.3;

  // Wave pattern in world space
  float wave = sin(wuv.x * 0.6 + uTime * 1.5) * 0.5 + 0.5;
  wave *= sin(wuv.y * 0.5 + uTime * 1.0) * 0.5 + 0.5;

  // Subtle surface variation
  float sparkle = pow(wave, 8.0) * 0.3;

  vec3 color = uWaterColor + vec3(sparkle * 0.2, sparkle * 0.3, sparkle * 0.4);

  gl_FragColor = vec4(color, uOpacity);
}
`;

// ─── WaterRenderer Class ───

export class WaterRenderer {
  private scene: THREE.Scene;
  private waterMeshes = new Map<string, THREE.Mesh>();
  private material: THREE.ShaderMaterial;
  private geometry: THREE.PlaneGeometry;
  private elapsedTime = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Shared water material
    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color('#3A7CBD') },
        uOpacity: { value: 0.7 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // One plane per chunk, sized to chunk dimensions
    this.geometry = new THREE.PlaneGeometry(CHUNK_SIZE_X, CHUNK_SIZE_Z, 16, 16);
    // Rotate to lie flat (XZ plane)
    this.geometry.rotateX(-Math.PI / 2);
  }

  /** Add a water surface for a chunk at the given coordinates */
  addChunkWater(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    if (this.waterMeshes.has(key)) return;

    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.set(
      chunkX * CHUNK_SIZE_X + CHUNK_SIZE_X / 2,
      SEA_LEVEL - 0.1, // Slightly below to avoid z-fighting with terrain water blocks
      chunkZ * CHUNK_SIZE_Z + CHUNK_SIZE_Z / 2,
    );
    mesh.renderOrder = 2;
    mesh.frustumCulled = true;

    this.scene.add(mesh);
    this.waterMeshes.set(key, mesh);
  }

  /** Remove the water surface for a chunk */
  removeChunkWater(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const mesh = this.waterMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      this.waterMeshes.delete(key);
    }
  }

  /** Update water animation */
  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    this.material.uniforms['uTime']!.value = this.elapsedTime;
  }

  /** Update which chunks have water based on loaded chunks */
  syncWithChunks(loadedChunkKeys: Set<string>): void {
    // Add water for new chunks
    for (const key of loadedChunkKeys) {
      if (!this.waterMeshes.has(key)) {
        const [cx, cz] = key.split(',').map(Number) as [number, number];
        this.addChunkWater(cx, cz);
      }
    }

    // Remove water for unloaded chunks
    for (const key of this.waterMeshes.keys()) {
      if (!loadedChunkKeys.has(key)) {
        const mesh = this.waterMeshes.get(key)!;
        this.scene.remove(mesh);
        this.waterMeshes.delete(key);
      }
    }
  }

  dispose(): void {
    for (const [, mesh] of this.waterMeshes) {
      this.scene.remove(mesh);
    }
    this.waterMeshes.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}
