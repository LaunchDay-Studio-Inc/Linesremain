// ─── NPC Renderer ───
// Renders NPC creatures as billboard sprites with procedural Canvas2D textures.
// Supports 7 creature types, idle/walk animations, floating health bars,
// and name labels visible within 15 blocks.

import * as THREE from 'three';

// ─── Constants ───

const NAME_LABEL_RANGE = 15; // blocks — show name when player is within this distance
const NAME_LABEL_RANGE_SQ = NAME_LABEL_RANGE * NAME_LABEL_RANGE;

// ─── Creature Visual Config ───

interface CreatureVisual {
  bodyColor: string;
  eyeColor: string;
  width: number;
  height: number;
  legCount: number;
  hasHorns: boolean;
  hasTail: boolean;
  bodyShape: 'round' | 'tall' | 'wide' | 'hunched';
  displayName: string;
}

const CREATURE_VISUALS: Record<string, CreatureVisual> = {
  DustHopper: {
    bodyColor: '#c9a96e',
    eyeColor: '#ffdd00',
    width: 48,
    height: 48,
    legCount: 4,
    hasHorns: false,
    hasTail: true,
    bodyShape: 'round',
    displayName: 'Dust Hopper',
  },
  RidgeGrazer: {
    bodyColor: '#8b7d6b',
    eyeColor: '#553311',
    width: 64,
    height: 56,
    legCount: 4,
    hasHorns: true,
    hasTail: true,
    bodyShape: 'wide',
    displayName: 'Ridge Grazer',
  },
  TuskWalker: {
    bodyColor: '#6b5b4f',
    eyeColor: '#ff4400',
    width: 72,
    height: 64,
    legCount: 4,
    hasHorns: true,
    hasTail: false,
    bodyShape: 'wide',
    displayName: 'Tusk Walker',
  },
  HuskWalker: {
    bodyColor: '#4a5a3a',
    eyeColor: '#ccff00',
    width: 56,
    height: 72,
    legCount: 2,
    hasHorns: false,
    hasTail: false,
    bodyShape: 'tall',
    displayName: 'Husk Walker',
  },
  SporeCrawler: {
    bodyColor: '#5a4a6a',
    eyeColor: '#ff00ff',
    width: 52,
    height: 44,
    legCount: 6,
    hasHorns: false,
    hasTail: false,
    bodyShape: 'round',
    displayName: 'Spore Crawler',
  },
  MireBrute: {
    bodyColor: '#3a4a3a',
    eyeColor: '#ff3300',
    width: 80,
    height: 80,
    legCount: 2,
    hasHorns: true,
    hasTail: false,
    bodyShape: 'hunched',
    displayName: 'Mire Brute',
  },
  ShoreSnapper: {
    bodyColor: '#4a6a7a',
    eyeColor: '#00ffcc',
    width: 56,
    height: 40,
    legCount: 4,
    hasHorns: false,
    hasTail: true,
    bodyShape: 'wide',
    displayName: 'Shore Snapper',
  },
  FrostStalker: {
    bodyColor: '#8ecae6',
    eyeColor: '#00bbff',
    width: 52,
    height: 52,
    legCount: 4,
    hasHorns: true,
    hasTail: true,
    bodyShape: 'round',
    displayName: 'Frost Stalker',
  },
  CrimsonHusk: {
    bodyColor: '#6b1a1a',
    eyeColor: '#ff0000',
    width: 60,
    height: 76,
    legCount: 2,
    hasHorns: true,
    hasTail: false,
    bodyShape: 'tall',
    displayName: 'Crimson Husk',
  },
};

// ─── Sprite Generation ───

