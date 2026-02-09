// ─── Socket Server ───
// Full Socket.IO server setup: connection/disconnection handling, player entity
// lifecycle, grace period for reconnections, and combat-log protection.

import {
  CHUNK_SIZE_X,
  ClientMessage,
  ComponentType,
  HAVEN_ISLAND,
  ServerMessage,
  VIEW_DISTANCE_CHUNKS,
  type EntitySnapshot,
  type EquipmentComponent,
  type HealthComponent,
  type HungerComponent,
  type InventoryComponent,
  type PositionComponent,
  type RespawnPayload,
  type SnapshotPayload,
  type ThirstComponent,
  type WorldChangePayload,
} from '@lineremain/shared';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { config } from '../config.js';
import { playerRepository } from '../database/repositories/PlayerRepository.js';
import { gameLoop } from '../game/GameLoop.js';
import { logger } from '../utils/logger.js';

// ─── Handler Imports ───
import { loadPlayerStats, unloadPlayerStats } from '../game/systems/AchievementSystem.js';
import { loadPlayerBlueprints, unloadPlayerBlueprints } from '../game/systems/BlueprintSystem.js';
import { closePlayerContainer } from '../game/systems/ContainerSystem.js';
import { processLineageDeath, processRespawn } from '../game/systems/RespawnSystem.js';
import { getSeasonInfo } from '../game/systems/WipeSystem.js';
import { registerBlockHandlers } from './handlers/BlockHandler.js';
import { registerBuildingHandlers } from './handlers/BuildingHandler.js';
import { registerChatHandlers } from './handlers/ChatHandler.js';
import { registerChunkRequestHandlers } from './handlers/ChunkRequestHandler.js';
import { registerCraftingHandlers } from './handlers/CraftingHandler.js';
import { registerCustomizationHandlers } from './handlers/CustomizationHandler.js';
import { registerEndgameHandlers } from './handlers/EndgameHandler.js';
import { registerInventoryHandlers } from './handlers/InventoryHandler.js';
import { registerPlayerInputHandlers } from './handlers/PlayerInputHandler.js';
import {
  handlePlayerConnect,
  handlePlayerDisconnect,
  registerTeamHandlers,
} from './handlers/TeamHandler.js';

// ─── Types ───

export interface ConnectedPlayer {
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

/** Track players who had a line death (no sleeping bag) — consumed on respawn */
const pendingLineDeaths = new Map<string, string>(); // playerId → cause of death

/** Mark a player as having a line death (called by StateBroadcaster when processing death notifications) */
export function markLineDeath(playerId: string, cause: string): void {
  pendingLineDeaths.set(playerId, cause);
}

/** Check and consume a player's line death flag (called by respawn handler) */
function consumeLineDeath(playerId: string): string | null {
  const cause = pendingLineDeaths.get(playerId) ?? null;
  pendingLineDeaths.delete(playerId);
  return cause;
}

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

