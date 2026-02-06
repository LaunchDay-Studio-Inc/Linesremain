// ─── Socket Server ───
// Full Socket.IO server setup: connection/disconnection handling, player entity
// lifecycle, grace period for reconnections, and combat-log protection.

import type { Server as SocketIOServer, Socket } from 'socket.io';
import { gameLoop } from '../game/GameLoop.js';
import { playerRepository } from '../database/repositories/PlayerRepository.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import {
  ClientMessage,
  ServerMessage,
  VIEW_DISTANCE_CHUNKS,
  CHUNK_SIZE_X,
  ComponentType,
  type InputPayload,
  type PositionComponent,
  type HealthComponent,
  type HungerComponent,
  type ThirstComponent,
  type InventoryComponent,
  type EquipmentComponent,
  type SnapshotPayload,
  type EntitySnapshot,
} from '@lineremain/shared';

// ─── Types ───

interface ConnectedPlayer {
  socket: Socket;
  playerId: string;
  username: string;
  entityId: number;
  connectedAt: number;
  lastInputSeq: number;
}

interface DisconnectedPlayer {
  playerId: string;
  username: string;
  entityId: number;
  disconnectedAt: number;
}

// ─── Constants ───

/** Grace period before removing disconnected player entity (seconds) */
const DISCONNECT_GRACE_PERIOD = 30;

// Combat log protection window (10 seconds) — used when checking recent damage on disconnect
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const COMBAT_LOG_WINDOW = 10_000;

// ─── Socket Server Manager ───

export class SocketServer {
  private io: SocketIOServer;
  private connectedPlayers = new Map<string, ConnectedPlayer>();
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private gracePeriodTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // ─── Initialize ───

  initialize(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Register post-tick broadcasting
    gameLoop.onPostTick((_world, _tick) => {
      // StateBroadcaster handles this via its own hook
    });

    logger.info('SocketServer initialized');
  }

  // ─── Connection Handler ───

  private async handleConnection(socket: Socket): Promise<void> {
    const playerId = socket.data['playerId'] as string;
    const username = socket.data['username'] as string;

    // Check max players
    if (this.connectedPlayers.size >= config.MAX_PLAYERS) {
      socket.emit(ServerMessage.Notification, {
        type: 'error',
        message: 'Server is full',
        duration: 5000,
      });
      socket.disconnect(true);
      return;
    }

    // Check if player is reconnecting within grace period
    const existing = this.disconnectedPlayers.get(playerId);
    let entityId: number;

    if (existing) {
      // Cancel grace period timer
      const timer = this.gracePeriodTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.gracePeriodTimers.delete(playerId);
      }
      this.disconnectedPlayers.delete(playerId);

      entityId = existing.entityId;
      logger.info({ playerId, username }, 'Player reconnected within grace period');
    } else {
      // Load saved state or create fresh entity
      entityId = await this.spawnPlayerEntity(playerId);
    }

    const player: ConnectedPlayer = {
      socket,
      playerId,
      username,
      entityId,
      connectedAt: Date.now(),
      lastInputSeq: 0,
    };

    this.connectedPlayers.set(playerId, player);

    // Send initial snapshot
    this.sendInitialSnapshot(player);

