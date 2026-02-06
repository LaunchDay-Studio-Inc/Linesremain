// ─── Barrel Renderer ───
// Renders lootable barrels as 3D CylinderGeometry meshes.
// Features: health bar when damaged, break animation with particles,
// subtle idle wobble, and proximity interaction prompt.

import * as THREE from 'three';
import type { ParticleSystem } from '../engine/ParticleSystem';

// ─── Constants ───

const BARREL_RADIUS_TOP = 0.35;
const BARREL_RADIUS_BOTTOM = 0.4;
const BARREL_HEIGHT = 0.9;
const BARREL_SEGMENTS = 12;

const HEALTH_BAR_WIDTH = 64;
const HEALTH_BAR_HEIGHT = 8;
const HEALTH_BAR_SHOW_DURATION = 5.0; // seconds

const INTERACT_DISTANCE = 3.5;
const PROMPT_SCALE = 1.4;

const BARREL_COLOR = 0x8b6b4a;
const BARREL_BAND_COLOR = 0x555555;
const BARREL_LID_COLOR = 0x7a5c3a;

// ─── Prompt Texture ───

let cachedPromptTexture: THREE.CanvasTexture | null = null;

function getPromptTexture(): THREE.CanvasTexture {
  if (cachedPromptTexture) return cachedPromptTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 64);

  // Background pill
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(r + 8, 12);
  ctx.lineTo(248 - r, 12);
  ctx.quadraticCurveTo(248, 12, 248, 12 + r);
  ctx.lineTo(248, 52 - r);
  ctx.quadraticCurveTo(248, 52, 248 - r, 52);
  ctx.lineTo(r + 8, 52);
  ctx.quadraticCurveTo(8, 52, 8, 52 - r);
  ctx.lineTo(8, 12 + r);
  ctx.quadraticCurveTo(8, 12, r + 8, 12);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Key box "[E]"
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(20, 20, 28, 24);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(20, 20, 28, 24);

  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffdd44';
  ctx.fillText('E', 34, 33);

  // "Search" text
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('Search', 58, 33);

  cachedPromptTexture = new THREE.CanvasTexture(canvas);
  cachedPromptTexture.minFilter = THREE.LinearFilter;
  cachedPromptTexture.magFilter = THREE.LinearFilter;
  return cachedPromptTexture;
}

// ─── Health Bar ───

function createHealthBarSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = HEALTH_BAR_WIDTH;
  canvas.height = HEALTH_BAR_HEIGHT;

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.0, 0.12, 1);
  return sprite;
}

function updateHealthBar(sprite: THREE.Sprite, healthPercent: number): void {
  const material = sprite.material as THREE.SpriteMaterial;
  const texture = material.map as THREE.CanvasTexture;
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);

  // Health fill
  const fillWidth = Math.max(0, Math.min(HEALTH_BAR_WIDTH, HEALTH_BAR_WIDTH * healthPercent));
  if (healthPercent > 0.5) {
    ctx.fillStyle = '#44cc44';
  } else if (healthPercent > 0.25) {
    ctx.fillStyle = '#cccc44';
  } else {
    ctx.fillStyle = '#cc4444';
  }
  ctx.fillRect(0, 0, fillWidth, HEALTH_BAR_HEIGHT);

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);

  texture.needsUpdate = true;
}

// ─── Barrel Mesh Builder ───

function createBarrelMesh(): THREE.Group {
  const group = new THREE.Group();

  // Main barrel body — tapered cylinder
  const bodyGeom = new THREE.CylinderGeometry(
    BARREL_RADIUS_TOP,
    BARREL_RADIUS_BOTTOM,
    BARREL_HEIGHT,
    BARREL_SEGMENTS,
  );
  const bodyMat = new THREE.MeshLambertMaterial({ color: BARREL_COLOR });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = BARREL_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Top lid
  const lidGeom = new THREE.CylinderGeometry(
    BARREL_RADIUS_TOP - 0.02,
    BARREL_RADIUS_TOP - 0.02,
    0.04,
    BARREL_SEGMENTS,
  );
  const lidMat = new THREE.MeshLambertMaterial({ color: BARREL_LID_COLOR });
  const lid = new THREE.Mesh(lidGeom, lidMat);
  lid.position.y = BARREL_HEIGHT;
  lid.castShadow = true;
  group.add(lid);

  // Metal bands (2 torus rings)
  const bandGeom = new THREE.TorusGeometry(BARREL_RADIUS_BOTTOM - 0.02, 0.02, 6, BARREL_SEGMENTS);
  const bandMat = new THREE.MeshLambertMaterial({ color: BARREL_BAND_COLOR });

  const band1 = new THREE.Mesh(bandGeom, bandMat);
  band1.rotation.x = Math.PI / 2;
  band1.position.y = BARREL_HEIGHT * 0.25;
  group.add(band1);

  const band2 = new THREE.Mesh(bandGeom, bandMat);
  band2.rotation.x = Math.PI / 2;
  band2.position.y = BARREL_HEIGHT * 0.75;
  group.add(band2);

  return group;
}

