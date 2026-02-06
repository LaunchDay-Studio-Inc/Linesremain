// ─── State Broadcaster ───
// Delta computation, per-client relevance filtering, and changelog management.
// Broadcasts entity state changes to connected players each tick.

import type { GameWorld } from '../game/World.js';
import type { SocketServer } from './SocketServer.js';
import { gameLoop } from '../game/GameLoop.js';
import {
  ComponentType,
  ServerMessage,
  SNAPSHOT_SEND_RATE,
  TICK_RATE,
  VIEW_DISTANCE_CHUNKS,
  CHUNK_SIZE_X,
  type PositionComponent,
  type HealthComponent,
  type HungerComponent,
  type ThirstComponent,
  type TemperatureComponent,
  type EntitySnapshot,
  type DeltaPayload,
  type PlayerStatsPayload,
  type WorldTimePayload,
} from '@lineremain/shared';

// ─── Types ───

interface EntityState {
  components: Record<string, unknown>;
}

// ─── Constants ───

/** How often to send deltas (every N ticks). At 20 TPS and 10 snapshots/sec = every 2 ticks */
const DELTA_INTERVAL = Math.max(1, Math.floor(TICK_RATE / SNAPSHOT_SEND_RATE));

/** How often to send player stats (every 10 ticks = 0.5 sec) */
const STATS_INTERVAL = 10;

/** How often to broadcast world time (every 100 ticks = 5 sec) */
const TIME_BROADCAST_INTERVAL = 100;

/** Components to track for delta changes */
const TRACKED_COMPONENTS = [
  ComponentType.Position,
  ComponentType.Velocity,
  ComponentType.Health,
  ComponentType.Hunger,
  ComponentType.Thirst,
  ComponentType.Temperature,
  ComponentType.Building,
  ComponentType.NPCType,
  ComponentType.AI,
];

// ─── State Broadcaster ───

export class StateBroadcaster {
  private socketServer: SocketServer;

  /** Previous tick's entity state for delta computation */
  private previousState = new Map<number, EntityState>();

  /** Set of entity IDs that existed last tick */
  private previousEntityIds = new Set<number>();

  private dayNumber = 0;

  constructor(socketServer: SocketServer) {
    this.socketServer = socketServer;
  }

  // ─── Initialize ───

  initialize(): void {
    // Register as post-tick callback
    gameLoop.onPostTick((world, tick) => {
      this.onTick(world, tick);
    });
  }

  // ─── Per-Tick Handler ───

  private onTick(world: GameWorld, tick: number): void {
    // Delta broadcast at configured interval
    if (tick % DELTA_INTERVAL === 0) {
      this.broadcastDeltas(world, tick);
    }

    // Player stats at configured interval
    if (tick % STATS_INTERVAL === 0) {
      this.broadcastPlayerStats(world);
    }

    // World time broadcast
    if (tick % TIME_BROADCAST_INTERVAL === 0) {
      this.broadcastWorldTime(world);
    }
  }

  // ─── Delta Broadcast ───

  private broadcastDeltas(world: GameWorld, tick: number): void {
    const currentEntityIds = new Set<number>();
    const currentState = new Map<number, EntityState>();

    // Build current state snapshot
    const allEntities = world.ecs.getAllEntities();
    for (const entityId of allEntities) {
      // Only track entities with a position
      const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
      if (!pos) continue;

      currentEntityIds.add(entityId);

      const components: Record<string, unknown> = {};
      for (const ct of TRACKED_COMPONENTS) {
        const comp = world.ecs.getComponent(entityId, ct);
        if (comp !== undefined) {
          components[ct] = comp;
        }
      }

      currentState.set(entityId, { components });
    }

    // Compute created, updated, removed
    const created: EntitySnapshot[] = [];
    const updated: EntitySnapshot[] = [];
    const removed: number[] = [];

    // New entities (in current but not in previous)
    for (const entityId of currentEntityIds) {
      if (!this.previousEntityIds.has(entityId)) {
        const state = currentState.get(entityId)!;
        created.push({ entityId, components: state.components });
      }
    }

    // Removed entities (in previous but not in current)
    for (const entityId of this.previousEntityIds) {
      if (!currentEntityIds.has(entityId)) {
        removed.push(entityId);
      }
    }

    // Updated entities (in both, check for changes)
    for (const entityId of currentEntityIds) {
      if (!this.previousEntityIds.has(entityId)) continue; // already in created

      const prev = this.previousState.get(entityId);
      const curr = currentState.get(entityId)!;

      if (this.hasChanged(prev, curr)) {
        updated.push({ entityId, components: curr.components });
      }
    }

    // Save current state for next tick comparison
    this.previousState = currentState;
    this.previousEntityIds = currentEntityIds;

    // Only broadcast if there are changes
    if (created.length === 0 && updated.length === 0 && removed.length === 0) return;

    // Send per-client with relevance filtering
    const connectedPlayers = this.socketServer.getConnectedPlayers();
    for (const [, player] of connectedPlayers) {
      const playerPos = world.ecs.getComponent<PositionComponent>(
        player.entityId,
        ComponentType.Position,
      );
      if (!playerPos) continue;

      const viewDistBlocks = VIEW_DISTANCE_CHUNKS * CHUNK_SIZE_X;
      const viewDistSq = viewDistBlocks * viewDistBlocks;

      // Filter entities by relevance (distance from player)
      const relevantCreated = created.filter((e) => this.isRelevant(e, playerPos, viewDistSq, world));
      const relevantUpdated = updated.filter((e) => this.isRelevant(e, playerPos, viewDistSq, world));
      // Always send all removals — client needs to know about despawned entities
      const relevantRemoved = removed;

      if (relevantCreated.length === 0 && relevantUpdated.length === 0 && relevantRemoved.length === 0) {
        continue;
      }

      const delta: DeltaPayload = {
        tick,
        created: relevantCreated,
        updated: relevantUpdated,
        removed: relevantRemoved,
      };

      player.socket.emit(ServerMessage.Delta, delta);
    }
  }

