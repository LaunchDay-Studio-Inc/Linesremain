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
  type ColliderComponent,
  type InputPayload,
  type PositionComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { GameWorld } from './World.js';

// ─── Import Systems ───
import { aiSystem } from './systems/AISystem.js';
import { achievementSystem } from './systems/AchievementSystem.js';
import { blueprintSystem } from './systems/BlueprintSystem.js';
import { buildingPlacementSystem } from './systems/BuildingPlacementSystem.js';
import { combatSystem } from './systems/CombatSystem.js';
import { containerSystem } from './systems/ContainerSystem.js';
import { craftingSystem } from './systems/CraftingSystem.js';
import { dayNightSystem, resetDayNightCounter } from './systems/DayNightSystem.js';
import { deathSystem } from './systems/DeathSystem.js';
import { decaySystem } from './systems/DecaySystem.js';
import { defenseSystem } from './systems/DefenseSystem.js';
import { doorSystem } from './systems/DoorSystem.js';
import { hungerSystem } from './systems/HungerSystem.js';
import { itemPickupSystem } from './systems/ItemPickupSystem.js';
import { journalSystem } from './systems/JournalSystem.js';
import { lootDespawnSystem } from './systems/LootDespawnSystem.js';
import { lootSpawnSystem } from './systems/LootSpawnSystem.js';
import { movementSystem } from './systems/MovementSystem.js';
import { npcSpawnSystem } from './systems/NPCSpawnSystem.js';
import { getBlockAt, isSolidBlock, physicsSystem } from './systems/PhysicsSystem.js';
import { projectileSystem } from './systems/ProjectileSystem.js';
import { raidingSystem } from './systems/RaidingSystem.js';
import { resourceRespawnSystem } from './systems/ResourceRespawnSystem.js';
import { temperatureSystem } from './systems/TemperatureSystem.js';
import { thirstSystem } from './systems/ThirstSystem.js';
import { toolCupboardSystem } from './systems/ToolCupboardSystem.js';
import { wipeSystem } from './systems/WipeSystem.js';
import { teleportSystem } from './systems/TeleportSystem.js';
import { worldEventSystem } from './systems/WorldEventSystem.js';
import { islandNPCSpawnSystem } from './systems/IslandNPCSpawnSystem.js';
import { islandSurvivalSystem } from './systems/IslandSurvivalSystem.js';

// ─── Input Queue ───

export interface QueuedInput {
  playerId: string;
  input: InputPayload;
}

// ─── Game Loop Class ───

export class GameLoop {
  readonly world: GameWorld;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickCount = 0;

  /** Queued player inputs to process next tick */
  private inputQueue: QueuedInput[] = [];

  /** Callbacks invoked after each tick (for broadcasting state) */
  private postTickCallbacks: Array<(world: GameWorld, tick: number) => void> = [];

  /** Callback for saving world state */
  private saveCallback: (() => Promise<void>) | null = null;

  /** Performance monitoring — ring buffer to avoid shift() O(n) */
  private readonly PERF_WINDOW = 100;
  private tickDurations = new Float64Array(100);
  private tickDurIdx = 0;
  private tickDurCount = 0;

  constructor() {
    this.world = new GameWorld();
  }

  // ─── Initialization ───

  initialize(): void {
    this.world.initialize(config.WORLD_SEED);
    resetDayNightCounter();

    // Register systems in execution order

    // 1. Day/night cycle (time progression)
    this.world.addSystem(dayNightSystem);

    // 2. World events (blood moon, fog, supply drops)
    this.world.addSystem(worldEventSystem);

    // 3. AI (NPC state machine: wander, chase, attack, flee)
    this.world.addSystem(aiSystem);

    // 4. Combat (melee attacks, damage resolution)
    this.world.addSystem(combatSystem);

    // 5. Projectiles (arrow/bullet flight, collision)
    this.world.addSystem(projectileSystem);

    // 6. Physics (gravity, ground detection, water)
    this.world.addSystem(physicsSystem);

    // 7. Movement (collision resolution)
    this.world.addSystem(movementSystem);

    // 7b. Teleport (portal detection after position resolves)
    this.world.addSystem(teleportSystem);

    // 8. Survival systems
    this.world.addSystem(hungerSystem);
    this.world.addSystem(thirstSystem);
    this.world.addSystem(temperatureSystem);

    // 9. Crafting (process craft queues)
    this.world.addSystem(craftingSystem);

    // 10. Death detection (loot bag creation, death notifications)
    this.world.addSystem(deathSystem);

    // 11. Item auto-pickup (proximity collection)
    this.world.addSystem(itemPickupSystem);

    // 12. Building systems
    this.world.addSystem(buildingPlacementSystem);
    this.world.addSystem(toolCupboardSystem);
    this.world.addSystem(decaySystem);

    // 13. World maintenance
    this.world.addSystem(resourceRespawnSystem);
    this.world.addSystem(lootSpawnSystem);
    this.world.addSystem(lootDespawnSystem);

    // 14. NPC spawning (proximity-based creature population)
    this.world.addSystem(npcSpawnSystem);

    // 14b. Island NPC spawning (Ember Isle hostiles)
    this.world.addSystem(islandNPCSpawnSystem);

    // 14c. Island survival mechanics (water drinking, campfire warmth)
    this.world.addSystem(islandSurvivalSystem);

    // 15. Journal system (event-driven journal fragment tracking)
    this.world.addSystem(journalSystem);

    // 16. Achievement system (periodic stats flush)
    this.world.addSystem(achievementSystem);

    // 17. Endgame systems
    this.world.addSystem(raidingSystem);
    this.world.addSystem(doorSystem);
    this.world.addSystem(containerSystem);
    this.world.addSystem(defenseSystem);
    this.world.addSystem(blueprintSystem);
    this.world.addSystem(wipeSystem);

    logger.info({ systemCount: 30 }, 'GameLoop initialized with all systems');
  }