    // Register all message handlers via dedicated handler modules
    this.registerMessageHandlers(socket, player);

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(playerId, reason);
    });

    // Notify team system of connection
    handlePlayerConnect(this.io, playerId);

    // Load achievement/progression stats into memory
    loadPlayerStats(playerId).catch((err) => {
      logger.error({ err, playerId }, 'Failed to load player stats');
    });

    // Load blueprints into memory
    loadPlayerBlueprints(playerId, []);

    // Send season info
    const seasonInfo = getSeasonInfo();
    socket.emit(ServerMessage.SeasonInfo, {
      seasonNumber: seasonInfo.seasonNumber,
      wipeTimestamp: seasonInfo.wipeTimestamp,
      seasonStartedAt: seasonInfo.seasonStartedAt,
    });

    // Send lineage info
    playerRepository
      .getLineage(playerId)
      .then((lineage) => {
        if (lineage) {
          socket.emit(ServerMessage.Lineage, lineage);
        }
      })
      .catch((err) => {
        logger.error({ err, playerId }, 'Failed to load lineage data');
      });

    logger.info(
      {
        playerId,
        username,
        entityId,
        socketId: socket.id,
        totalPlayers: this.connectedPlayers.size,
      },
      'Player connected to game',
    );
  }

  // ─── Spawn Player Entity ───

  private async spawnPlayerEntity(playerId: string): Promise<number> {
    // Try to load saved state
    const savedState = await playerRepository.loadPlayerState(playerId);
    const world = gameLoop.world;

    let position: { x: number; y: number; z: number };
    let state: { health?: number; hunger?: number; thirst?: number } | undefined;

    if (savedState && savedState.positionX != null && savedState.positionY != null && savedState.positionZ != null) {
      // Restore saved position (player is in whatever world they left off in)
      position = {
        x: savedState.positionX,
        y: savedState.positionY,
        z: savedState.positionZ,
      };
      state = {
        health: savedState.health ?? undefined,
        hunger: savedState.hunger ?? undefined,
        thirst: savedState.thirst ?? undefined,
      };
    } else {
      // New player — spawn at Haven Island center
      const spawnY = world.islandChunkStore.getGenerator().findSurfaceY(
        HAVEN_ISLAND.spawnX, HAVEN_ISLAND.spawnZ,
      ) + 1;
      position = { x: HAVEN_ISLAND.spawnX, y: spawnY, z: HAVEN_ISLAND.spawnZ };
      world.playerWorldMap.set(playerId, 'islands');
    }

    // Default to 'islands' if not already set (e.g. reconnecting player)
    if (!world.playerWorldMap.has(playerId)) {
      world.playerWorldMap.set(playerId, 'islands');
    }

    return world.createPlayerEntity(playerId, position, state);
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
      playerWorld: world.playerWorldMap.get(player.playerId) ?? 'islands',
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
      ComponentType.DoorState,
      ComponentType.Container,
      ComponentType.Explosive,
      ComponentType.Landmine,
      ComponentType.Barricade,
      ComponentType.SleepingBag,
      ComponentType.ResourceNode,
      ComponentType.Lootable,
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
    const world = gameLoop.world;

    // Helper to get playerId from a socket
    const getPlayerId = (s: Socket): string | undefined => {
      return s.data['playerId'] as string | undefined;
    };

    // Helper to get player name from playerId
    const getPlayerName = (pid: string): string => {
      const p = this.connectedPlayers.get(pid);
      return p?.username ?? 'Unknown';
    };

    // Register dedicated handlers
    registerPlayerInputHandlers(this.io, socket, world, getPlayerId);
    registerChatHandlers(this.io, socket, world, getPlayerId, getPlayerName);
    registerChunkRequestHandlers(this.io, socket, world, getPlayerId);
    registerCraftingHandlers(this.io, socket, world, getPlayerId);
    registerInventoryHandlers(this.io, socket, world, getPlayerId);
    registerBuildingHandlers(this.io, socket, world, getPlayerId);
    registerTeamHandlers(this.io, socket, world, getPlayerId, getPlayerName);
    registerBlockHandlers(this.io, socket, world, getPlayerId);
    registerCustomizationHandlers(this.io, socket, world, getPlayerId);
    registerEndgameHandlers(this.io, socket, world, getPlayerId);

    // Respawn handler — creates fresh entity via RespawnSystem
    socket.on(ClientMessage.Respawn, async (data?: unknown) => {
      // Only respawn if player entity was removed by DeathSystem
      const existingEntity = world.getPlayerEntity(player.playerId);
      if (existingEntity !== undefined) {
        // Entity still exists — check if actually dead
        const health = world.ecs.getComponent<HealthComponent>(
          existingEntity,
          ComponentType.Health,
        );
        if (!health || health.current > 0) return; // not dead
      }

      // Parse respawn payload
      const payload = data as RespawnPayload | undefined;
      const respawnType = payload?.spawnOption === 'bag' ? 'bag' : 'random';

      // Check if this is a line death (no sleeping bag at death time)
      const lineDeathCause = consumeLineDeath(player.playerId);
      const isLineDeath = lineDeathCause !== null;

      // Process lineage advancement for line deaths
      if (isLineDeath) {
        try {
          const lineageResult = await processLineageDeath(player.playerId, lineDeathCause);

          // Send updated lineage to client
          player.socket.emit(ServerMessage.Lineage, {
            generation: lineageResult.newGeneration,
            ancestors: [lineageResult.ancestor],
          });

          logger.info(
            { playerId: player.playerId, generation: lineageResult.newGeneration },
            'Lineage advanced on respawn',
          );
        } catch (err) {
          logger.error({ err, playerId: player.playerId }, 'Failed to process lineage death');
        }
      }

      // Create fresh player entity with starting gear
      const newEntityId = processRespawn(world, player.playerId, respawnType, isLineDeath);
      player.entityId = newEntityId;

      // Send fresh snapshot to the respawned player
      this.sendInitialSnapshot(player);

      logger.info(
        { playerId: player.playerId, entityId: newEntityId, isLineDeath },
        'Player respawned',
      );
    });
  }

  // ─── Disconnection Handler ───

  private handleDisconnection(playerId: string, reason: string): void {
    const player = this.connectedPlayers.get(playerId);
    if (!player) return;

    this.connectedPlayers.delete(playerId);

    // Notify team system
    handlePlayerDisconnect(this.io, playerId);

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

    // Flush and unload achievement stats from memory
    unloadPlayerStats(playerId).catch((err) => {
      logger.error({ err, playerId }, 'Failed to unload player stats');
    });

    // Unload blueprints from memory
    unloadPlayerBlueprints(playerId);

    // Close any open containers
    closePlayerContainer(playerId);

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
