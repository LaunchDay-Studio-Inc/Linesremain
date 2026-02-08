// ─── Network Message Types ───

import type { ItemStack } from './items.js';

// ─── Client → Server Messages ───

export enum ClientMessage {
  Input = 'c:input',
  Chat = 'c:chat',
  CraftStart = 'c:craft_start',
  CraftCancel = 'c:craft_cancel',
  InventoryMove = 'c:inv_move',
  InventoryDrop = 'c:inv_drop',
  InventorySplit = 'c:inv_split',
  BuildPlace = 'c:build_place',
  BuildUpgrade = 'c:build_upgrade',
  BuildDemolish = 'c:build_demolish',
  BlockBreak = 'c:block_break',
  BlockPlace = 'c:block_place',
  Interact = 'c:interact',
  ChunkRequest = 'c:chunk_request',
  TeamCreate = 'c:team_create',
  TeamInvite = 'c:team_invite',
  TeamAccept = 'c:team_accept',
  TeamLeave = 'c:team_leave',
  TeamKick = 'c:team_kick',
  Respawn = 'c:respawn',
}

// ─── Server → Client Messages ───

export enum ServerMessage {
  Snapshot = 's:snapshot',
  Delta = 's:delta',
  ChunkData = 's:chunk_data',
  ChunkUpdate = 's:chunk_update',
  Chat = 's:chat',
  InventoryUpdate = 's:inv_update',
  CraftProgress = 's:craft_progress',
  Death = 's:death',
  Notification = 's:notification',
  TeamUpdate = 's:team_update',
  PlayerStats = 's:player_stats',
  WorldTime = 's:world_time',
  Sound = 's:sound',
  WorldEvent = 's:world_event',
  JournalFound = 's:journal_found',
  CinematicText = 's:cinematic_text',
}

// ─── Client Payload Interfaces ───

export interface InputPayload {
  seq: number; // sequence number for reconciliation
  forward: number; // -1, 0, 1
  right: number; // -1, 0, 1
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  rotation: number; // radians
  primaryAction: boolean; // left click
  secondaryAction: boolean; // right click
  selectedSlot: number;
}

export interface ChatPayload {
  message: string;
}

export interface CraftStartPayload {
  recipeId: number;
}

export interface CraftCancelPayload {
  recipeId: number;
}

export interface InventoryMovePayload {
  fromSlot: number;
  toSlot: number;
  fromContainer?: string; // entity id of container, omit for player inventory
  toContainer?: string;
}

export interface InventoryDropPayload {
  slot: number;
  quantity: number;
}

export interface InventorySplitPayload {
  slot: number;
}

export interface BuildPlacePayload {
  pieceType: string;
  tier: number;
  position: { x: number; y: number; z: number };
  rotation: number;
}

export interface BuildUpgradePayload {
  entityId: number;
  newTier: number;
}

export interface BuildDemolishPayload {
  entityId: number;
}

export interface BlockBreakPayload {
  x: number;
  y: number;
  z: number;
}

export interface BlockPlacePayload {
  x: number;
  y: number;
  z: number;
  blockType: number;
}

export interface InteractPayload {
  entityId: number;
}

export interface ChunkRequestPayload {
  chunkX: number;
  chunkZ: number;
}

export interface TeamCreatePayload {
  name: string;
}

export interface TeamInvitePayload {
  targetPlayerId: string;
}

export interface TeamAcceptPayload {
  teamId: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TeamLeavePayload {}

export interface TeamKickPayload {
  targetPlayerId: string;
}

export interface RespawnPayload {
  spawnOption?: 'random' | 'bag'; // sleeping bag or random
  bagEntityId?: number;
}

// ─── Server Payload Interfaces ───

export interface EntitySnapshot {
  entityId: number;
  components: Record<string, unknown>;
}

export interface SnapshotPayload {
  tick: number;
  entities: EntitySnapshot[];
  playerEntityId: number;
}

export interface DeltaPayload {
  tick: number;
  created: EntitySnapshot[];
  updated: EntitySnapshot[];
  removed: number[];
}

export interface ChunkDataPayload {
  chunkX: number;
  chunkZ: number;
  blocks: number[]; // flat array of block type IDs
}

export interface ChunkUpdatePayload {
  chunkX: number;
  chunkZ: number;
  updates: { localX: number; localY: number; localZ: number; blockType: number }[];
}

export interface ServerChatPayload {
  senderId: string;
  senderName: string;
  message: string;
  channel: 'global' | 'team' | 'local';
  timestamp: number;
}

export interface InventoryUpdatePayload {
  slots: (ItemStack | null)[];
  equipment: {
    head: ItemStack | null;
    chest: ItemStack | null;
    legs: ItemStack | null;
    feet: ItemStack | null;
    held: ItemStack | null;
  };
}

export interface CraftProgressPayload {
  recipeId: number;
  progress: number; // 0-1
  isComplete: boolean;
}

export interface DeathPayload {
  killerId: string | null;
  killerName: string | null;
  cause: string; // 'player', 'animal', 'hunger', 'thirst', 'cold', 'heat', 'fall', 'bleeding'
}

export interface NotificationPayload {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  duration: number; // ms
}

export interface TeamUpdatePayload {
  teamId: string;
  name: string;
  members: { playerId: string; playerName: string; isLeader: boolean; isOnline: boolean }[];
  pendingInvites: string[];
}

export interface PlayerStatsPayload {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  thirst: number;
  maxThirst: number;
  temperature: number;
}

export interface WorldTimePayload {
  timeOfDay: number; // 0-1 where 0=midnight, 0.5=noon
  dayNumber: number;
  dayLengthSeconds: number;
}

export interface SoundPayload {
  soundId: string;
  position: { x: number; y: number; z: number };
  volume: number; // 0-1
  pitch?: number;
}

export interface WorldEventPayload {
  eventType: 'blood_moon' | 'supply_drop' | 'fog';
  active: boolean;
  position?: { x: number; y: number; z: number }; // for supply drops
}

export interface JournalFoundPayload {
  fragmentId: number; // item ID 68-87
  title: string;
  text: string;
}

export interface CinematicTextPayload {
  text: string;
  subtitle?: string;
  duration: number; // ms
}
