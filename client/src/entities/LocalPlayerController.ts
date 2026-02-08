// ─── Local Player Controller ───
// WASD+mouse first-person controller with collision detection against voxel terrain.
// Uses pointer lock for mouse look and reads input from InputManager singleton.

import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  GRAVITY,
  PLAYER_CROUCH_SPEED,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_JUMP_VELOCITY,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  PLAYER_WIDTH,
  SEA_LEVEL,
  TERMINAL_VELOCITY,
} from '@shared/constants/game';
import { BlockType } from '@shared/types/blocks';
import { useSettingsStore } from '../stores/useSettingsStore';
import * as THREE from 'three';
import type { AnimationName } from '../assets/SpriteGenerator';
import { CameraController } from '../engine/Camera';
import { InputManager } from '../engine/InputManager';
import type { ParticleSystem } from '../engine/ParticleSystem';
import { usePlayerStore } from '../stores/usePlayerStore';
import { ChunkManager } from '../world/ChunkManager';
import { PlayerRenderer } from './PlayerRenderer';

// ─── Constants ───

const MOUSE_SENSITIVITY = 0.15; // degrees per pixel
const ARROW_KEY_SENSITIVITY = 0.5; // degrees per frame
const HALF_WIDTH = PLAYER_WIDTH / 2;
const COLLISION_EPSILON = 0.001;
const FOOTSTEP_INTERVAL_WALK = 0.45; // seconds between footstep dust when walking
const FOOTSTEP_INTERVAL_RUN = 0.3; // seconds between footstep dust when sprinting

// ─── Helper: Get block at world position ───