function generateCreatureSprite(creatureType: string, frame: number = 0): HTMLCanvasElement {
  const visual = CREATURE_VISUALS[creatureType] ?? CREATURE_VISUALS.DustHopper!;
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const w = visual.width;
  const h = visual.height;

  // Animation bob
  const bob = Math.sin(frame * 0.1) * 2;

  ctx.clearRect(0, 0, size, size);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h / 2 + 4, w / 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = darkenColor(visual.bodyColor, 0.3);
  ctx.lineWidth = 3;
  const legSpacing = w / (visual.legCount + 1);
  for (let i = 0; i < visual.legCount; i++) {
    const lx = cx - w / 2 + legSpacing * (i + 1);
    const legBob = Math.sin(frame * 0.15 + i * Math.PI) * 3;
    ctx.beginPath();
    ctx.moveTo(lx, cy + h / 4 + bob);
    ctx.lineTo(lx + legBob, cy + h / 2 + 2);
    ctx.stroke();
  }

  // Body
  ctx.fillStyle = visual.bodyColor;
  switch (visual.bodyShape) {
    case 'round':
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'tall':
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, w / 3, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wide':
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, w / 2, h / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'hunched':
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob + 4, w / 2, h / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hump
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy + bob - h / 4, w / 4, h / 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  // Body outline
  ctx.strokeStyle = darkenColor(visual.bodyColor, 0.2);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes
  ctx.fillStyle = visual.eyeColor;
  const eyeY = cy + bob - h / 6;
  ctx.beginPath();
  ctx.arc(cx - 6, eyeY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 6, eyeY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Eye pupils
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx - 5, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 7, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Horns
  if (visual.hasHorns) {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, eyeY - 4);
    ctx.lineTo(cx - 16, eyeY - 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 10, eyeY - 4);
    ctx.lineTo(cx + 16, eyeY - 16);
    ctx.stroke();
  }

  // Tail
  if (visual.hasTail) {
    const tailBob = Math.sin(frame * 0.12) * 4;
    ctx.strokeStyle = darkenColor(visual.bodyColor, 0.15);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + w / 2, cy + bob);
    ctx.quadraticCurveTo(
      cx + w / 2 + 12,
      cy + bob - 8 + tailBob,
      cx + w / 2 + 18,
      cy + bob + tailBob,
    );
    ctx.stroke();
  }

  return canvas;
}

function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.max(0, Math.floor(r * (1 - amount)));
  const ng = Math.max(0, Math.floor(g * (1 - amount)));
  const nb = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// ─── Name Label ───

function createNameLabelSprite(displayName: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 32);

  // Text
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(displayName, 129, 17);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayName, 128, 16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.0, 0.25, 1);
  sprite.visible = false;
  return sprite;
}

// ─── Health Bar ───

function createHealthBarSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.2, 0.15, 1);
  return sprite;
}

function updateHealthBar(sprite: THREE.Sprite, healthPercent: number): void {
  const material = sprite.material as THREE.SpriteMaterial;
  const texture = material.map as THREE.CanvasTexture;
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 64, 8);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, 64, 8);

  // Health fill
  const fillWidth = Math.max(0, Math.min(64, 64 * healthPercent));
  if (healthPercent > 0.5) {
    ctx.fillStyle = '#44cc44';
  } else if (healthPercent > 0.25) {
    ctx.fillStyle = '#cccc44';
  } else {
    ctx.fillStyle = '#cc4444';
  }
  ctx.fillRect(0, 0, fillWidth, 8);

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 64, 8);

  texture.needsUpdate = true;
}

// ─── NPC Instance ───

interface NPCInstance {
  entityId: number;
  creatureType: string;
  group: THREE.Group;
  sprite: THREE.Sprite;
  healthBar: THREE.Sprite;
  nameLabel: THREE.Sprite;
  animFrame: number;
  lastHealth: number;
  healthBarVisible: boolean;
  healthBarTimer: number;
}

// ─── NPC Renderer ───

export class NPCRenderer {
  private scene: THREE.Scene;
  private npcs = new Map<number, NPCInstance>();
  private textureCache = new Map<string, THREE.CanvasTexture>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ─── Add / Remove ───

