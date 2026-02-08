// ─── Weather System ───
// Manages rain particles, cloud billboards, and lighting/fog adjustments
// based on current weather state.

import * as THREE from 'three';

// ─── Types ───

export type WeatherType = 'clear' | 'cloudy' | 'rain';

interface Cloud {
  mesh: THREE.Sprite;
  driftSpeed: number;
  driftDir: THREE.Vector3;
}

// ─── Constants ───

const RAIN_COUNT = 200;
const RAIN_AREA = 60; // spread around player
const RAIN_HEIGHT = 30;
const RAIN_SPEED = 25;
const RAIN_LENGTH = 1.2;
const RAIN_ANGLE = 0.15; // slight wind angle

// Pre-computed rain velocity
const RAIN_VX = RAIN_ANGLE * RAIN_SPEED;
const RAIN_VY = -RAIN_SPEED;
const RAIN_STREAK_X = RAIN_VX * (RAIN_LENGTH / RAIN_SPEED);
const RAIN_STREAK_Y = RAIN_VY * (RAIN_LENGTH / RAIN_SPEED);

const CLOUD_COUNT = 8;
const CLOUD_Y_MIN = 55;
const CLOUD_Y_MAX = 60;
const CLOUD_SPREAD = 80;
const CLOUD_DRIFT_SPEED_MIN = 0.5;
const CLOUD_DRIFT_SPEED_MAX = 1.5;

// ─── Weather System ───

export class WeatherSystem {
  private scene: THREE.Scene;
  private weather: WeatherType = 'clear';

  // Rain — single batched LineSegments with shared buffer
  private rainPositions: Float32Array; // RAIN_COUNT * 6 (2 endpoints × 3 components)
  private rainLives: Float32Array; // per-drop lifetime
  private rainGeometry: THREE.BufferGeometry;
  private rainMesh: THREE.LineSegments;
  private rainMaterial: THREE.LineBasicMaterial;

  // Clouds
  private clouds: Cloud[] = [];
  private cloudGroup: THREE.Group;
  private cloudMaterials: THREE.SpriteMaterial[] = [];
  private cloudTexture: THREE.CanvasTexture;

  // Fog/lighting multipliers (applied by caller, not directly to fog)
  private fogNearMultiplier = 1;
  private fogFarMultiplier = 1;
  private ambientMultiplier = 1;

