// ─── Loot Bag Renderer ───
// Renders loot bags (dropped on death) as billboard sprites.
// Features: pulsing glow animation, skull icon for player bags,
// proximity "Press E to loot" prompt, and idle bob animation.

import * as THREE from 'three';

// ─── Constants ───

const BAG_SPRITE_SIZE = 64;
const BAG_SCALE = 0.8;
const BOB_SPEED = 2.0;
const BOB_AMPLITUDE = 0.08;
const GLOW_SPEED = 3.0;
const GLOW_MIN = 0.6;
const GLOW_MAX = 1.0;
const PROMPT_DISTANCE = 4.0; // distance at which "Press E" appears
const PROMPT_SCALE = 1.6;

// ─── Sprite Generation ───

function generateBagSprite(isPlayerBag: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BAG_SPRITE_SIZE;
  canvas.height = BAG_SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const cx = BAG_SPRITE_SIZE / 2;

  ctx.clearRect(0, 0, BAG_SPRITE_SIZE, BAG_SPRITE_SIZE);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, 54, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bag body
  ctx.fillStyle = isPlayerBag ? '#6b4226' : '#8b6914';
  ctx.beginPath();
  ctx.moveTo(cx - 14, 20);
  ctx.quadraticCurveTo(cx - 18, 50, cx - 12, 52);
  ctx.lineTo(cx + 12, 52);
  ctx.quadraticCurveTo(cx + 18, 50, cx + 14, 20);
  ctx.closePath();
  ctx.fill();

  // Bag outline
  ctx.strokeStyle = isPlayerBag ? '#4a2e18' : '#6b5010';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bag tie / cinch at top
  ctx.fillStyle = isPlayerBag ? '#4a2e18' : '#6b5010';
  ctx.beginPath();
  ctx.moveTo(cx - 10, 22);
  ctx.quadraticCurveTo(cx, 14, cx + 10, 22);
  ctx.quadraticCurveTo(cx, 18, cx - 10, 22);
  ctx.fill();

  // Rope tie
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 3, 18);
  ctx.lineTo(cx + 3, 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, 15, 3, 0, Math.PI * 2);
  ctx.stroke();

  // Highlight / sheen
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.ellipse(cx - 4, 34, 6, 12, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Skull icon for player death bags
  if (isPlayerBag) {
    ctx.fillStyle = '#ddd';
    // Skull
    ctx.beginPath();
    ctx.arc(cx, 36, 7, 0, Math.PI * 2);
    ctx.fill();
    // Jaw
    ctx.fillRect(cx - 5, 40, 10, 4);
    // Eyes
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.arc(cx - 3, 35, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 3, 35, 2, 0, Math.PI * 2);
    ctx.fill();
    // Nose
    ctx.beginPath();
    ctx.moveTo(cx, 37);
    ctx.lineTo(cx - 1, 39);
    ctx.lineTo(cx + 1, 39);
    ctx.closePath();
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#ddd';
    ctx.strokeStyle = '#4a2e18';
    ctx.lineWidth = 0.5;
    for (let i = -3; i <= 3; i += 2) {
      ctx.fillRect(cx + i - 0.5, 40, 1.5, 3);
      ctx.strokeRect(cx + i - 0.5, 40, 1.5, 3);
    }
  }

  return canvas;
}

function generatePromptSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 64);

  // Background pill
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const radius = 12;
  ctx.beginPath();
  ctx.moveTo(radius + 8, 12);
  ctx.lineTo(248 - radius, 12);
  ctx.quadraticCurveTo(248, 12, 248, 12 + radius);
  ctx.lineTo(248, 52 - radius);
  ctx.quadraticCurveTo(248, 52, 248 - radius, 52);
  ctx.lineTo(radius + 8, 52);
  ctx.quadraticCurveTo(8, 52, 8, 52 - radius);
  ctx.lineTo(8, 12 + radius);
  ctx.quadraticCurveTo(8, 12, radius + 8, 12);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Key indicator box "[E]"
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(20, 20, 28, 24);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 28, 24);

  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffdd44';
  ctx.fillText('E', 34, 33);

  // "Loot" text
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('Loot', 58, 33);

  return canvas;
}