// ─── Barrel Instance ───

interface BarrelInstance {
  entityId: number;
  group: THREE.Group;
  barrelMesh: THREE.Group;
  healthBar: THREE.Sprite;
  promptSprite: THREE.Sprite;
  healthBarTimer: number;
  lastHealth: number;
  maxHealth: number;
  isDestroyed: boolean;
  destroyTimer: number;
}

// ─── Barrel Renderer ───

export class BarrelRenderer {
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private barrels = new Map<number, BarrelInstance>();

  // Shared geometries/materials for disposal
  private sharedGeometries: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene = scene;
    this.particles = particles;
  }

  // ─── Add / Remove ───

  addBarrel(
    entityId: number,
    position: THREE.Vector3,
    maxHealth: number,
    rotation: number = 0,
  ): void {
    if (this.barrels.has(entityId)) return;

    const group = new THREE.Group();
    group.position.copy(position);

    // Barrel mesh
    const barrelMesh = createBarrelMesh();
    barrelMesh.rotation.y = rotation;
    group.add(barrelMesh);

    // Health bar (hidden by default)
    const healthBar = createHealthBarSprite();
    healthBar.position.y = BARREL_HEIGHT + 0.3;
    healthBar.visible = false;
    group.add(healthBar);

    // Interaction prompt (hidden by default)
    const promptTexture = getPromptTexture();
    const promptMat = new THREE.SpriteMaterial({
      map: promptTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const promptSprite = new THREE.Sprite(promptMat);
    promptSprite.scale.set(PROMPT_SCALE, PROMPT_SCALE * 0.25, 1);
    promptSprite.position.y = BARREL_HEIGHT + 0.6;
    promptSprite.visible = false;
    group.add(promptSprite);

    this.scene.add(group);

    this.barrels.set(entityId, {
      entityId,
      group,
      barrelMesh,
      healthBar,
      promptSprite,
      healthBarTimer: 0,
      lastHealth: maxHealth,
      maxHealth,
      isDestroyed: false,
      destroyTimer: 0,
    });
  }

  removeBarrel(entityId: number): void {
    const barrel = this.barrels.get(entityId);
    if (!barrel) return;

    this.scene.remove(barrel.group);
    this.disposeBarrelResources(barrel);
    this.barrels.delete(entityId);
  }

  private disposeBarrelResources(barrel: BarrelInstance): void {
    // Dispose barrel mesh children
    barrel.barrelMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Health bar
    const healthMat = barrel.healthBar.material as THREE.SpriteMaterial;
    healthMat.map?.dispose();
    healthMat.dispose();

    // Prompt
    (barrel.promptSprite.material as THREE.SpriteMaterial).dispose();
  }

  // ─── Update ───

  update(
    dt: number,
    camera: THREE.Camera,
    playerPosition: THREE.Vector3,
    barrelData?: Map<number, {
      position: { x: number; y: number; z: number };
      health?: { current: number; max: number };
    }>,
  ): void {
    const toRemove: number[] = [];

    for (const [entityId, barrel] of this.barrels) {
      // Update from server data
      if (barrelData) {
        const data = barrelData.get(entityId);
        if (data) {
          barrel.group.position.set(data.position.x, data.position.y, data.position.z);

          if (data.health) {
            const currentHealth = data.health.current;
            barrel.maxHealth = data.health.max;

            // Detect damage
            if (currentHealth < barrel.lastHealth) {
              this.onBarrelHit(barrel, barrel.lastHealth - currentHealth);
            }
            barrel.lastHealth = currentHealth;

            // Check destruction
            if (currentHealth <= 0 && !barrel.isDestroyed) {
              this.onBarrelDestroyed(barrel);
            }
          }
        }
      }

      // Destruction animation
      if (barrel.isDestroyed) {
        barrel.destroyTimer += dt;

        // Scale down and fade
        const progress = Math.min(1, barrel.destroyTimer / 0.5);
        const scale = 1.0 - progress;
        barrel.barrelMesh.scale.setScalar(scale);
        barrel.barrelMesh.position.y = -progress * 0.3;

        // Tilt as it "collapses"
        barrel.barrelMesh.rotation.z = progress * 0.5;
        barrel.barrelMesh.rotation.x = progress * 0.3;

        if (barrel.destroyTimer >= 0.6) {
          toRemove.push(entityId);
        }
        continue;
      }

      // Health bar visibility
      if (barrel.healthBarTimer > 0) {
        barrel.healthBarTimer -= dt;
        barrel.healthBar.visible = true;

        const healthPercent = barrel.lastHealth / barrel.maxHealth;
        updateHealthBar(barrel.healthBar, healthPercent);

        // Billboard health bar
        barrel.healthBar.lookAt(camera.position);
      } else {
        barrel.healthBar.visible = false;
      }

      // Proximity prompt
      const dist = barrel.group.position.distanceTo(playerPosition);
      const showPrompt = dist <= INTERACT_DISTANCE && !barrel.isDestroyed;
      barrel.promptSprite.visible = showPrompt;

      if (showPrompt) {
        const alpha = 1.0 - (dist / INTERACT_DISTANCE) * 0.5;
        const promptMat = barrel.promptSprite.material as THREE.SpriteMaterial;
        promptMat.opacity = alpha;
        barrel.promptSprite.lookAt(camera.position);
      }

      // Damage shake effect (brief wobble when health bar is showing and recently hit)
      if (barrel.healthBarTimer > HEALTH_BAR_SHOW_DURATION - 0.3) {
        const shakeIntensity =
          (barrel.healthBarTimer - (HEALTH_BAR_SHOW_DURATION - 0.3)) / 0.3;
        barrel.barrelMesh.rotation.z = Math.sin(barrel.healthBarTimer * 40) * 0.05 * shakeIntensity;
        barrel.barrelMesh.rotation.x = Math.cos(barrel.healthBarTimer * 35) * 0.03 * shakeIntensity;
      } else {
        // Reset rotation smoothly
        barrel.barrelMesh.rotation.z *= 0.9;
        barrel.barrelMesh.rotation.x *= 0.9;
      }
    }

    // Remove destroyed barrels
    for (const id of toRemove) {
      this.removeBarrel(id);
    }
  }

  // ─── Damage / Destroy Effects ───

  private onBarrelHit(barrel: BarrelInstance, _damage: number): void {
    barrel.healthBarTimer = HEALTH_BAR_SHOW_DURATION;

    // Wood chip particles
    const pos = barrel.group.position.clone();
    pos.y += BARREL_HEIGHT * 0.5;

    this.particles.emit({
      position: pos,
      count: 6,
      color: new THREE.Color(BARREL_COLOR),
      speed: 3.0,
      spread: 0.6,
      lifetime: 0.6,
      size: 0.1,
      gravity: -12.0,
    });
  }

  private onBarrelDestroyed(barrel: BarrelInstance): void {
    barrel.isDestroyed = true;
    barrel.destroyTimer = 0;
    barrel.healthBar.visible = false;
    barrel.promptSprite.visible = false;

    const pos = barrel.group.position.clone();
    pos.y += BARREL_HEIGHT * 0.5;

    // Large burst of wood particles
    this.particles.emitBlockBreak(pos, new THREE.Color(BARREL_COLOR));

    // Metal band fragments
    this.particles.emit({
      position: pos,
      count: 4,
      color: new THREE.Color(BARREL_BAND_COLOR),
      speed: 5.0,
      spread: 0.8,
      lifetime: 0.8,
      size: 0.08,
      gravity: -15.0,
    });

    // Dust cloud
    this.particles.emit({
      position: pos,
      count: 8,
      color: new THREE.Color(0xccbb99),
      speed: 1.5,
      spread: 0.5,
      lifetime: 0.6,
      size: 0.2,
      gravity: -2.0,
    });
  }

  // ─── Queries ───

  hasBarrel(entityId: number): boolean {
    return this.barrels.has(entityId);
  }

  getBarrelPosition(entityId: number): THREE.Vector3 | null {
    const barrel = this.barrels.get(entityId);
    return barrel ? barrel.group.position.clone() : null;
  }

  /**
   * Get the closest barrel within interaction range of the player.
   */
  getClosestInteractableBarrel(playerPosition: THREE.Vector3): number | null {
    let closestId: number | null = null;
    let closestDist = INTERACT_DISTANCE;

    for (const [entityId, barrel] of this.barrels) {
      if (barrel.isDestroyed) continue;
      const dist = barrel.group.position.distanceTo(playerPosition);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = entityId;
      }
    }

    return closestId;
  }

  // ─── Cleanup ───

  dispose(): void {
    for (const [, barrel] of this.barrels) {
      this.scene.remove(barrel.group);
      this.disposeBarrelResources(barrel);
    }
    this.barrels.clear();

    for (const geom of this.sharedGeometries) {
      geom.dispose();
    }
    this.sharedGeometries.length = 0;

    if (cachedPromptTexture) {
      cachedPromptTexture.dispose();
      cachedPromptTexture = null;
    }
  }
}