  addNPC(entityId: number, creatureType: string, position: THREE.Vector3): void {
    if (this.npcs.has(entityId)) return;

    const group = new THREE.Group();
    group.position.copy(position);

    // Create sprite
    const canvas = generateCreatureSprite(creatureType, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    const visual = CREATURE_VISUALS[creatureType] ?? CREATURE_VISUALS.DustHopper!;
    const spriteScale = Math.max(visual.width, visual.height) / 64;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(spriteScale * 1.5, spriteScale * 1.5, 1);
    sprite.position.y = spriteScale * 0.75;
    group.add(sprite);

    // Health bar (hidden by default)
    const healthBar = createHealthBarSprite();
    healthBar.position.y = spriteScale * 1.5 + 0.3;
    healthBar.visible = false;
    group.add(healthBar);

    // Name label (hidden by default, shown when player is within range)
    const nameLabel = createNameLabelSprite(visual.displayName);
    nameLabel.position.y = spriteScale * 1.5 + 0.55;
    group.add(nameLabel);

    this.scene.add(group);

    this.npcs.set(entityId, {
      entityId,
      creatureType,
      group,
      sprite,
      healthBar,
      nameLabel,
      animFrame: Math.random() * 100, // Stagger animations
      lastHealth: 1.0,
      healthBarVisible: false,
      healthBarTimer: 0,
    });
  }

  removeNPC(entityId: number): void {
    const npc = this.npcs.get(entityId);
    if (!npc) return;

    this.scene.remove(npc.group);

    // Dispose resources
    const spriteMat = npc.sprite.material as THREE.SpriteMaterial;
    spriteMat.map?.dispose();
    spriteMat.dispose();

    const healthMat = npc.healthBar.material as THREE.SpriteMaterial;
    healthMat.map?.dispose();
    healthMat.dispose();

    const nameMat = npc.nameLabel.material as THREE.SpriteMaterial;
    nameMat.map?.dispose();
    nameMat.dispose();

    this.npcs.delete(entityId);
  }

  // ─── Update ───

  update(
    dt: number,
    camera: THREE.Camera,
    entityData: Map<
      number,
      {
        position: { x: number; y: number; z: number };
        health?: { current: number; max: number };
      }
    >,
  ): void {
    for (const [entityId, npc] of this.npcs) {
      const data = entityData.get(entityId);
      if (!data) continue;

      // Update position
      npc.group.position.set(data.position.x, data.position.y, data.position.z);

      // Animation
      npc.animFrame += dt * 60; // 60fps animation speed
      const canvas = generateCreatureSprite(npc.creatureType, npc.animFrame);
      const spriteMat = npc.sprite.material as THREE.SpriteMaterial;
      const texture = spriteMat.map as THREE.CanvasTexture;
      const oldCanvas = texture.image as HTMLCanvasElement;
      const destCtx = oldCanvas.getContext('2d')!;
      destCtx.clearRect(0, 0, oldCanvas.width, oldCanvas.height);
      destCtx.drawImage(canvas, 0, 0);
      texture.needsUpdate = true;

      // Billboard — face camera
      npc.sprite.lookAt(camera.position);

      // Distance to camera (for name label visibility)
      const dx = data.position.x - camera.position.x;
      const dy = data.position.y - camera.position.y;
      const dz = data.position.z - camera.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Name label — show when player is within 15 blocks
      npc.nameLabel.visible = distSq <= NAME_LABEL_RANGE_SQ;

      // Health bar
      if (data.health) {
        const healthPercent = data.health.current / data.health.max;

        // Show health bar when damaged
        if (healthPercent < npc.lastHealth) {
          npc.healthBarVisible = true;
          npc.healthBarTimer = 5.0; // Show for 5 seconds
        }
        npc.lastHealth = healthPercent;

        if (npc.healthBarVisible) {
          npc.healthBarTimer -= dt;
          if (npc.healthBarTimer <= 0 && healthPercent >= 1.0) {
            npc.healthBarVisible = false;
          }
          npc.healthBar.visible = npc.healthBarVisible;
          updateHealthBar(npc.healthBar, healthPercent);
        }
      }
    }
  }

  // ─── Queries ───

  hasNPC(entityId: number): boolean {
    return this.npcs.has(entityId);
  }

  getNPCPosition(entityId: number): THREE.Vector3 | null {
    const npc = this.npcs.get(entityId);
    return npc ? npc.group.position.clone() : null;
  }

  /** Remove any tracked NPCs not present in the active set */
  syncActiveEntities(activeIds: Set<number>): void {
    for (const entityId of this.npcs.keys()) {
      if (!activeIds.has(entityId)) {
        this.removeNPC(entityId);
      }
    }
  }

  // ─── Cleanup ───

  dispose(): void {
    for (const [, npc] of this.npcs) {
      this.scene.remove(npc.group);
      const spriteMat = npc.sprite.material as THREE.SpriteMaterial;
      spriteMat.map?.dispose();
      spriteMat.dispose();
      const nameMat = npc.nameLabel.material as THREE.SpriteMaterial;
      nameMat.map?.dispose();
      nameMat.dispose();
    }
    this.npcs.clear();

    for (const [, texture] of this.textureCache) {
      texture.dispose();
    }
    this.textureCache.clear();
  }
}
