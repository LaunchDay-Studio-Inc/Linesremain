// ─── Particle System ───
// GPU particle system using THREE.Points with preset-based emission.
// Supports burst emissions for block breaking, placement, footsteps,
// campfire, combat, pickups, level-up, and environmental effects.

import * as THREE from 'three';

// ─── Types ───

export interface ParticleEmitOptions {
  position: THREE.Vector3;
  count: number;
  color?: THREE.Color;
  colors?: THREE.Color[];
  speed?: number;
  spread?: number;
  lifetime?: number;
  size?: number;
  gravity?: number;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  lifetime: number;
  maxLifetime: number;
  size: number;
  gravity: number;
}

export type ParticlePreset =
  | 'blockBreakDirt'
  | 'blockBreakStone'
  | 'blockBreakWood'
  | 'blockPlace'
  | 'footstepDust'
  | 'campfireEmbers'
  | 'campfireSmoke'
  | 'hitBlood'
  | 'hitSpark'
  | 'itemPickupSparkle'
  | 'levelUpBurst'
  | 'rainSplash';

interface PresetConfig {
  count: number;
  colors: number[];
  speed: number;
  spread: number;
  lifetime: number;
  size: number;
  gravity: number;
}

// ─── Preset Definitions ───

const PRESET_CONFIGS: Record<ParticlePreset, PresetConfig> = {
  blockBreakDirt: {
    count: 12,
    colors: [0x8b7355, 0xa0926b, 0x6b5b45],
    speed: 4.0,
    spread: 0.8,
    lifetime: 0.5,
    size: 0.18,
    gravity: -9.8,
  },
  blockBreakStone: {
    count: 15,
    colors: [0x888888, 0xaaaaaa, 0x666666],
    speed: 5.0,
    spread: 0.9,
    lifetime: 0.4,
    size: 0.14,
    gravity: -12.0,
  },
  blockBreakWood: {
    count: 10,
    colors: [0x8b6914, 0xa0822b, 0x6b4f14],
    speed: 3.5,
    spread: 0.7,
    lifetime: 0.6,
    size: 0.2,
    gravity: -6.0,
  },
  blockPlace: {
    count: 8,
    colors: [0xddeeff, 0xffffff, 0xccccee],
    speed: 1.5,
    spread: 0.4,
    lifetime: 0.3,
    size: 0.1,
    gravity: 0.5,
  },
  footstepDust: {
    count: 4,
    colors: [0xc8b99a],
    speed: 1.0,
    spread: 0.3,
    lifetime: 0.3,
    size: 0.12,
    gravity: -2.0,
  },
  campfireEmbers: {
    count: 3,
    colors: [0xff6600, 0xff3300, 0xffaa00],
    speed: 1.5,
    spread: 0.3,
    lifetime: 1.5,
    size: 0.1,
    gravity: 1.0,
  },
  campfireSmoke: {
    count: 2,
    colors: [0x555555, 0x777777],
    speed: 0.8,
    spread: 0.2,
    lifetime: 3.0,
    size: 0.4,
    gravity: 0.5,
  },
  hitBlood: {
    count: 8,
    colors: [0xcc0000, 0x880000],
    speed: 3.5,
    spread: 0.6,
    lifetime: 0.3,
    size: 0.12,
    gravity: -15.0,
  },
  hitSpark: {
    count: 6,
    colors: [0xffffee, 0xffaa00],
    speed: 6.0,
    spread: 0.5,
    lifetime: 0.15,
    size: 0.06,
    gravity: 0.0,
  },
  itemPickupSparkle: {
    count: 6,
    colors: [0xffd700, 0xffa500],
    speed: 2.0,
    spread: 0.4,
    lifetime: 0.5,
    size: 0.08,
    gravity: 1.5,
  },
  levelUpBurst: {
    count: 30,
    colors: [0xffd700, 0xffffff, 0xffaa00, 0xffffcc],
    speed: 5.0,
    spread: 1.0,
    lifetime: 1.0,
    size: 0.15,
    gravity: -3.0,
  },
  rainSplash: {
    count: 3,
    colors: [0xccccee, 0xddeeff],
    speed: 1.5,
    spread: 0.2,
    lifetime: 0.15,
    size: 0.06,
    gravity: -8.0,
  },
};

// ─── Constants ───

const MAX_PARTICLES = 2048;
const DEFAULT_LIFETIME = 1.0;
const DEFAULT_SPEED = 3.0;
const DEFAULT_SPREAD = 1.0;
const DEFAULT_SIZE = 0.15;
const DEFAULT_GRAVITY = -10.0;

// ─── Particle System ───

