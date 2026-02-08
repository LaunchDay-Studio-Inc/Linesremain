// ─── Supply Drop Renderer ───
// Renders a falling supply crate with a smoke trail.

import * as THREE from 'three';

export class SupplyDropRenderer {
  private scene: THREE.Scene;
  private drops: Map<
    string,
    {
      mesh: THREE.Mesh;
      targetY: number;
      falling: boolean;
      smokeParticles: THREE.Points;
      smokePositions: Float32Array;
      smokeTimer: number;
    }
  > = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addDrop(id: string, position: { x: number; y: number; z: number }): void {
    if (this.drops.has(id)) return;

    // Crate mesh
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + 50, position.z); // Start high
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Smoke particles
    const smokeCount = 50;
    const smokePositions = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = position.x;
      smokePositions[i * 3 + 1] = -1000;
      smokePositions[i * 3 + 2] = position.z;
    }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0xcc8800,
      size: 0.5,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    smokeParticles.frustumCulled = false;
    this.scene.add(smokeParticles);

    this.drops.set(id, {
      mesh,
      targetY: position.y,
      falling: true,
      smokeParticles,
      smokePositions,
      smokeTimer: 0,
    });
  }

  update(dt: number): void {
    for (const [, drop] of this.drops) {
      if (drop.falling) {
        // Fall toward target
        const fallSpeed = 8;
        drop.mesh.position.y -= fallSpeed * dt;
        drop.mesh.rotation.y += dt * 2;

        if (drop.mesh.position.y <= drop.targetY) {
          drop.mesh.position.y = drop.targetY;
          drop.falling = false;
          drop.mesh.rotation.y = 0;
        }
      }

      // Smoke signal after landing
      if (!drop.falling) {
        drop.smokeTimer += dt;
        const idx = Math.floor(drop.smokeTimer * 10) % 50;
        const x = drop.mesh.position.x + (Math.random() - 0.5) * 0.5;
        const z = drop.mesh.position.z + (Math.random() - 0.5) * 0.5;
        const y = drop.mesh.position.y + 1 + drop.smokeTimer * 0.5 + Math.random() * 2;
        drop.smokePositions[idx * 3] = x;
        drop.smokePositions[idx * 3 + 1] = y;
        drop.smokePositions[idx * 3 + 2] = z;
        drop.smokeParticles.geometry.attributes['position']!.needsUpdate = true;
      }
    }
  }

  removeDrop(id: string): void {
    const drop = this.drops.get(id);
    if (!drop) return;

    this.scene.remove(drop.mesh);
    drop.mesh.geometry.dispose();
    (drop.mesh.material as THREE.Material).dispose();
    this.scene.remove(drop.smokeParticles);
    drop.smokeParticles.geometry.dispose();
    (drop.smokeParticles.material as THREE.Material).dispose();
    this.drops.delete(id);
  }

  dispose(): void {
    for (const id of this.drops.keys()) {
      this.removeDrop(id);
    }
  }
}