function getBlock(chunkManager: ChunkManager, wx: number, wy: number, wz: number): BlockType {
  if (wy < 0 || wy >= CHUNK_SIZE_Y) return BlockType.Air;

  const cx = Math.floor(wx / CHUNK_SIZE_X);
  const cz = Math.floor(wz / CHUNK_SIZE_Z);
  const data = chunkManager.getChunkData(cx, cz);
  if (!data) return BlockType.Air;

  const lx = ((Math.floor(wx) % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
  const lz = ((Math.floor(wz) % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
  const ly = Math.floor(wy);

  if (
    lx < 0 ||
    lx >= CHUNK_SIZE_X ||
    ly < 0 ||
    ly >= CHUNK_SIZE_Y ||
    lz < 0 ||
    lz >= CHUNK_SIZE_Z
  ) {
    return BlockType.Air;
  }

  const idx = lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
  return (data[idx] ?? BlockType.Air) as BlockType;
}

function isSolidBlock(blockType: BlockType): boolean {
  return blockType !== BlockType.Air && blockType !== BlockType.Water;
}

// ─── Local Player Controller ───

export class LocalPlayerController {
  // Position & physics
  private position = new THREE.Vector3(0, SEA_LEVEL + 5, 0);
  private velocity = new THREE.Vector3(0, 0, 0);
  private yaw = 0; // radians, horizontal rotation
  private pitch = 0; // radians, vertical look

  // State
  private isGrounded = false;
  private isSprinting = false;
  private isCrouching = false;
  private isInWater = false;

  // Dependencies
  private input: InputManager;
  private cameraController: CameraController;
  private playerRenderer: PlayerRenderer;
  private chunkManager: ChunkManager;
  private camera: THREE.PerspectiveCamera;
  private particleSystem: ParticleSystem | null = null;

  // Reusable vectors
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly moveDir = new THREE.Vector3();

  // Debug: throttle movement logging to avoid spam
  private lastMovementLog = 0;

  // Footstep dust timer
  private footstepTimer = 0;

  // Store sync: only push to React when position changes meaningfully
  private lastSyncX = NaN;
  private lastSyncY = NaN;
  private lastSyncZ = NaN;

  constructor(
    input: InputManager,
    cameraController: CameraController,
    playerRenderer: PlayerRenderer,
    chunkManager: ChunkManager,
    camera: THREE.PerspectiveCamera,
  ) {
    this.input = input;
    this.cameraController = cameraController;
    this.playerRenderer = playerRenderer;
    this.chunkManager = chunkManager;
    this.camera = camera;
  }

  // ─── Initialization ───

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  getYaw(): number {
    return this.yaw;
  }

  setParticleSystem(ps: ParticleSystem): void {
    this.particleSystem = ps;
  }

  // ─── Update (call each fixed timestep) ───

  update(dt: number): void {
    this.handleMouseLook();
    this.handleCameraInput();
    this.handleMovement(dt);
    this.handleCollision(dt);
    this.updateFootstepDust(dt);
    this.updateAnimation();
    this.updateCamera();
    this.syncStore();
  }

  // ─── Mouse Look (orbits camera) ───

  private handleMouseLook(): void {
    if (!this.input.isPointerLocked()) return;

    const delta = this.input.getMouseDelta();
    const invertY = useSettingsStore.getState().invertY;
    const yMultiplier = invertY ? -1 : 1;
    // Orbit camera with mouse when pointer is locked
    this.cameraController.rotateAzimuth(-delta.x * MOUSE_SENSITIVITY);
    this.cameraController.rotateElevation(delta.y * MOUSE_SENSITIVITY * yMultiplier);
  }

  // ─── Arrow Key Camera Control ───

  private handleCameraInput(): void {
    if (this.input.isKeyDown('ArrowLeft')) {
      this.cameraController.rotateAzimuth(ARROW_KEY_SENSITIVITY);
    }
    if (this.input.isKeyDown('ArrowRight')) {
      this.cameraController.rotateAzimuth(-ARROW_KEY_SENSITIVITY);
    }
    if (this.input.isKeyDown('ArrowUp')) {
      this.cameraController.rotateElevation(ARROW_KEY_SENSITIVITY);
    }
    if (this.input.isKeyDown('ArrowDown')) {
      this.cameraController.rotateElevation(-ARROW_KEY_SENSITIVITY);
    }
  }

  // ─── Movement Input ───

  private handleMovement(dt: number): void {
    const keybinds = this.input.keybinds;

    // Sprint/crouch state
    this.isSprinting = this.input.isKeyDown(keybinds.sprint) && !this.isCrouching;
    this.isCrouching = this.input.isKeyDown(keybinds.crouch);

    // Check water
    const feetBlock = getBlock(
      this.chunkManager,
      this.position.x,
      this.position.y,
      this.position.z,
    );
    this.isInWater = feetBlock === BlockType.Water;

    // Determine move speed
    let speed = PLAYER_WALK_SPEED;
    if (this.isSprinting) speed = PLAYER_SPRINT_SPEED;
    if (this.isCrouching) speed = PLAYER_CROUCH_SPEED;
    if (this.isInWater) speed = Math.min(speed, PLAYER_WALK_SPEED * 0.75);

    // Calculate forward/right based on CAMERA azimuth (camera-relative movement)
    const camAzimuthRad = (this.cameraController.getAzimuth() * Math.PI) / 180;
    // Camera forward direction (from camera toward target) projected on XZ
    this.forward.set(-Math.sin(camAzimuthRad), 0, -Math.cos(camAzimuthRad));
    this.right.set(Math.cos(camAzimuthRad), 0, -Math.sin(camAzimuthRad));

    // Movement input
    this.moveDir.set(0, 0, 0);
    if (this.input.isKeyDown(keybinds.moveForward)) this.moveDir.add(this.forward);
    if (this.input.isKeyDown(keybinds.moveBackward)) this.moveDir.sub(this.forward);
    if (this.input.isKeyDown(keybinds.moveRight)) this.moveDir.add(this.right);
    if (this.input.isKeyDown(keybinds.moveLeft)) this.moveDir.sub(this.right);

    if (this.moveDir.lengthSq() > 0) {
      this.moveDir.normalize();
      // Update player yaw to face movement direction (for sprite orientation)
      this.yaw = Math.atan2(this.moveDir.x, this.moveDir.z);

      // Debug: Log movement (throttled to once per second)
      const now = Date.now();
      if (now - this.lastMovementLog > 1000) {
        console.log('Moving:', this.moveDir.x.toFixed(2), this.moveDir.z.toFixed(2));
        this.lastMovementLog = now;
      }
    }

    // Apply horizontal velocity
    this.velocity.x = this.moveDir.x * speed;
    this.velocity.z = this.moveDir.z * speed;

    // Jump
    if (this.input.isKeyPressed(keybinds.jump) && this.isGrounded) {
      this.velocity.y = PLAYER_JUMP_VELOCITY;
      this.isGrounded = false;
    }

    // Gravity
    if (!this.isGrounded) {
      this.velocity.y += GRAVITY * dt;
      if (this.velocity.y < TERMINAL_VELOCITY) {
        this.velocity.y = TERMINAL_VELOCITY;
      }
    }

    // Water buoyancy
    if (this.isInWater) {
      this.velocity.y = Math.max(this.velocity.y, GRAVITY * 0.1);
      if (this.input.isKeyDown(keybinds.jump)) {
        this.velocity.y = PLAYER_JUMP_VELOCITY * 0.4;
      }
    }
  }

  // ─── Footstep Dust ───

  private updateFootstepDust(dt: number): void {
    if (!this.particleSystem) return;

    const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;

    if (!isMoving || !this.isGrounded || this.isInWater) {
      this.footstepTimer = 0;
      return;
    }

    const interval = this.isSprinting ? FOOTSTEP_INTERVAL_RUN : FOOTSTEP_INTERVAL_WALK;
    this.footstepTimer += dt;

    if (this.footstepTimer >= interval) {
      this.footstepTimer -= interval;
      this.particleSystem.emitFootstep(
        new THREE.Vector3(this.position.x, this.position.y, this.position.z),
      );
    }
  }

  // ─── Collision Detection & Response ───

  private handleCollision(dt: number): void {
    // ── Escape hatch: if player starts the frame stuck inside geometry, push up ──
    if (this.checkCollision()) {
      for (let i = 0; i < 10; i++) {
        this.position.y += 1;
        if (!this.checkCollision()) {
          this.velocity.y = 0;
          this.isGrounded = true;
          break;
        }
      }
    }

    // Move and collide each axis independently
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    const dz = this.velocity.z * dt;

    // X axis
    this.position.x += dx;
    if (this.checkCollision()) {
      this.position.x -= dx;
      this.velocity.x = 0;
    }

    // Z axis
    this.position.z += dz;
    if (this.checkCollision()) {
      this.position.z -= dz;
      this.velocity.z = 0;
    }

    // Y axis — substep to prevent tunneling through thin floors at high speed
    const MAX_STEP = 0.5;
    let yRemaining = dy;
    let yCollided = false;

    while (Math.abs(yRemaining) > COLLISION_EPSILON) {
      const stepY = Math.abs(yRemaining) > MAX_STEP ? Math.sign(yRemaining) * MAX_STEP : yRemaining;

      this.position.y += stepY;
      if (this.checkCollision()) {
        this.position.y -= stepY;
        if (this.velocity.y < 0) {
          this.isGrounded = true;
        }
        this.velocity.y = 0;
        yCollided = true;
        break;
      }
      yRemaining -= stepY;
    }

    if (!yCollided) {
      // Check if still grounded (one block below feet)
      const belowBlock = getBlock(
        this.chunkManager,
        this.position.x,
        this.position.y - COLLISION_EPSILON,
        this.position.z,
      );
      this.isGrounded = isSolidBlock(belowBlock);
    }

    // Prevent falling below world
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
  }

  private checkCollision(): boolean {
    // Check AABB collision against surrounding blocks
    const minX = this.position.x - HALF_WIDTH;
    const maxX = this.position.x + HALF_WIDTH;
    const minY = this.position.y;
    const maxY = this.position.y + PLAYER_HEIGHT;
    const minZ = this.position.z - HALF_WIDTH;
    const maxZ = this.position.z + HALF_WIDTH;

    for (let bx = Math.floor(minX); bx <= Math.floor(maxX); bx++) {
      for (let by = Math.floor(minY); by <= Math.floor(maxY); by++) {
        for (let bz = Math.floor(minZ); bz <= Math.floor(maxZ); bz++) {
          const block = getBlock(this.chunkManager, bx, by, bz);
          if (isSolidBlock(block)) {
            // AABB overlap check
            if (
              maxX > bx &&
              minX < bx + 1 &&
              maxY > by &&
              minY < by + 1 &&
              maxZ > bz &&
              minZ < bz + 1
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  // ─── Animation ───

  private updateAnimation(): void {
    const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
    let anim: AnimationName = 'idle';

    if (!this.isGrounded && this.velocity.y > 0) {
      anim = 'jump';
    } else if (!this.isGrounded && this.velocity.y < -2) {
      anim = 'fall';
    } else if (this.isCrouching) {
      anim = 'crouch';
    } else if (isMoving && this.isSprinting) {
      anim = 'run';
    } else if (isMoving) {
      anim = 'walk';
    }

    const animSpeed = this.isSprinting ? 12 : 8;
    this.playerRenderer.play(anim, animSpeed);
    this.playerRenderer.setPosition(this.position.x, this.position.y, this.position.z);
  }

  // ─── Camera ───

  private updateCamera(): void {
    // Set camera to look at player at eye height
    // Camera azimuth is independently controlled via mouse/arrow keys
    this.cameraController.setTarget(
      this.position.x,
      this.position.y + PLAYER_EYE_HEIGHT,
      this.position.z,
    );
  }

  // ─── Store Sync ───

  private static readonly SYNC_THRESHOLD_SQ = 0.001 * 0.001; // ~1mm movement threshold

  private syncStore(): void {
    const dx = this.position.x - this.lastSyncX;
    const dy = this.position.y - this.lastSyncY;
    const dz = this.position.z - this.lastSyncZ;

    // Skip if position hasn't changed meaningfully (avoids unnecessary React re-renders)
    if (dx * dx + dy * dy + dz * dz < LocalPlayerController.SYNC_THRESHOLD_SQ) return;

    this.lastSyncX = this.position.x;
    this.lastSyncY = this.position.y;
    this.lastSyncZ = this.position.z;

    usePlayerStore.getState().setPosition(this.position.x, this.position.y, this.position.z);
  }
}
