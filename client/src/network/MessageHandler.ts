// ─── Message Handler ───
// Routes incoming server messages to the appropriate client stores and systems.

import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from '@shared/constants/game';
import type { TutorialStep } from '@shared/types/customization';
import type { ItemStack } from '@shared/types/items';
import {
  ServerMessage,
  type AchievementPayload,
  type BaseAttackPayload,
  type BlueprintLearnedPayload,
  type ChunkUpdatePayload,
  type CodeLockPromptPayload,
  type ContainerContentsPayload,
  type CustomizationUpdatedPayload,
  type DeathPayload,
  type DeltaPayload,
  type GameNotificationPayload,
  type InventoryUpdatePayload,
  type LevelUpPayload,
  type NotificationPayload,
  type PlayerStatsPayload,
  type ResearchProgressPayload,
  type SeasonInfoPayload,
  type ServerChatPayload,
  type SnapshotPayload,
  type TutorialStepPayload,
  type WipeWarningPayload,
  type WorldTimePayload,
  type XpGainPayload,
} from '@shared/types/network';
import { useAchievementStore } from '../stores/useAchievementStore';
import { useChatStore } from '../stores/useChatStore';
import { useEndgameStore } from '../stores/useEndgameStore';
import { useGameStore } from '../stores/useGameStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { showNotification } from '../ui/hud/NotificationToast';
import { socketClient } from './SocketClient';

// ─── Entity Store (client-side entity cache) ───

interface ClientEntity {
  entityId: number;
  components: Record<string, unknown>;
}

/** Client-side entity cache for rendering and interpolation */
const entities = new Map<number, ClientEntity>();
let localPlayerEntityId: number | null = null;
let lastServerTick = 0;

// ─── Block Update Callback ───

type BlockChangedCallback = (
  worldX: number,
  worldY: number,
  worldZ: number,
  blockType: number,
) => void;
let onBlockChangedCallback: BlockChangedCallback | null = null;