  // ─── Relevance Check ───

  private isRelevant(
    snapshot: EntitySnapshot,
    playerPos: PositionComponent,
    viewDistSq: number,
    _world: GameWorld,
  ): boolean {
    const pos = snapshot.components[ComponentType.Position] as PositionComponent | undefined;
    if (!pos) return true; // No position means always relevant (shouldn't happen)

    const dx = pos.x - playerPos.x;
    const dz = pos.z - playerPos.z;
    return dx * dx + dz * dz <= viewDistSq;
  }

  // ─── Change Detection ───

  private hasChanged(prev: EntityState | undefined, curr: EntityState): boolean {
    if (!prev) return true;

    // Compare position (most frequent change)
    const prevPos = prev.components[ComponentType.Position] as PositionComponent | undefined;
    const currPos = curr.components[ComponentType.Position] as PositionComponent | undefined;

    if (prevPos && currPos) {
      if (
        Math.abs(prevPos.x - currPos.x) > 0.01 ||
        Math.abs(prevPos.y - currPos.y) > 0.01 ||
        Math.abs(prevPos.z - currPos.z) > 0.01 ||
        Math.abs(prevPos.rotation - currPos.rotation) > 0.01
      ) {
        return true;
      }
    }

    // Compare health
    const prevHealth = prev.components[ComponentType.Health] as { current: number } | undefined;
    const currHealth = curr.components[ComponentType.Health] as { current: number } | undefined;
    if (prevHealth?.current !== currHealth?.current) return true;

    // Compare AI state (for NPCs)
    const prevAI = prev.components[ComponentType.AI] as { state: string } | undefined;
    const currAI = curr.components[ComponentType.AI] as { state: string } | undefined;
    if (prevAI?.state !== currAI?.state) return true;

    return false;
  }

  // ─── Player Stats Broadcast ───

  private broadcastPlayerStats(world: GameWorld): void {
    const connectedPlayers = this.socketServer.getConnectedPlayers();

    for (const [, player] of connectedPlayers) {
      const health = world.ecs.getComponent<HealthComponent>(player.entityId, ComponentType.Health);
      const hunger = world.ecs.getComponent<HungerComponent>(player.entityId, ComponentType.Hunger);
      const thirst = world.ecs.getComponent<ThirstComponent>(player.entityId, ComponentType.Thirst);
      const temp = world.ecs.getComponent<TemperatureComponent>(player.entityId, ComponentType.Temperature);

      if (!health) continue;

      const stats: PlayerStatsPayload = {
        health: health.current,
        maxHealth: health.max,
        hunger: hunger?.current ?? 0,
        maxHunger: hunger?.max ?? 100,
        thirst: thirst?.current ?? 0,
        maxThirst: thirst?.max ?? 100,
        temperature: temp?.current ?? 37,
      };

      player.socket.emit(ServerMessage.PlayerStats, stats);
    }
  }

  // ─── World Time Broadcast ───

  private broadcastWorldTime(world: GameWorld): void {
    // Track day transitions
    if (world.worldTime < 0.1 && this.dayNumber === 0) {
      this.dayNumber = 1;
    } else if (world.worldTime < 0.05) {
      this.dayNumber++;
    }

    const payload: WorldTimePayload = {
      timeOfDay: world.worldTime,
      dayNumber: this.dayNumber,
      dayLengthSeconds: 3600,
    };

    this.socketServer.broadcast(ServerMessage.WorldTime, payload);
  }
}