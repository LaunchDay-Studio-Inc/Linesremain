// ─── Combat Effects System ───
// Detects health changes from entity state snapshots, triggers visual feedback:
// - Blood / hit particles via ParticleSystem
// - Floating damage numbers (THREE.Sprite + CanvasTexture)
// - Kill feed notifications stored for HUD consumption

import * as THREE from 'three';
import type { ParticleSystem } from '../engine/ParticleSystem';

// ─── Types ───

export interface EntityHealthState {
  entityId: number;
  position: { x: number; y: number; z: number };
  health: { current: number; max: number };
  isNPC?: boolean;
  isPlayer?: boolean;
}

export interface KillNotification {
  id: number;
  killerName: string;
  victimName: string;
  weaponIcon: string; // emoji or text identifier
  timestamp: number;
}

interface FloatingNumber {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

// ─── Constants ───

const DAMAGE_NUMBER_LIFETIME = 1.2; // seconds
const DAMAGE_NUMBER_RISE_SPEED = 2.0;
const DAMAGE_NUMBER_SPREAD = 0.8;
const KILL_FEED_MAX = 6;
const KILL_FEED_DURATION = 8000; // ms

// ─── Canvas Texture Helpers ───

function createDamageNumberTexture(damage: number, isCrit: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 64);

  // Text styling
  const fontSize = isCrit ? 36 : 28;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = `-${Math.round(damage)}`;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(text, 65, 33);

  // Main text
  if (isCrit) {
    ctx.fillStyle = '#ff4444';
  } else if (damage >= 30) {
    ctx.fillStyle = '#ff8844';
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillText(text, 64, 32);

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeText(text, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createHealNumberTexture(amount: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 64);

  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = `+${Math.round(amount)}`;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(text, 65, 33);

  // Green text for healing
  ctx.fillStyle = '#44ff44';
  ctx.fillText(text, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// ─── Combat Effects System ───

export class CombatEffects {
  private scene: THREE.Scene;
  private particles: ParticleSystem;

  // Previous frame health tracking
  private prevHealth = new Map<number, number>();

  // Active floating damage numbers
  private floatingNumbers: FloatingNumber[] = [];

  // Kill feed
  private killFeed: KillNotification[] = [];
  private killIdCounter = 0;

  // Local player entity ID (set externally)
  private localPlayerEntityId: number | null = null;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene = scene;
    this.particles = particles;
  }

  // ─── Configuration ───

  setLocalPlayerEntityId(entityId: number): void {
    this.localPlayerEntityId = entityId;
  }

  // ─── Process Entity Health Changes ───

  /**
   * Call each frame with current entity health data.
   * Detects health decreases and fires visual effects.
   */
  processEntityStates(entities: EntityHealthState[]): void {
    for (const entity of entities) {
      const prev = this.prevHealth.get(entity.entityId);

      if (prev !== undefined) {
        const diff = prev - entity.health.current;

        if (diff > 0) {
          // Entity took damage
          this.onEntityDamaged(entity, diff);
        } else if (diff < 0 && prev < entity.health.max) {
          // Entity healed
          this.onEntityHealed(entity, -diff);
        }
      }

      this.prevHealth.set(entity.entityId, entity.health.current);
    }
  }

  /**
   * Remove tracking for entities that no longer exist.
   */
  removeEntity(entityId: number): void {
    this.prevHealth.delete(entityId);
  }

  // ─── Damage Events ───

  private onEntityDamaged(entity: EntityHealthState, damage: number): void {
    const pos = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);

    // Blood particles
    this.particles.emitBlood(pos);

    // Floating damage number
    const isCrit = damage >= 50;
    this.spawnDamageNumber(pos, damage, isCrit);

    // Check for death
    if (entity.health.current <= 0) {
      this.onEntityDeath(entity);
    }
  }

  private onEntityHealed(entity: EntityHealthState, amount: number): void {
    if (amount < 1) return; // Ignore tiny regen ticks visually

    const pos = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);
    this.spawnHealNumber(pos, amount);
  }

  private onEntityDeath(entity: EntityHealthState): void {
    const pos = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);

    // Extra blood burst on death
    this.particles.emitBlood(pos);
    this.particles.emitBlood(pos, new THREE.Vector3(0, 1, 0));
  }

  // ─── Projectile Impact ───

  /**
   * Call when a projectile hits something.
   */
  onProjectileHit(
    position: THREE.Vector3,
    hitEntity: boolean,
    surfaceColor?: THREE.Color,
  ): void {
    if (hitEntity) {
      this.particles.emitBlood(position);
    } else {
      this.particles.emitArrowHit(position, surfaceColor);
    }
  }