  // Player tracking
  private playerPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // ── Rain setup (single batched mesh) ──
    this.rainPositions = new Float32Array(RAIN_COUNT * 6);
    this.rainLives = new Float32Array(RAIN_COUNT);

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0x8899bb,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });

    this.rainMesh = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    scene.add(this.rainMesh);

    // Initialize all rain drops
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.resetRainDrop(i);
    }

    // ── Cloud setup ──
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.visible = false;
    scene.add(this.cloudGroup);

    this.cloudTexture = this.generateCloudTexture();

    // Pre-create one material per cloud to avoid per-cloud cloning
    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.cloudMaterials.push(
        new THREE.SpriteMaterial({
          map: this.cloudTexture,
          transparent: true,
          opacity: 0.3 + Math.random() * 0.4,
          depthWrite: false,
          fog: true,
        }),
      );
    }

    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.clouds.push(this.createCloud(i));
    }
  }

  // ─── Cloud Texture Generation ───

  private generateCloudTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Soft radial gradient cloud
    const cx = size / 2;
    const cy = size / 2;

    // Draw several overlapping circles for cloud shape
    const blobs = [
      { x: cx, y: cy, r: 40 },
      { x: cx - 25, y: cy + 5, r: 30 },
      { x: cx + 25, y: cy + 5, r: 30 },
      { x: cx - 10, y: cy - 10, r: 35 },
      { x: cx + 10, y: cy - 10, r: 35 },
    ];

    for (const blob of blobs) {
      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      grad.addColorStop(0, 'rgba(220, 220, 230, 0.8)');
      grad.addColorStop(0.5, 'rgba(200, 200, 210, 0.4)');
      grad.addColorStop(1, 'rgba(180, 180, 190, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // ─── Rain Drop Reset ───

  private resetRainDrop(index: number): void {
    const x = this.playerPos.x + (Math.random() - 0.5) * RAIN_AREA;
    const y = this.playerPos.y + RAIN_HEIGHT * (0.5 + Math.random() * 0.5);
    const z = this.playerPos.z + (Math.random() - 0.5) * RAIN_AREA;

    const base = index * 6;
    // Start point
    this.rainPositions[base] = x;
    this.rainPositions[base + 1] = y;
    this.rainPositions[base + 2] = z;
    // End point (streak direction)
    this.rainPositions[base + 3] = x + RAIN_STREAK_X;
    this.rainPositions[base + 4] = y + RAIN_STREAK_Y;
    this.rainPositions[base + 5] = z;

    this.rainLives[index] = Math.random() * 2; // stagger start times
  }

  // ─── Cloud Creation ───

  private createCloud(index: number): Cloud {
    const sprite = new THREE.Sprite(this.cloudMaterials[index]!);
    const scale = 15 + Math.random() * 20;
    sprite.scale.set(scale, scale * 0.4, 1);

    const x = this.playerPos.x + (Math.random() - 0.5) * CLOUD_SPREAD * 2;
    const y = CLOUD_Y_MIN + Math.random() * (CLOUD_Y_MAX - CLOUD_Y_MIN);
    const z = this.playerPos.z + (Math.random() - 0.5) * CLOUD_SPREAD * 2;
    sprite.position.set(x, y, z);

    this.cloudGroup.add(sprite);

    const driftSpeed =
      CLOUD_DRIFT_SPEED_MIN + Math.random() * (CLOUD_DRIFT_SPEED_MAX - CLOUD_DRIFT_SPEED_MIN);
    const windAngle = Math.random() * Math.PI * 0.3; // slight variation in wind direction

    return {
      mesh: sprite,
      driftSpeed,
      driftDir: new THREE.Vector3(Math.cos(windAngle), 0, Math.sin(windAngle)).normalize(),
    };
  }

  // ─── Weather Control ───

  setWeather(weather: WeatherType): void {
    if (this.weather === weather) return;
    this.weather = weather;

    const showRain = weather === 'rain';
    const showClouds = weather === 'rain' || weather === 'cloudy';

    this.rainMesh.visible = showRain;
    this.cloudGroup.visible = showClouds;

    // Set fog/lighting multipliers for caller to consume
    if (weather === 'rain') {
      this.fogNearMultiplier = 0.4;
      this.fogFarMultiplier = 0.35;
      this.ambientMultiplier = 0.7;
    } else {
      this.fogNearMultiplier = 1;
      this.fogFarMultiplier = 1;
      this.ambientMultiplier = 1;
    }
  }

  getWeather(): WeatherType {
    return this.weather;
  }

  /** Get fog near multiplier for SkyRenderer to apply */
  getFogNearMultiplier(): number {
    return this.fogNearMultiplier;
  }

  /** Get fog far multiplier for SkyRenderer to apply */
  getFogFarMultiplier(): number {
    return this.fogFarMultiplier;
  }

  /** Get ambient light multiplier for SkyRenderer to apply */
  getAmbientMultiplier(): number {
    return this.ambientMultiplier;
  }

  // ─── Update ───

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.playerPos.copy(playerPosition);

    if (this.weather === 'rain') {
      this.updateRain(dt);
    }

    if (this.weather === 'rain' || this.weather === 'cloudy') {
      this.updateClouds(dt);
    }
  }

  private updateRain(dt: number): void {
    const dx = RAIN_VX * dt;
    const dy = RAIN_VY * dt;

    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainLives[i]! -= dt;
      const base = i * 6;

      // Move both endpoints
      this.rainPositions[base]! += dx;
      this.rainPositions[base + 1]! += dy;
      // z unchanged (no z velocity)
      this.rainPositions[base + 3]! += dx;
      this.rainPositions[base + 4]! += dy;
      // z unchanged

      // Reset if below ground or too far from player
      const dropY = this.rainPositions[base + 1]!;
      const distX = Math.abs(this.rainPositions[base]! - this.playerPos.x);
      const distZ = Math.abs(this.rainPositions[base + 2]! - this.playerPos.z);

      if (
        dropY < this.playerPos.y - 5 ||
        distX > RAIN_AREA ||
        distZ > RAIN_AREA ||
        this.rainLives[i]! <= 0
      ) {
        this.resetRainDrop(i);
      }
    }

    (this.rainGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateClouds(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.mesh.position.addScaledVector(cloud.driftDir, cloud.driftSpeed * dt);

      // Wrap clouds around player
      const dx = cloud.mesh.position.x - this.playerPos.x;
      const dz = cloud.mesh.position.z - this.playerPos.z;

      if (Math.abs(dx) > CLOUD_SPREAD) {
        cloud.mesh.position.x = this.playerPos.x - Math.sign(dx) * CLOUD_SPREAD;
      }
      if (Math.abs(dz) > CLOUD_SPREAD) {
        cloud.mesh.position.z = this.playerPos.z - Math.sign(dz) * CLOUD_SPREAD;
      }
    }
  }

  // ─── Cleanup ───

  dispose(): void {
    // Rain cleanup
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.scene.remove(this.rainMesh);

    // Cloud cleanup
    for (const cloud of this.clouds) {
      this.cloudGroup.remove(cloud.mesh);
    }
    this.clouds.length = 0;
    for (const mat of this.cloudMaterials) {
      mat.dispose();
    }
    this.cloudMaterials.length = 0;
    this.cloudTexture.dispose();
    this.scene.remove(this.cloudGroup);
  }
}