  // ─── Input Queue ───

  queueInput(playerId: string, input: InputPayload): void {
    this.inputQueue.push({
      playerId,
      input,
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

    // ── Performance tracking (ring buffer) ──
    const tickDuration = performance.now() - tickStart;
    this.tickDurations[this.tickDurIdx] = tickDuration;
    this.tickDurIdx = (this.tickDurIdx + 1) % this.PERF_WINDOW;
    if (this.tickDurCount < this.PERF_WINDOW) this.tickDurCount++;

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
    // Dedup: keep only the latest input per player (Issue 104)
    const latestPerPlayer = new Map<string, InputPayload>();
    for (let i = 0; i < this.inputQueue.length; i++) {
      const queued = this.inputQueue[i]!;
      latestPerPlayer.set(queued.playerId, queued.input);
    }

    // Reuse array instead of allocating a new one (Issue 101)
    this.inputQueue.length = 0;

    for (const [playerId, input] of latestPerPlayer) {
      const entityId = this.world.getPlayerEntity(playerId);
      if (entityId === undefined) continue;

      const vel = this.world.ecs.getComponent<VelocityComponent>(entityId, ComponentType.Velocity);
      const pos = this.world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);

      if (!vel || !pos) continue;

      // Determine which world this player is in for block queries
      const worldType = this.world.playerWorldMap.get(playerId) ?? 'main';

      // Apply rotation
      pos.rotation = input.rotation;

      // Calculate movement direction relative to player rotation
      const sin = Math.sin(input.rotation);
      const cos = Math.cos(input.rotation);

      const moveX = input.right;
      const moveZ = input.forward;

      // Base speed — sprint takes priority; crouch overrides if not sprinting
      let speed = PLAYER_WALK_SPEED;
      if (input.sprint && !input.crouch) {
        speed = PLAYER_SPRINT_SPEED;
      } else if (input.crouch) {
        speed = PLAYER_CROUCH_SPEED;
      }

      // Transform input direction by rotation
      const desiredVx = (moveX * cos - moveZ * sin) * speed;
      const desiredVz = (moveX * sin + moveZ * cos) * speed;

      // Ground detection for jump gating (Issue 102)
      const collider = this.world.ecs.getComponent<ColliderComponent>(
        entityId,
        ComponentType.Collider,
      );
      const feetY = pos.y - 0.01;
      const halfW = collider ? collider.width / 2 : 0.3;
      const halfD = collider ? collider.depth / 2 : 0.3;
      // Check 4 corners + center for reliable ground detection
      const grounded =
        isSolidBlock(getBlockAt(this.world, pos.x, feetY, pos.z, worldType)) ||
        isSolidBlock(getBlockAt(this.world, pos.x - halfW, feetY, pos.z - halfD, worldType)) ||
        isSolidBlock(getBlockAt(this.world, pos.x + halfW, feetY, pos.z - halfD, worldType)) ||
        isSolidBlock(getBlockAt(this.world, pos.x - halfW, feetY, pos.z + halfD, worldType)) ||
        isSolidBlock(getBlockAt(this.world, pos.x + halfW, feetY, pos.z + halfD, worldType));

      if (grounded) {
        // On ground: apply full desired movement
        vel.vx = desiredVx;
        vel.vz = desiredVz;
      } else {
        // Airborne: cap horizontal speed to prevent bunny-hop accel (Issue 103)
        vel.vx = desiredVx;
        vel.vz = desiredVz;
        const airSpeed = Math.sqrt(vel.vx * vel.vx + vel.vz * vel.vz);
        if (airSpeed > PLAYER_SPRINT_SPEED) {
          const scale = PLAYER_SPRINT_SPEED / airSpeed;
          vel.vx *= scale;
          vel.vz *= scale;
        }
      }

      // Jump — only allow when grounded (Issue 102)
      if (input.jump && grounded) {
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
    if (this.tickDurCount === 0) {
      return { avgTickMs: 0, maxTickMs: 0, tickCount: this.tickCount };
    }

    let sum = 0;
    let max = 0;
    for (let i = 0; i < this.tickDurCount; i++) {
      const v = this.tickDurations[i]!;
      sum += v;
      if (v > max) max = v;
    }
    const avg = sum / this.tickDurCount;

    return {
      avgTickMs: Math.round(avg * 100) / 100,
      maxTickMs: Math.round(max * 100) / 100,
      tickCount: this.tickCount,
    };
  }
}

// ─── Singleton ───

export const gameLoop = new GameLoop();
