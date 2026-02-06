// ─── Item Drop Renderer ───
// Renders dropped items in the 3D world as billboard sprites with
// bob/spin animation, glow effect, and pickup proximity prompt.

import * as THREE from 'three';

// ─── Constants ───

const BOB_AMPLITUDE = 0.15; // vertical bob distance
const BOB_SPEED = 2.0; // bob cycles per second
const SPIN_SPEED = 1.5; // radians per second
const GLOW_COLOR = 0xffffaa;
const GLOW_INTENSITY = 0.6;
const SPRITE_SIZE = 0.5;
const PICKUP_RANGE = 3.0;

// ─── Item Drop Data ───

interface ItemDropData {
  entityId: number;
  itemId: number;
  quantity: number;
  baseY: number;
  spawnTime: number;
}

// ─── Item Drop Renderer Class ───

export class ItemDropRenderer {
  private scene: THREE.Scene;
  private drops = new Map<number, {
    group: THREE.Group;
    sprite: THREE.Sprite;
    glow: THREE.PointLight;
    data: ItemDropData;
  }>();

  /** Shared sprite material cache keyed by itemId */
  private materialCache = new Map<number, THREE.SpriteMaterial>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ─── Get or create sprite material for an item ───

  private getMaterial(itemId: number): THREE.SpriteMaterial {
    let mat = this.materialCache.get(itemId);
    if (!mat) {
      // Generate a colored square as placeholder — in production, use item icon textures
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;

      // Background with item-specific color
      const hue = (itemId * 137) % 360; // deterministic color from itemId
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(4, 4, 56, 56);

      // Border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, 56, 56);

      // Item ID text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${itemId}`, 32, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;

      mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      this.materialCache.set(itemId, mat);
    }
    return mat;
  }

  // ─── Add a dropped item to the scene ───

  addDrop(
    entityId: number,
    itemId: number,
    quantity: number,
    position: { x: number; y: number; z: number },
  ): void {
    // Remove if already exists
    this.removeDrop(entityId);

    const group = new THREE.Group();
    group.position.set(position.x, position.y, position.z);

    // Sprite
    const material = this.getMaterial(itemId);
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1);
    group.add(sprite);

    // Glow point light
    const glow = new THREE.PointLight(GLOW_COLOR, GLOW_INTENSITY, 3);
    glow.position.set(0, 0.2, 0);
    group.add(glow);

    this.scene.add(group);

    this.drops.set(entityId, {
      group,
      sprite,
      glow,
      data: {
        entityId,
        itemId,
        quantity,
        baseY: position.y,
        spawnTime: performance.now() / 1000,
      },
    });
  }

  // ─── Remove a dropped item from the scene ───

  removeDrop(entityId: number): void {
    const drop = this.drops.get(entityId);
    if (drop) {
      this.scene.remove(drop.group);
      this.drops.delete(entityId);
    }
  }

  // ─── Update animations (called each frame) ───

  update(time: number, playerPosition?: THREE.Vector3): { nearbyDrops: number[] } {
    const nearbyDrops: number[] = [];

    for (const [entityId, drop] of this.drops) {
      const elapsed = time - drop.data.spawnTime;

      // Bob animation
      const bobOffset = Math.sin(elapsed * BOB_SPEED * Math.PI * 2) * BOB_AMPLITUDE;
      drop.group.position.y = drop.data.baseY + 0.3 + bobOffset;

      // Spin animation
      drop.sprite.material.rotation = elapsed * SPIN_SPEED;

      // Glow pulse
      drop.glow.intensity = GLOW_INTENSITY + Math.sin(elapsed * 3) * 0.2;

      // Check pickup proximity
      if (playerPosition) {
        const dx = drop.group.position.x - playerPosition.x;
        const dy = drop.group.position.y - playerPosition.y;
        const dz = drop.group.position.z - playerPosition.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= PICKUP_RANGE * PICKUP_RANGE) {
          nearbyDrops.push(entityId);

          // Scale up slightly when in pickup range
          const pulseScale = SPRITE_SIZE + Math.sin(elapsed * 4) * 0.05;
          drop.sprite.scale.set(pulseScale, pulseScale, 1);
        } else {
          drop.sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1);
        }
      }
    }

    return { nearbyDrops };
  }

  // ─── Get drop info by entity ID ───

  getDropData(entityId: number): ItemDropData | undefined {
    return this.drops.get(entityId)?.data;
  }

  // ─── Get all drop entity IDs ───

  getAllDropIds(): number[] {
    return Array.from(this.drops.keys());
  }

  // ─── Dispose all resources ───

  dispose(): void {
    for (const [, drop] of this.drops) {
      this.scene.remove(drop.group);
    }
    this.drops.clear();

    for (const [, mat] of this.materialCache) {
      mat.map?.dispose();
      mat.dispose();
    }
    this.materialCache.clear();
  }
}