  /**
   * Call when a ranged weapon fires.
   */
  onWeaponFire(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.particles.emitMuzzleFlash(position, direction);
  }

  // ─── Kill Feed ───

  /**
   * Add a kill notification to the feed.
   */
  addKillNotification(killerName: string, victimName: string, weaponIcon: string = '⚔'): void {
    const notification: KillNotification = {
      id: this.killIdCounter++,
      killerName,
      victimName,
      weaponIcon,
      timestamp: Date.now(),
    };

    this.killFeed.push(notification);

    // Trim to max
    while (this.killFeed.length > KILL_FEED_MAX) {
      this.killFeed.shift();
    }
  }

  /**
   * Get active kill feed notifications (not expired).
   */
  getKillFeed(): KillNotification[] {
    const now = Date.now();
    this.killFeed = this.killFeed.filter((n) => now - n.timestamp < KILL_FEED_DURATION);
    return this.killFeed;
  }

  // ─── Floating Damage Numbers ───

  private spawnDamageNumber(worldPos: THREE.Vector3, damage: number, isCrit: boolean): void {
    const texture = createDamageNumberTexture(damage, isCrit);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);

    // Randomize position slightly to avoid overlap
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * DAMAGE_NUMBER_SPREAD,
      1.5 + Math.random() * 0.5,
      (Math.random() - 0.5) * DAMAGE_NUMBER_SPREAD,
    );
    sprite.position.copy(worldPos).add(offset);

    const scale = isCrit ? 1.0 : 0.7;
    sprite.scale.set(scale * 2, scale, 1);

    this.scene.add(sprite);

    this.floatingNumbers.push({
      sprite,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        DAMAGE_NUMBER_RISE_SPEED,
        (Math.random() - 0.5) * 0.5,
      ),
      lifetime: DAMAGE_NUMBER_LIFETIME,
      maxLifetime: DAMAGE_NUMBER_LIFETIME,
    });
  }

  private spawnHealNumber(worldPos: THREE.Vector3, amount: number): void {
    const texture = createHealNumberTexture(amount);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);

    sprite.position.copy(worldPos).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      1.8,
      (Math.random() - 0.5) * 0.3,
    ));
    sprite.scale.set(1.4, 0.7, 1);

    this.scene.add(sprite);

    this.floatingNumbers.push({
      sprite,
      velocity: new THREE.Vector3(0, DAMAGE_NUMBER_RISE_SPEED * 0.7, 0),
      lifetime: DAMAGE_NUMBER_LIFETIME * 0.8,
      maxLifetime: DAMAGE_NUMBER_LIFETIME * 0.8,
    });
  }

  // ─── Update ───

  update(dt: number): void {
    // Update floating damage numbers
    let i = 0;
    while (i < this.floatingNumbers.length) {
      const fn = this.floatingNumbers[i]!;

      fn.lifetime -= dt;

      if (fn.lifetime <= 0) {
        // Remove — swap and pop
        this.scene.remove(fn.sprite);
        const mat = fn.sprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();

        this.floatingNumbers[i] = this.floatingNumbers[this.floatingNumbers.length - 1]!;
        this.floatingNumbers.pop();
        continue;
      }

      // Move upward + drift
      fn.sprite.position.addScaledVector(fn.velocity, dt);

      // Slow down horizontal drift
      fn.velocity.x *= 0.98;
      fn.velocity.z *= 0.98;

      // Decelerate vertical rise
      fn.velocity.y *= 0.97;

      // Fade out
      const alpha = Math.max(0, fn.lifetime / fn.maxLifetime);
      const mat = fn.sprite.material as THREE.SpriteMaterial;
      mat.opacity = alpha;

      // Scale down slightly as it fades
      const currentScale = fn.sprite.scale.x;
      fn.sprite.scale.setScalar(currentScale * (0.995 + alpha * 0.005));

      i++;
    }
  }

  // ─── Queries ───

  getLocalPlayerEntityId(): number | null {
    return this.localPlayerEntityId;
  }

  getActiveFloatingNumberCount(): number {
    return this.floatingNumbers.length;
  }

  // ─── Cleanup ───

  dispose(): void {
    // Remove all floating numbers
    for (const fn of this.floatingNumbers) {
      this.scene.remove(fn.sprite);
      const mat = fn.sprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.floatingNumbers.length = 0;

    this.prevHealth.clear();
    this.killFeed.length = 0;
  }
}