// ─── Loot Bag Instance ───

interface LootBagInstance {
  entityId: number;
  isPlayerBag: boolean;
  group: THREE.Group;
  bagSprite: THREE.Sprite;
  promptSprite: THREE.Sprite;
  glowMesh: THREE.Mesh;
  animTime: number;
  baseY: number;
}

// ─── Loot Bag Renderer ───

export class LootBagRenderer {
  private scene: THREE.Scene;
  private bags = new Map<number, LootBagInstance>();

  // Cached textures
  private playerBagTexture: THREE.CanvasTexture | null = null;
  private npcBagTexture: THREE.CanvasTexture | null = null;
  private promptTexture: THREE.CanvasTexture | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ─── Texture Caching ───

  private getBagTexture(isPlayerBag: boolean): THREE.CanvasTexture {
    if (isPlayerBag) {
      if (!this.playerBagTexture) {
        const canvas = generateBagSprite(true);
        this.playerBagTexture = new THREE.CanvasTexture(canvas);
        this.playerBagTexture.minFilter = THREE.NearestFilter;
        this.playerBagTexture.magFilter = THREE.NearestFilter;
      }
      return this.playerBagTexture;
    } else {
      if (!this.npcBagTexture) {
        const canvas = generateBagSprite(false);
        this.npcBagTexture = new THREE.CanvasTexture(canvas);
        this.npcBagTexture.minFilter = THREE.NearestFilter;
        this.npcBagTexture.magFilter = THREE.NearestFilter;
      }
      return this.npcBagTexture;
    }
  }

  private getPromptTexture(): THREE.CanvasTexture {
    if (!this.promptTexture) {
      const canvas = generatePromptSprite();
      this.promptTexture = new THREE.CanvasTexture(canvas);
      this.promptTexture.minFilter = THREE.LinearFilter;
      this.promptTexture.magFilter = THREE.LinearFilter;
    }
    return this.promptTexture;
  }

  // ─── Add / Remove ───

