// ─── Particle System ───
// Simple GPU particle system using THREE.Points.
// Supports burst emissions for block breaking, footsteps, etc.

import * as THREE from 'three';

// ─── Types ───

export interface ParticleEmitOptions {
  position: THREE.Vector3;
  count: number;
  color?: THREE.Color;
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

  // ─── Emission ───

  /**
   * Emit a burst of particles at a position.
   */
  emit(options: ParticleEmitOptions): void {
    const {
      position,
      count,
      color = new THREE.Color(0xffffff),
      speed = DEFAULT_SPEED,
      spread = DEFAULT_SPREAD,
      lifetime = DEFAULT_LIFETIME,
      size = DEFAULT_SIZE,
      gravity = DEFAULT_GRAVITY,
    } = options;

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

      // Slight color variation
      const variedColor = color.clone();
      const variation = 0.15;
      variedColor.r = Math.max(0, Math.min(1, variedColor.r + (Math.random() - 0.5) * variation));
      variedColor.g = Math.max(0, Math.min(1, variedColor.g + (Math.random() - 0.5) * variation));
      variedColor.b = Math.max(0, Math.min(1, variedColor.b + (Math.random() - 0.5) * variation));

      this.particles.push({
        position: position.clone(),
        velocity,
        color: variedColor,
        lifetime,
        maxLifetime: lifetime,
        size: size * (0.5 + Math.random() * 0.5),
        gravity,
      });
    }
  }

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
    this.emit({
      position,
      count: 3,
      color: new THREE.Color(0x8b7355),
      speed: 1.0,
      spread: 0.3,
      lifetime: 0.4,
      size: 0.1,
      gravity: -5.0,
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
        // Don't increment i — re-check the swapped element
      } else {
        i++;
      }
    }

    // Update GPU buffers
    const count = Math.min(this.particles.length, MAX_PARTICLES);

    for (let i = 0; i < count; i++) {
      const p = this.particles[i]!;
      const i3 = i * 3;

      this.positions[i3] = p.position.x;
      this.positions[i3 + 1] = p.position.y;
      this.positions[i3 + 2] = p.position.z;

      // Fade out alpha via color brightness
      const alpha = Math.max(0, p.lifetime / p.maxLifetime);
      this.colors[i3] = p.color.r * alpha;
      this.colors[i3 + 1] = p.color.g * alpha;
      this.colors[i3 + 2] = p.color.b * alpha;

      this.sizes[i] = p.size * (0.5 + alpha * 0.5);
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