/** Register a callback for server-authoritative block changes (used by ChunkManager). */
export function setOnBlockChanged(cb: BlockChangedCallback): void {
  onBlockChangedCallback = cb;
}

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

  // Chunk block updates (from other players breaking/placing)
  socketClient.on(ServerMessage.ChunkUpdate, (data) => {
    const update = data as ChunkUpdatePayload;
    handleChunkUpdate(update);
  });

  // Achievement unlocked
  socketClient.on(ServerMessage.Achievement, (data) => {
    const payload = data as AchievementPayload;
    useAchievementStore.getState().unlockAchievement(payload.achievementId);
  });

  // Level up
  socketClient.on(ServerMessage.LevelUp, (data) => {
    const payload = data as LevelUpPayload;
    useAchievementStore.getState().setLevel(payload.newLevel);
  });

  // XP gain
  socketClient.on(ServerMessage.XpGain, (data) => {
    const payload = data as XpGainPayload;
    useAchievementStore.getState().addXP(payload.amount, payload.source);
  });

  // Customization updated
  socketClient.on(ServerMessage.CustomizationUpdated, (data) => {
    const payload = data as CustomizationUpdatedPayload;
    useAchievementStore.getState().setCustomization({
      bodyColor: payload.bodyColor,
      bodyType: (payload.bodyType as import('@shared/types/customization').BodyType) ?? 'striker',
      accessory: payload.accessory ?? 'none',
      trail: payload.trail ?? 'none',
      deathEffect: payload.deathEffect ?? 'none',
      title: payload.title ?? 'none',
    });
  });

  // Tutorial step
  socketClient.on(ServerMessage.TutorialStep, (data) => {
    const payload = data as TutorialStepPayload;
    useAchievementStore.getState().setTutorialStep(payload.step as TutorialStep | null);
  });

  // Base attack notification
  socketClient.on(ServerMessage.BaseAttack, (data) => {
    const payload = data as BaseAttackPayload;
    useEndgameStore.getState().setRaidAlert({
      position: payload.position,
      attackerName: payload.attackerName,
    });
  });

  // Code lock prompt
  socketClient.on(ServerMessage.CodeLockPrompt, (data) => {
    const payload = data as CodeLockPromptPayload;
    useEndgameStore.getState().setCodeLockPrompt({
      entityId: payload.entityId,
      isOwner: payload.isOwner,
    });
  });

  // Container contents
  socketClient.on(ServerMessage.ContainerContents, (data) => {
    const payload = data as ContainerContentsPayload;
    useEndgameStore.getState().setContainerOpen({
      entityId: payload.entityId,
      containerType: payload.containerType,
      slots: payload.slots,
      maxSlots: payload.maxSlots,
    });
  });

  // Container closed
  socketClient.on(ServerMessage.ContainerClosed, () => {
    useEndgameStore.getState().setContainerOpen(null);
  });

  // Research progress
  socketClient.on(ServerMessage.ResearchProgress, (data) => {
    const payload = data as ResearchProgressPayload;
    useEndgameStore.getState().setResearchProgress({
      entityId: payload.entityId,
      progress: payload.progress,
      isComplete: payload.isComplete,
      itemName: payload.itemName,
    });
  });

  // Blueprint learned
  socketClient.on(ServerMessage.BlueprintLearned, (data) => {
    const payload = data as BlueprintLearnedPayload;
    useEndgameStore.getState().addBlueprint(payload.recipeId);
  });

  // Season info
  socketClient.on(ServerMessage.SeasonInfo, (data) => {
    const payload = data as SeasonInfoPayload;
    useEndgameStore.getState().setSeasonInfo({
      seasonNumber: payload.seasonNumber,
      wipeTimestamp: payload.wipeTimestamp,
      seasonStartedAt: payload.seasonStartedAt,
    });
  });

  // Wipe warning
  socketClient.on(ServerMessage.WipeWarning, (data) => {
    const payload = data as WipeWarningPayload;
    useEndgameStore.getState().setWipeWarning({
      timeRemainingMs: payload.timeRemainingMs,
      message: payload.message,
    });
  });

  // Explosion effects (for rendering - store for particle system)
  socketClient.on(ServerMessage.Explosion, (_data) => {
    // Explosion visual effects are handled by the rendering layer
    // Store can be extended later for particle effects
  });

  // C4 placed (for rendering)
  socketClient.on(ServerMessage.C4Placed, (_data) => {
    // C4 entity appears via delta updates
  });

  // C4 detonated (for rendering)
  socketClient.on(ServerMessage.C4Detonated, (_data) => {
    // Handled by Explosion message
  });

  // Door state (handled by delta updates to DoorState component)
  socketClient.on(ServerMessage.DoorState, (_data) => {
    // Door state changes come through delta updates
  });

  // Game notification (unified toast system)
  socketClient.on(ServerMessage.GameNotification, (data) => {
    const payload = data as GameNotificationPayload;
    showNotification(payload.type, payload.title, payload.message);
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
    const pos = playerEntity.components['Position'] as
      | { x: number; y: number; z: number }
      | undefined;
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
      const pos = playerEntity.components['Position'] as
        | { x: number; y: number; z: number }
        | undefined;
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

function handleDeath(death: DeathPayload): void {
  useGameStore.getState().setHasSleepingBag(death.hasSleepingBag ?? false);
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

// ─── Chunk Update Handler ───

function handleChunkUpdate(update: ChunkUpdatePayload): void {
  if (!onBlockChangedCallback) return;

  for (const block of update.updates) {
    const worldX = update.chunkX * CHUNK_SIZE_X + block.localX;
    const worldZ = update.chunkZ * CHUNK_SIZE_Z + block.localZ;
    onBlockChangedCallback(worldX, block.localY, worldZ, block.blockType);
  }
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