  addBag(entityId: number, position: THREE.Vector3, isPlayerBag: boolean): void {
    if (this.bags.has(entityId)) return;

    const group = new THREE.Group();
    group.position.copy(position);

    // Bag sprite
    const bagTexture = this.getBagTexture(isPlayerBag);
    const bagMaterial = new THREE.SpriteMaterial({
      map: bagTexture,
      transparent: true,
      alphaTest: 0.1,
    });
    const bagSprite = new THREE.Sprite(bagMaterial);
    bagSprite.scale.set(BAG_SCALE, BAG_SCALE, 1);
    bagSprite.position.y = BAG_SCALE * 0.5;
    group.add(bagSprite);

    // Ground glow circle
    const glowGeometry = new THREE.CircleGeometry(0.5, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: isPlayerBag ? 0xff6644 : 0xffcc44,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.y = 0.02; // Slightly above ground to avoid z-fighting
    group.add(glowMesh);

    // Prompt sprite (hidden by default)
    const promptTexture = this.getPromptTexture();
    const promptMaterial = new THREE.SpriteMaterial({
      map: promptTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const promptSprite = new THREE.Sprite(promptMaterial);
    promptSprite.scale.set(PROMPT_SCALE, PROMPT_SCALE * 0.25, 1);
    promptSprite.position.y = BAG_SCALE + 0.6;
    promptSprite.visible = false;
    group.add(promptSprite);

    this.scene.add(group);

    this.bags.set(entityId, {
      entityId,
      isPlayerBag,
      group,
      bagSprite,
      promptSprite,
      glowMesh,
      animTime: Math.random() * Math.PI * 2, // Stagger animations
      baseY: position.y,
    });
  }

  removeBag(entityId: number): void {
    const bag = this.bags.get(entityId);
    if (!bag) return;

    this.scene.remove(bag.group);

    // Dispose sprite materials (not textures — they're cached)
    (bag.bagSprite.material as THREE.SpriteMaterial).dispose();
    (bag.promptSprite.material as THREE.SpriteMaterial).dispose();
    (bag.glowMesh.material as THREE.MeshBasicMaterial).dispose();
    (bag.glowMesh.geometry as THREE.CircleGeometry).dispose();

    this.bags.delete(entityId);
  }

  // ─── Update ───

  update(
    dt: number,
    camera: THREE.Camera,
    playerPosition: THREE.Vector3,
    bagPositions?: Map<number, { x: number; y: number; z: number }>,
  ): void {
    for (const [entityId, bag] of this.bags) {
      bag.animTime += dt;

      // Update position from server data if provided
      if (bagPositions) {
        const serverPos = bagPositions.get(entityId);
        if (serverPos) {
          bag.group.position.set(serverPos.x, serverPos.y, serverPos.z);
          bag.baseY = serverPos.y;
        }
      }

      // Bob animation
      const bobOffset = Math.sin(bag.animTime * BOB_SPEED) * BOB_AMPLITUDE;
      bag.bagSprite.position.y = BAG_SCALE * 0.5 + bobOffset;

      // Billboard — face camera
      bag.bagSprite.lookAt(camera.position);

      // Glow pulse
      const glowIntensity =
        GLOW_MIN + (GLOW_MAX - GLOW_MIN) * ((Math.sin(bag.animTime * GLOW_SPEED) + 1) * 0.5);
      const glowMat = bag.glowMesh.material as THREE.MeshBasicMaterial;
      glowMat.opacity = glowIntensity * 0.3;

      // Scale glow slightly with pulse
      const glowScale = 0.5 + glowIntensity * 0.15;
      bag.glowMesh.scale.setScalar(glowScale);

      // Proximity prompt
      const distToPlayer = bag.group.position.distanceTo(playerPosition);
      const showPrompt = distToPlayer <= PROMPT_DISTANCE;
      bag.promptSprite.visible = showPrompt;

      if (showPrompt) {
        // Fade prompt based on distance
        const promptAlpha = 1.0 - (distToPlayer / PROMPT_DISTANCE) * 0.5;
        const promptMat = bag.promptSprite.material as THREE.SpriteMaterial;
        promptMat.opacity = promptAlpha;

        // Billboard prompt
        bag.promptSprite.lookAt(camera.position);
      }
    }
  }

  // ─── Queries ───

  hasBag(entityId: number): boolean {
    return this.bags.has(entityId);
  }

  getAllBagIds(): number[] {
    return Array.from(this.bags.keys());
  }

  getBagPosition(entityId: number): THREE.Vector3 | null {
    const bag = this.bags.get(entityId);
    return bag ? bag.group.position.clone() : null;
  }

  /**
   * Get the closest loot bag within interaction range of the player.
   * Returns the entity ID or null.
   */
  getClosestInteractableBag(playerPosition: THREE.Vector3): number | null {
    let closestId: number | null = null;
    let closestDist = PROMPT_DISTANCE;

    for (const [entityId, bag] of this.bags) {
      const dist = bag.group.position.distanceTo(playerPosition);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = entityId;
      }
    }

    return closestId;
  }

  // ─── Cleanup ───

  dispose(): void {
    for (const [, bag] of this.bags) {
      this.scene.remove(bag.group);
      (bag.bagSprite.material as THREE.SpriteMaterial).dispose();
      (bag.promptSprite.material as THREE.SpriteMaterial).dispose();
      (bag.glowMesh.material as THREE.MeshBasicMaterial).dispose();
      (bag.glowMesh.geometry as THREE.CircleGeometry).dispose();
    }
    this.bags.clear();

    this.playerBagTexture?.dispose();
    this.playerBagTexture = null;
    this.npcBagTexture?.dispose();
    this.npcBagTexture = null;
    this.promptTexture?.dispose();
    this.promptTexture = null;
  }
}
