// ─── Game Loop ───
// Fixed-timestep server tick loop running at TICK_RATE ticks/second.
// Manages system ordering, input queue processing, tick monitoring, and world saving.

import {
  ComponentType,
  PLAYER_CROUCH_SPEED,
  PLAYER_JUMP_VELOCITY,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  TICK_RATE,
  type InputPayload,
  type PositionComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { GameWorld } from './World.js';

// ─── Import Systems ───
import { aiSystem } from './systems/AISystem.js';
import { buildingPlacementSystem } from './systems/BuildingPlacementSystem.js';
import { combatSystem } from './systems/CombatSystem.js';
import { craftingSystem } from './systems/CraftingSystem.js';
import { dayNightSystem } from './systems/DayNightSystem.js';
import { deathSystem } from './systems/DeathSystem.js';
import { decaySystem } from './systems/DecaySystem.js';
import { hungerSystem } from './systems/HungerSystem.js';
import { itemPickupSystem } from './systems/ItemPickupSystem.js';
import { lootDespawnSystem } from './systems/LootDespawnSystem.js';
import { lootSpawnSystem } from './systems/LootSpawnSystem.js';
import { movementSystem } from './systems/MovementSystem.js';
import { npcSpawnSystem } from './systems/NPCSpawnSystem.js';
import { physicsSystem } from './systems/PhysicsSystem.js';
import { projectileSystem } from './systems/ProjectileSystem.js';
import { resourceRespawnSystem } from './systems/ResourceRespawnSystem.js';
import { temperatureSystem } from './systems/TemperatureSystem.js';
import { thirstSystem } from './systems/ThirstSystem.js';
import { toolCupboardSystem } from './systems/ToolCupboardSystem.js';
import { worldEventSystem } from './systems/WorldEventSystem.js';
import { journalSystem } from './systems/JournalSystem.js';

// ─── Input Queue ───

export interface QueuedInput {
  playerId: string;
  input: InputPayload;
  receivedAt: number;
}

// ─── Game Loop Class ───

export class GameLoop {
  readonly world: GameWorld;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickCount = 0;
  private lastTickTime = 0;

  /** Queued player inputs to process next tick */
  private inputQueue: QueuedInput[] = [];

  /** Callbacks invoked after each tick (for broadcasting state) */
  private postTickCallbacks: Array<(world: GameWorld, tick: number) => void> = [];

  /** Callback for saving world state */
  private saveCallback: (() => Promise<void>) | null = null;

  /** Performance monitoring */
  private tickDurations: number[] = [];
  private readonly PERF_WINDOW = 100; // track last 100 ticks

  constructor() {
    this.world = new GameWorld();
  }

  // ─── Initialization ───

  initialize(): void {
    this.world.initialize(config.WORLD_SEED);

    // Register systems in execution order

    // 1. Day/night cycle (time progression)
    this.world.addSystem(dayNightSystem);

    // 1b. World events (blood moon, fog, supply drops)
    this.world.addSystem(worldEventSystem);

    // 2. AI (NPC state machine: wander, chase, attack, flee)
    this.world.addSystem(aiSystem);

    // 3. Combat (melee attacks, damage resolution)
    this.world.addSystem(combatSystem);

    // 4. Projectiles (arrow/bullet flight, collision)
    this.world.addSystem(projectileSystem);

    // 5. Physics (gravity, ground detection, water)
    this.world.addSystem(physicsSystem);

    // 6. Movement (collision resolution)
    this.world.addSystem(movementSystem);

    // 7. Survival systems
    this.world.addSystem(hungerSystem);
    this.world.addSystem(thirstSystem);
    this.world.addSystem(temperatureSystem);

    // 8. Crafting (process craft queues)
    this.world.addSystem(craftingSystem);

    // 9. Death detection (loot bag creation, death notifications)
    this.world.addSystem(deathSystem);

    // 10. Item auto-pickup (proximity collection)
    this.world.addSystem(itemPickupSystem);

    // 10. Building systems
    this.world.addSystem(buildingPlacementSystem);
    this.world.addSystem(toolCupboardSystem);
    this.world.addSystem(decaySystem);

    // 11. World maintenance
    this.world.addSystem(resourceRespawnSystem);
    this.world.addSystem(lootSpawnSystem);
    this.world.addSystem(lootDespawnSystem);

    // 12. NPC spawning (proximity-based creature population)
    this.world.addSystem(npcSpawnSystem);

    // 13. Journal system (event-driven journal fragment tracking)
    this.world.addSystem(journalSystem);

    logger.info({ systemCount: 20 }, 'GameLoop initialized with all systems');
  }

  // ─── Input Queue ───

  queueInput(playerId: string, input: InputPayload): void {
    this.inputQueue.push({
      playerId,
      input,
      receivedAt: Date.now(),
    });
  }

  // ─── Post-Tick Hooks ───

  onPostTick(callback: (world: GameWorld, tick: number) => void): void {
    this.postTickCallbacks.push(callback);
  }

  onSave(callback: () => Promise<void>): void {
    this.saveCallback = callback;
  }

  // ─── Start / Stop ───

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTickTime = performance.now();

    const tickIntervalMs = 1000 / TICK_RATE;

    this.tickInterval = setInterval(() => {
      this.tick();
    }, tickIntervalMs);

    // Periodic world save
    this.saveInterval = setInterval(() => {
      this.save();
    }, config.SAVE_INTERVAL_MS);

    logger.info(
      { tickRate: TICK_RATE, tickIntervalMs, saveIntervalMs: config.SAVE_INTERVAL_MS },
      'GameLoop started',
    );
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    logger.info({ totalTicks: this.tickCount }, 'GameLoop stopped');
  }

  // ─── Core Tick ───

  private tick(): void {
    const tickStart = performance.now();
    const dt = 1 / TICK_RATE; // fixed timestep

    // ── Process queued inputs ──
    this.processInputs();

    // ── Run all systems via world.update ──
    this.world.update(dt);

    // ── Increment tick counter ──
    this.tickCount++;

    // ── Run post-tick callbacks (broadcasting, etc.) ──
    for (const cb of this.postTickCallbacks) {
      cb(this.world, this.tickCount);
    }

    // ── Performance tracking ──
    const tickDuration = performance.now() - tickStart;
    this.tickDurations.push(tickDuration);
    if (this.tickDurations.length > this.PERF_WINDOW) {
      this.tickDurations.shift();
    }

    // Warn if tick took too long (>80% of budget)
    const budget = 1000 / TICK_RATE;
    if (tickDuration > budget * 0.8) {
      logger.warn(
        { tickDuration: tickDuration.toFixed(2), budget: budget.toFixed(2), tick: this.tickCount },
        'Tick exceeded 80% of time budget',
      );
    }
  }

  // ─── Process Queued Inputs ───

  private processInputs(): void {
    const inputs = this.inputQueue;
    this.inputQueue = [];

    for (const queued of inputs) {
      const entityId = this.world.getPlayerEntity(queued.playerId);
      if (entityId === undefined) continue;

      const vel = this.world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity);
      const pos = this.world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);

      if (!vel || !pos) continue;

      const input = queued.input;

      // Apply rotation
      pos.rotation = input.rotation;

      // Calculate movement direction relative to player rotation
      const sin = Math.sin(input.rotation);
      const cos = Math.cos(input.rotation);

      const moveX = input.right;
      const moveZ = input.forward;

      // Base speed
      let speed = PLAYER_WALK_SPEED;
      if (input.sprint) speed = PLAYER_SPRINT_SPEED;
      if (input.crouch) speed = PLAYER_CROUCH_SPEED;

      // Transform input direction by rotation
      vel.vx = (moveX * cos - moveZ * sin) * speed;
      vel.vz = (moveX * sin + moveZ * cos) * speed;

      // Jump
      if (input.jump && vel.vy === 0) {
        vel.vy = PLAYER_JUMP_VELOCITY;
      }
    }
  }

  // ─── World Save ───

  private async save(): Promise<void> {
    if (!this.saveCallback) return;

    try {
      await this.saveCallback();
      logger.debug({ tick: this.tickCount }, 'World state saved');
    } catch (err) {
      logger.error({ err }, 'Failed to save world state');
    }
  }

  // ─── Getters ───

  get currentTick(): number {
    return this.tickCount;
  }

  get isRunning(): boolean {
    return this.running;
  }

  getPerformanceStats(): {
    avgTickMs: number;
    maxTickMs: number;
    tickCount: number;
  } {
    if (this.tickDurations.length === 0) {
      return { avgTickMs: 0, maxTickMs: 0, tickCount: this.tickCount };
    }

    const sum = this.tickDurations.reduce((a, b) => a + b, 0);
    const avg = sum / this.tickDurations.length;
    const max = Math.max(...this.tickDurations);

    return {
      avgTickMs: Math.round(avg * 100) / 100,
      maxTickMs: Math.round(max * 100) / 100,
      tickCount: this.tickCount,
    };
  }
}

// ─── Singleton ───

export const gameLoop = new GameLoop();
