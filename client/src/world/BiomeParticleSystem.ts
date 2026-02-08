// ─── Biome Particle System ───
// Ambient particle effects tied to biome atmosphere. Uses a single
// THREE.BufferGeometry + THREE.Points object for efficient rendering.
// Supports 6 particle behaviors: snow, blizzard, dust, fireflies, ash, spores.

import * as THREE from 'three';

// ─── Constants ───

const MAX_PARTICLES = 200;
const SPAWN_RADIUS = 20;
const RECYCLE_RADIUS = SPAWN_RADIUS + 5;

// ─── Particle Data ───

interface ParticleData {
  active: boolean;
  age: number;
  maxAge: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number; // for wobble/drift offsets
}

// ─── Particle Type Configs ───

interface ParticleTypeConfig {
  color: THREE.Color;
  size: number;
  speedY: number;
  driftXZ: number;
  wobbleFreq: number;
  wobbleAmp: number;
  opacity: number;
  lifetime: number;
  spawnAbove: boolean; // spawn above player (falling) or below (rising)
  blending: THREE.Blending;
}

const PARTICLE_CONFIGS: Record<string, ParticleTypeConfig> = {
  snow: {
    color: new THREE.Color(0xeeeeff),
    size: 0.15,
    speedY: -1.5,
    driftXZ: 0.3,
    wobbleFreq: 1.5,
    wobbleAmp: 0.5,
    opacity: 0.7,
    lifetime: 8,
    spawnAbove: true,
    blending: THREE.NormalBlending,
  },
  blizzard: {
    color: new THREE.Color(0xffffff),
    size: 0.12,
    speedY: -4.0,
    driftXZ: 3.0,
    wobbleFreq: 3.0,
    wobbleAmp: 1.5,
    opacity: 0.8,
    lifetime: 4,
    spawnAbove: true,
    blending: THREE.NormalBlending,
  },
  dust: {
    color: new THREE.Color(0xccaa66),
    size: 0.1,
    speedY: -0.3,
    driftXZ: 0.8,
    wobbleFreq: 0.8,
    wobbleAmp: 1.0,
    opacity: 0.4,
    lifetime: 10,
    spawnAbove: true,
    blending: THREE.NormalBlending,
  },
  fireflies: {
    color: new THREE.Color(0xaaff44),
    size: 0.2,
    speedY: 0.2,
    driftXZ: 0.4,
    wobbleFreq: 2.0,
    wobbleAmp: 0.8,
    opacity: 0.9,
    lifetime: 6,
    spawnAbove: false,
    blending: THREE.AdditiveBlending,
  },
  ash: {
    color: new THREE.Color(0x888888),
    size: 0.1,
    speedY: -0.8,
    driftXZ: 0.5,
    wobbleFreq: 1.0,
    wobbleAmp: 0.6,
    opacity: 0.5,
    lifetime: 9,
    spawnAbove: true,
    blending: THREE.NormalBlending,
  },
  spores: {
    color: new THREE.Color(0xaa66cc),
    size: 0.12,
    speedY: 0.4,
    driftXZ: 0.3,
    wobbleFreq: 1.2,
    wobbleAmp: 0.7,
    opacity: 0.5,
    lifetime: 8,
    spawnAbove: false,
    blending: THREE.AdditiveBlending,
  },
};

// ─── Biome Particle System ───

export class BiomeParticleSystem {
  private scene: THREE.Scene;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  // Buffer arrays
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  // Particle state
  private particles: ParticleData[];