    // Register message handlers
    this.registerMessageHandlers(socket, player);

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(playerId, reason);
    });

    logger.info(
      { playerId, username, entityId, socketId: socket.id, totalPlayers: this.connectedPlayers.size },
      'Player connected to game',
    );
  }

  // ─── Spawn Player Entity ───

  private async spawnPlayerEntity(playerId: string): Promise<number> {
    // Try to load saved state
    const savedState = await playerRepository.loadPlayerState(playerId);

    let position = { x: 2048, y: 50, z: 2048 }; // default spawn
    let state: { health?: number; hunger?: number; thirst?: number } | undefined;

    if (savedState) {
      if (savedState.positionX != null && savedState.positionY != null && savedState.positionZ != null) {
        position = {
          x: savedState.positionX,
          y: savedState.positionY,
          z: savedState.positionZ,
        };
      }
      state = {
        health: savedState.health ?? undefined,
        hunger: savedState.hunger ?? undefined,
        thirst: savedState.thirst ?? undefined,
      };
    }

    return gameLoop.world.createPlayerEntity(playerId, position, state);
  }

  // ─── Send Initial Snapshot ───

  private sendInitialSnapshot(player: ConnectedPlayer): void {
    const world = gameLoop.world;
    const entities: EntitySnapshot[] = [];

    // Get all entities within view distance of the player
    const playerPos = world.ecs.getComponent<PositionComponent>(
      player.entityId,
      ComponentType.Position,
    );

    if (!playerPos) return;

    const allEntities = world.ecs.getAllEntities();
    for (const eid of allEntities) {
      const pos = world.ecs.getComponent<PositionComponent>(eid, ComponentType.Position);
      if (!pos) continue;

      // Check if within view distance
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const viewDistBlocks = VIEW_DISTANCE_CHUNKS * CHUNK_SIZE_X;
      if (dx * dx + dz * dz > viewDistBlocks * viewDistBlocks) continue;

      const snapshot = this.buildEntitySnapshot(eid);
      if (snapshot) entities.push(snapshot);
    }

    const payload: SnapshotPayload = {
      tick: gameLoop.currentTick,
      entities,
      playerEntityId: player.entityId,
    };

    player.socket.emit(ServerMessage.Snapshot, payload);
  }

  // ─── Build Entity Snapshot ───

  private buildEntitySnapshot(entityId: number): EntitySnapshot | null {
    const world = gameLoop.world;
    const components: Record<string, unknown> = {};

    // Collect all components for the entity
    const componentTypes = [
      ComponentType.Position,
      ComponentType.Velocity,
      ComponentType.Health,
      ComponentType.Hunger,
      ComponentType.Thirst,
      ComponentType.Temperature,
      ComponentType.Inventory,
      ComponentType.Equipment,
      ComponentType.Building,
      ComponentType.Collider,
      ComponentType.NPCType,
      ComponentType.AI,
      ComponentType.Ownership,
    ];

    let hasAny = false;
    for (const ct of componentTypes) {
      const comp = world.ecs.getComponent(entityId, ct);
      if (comp !== undefined) {
        components[ct] = comp;
        hasAny = true;
      }
    }

    if (!hasAny) return null;

    return { entityId, components };
  }

  // ─── Register Message Handlers ───

  private registerMessageHandlers(socket: Socket, player: ConnectedPlayer): void {
    // Player input
    socket.on(ClientMessage.Input, (data: InputPayload) => {
      if (typeof data.seq !== 'number') return;
      player.lastInputSeq = data.seq;
      gameLoop.queueInput(player.playerId, data);
    });

    // Chat
    socket.on(ClientMessage.Chat, (data: { message: string }) => {
      if (!data.message || typeof data.message !== 'string') return;
      const trimmed = data.message.trim().slice(0, 256);
      if (trimmed.length === 0) return;

      this.io.emit(ServerMessage.Chat, {
        senderId: player.playerId,
        senderName: player.username,
        message: trimmed,
        channel: 'global' as const,
        timestamp: Date.now(),
      });
    });

    // Chunk requests
    socket.on(ClientMessage.ChunkRequest, (data: { chunkX: number; chunkZ: number }) => {
      if (typeof data.chunkX !== 'number' || typeof data.chunkZ !== 'number') return;

      const chunk = gameLoop.world.chunkStore.getOrGenerate(
        data.chunkX,
        data.chunkZ,
        gameLoop.world.terrainGenerator,
      );

      if (chunk) {
        socket.emit(ServerMessage.ChunkData, {
          chunkX: data.chunkX,
          chunkZ: data.chunkZ,
          blocks: Array.from(chunk),
        });
      }
    });

    // Respawn
    socket.on(ClientMessage.Respawn, () => {
      const world = gameLoop.world;
      const health = world.ecs.getComponent<HealthComponent>(player.entityId, ComponentType.Health);
      if (health && health.current <= 0) {
        // Reset player state
        health.current = health.max;

        const hunger = world.ecs.getComponent<HungerComponent>(player.entityId, ComponentType.Hunger);
        if (hunger) hunger.current = hunger.max * 0.5;

        const thirst = world.ecs.getComponent<ThirstComponent>(player.entityId, ComponentType.Thirst);
        if (thirst) thirst.current = thirst.max * 0.5;

        // Teleport to spawn
        const pos = world.ecs.getComponent<PositionComponent>(player.entityId, ComponentType.Position);
        if (pos) {
          pos.x = 2048 + (Math.random() - 0.5) * 20;
          pos.y = 50;
          pos.z = 2048 + (Math.random() - 0.5) * 20;
        }

        logger.info({ playerId: player.playerId }, 'Player respawned');
      }
    });
  }

  // ─── Disconnection Handler ───

  private handleDisconnection(playerId: string, reason: string): void {
    const player = this.connectedPlayers.get(playerId);
    if (!player) return;

    this.connectedPlayers.delete(playerId);

    // Save player state
    this.savePlayerState(playerId, player.entityId).catch((err) => {
      logger.error({ err, playerId }, 'Failed to save player state on disconnect');
    });

    // Start grace period — keep entity alive for reconnection
    const disconnected: DisconnectedPlayer = {
      playerId,
      username: player.username,
      entityId: player.entityId,
      disconnectedAt: Date.now(),
    };

    this.disconnectedPlayers.set(playerId, disconnected);

    const timer = setTimeout(() => {
      this.removeDisconnectedPlayer(playerId);
    }, DISCONNECT_GRACE_PERIOD * 1000);

    this.gracePeriodTimers.set(playerId, timer);

    logger.info(
      { playerId, username: player.username, reason, totalPlayers: this.connectedPlayers.size },
      'Player disconnected, grace period started',
    );
  }

  // ─── Remove Disconnected Player ───

  private removeDisconnectedPlayer(playerId: string): void {
    const disconnected = this.disconnectedPlayers.get(playerId);
    if (!disconnected) return;

    gameLoop.world.removePlayerEntity(playerId);
    this.disconnectedPlayers.delete(playerId);
    this.gracePeriodTimers.delete(playerId);

    logger.info({ playerId }, 'Player entity removed after grace period');
  }

  // ─── Save Player State ───

  private async savePlayerState(playerId: string, entityId: number): Promise<void> {
    const world = gameLoop.world;

    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
    const hunger = world.ecs.getComponent<HungerComponent>(entityId, ComponentType.Hunger);
    const thirst = world.ecs.getComponent<ThirstComponent>(entityId, ComponentType.Thirst);
    const inventory = world.ecs.getComponent<InventoryComponent>(entityId, ComponentType.Inventory);
    const equipment = world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment);

    await playerRepository.savePlayerState(playerId, {
      positionX: pos?.x ?? 2048,
      positionY: pos?.y ?? 50,
      positionZ: pos?.z ?? 2048,
      health: health?.current ?? 100,
      hunger: hunger?.current ?? 50,
      thirst: thirst?.current ?? 50,
      inventory: inventory?.slots ?? [],
      equipment: equipment ?? { head: null, chest: null, legs: null, feet: null, held: null },
    });
  }

  // ─── Save All Players ───

  async saveAllPlayers(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [playerId, player] of this.connectedPlayers) {
      promises.push(
        this.savePlayerState(playerId, player.entityId).catch((err) => {
          logger.error({ err, playerId }, 'Failed to save player state');
        }),
      );
    }
    await Promise.all(promises);
  }

  // ─── Broadcast to All Connected ───

  broadcast(event: string, data: unknown): void {
    this.io.emit(event, data);
  }

  // ─── Emit to Specific Player ───

  emitToPlayer(playerId: string, event: string, data: unknown): void {
    const player = this.connectedPlayers.get(playerId);
    if (player) {
      player.socket.emit(event, data);
    }
  }

  // ─── Getters ───

  getConnectedPlayers(): Map<string, ConnectedPlayer> {
    return this.connectedPlayers;
  }

  getConnectedPlayerCount(): number {
    return this.connectedPlayers.size;
  }

  getPlayerSocket(playerId: string): Socket | undefined {
    return this.connectedPlayers.get(playerId)?.socket;
  }

  // ─── Cleanup ───

  async shutdown(): Promise<void> {
    // Save all connected players
    await this.saveAllPlayers();

    // Clear all grace period timers
    for (const timer of this.gracePeriodTimers.values()) {
      clearTimeout(timer);
    }
    this.gracePeriodTimers.clear();

    // Remove all disconnected player entities
    for (const [playerId] of this.disconnectedPlayers) {
      gameLoop.world.removePlayerEntity(playerId);
    }
    this.disconnectedPlayers.clear();

    logger.info('SocketServer shut down');
  }
}