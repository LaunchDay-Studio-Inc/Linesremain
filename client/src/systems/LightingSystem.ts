// ─── Lighting System ───
// Manages dynamic point lights for campfires, torches, and held light sources.
// Limits active GPU lights, applies natural flicker effects, and culls distant lights.

import * as THREE from 'three';

// ─── Light Type Configurations ───

interface LightConfig {
  color: number;
  intensity: number;
  distance: number;
  flickerSpeed: number;
  flickerAmount: number;
}

const LIGHT_CONFIGS: Record<string, LightConfig> = {
  campfire: {
    color: 0xff8844,
    intensity: 1.5,
    distance: 15,
    flickerSpeed: 8,
    flickerAmount: 0.3,
  },
  torch: {
    color: 0xffaa55,
    intensity: 1.0,
    distance: 10,
    flickerSpeed: 10,
    flickerAmount: 0.2,
  },
  held: {
    color: 0xffaa55,
    intensity: 0.8,
    distance: 8,
    flickerSpeed: 12,
    flickerAmount: 0.15,
  },
};

// ─── Types ───

interface DynamicLight {
  entityId: number;
  light: THREE.PointLight;
  baseIntensity: number;
  flickerSpeed: number;
  flickerAmount: number;
  color: THREE.Color;
  position: THREE.Vector3;
  type: string;
}

// ─── LightingSystem Class ───

export class LightingSystem {
  private lights = new Map<number, DynamicLight>();
  private scene: THREE.Scene;
  private maxLights = 8; // GPU limit — only render nearest 8 lights
  private playerPos = new THREE.Vector3();
  private elapsedTime = 0;
  private cullDistance = 30; // blocks — lights beyond this are deactivated

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add a dynamic light for an entity */
  addLight(
    entityId: number,
    position: THREE.Vector3,
    type: 'campfire' | 'torch' | 'held',
  ): void {
    // Don't duplicate
    if (this.lights.has(entityId)) return;

    const config = LIGHT_CONFIGS[type]!;
    const light = new THREE.PointLight(config.color, config.intensity, config.distance, 2);
    light.position.copy(position);
    // Offset campfire/torch lights slightly above the source
    if (type === 'campfire') {
      light.position.y += 0.8;
    } else if (type === 'torch') {
      light.position.y += 0.5;
    }
    light.castShadow = false;

    const dynamicLight: DynamicLight = {
      entityId,
      light,
      baseIntensity: config.intensity,
      flickerSpeed: config.flickerSpeed,
      flickerAmount: config.flickerAmount,
      color: new THREE.Color(config.color),
      position: position.clone(),
      type,
    };

    this.lights.set(entityId, dynamicLight);
    this.scene.add(light);
  }

  /** Remove a dynamic light by entity ID */
  removeLight(entityId: number): void {
    const entry = this.lights.get(entityId);
    if (entry) {
      this.scene.remove(entry.light);
      entry.light.dispose();
      this.lights.delete(entityId);
    }
  }

  /** Update light position (for held/moving lights) */
  updateLightPosition(entityId: number, position: THREE.Vector3): void {
    const entry = this.lights.get(entityId);
    if (entry) {
      entry.position.copy(position);
      entry.light.position.copy(position);
      if (entry.type === 'held') {
        entry.light.position.y += 1.5; // at hand height
      }
    }
  }

  /** Check if a light exists for the given entity */
  hasLight(entityId: number): boolean {
    return this.lights.has(entityId);
  }

  /** Main update — flicker effects, distance culling, GPU light limit */
  update(dt: number, playerPosition: THREE.Vector3): void {
    this.elapsedTime += dt;
    this.playerPos.copy(playerPosition);

    const time = this.elapsedTime;

    // Calculate distances and apply flicker
    const distEntries: { entry: DynamicLight; dist: number }[] = [];

    for (const [, entry] of this.lights) {
      const dist = entry.position.distanceTo(this.playerPos);
      distEntries.push({ entry, dist });

      // Natural flicker — two layered sine waves at different frequencies
      const flicker =
        Math.sin(time * entry.flickerSpeed + entry.entityId * 1.3) *
          entry.flickerAmount *
          entry.baseIntensity +
        Math.sin(time * entry.flickerSpeed * 1.7 + entry.entityId * 2.7) *
          entry.flickerAmount *
          0.5 *
          entry.baseIntensity;

      entry.light.intensity = entry.baseIntensity + flicker;
    }

    // Sort by distance (nearest first)
    distEntries.sort((a, b) => a.dist - b.dist);

    // Activate nearest lights, deactivate the rest
    let activeCount = 0;
    for (const { entry, dist } of distEntries) {
      if (dist > this.cullDistance || activeCount >= this.maxLights) {
        // Too far or over GPU limit — hide
        entry.light.visible = false;
      } else {
        entry.light.visible = true;
        activeCount++;
      }
    }
  }

  /** Dispose all lights */
  dispose(): void {
    for (const [, entry] of this.lights) {
      this.scene.remove(entry.light);
      entry.light.dispose();
    }
    this.lights.clear();
  }
}