  // Current state
  private currentType: string = 'none';
  private currentConfig: ParticleTypeConfig | null = null;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-allocate buffers
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);

    // Initialize particle data
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        age: 0,
        maxAge: 5,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0,
        baseX: 0,
        baseY: 0,
        baseZ: 0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Material
    this.material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
    });

    // Points mesh
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  // ─── Update ───

  update(
    dt: number,
    playerPosition: THREE.Vector3,
    particleType: string,
    density: number,
    worldTime: number,
  ): void {
    this.elapsed += dt;

    // Handle type changes
    if (particleType !== this.currentType) {
      this.currentType = particleType;
      this.currentConfig =
        particleType !== 'none' ? (PARTICLE_CONFIGS[particleType] ?? null) : null;

      // Update material blending mode
      if (this.currentConfig) {
        this.material.blending = this.currentConfig.blending;
      }

      // Deactivate all particles on type change for clean transition
      for (const p of this.particles) {
        p.active = false;
      }
    }

    // No particles if type is none or density is zero
    if (!this.currentConfig || density <= 0 || particleType === 'none') {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // Fireflies are only active at night (worldTime > 0.7 or < 0.2)
    if (particleType === 'fireflies') {
      const isNight = worldTime > 0.7 || worldTime < 0.2;
      if (!isNight) {
        this.geometry.setDrawRange(0, 0);
        return;
      }
    }

    const config = this.currentConfig;
    const targetCount = Math.floor(MAX_PARTICLES * density);

    // Spawn new particles up to target count
    let activeCount = 0;
    for (const p of this.particles) {
      if (p.active) activeCount++;
    }

    for (let i = 0; i < this.particles.length && activeCount < targetCount; i++) {
      const p = this.particles[i]!;
      if (!p.active) {
        this.spawnParticle(p, playerPosition, config);
        activeCount++;
      }
    }

    // Update existing particles
    let visibleCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;

      // Age the particle
      p.age += dt;
      if (p.age >= p.maxAge) {
        // Recycle: respawn near player
        this.spawnParticle(p, playerPosition, config);
      }

      // Calculate position with wobble
      const wobbleX = Math.sin(this.elapsed * config.wobbleFreq + p.phase) * config.wobbleAmp;
      const wobbleZ = Math.cos(this.elapsed * config.wobbleFreq * 0.7 + p.phase) * config.wobbleAmp;

      const x = p.baseX + p.velocityX * p.age + wobbleX;
      const y = p.baseY + p.velocityY * p.age;
      const z = p.baseZ + p.velocityZ * p.age + wobbleZ;

      // Check if particle is too far from player
      const dx = x - playerPosition.x;
      const dz = z - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      if (distSq > RECYCLE_RADIUS * RECYCLE_RADIUS) {
        this.spawnParticle(p, playerPosition, config);
        continue;
      }

      // Fade in/out over lifetime
      const fadeIn = Math.min(1, p.age * 2);
      const fadeOut = Math.max(0, 1 - (p.age / p.maxAge - 0.7) / 0.3);
      const alpha = fadeIn * fadeOut;

      // Write to buffers
      const i3 = visibleCount * 3;
      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      this.positions[i3 + 2] = z;

      this.colors[i3] = config.color.r * alpha;
      this.colors[i3 + 1] = config.color.g * alpha;
      this.colors[i3 + 2] = config.color.b * alpha;

      this.sizes[visibleCount] = config.size * (0.5 + alpha * 0.5);

      visibleCount++;
    }

    // Update GPU buffers
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = this.geometry.getAttribute('size') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    this.material.opacity = config.opacity;
    this.material.size = config.size;

    this.geometry.setDrawRange(0, visibleCount);
  }

  // ─── Particle Spawning ───

  private spawnParticle(
    p: ParticleData,
    playerPosition: THREE.Vector3,
    config: ParticleTypeConfig,
  ): void {
    p.active = true;
    p.age = 0;
    p.maxAge = config.lifetime * (0.5 + Math.random());
    p.phase = Math.random() * Math.PI * 2;

    // Random position within spawn radius around player
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * SPAWN_RADIUS;
    p.baseX = playerPosition.x + Math.cos(angle) * radius;
    p.baseZ = playerPosition.z + Math.sin(angle) * radius;

    if (config.spawnAbove) {
      // Falling particles: spawn above player
      p.baseY = playerPosition.y + 5 + Math.random() * 15;
    } else {
      // Rising particles: spawn at/below player level
      p.baseY = playerPosition.y - 2 + Math.random() * 4;
    }

    // Velocity
    p.velocityY = config.speedY;
    p.velocityX = (Math.random() - 0.5) * config.driftXZ;
    p.velocityZ = (Math.random() - 0.5) * config.driftXZ;
  }

  // ─── Cleanup ───

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
