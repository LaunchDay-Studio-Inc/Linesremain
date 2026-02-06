// ─── Message Handler ───
// Routes incoming server messages to the appropriate client stores and systems.

import { socketClient } from './SocketClient';
import { useGameStore } from '../stores/useGameStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useChatStore } from '../stores/useChatStore';
import type { ItemStack } from '@shared/types/items';
import {
  ServerMessage,
  type SnapshotPayload,
  type DeltaPayload,
  type PlayerStatsPayload,
  type DeathPayload,
  type ServerChatPayload,
  type NotificationPayload,
  type WorldTimePayload,
  type InventoryUpdatePayload,
} from '@shared/types/network';

// ─── Entity Store (client-side entity cache) ───

interface ClientEntity {
  entityId: number;
  components: Record<string, unknown>;
}

/** Client-side entity cache for rendering and interpolation */
const entities = new Map<number, ClientEntity>();
let localPlayerEntityId: number | null = null;
let lastServerTick = 0;

// ─── Initialize Message Handlers ───

export function initializeMessageHandlers(): void {
  // Full snapshot (on connect)
  socketClient.on(ServerMessage.Snapshot, (data) => {
    const snapshot = data as SnapshotPayload;
    handleSnapshot(snapshot);
  });

  // Delta updates (every tick)
  socketClient.on(ServerMessage.Delta, (data) => {
    const delta = data as DeltaPayload;
    handleDelta(delta);
  });

  // Player stats
  socketClient.on(ServerMessage.PlayerStats, (data) => {
    const stats = data as PlayerStatsPayload;
    handlePlayerStats(stats);
  });

  // Death
  socketClient.on(ServerMessage.Death, (data) => {
    const death = data as DeathPayload;
    handleDeath(death);
  });

  // Chat
  socketClient.on(ServerMessage.Chat, (data) => {
    const chat = data as ServerChatPayload;
    handleChat(chat);
  });

  // Notifications
  socketClient.on(ServerMessage.Notification, (data) => {
    const notification = data as NotificationPayload;
    handleNotification(notification);
  });

  // World time
  socketClient.on(ServerMessage.WorldTime, (data) => {
    const time = data as WorldTimePayload;
    handleWorldTime(time);
  });

  // Inventory updates
  socketClient.on(ServerMessage.InventoryUpdate, (data) => {
    const inv = data as InventoryUpdatePayload;
    handleInventoryUpdate(inv);
  });
}

// ─── Snapshot Handler ───

function handleSnapshot(snapshot: SnapshotPayload): void {
  // Clear existing entities and rebuild from snapshot
  entities.clear();

  for (const entitySnapshot of snapshot.entities) {
    entities.set(entitySnapshot.entityId, {
      entityId: entitySnapshot.entityId,
      components: entitySnapshot.components,
    });
  }

  localPlayerEntityId = snapshot.playerEntityId;
  lastServerTick = snapshot.tick;

  // Update local player position from snapshot
  const playerEntity = entities.get(snapshot.playerEntityId);
  if (playerEntity) {
    const pos = playerEntity.components['Position'] as { x: number; y: number; z: number } | undefined;
    if (pos) {
      usePlayerStore.getState().setPosition(pos.x, pos.y, pos.z);
    }
  }

  // Transition to playing screen
  useGameStore.getState().setScreen('playing');
}

// ─── Delta Handler ───

function handleDelta(delta: DeltaPayload): void {
  lastServerTick = delta.tick;

  // Process created entities
  for (const created of delta.created) {
    entities.set(created.entityId, {
      entityId: created.entityId,
      components: created.components,
    });
  }

  // Process updated entities
  for (const updated of delta.updated) {
    const existing = entities.get(updated.entityId);
    if (existing) {
      // Merge component updates
      for (const [key, value] of Object.entries(updated.components)) {
        existing.components[key] = value;
      }
    } else {
      // Entity wasn't tracked, add it
      entities.set(updated.entityId, {
        entityId: updated.entityId,
        components: updated.components,
      });
    }
  }

  // Process removed entities
  for (const removedId of delta.removed) {
    entities.delete(removedId);
  }

  // Update local player position from server state
  if (localPlayerEntityId !== null) {
    const playerEntity = entities.get(localPlayerEntityId);
    if (playerEntity) {
      const pos = playerEntity.components['Position'] as { x: number; y: number; z: number } | undefined;
      if (pos) {
        usePlayerStore.getState().setPosition(pos.x, pos.y, pos.z);
      }
    }
  }
}

// ─── Player Stats Handler ───

function handlePlayerStats(stats: PlayerStatsPayload): void {
  const store = usePlayerStore.getState();
  store.setHealth(stats.health);
  store.setHunger(stats.hunger);
  store.setThirst(stats.thirst);
  store.setTemperature(stats.temperature);
}

// ─── Death Handler ───

function handleDeath(_death: DeathPayload): void {
  useGameStore.getState().setScreen('dead');
}

// ─── Chat Handler ───

function handleChat(chat: ServerChatPayload): void {
  useChatStore.getState().addMessage(chat.senderName, chat.message, chat.channel);
}

// ─── Notification Handler ───

function handleNotification(notification: NotificationPayload): void {
  // Add as a system chat message for now
  useChatStore.getState().addMessage('System', notification.message, 'system');
}

// ─── World Time Handler ───

function handleWorldTime(_time: WorldTimePayload): void {
  // World time is consumed by the sky renderer and other systems
  // Store it for access by rendering systems
  worldTimeState.timeOfDay = _time.timeOfDay;
  worldTimeState.dayNumber = _time.dayNumber;
}

// ─── Inventory Update Handler ───

function handleInventoryUpdate(inv: InventoryUpdatePayload): void {
  const store = usePlayerStore.getState();
  store.setInventory(inv.slots);
  store.setEquipment(inv.equipment as Record<string, ItemStack | null>);
}

// ─── Exported State ───

export const worldTimeState = {
  timeOfDay: 0.25, // default to noon
  dayNumber: 1,
};

export function getEntities(): Map<number, ClientEntity> {
  return entities;
}

export function getLocalPlayerEntityId(): number | null {
  return localPlayerEntityId;
}

export function getLastServerTick(): number {
  return lastServerTick;
}