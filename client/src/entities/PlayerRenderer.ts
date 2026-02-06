// ─── Player Renderer ───
// Billboard sprite renderer for stickman characters.
// Uses Three.js SpriteMaterial with sprite sheet UV offsets for animation.

import * as THREE from 'three';
import type { AnimationName, SpriteSheetConfig } from '../assets/SpriteGenerator';
import { PLAYER_HEIGHT } from '@shared/constants/game';

// ─── Types ───

export interface PlayerAnimationState {
  animation: AnimationName;
  frame: number;
  elapsed: number;
  speed: number; // frames per second
  loop: boolean;
  finished: boolean;
}

// ─── Player Renderer ───

export class PlayerRenderer {
  private sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private config: SpriteSheetConfig;
  private texture: THREE.Texture;

  // Animation state
  private state: PlayerAnimationState = {
    animation: 'idle',
    frame: 0,
    elapsed: 0,
    speed: 6,
    loop: true,
    finished: false,
  };

  // UV dimensions per frame
  private frameU: number;
  private frameV: number;
  private maxFramesPerRow: number;

  constructor(spriteSheetCanvas: HTMLCanvasElement, config: SpriteSheetConfig) {
    this.config = config;

    // Create texture from canvas
    this.texture = new THREE.CanvasTexture(spriteSheetCanvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    // Calculate max frames per row
    this.maxFramesPerRow = spriteSheetCanvas.width / config.frameWidth;
    const totalRows = spriteSheetCanvas.height / config.frameHeight;

    // UV size per frame
    this.frameU = 1 / this.maxFramesPerRow;
    this.frameV = 1 / totalRows;

    // Create sprite material
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      sizeAttenuation: true,
    });

    // Create sprite
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(PLAYER_HEIGHT * 0.8, PLAYER_HEIGHT, 1);

    // Set initial UV
    this.updateUV();
  }

  // ─── Animation Control ───

  play(animation: AnimationName, speed = 8, loop = true): void {
    if (this.state.animation === animation && !this.state.finished) return;

    const animConfig = this.config.animations[animation];
    this.state = {
      animation,
      frame: 0,
      elapsed: 0,
      speed: speed * (animConfig.frameCount / 8), // normalize speed
      loop,
      finished: false,
    };
    this.updateUV();
  }

  playOnce(animation: AnimationName, speed = 8): void {
    this.play(animation, speed, false);
  }

  getCurrentAnimation(): AnimationName {
    return this.state.animation;
  }

  isFinished(): boolean {
    return this.state.finished;
  }

  // ─── Update ───

  update(dt: number): void {
    if (this.state.finished) return;

    const animConfig = this.config.animations[this.state.animation];
    this.state.elapsed += dt;

    const frameDuration = 1 / this.state.speed;
    if (this.state.elapsed >= frameDuration) {
      this.state.elapsed -= frameDuration;
      this.state.frame++;

      if (this.state.frame >= animConfig.frameCount) {
        if (this.state.loop) {
          this.state.frame = 0;
        } else {
          this.state.frame = animConfig.frameCount - 1;
          this.state.finished = true;
        }
      }

      this.updateUV();
    }
  }

  // ─── UV Update ───

  private updateUV(): void {
    const animConfig = this.config.animations[this.state.animation];
    const col = this.state.frame;
    const row = animConfig.row;

    // Three.js texture UV offset (bottom-left origin)
    // Sprite sheet has row 0 at top, so we need to flip Y
    const offsetX = col * this.frameU;
    const offsetY = 1 - (row + 1) * this.frameV; // flip Y

    this.texture.offset.set(offsetX, offsetY);
    this.texture.repeat.set(this.frameU, this.frameV);
  }

  // ─── Position ───

  setPosition(x: number, y: number, z: number): void {
    this.sprite.position.set(x, y + PLAYER_HEIGHT / 2, z);
  }

  getPosition(): THREE.Vector3 {
    return this.sprite.position.clone();
  }

  // ─── Scene Management ───

  addToScene(scene: THREE.Scene): void {
    scene.add(this.sprite);
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.sprite);
  }

  getSprite(): THREE.Sprite {
    return this.sprite;
  }

  // ─── Cleanup ───

  dispose(): void {
    this.material.dispose();
    this.texture.dispose();
  }
}