export class ParticleSystem {
  private particles: Particle[] = [];
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  // Buffer arrays
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-allocate buffers
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);

    // Geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Material
    this.material = new THREE.PointsMaterial({
      size: DEFAULT_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
    });

    // Points mesh
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  // ─── Preset Emission ───

  /**
   * Emit particles using a named preset at the given position.
   * Optionally override the particle count.
   */
  emitPreset(preset: ParticlePreset, position: THREE.Vector3, count?: number): void {
    const config = PRESET_CONFIGS[preset];
    const c = count ?? config.count;
    const colorObjs = config.colors.map((hex) => new THREE.Color(hex));

    this.emit({
      position,
      count: c,
      colors: colorObjs,
      speed: config.speed,
      spread: config.spread,
      lifetime: config.lifetime,
      size: config.size,
      gravity: config.gravity,
    });
  }

  // ─── Low-Level Emission ───

  /**
   * Emit a burst of particles at a position.
   */
  emit(options: ParticleEmitOptions): void {
    const {
      position,
      count,
      color,
      colors,
      speed = DEFAULT_SPEED,
      spread = DEFAULT_SPREAD,
      lifetime = DEFAULT_LIFETIME,
      size = DEFAULT_SIZE,
      gravity = DEFAULT_GRAVITY,
    } = options;

    const baseColor = color ?? new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) {
        // Overwrite oldest particle (index 0) by swapping with last and popping
        this.particles[0] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }

      // Random velocity in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * spread;

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r * speed,
        Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * 0.5 + speed * 0.3,
        Math.cos(phi) * r * speed,
      );

      // Pick color from palette or use single base color
      let particleColor: THREE.Color;
      if (colors && colors.length > 0) {
        particleColor = colors[Math.floor(Math.random() * colors.length)]!.clone();
      } else {
        particleColor = baseColor.clone();
      }

      // Slight color variation
      const variation = 0.1;
      particleColor.r = Math.max(
        0,
        Math.min(1, particleColor.r + (Math.random() - 0.5) * variation),
      );
      particleColor.g = Math.max(
        0,
        Math.min(1, particleColor.g + (Math.random() - 0.5) * variation),
      );
      particleColor.b = Math.max(
        0,
        Math.min(1, particleColor.b + (Math.random() - 0.5) * variation),
      );

      this.particles.push({
        position: position.clone(),
        velocity,
        color: particleColor,
        lifetime,
        maxLifetime: lifetime,
        size: size * (0.5 + Math.random() * 0.5),
        gravity,
      });
    }
  }

  // ─── Convenience Emitters ───

  /**
   * Emit block-break particles with color matching the block.
   */
  emitBlockBreak(position: THREE.Vector3, blockColor: THREE.Color): void {
    this.emit({
      position,
      count: 12,
      color: blockColor,
      speed: 4.0,
      spread: 0.8,
      lifetime: 0.8,
      size: 0.2,
      gravity: -15.0,
    });
  }

  /**
   * Emit footstep dust particles.
   */
  emitFootstep(position: THREE.Vector3): void {
    this.emitPreset('footstepDust', position);
  }

  /**
   * Emit blood splatter particles on hit.
   */
  emitBlood(position: THREE.Vector3, direction?: THREE.Vector3): void {
    const basePos = position.clone();
    if (direction) {
      basePos.addScaledVector(direction, 0.2);
    }
    this.emitPreset('hitBlood', basePos);
    // Secondary darker droplets
    this.emit({
      position: basePos,
      count: 4,
      color: new THREE.Color(0x4a0000),
      speed: 2.0,
      spread: 0.4,
      lifetime: 0.8,
      size: 0.08,
      gravity: -15.0,
    });
  }

  /**
   * Emit hit spark particles (for non-blood hits).
   */
  emitHitSpark(position: THREE.Vector3): void {
    this.emitPreset('hitSpark', position);
  }

  /**
   * Emit arrow/projectile impact particles.
   */
  emitArrowHit(position: THREE.Vector3, surfaceColor?: THREE.Color): void {
    this.emit({
      position,
      count: 6,
      color: surfaceColor ?? new THREE.Color(0x9e8c6c),
      speed: 2.5,
      spread: 0.5,
      lifetime: 0.5,
      size: 0.1,
      gravity: -10.0,
    });
    this.emit({
      position,
      count: 4,
      color: new THREE.Color(0xc8b898),
      speed: 1.0,
      spread: 0.3,
      lifetime: 0.3,
      size: 0.15,
      gravity: -3.0,
    });
  }

  /**
   * Emit muzzle flash particles (bright, short-lived).
   */
  emitMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3): void {
    const flashPos = position.clone().addScaledVector(direction, 0.3);
    this.emit({
      position: flashPos,
      count: 3,
      color: new THREE.Color(0xffdd44),
      speed: 8.0,
      spread: 0.15,
      lifetime: 0.08,
      size: 0.25,
      gravity: 0,
    });
    this.emit({
      position: flashPos,
      count: 5,
      color: new THREE.Color(0xff8800),
      speed: 6.0,
      spread: 0.4,
      lifetime: 0.15,
      size: 0.08,
      gravity: -5.0,
    });
    this.emit({
      position: flashPos,
      count: 2,
      color: new THREE.Color(0x888888),
      speed: 1.5,
      spread: 0.3,
      lifetime: 0.4,
      size: 0.2,
      gravity: 2.0,
    });
  }

  // ─── Update ───

  update(dt: number): void {
    // Update particles — swap-and-pop for O(1) removal
    let i = 0;
    while (i < this.particles.length) {
      const p = this.particles[i]!;

      // Physics
      p.velocity.y += p.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);
      p.lifetime -= dt;

      // Remove dead particles via swap-and-pop
      if (p.lifetime <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      } else {
        i++;
      }
    }

    // Update GPU buffers
    const count = Math.min(this.particles.length, MAX_PARTICLES);

    for (let j = 0; j < count; j++) {
      const p = this.particles[j]!;
      const j3 = j * 3;

      this.positions[j3] = p.position.x;
      this.positions[j3 + 1] = p.position.y;
      this.positions[j3 + 2] = p.position.z;

      // Fade out alpha via color brightness
      const alpha = Math.max(0, p.lifetime / p.maxLifetime);
      this.colors[j3] = p.color.r * alpha;
      this.colors[j3 + 1] = p.color.g * alpha;
      this.colors[j3 + 2] = p.color.b * alpha;

      this.sizes[j] = p.size * (0.5 + alpha * 0.5);
    }

    // Mark buffers for upload
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = this.geometry.getAttribute('size') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    this.geometry.setDrawRange(0, count);
  }

  // ─── Queries ───

  getParticleCount(): number {
    return this.particles.length;
  }

  // ─── Cleanup ───

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.particles.length = 0;
  }
}
