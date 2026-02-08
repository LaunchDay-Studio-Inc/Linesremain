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
  Customize = 'c:customize',
  TutorialAdvance = 'c:tutorial:advance',
  TutorialSkip = 'c:tutorial:skip',
  PlaceC4 = 'c:place_c4',
  DoorInteract = 'c:door_interact',
  SetLockCode = 'c:set_lock_code',
  EnterLockCode = 'c:enter_lock_code',
  ContainerOpen = 'c:container_open',
  ContainerClose = 'c:container_close',
  ContainerMoveItem = 'c:container_move',
  ResearchStart = 'c:research_start',
  ResearchCancel = 'c:research_cancel',
  PlaceDeployable = 'c:place_deployable',
  StoreGetItems = 'store:getItems',
  StorePurchase = 'store:purchase',
  BattlePassGet = 'battlePass:get',
  BattlePassPurchase = 'battlePass:purchase',
  BattlePassClaimReward = 'battlePass:claimReward',
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
  Achievement = 's:achievement',
  LevelUp = 's:level_up',
  XpGain = 's:xp_gain',
  CustomizationUpdated = 's:customization:updated',
  TutorialStep = 's:tutorial:step',
  PlayerProfile = 's:player:profile',
  C4Placed = 's:c4_placed',
  C4Detonated = 's:c4_detonated',
  BaseAttack = 's:base_attack',
  DoorState = 's:door_state',
  CodeLockPrompt = 's:code_lock_prompt',
  ContainerContents = 's:container_contents',
  ContainerClosed = 's:container_closed',
  ResearchProgress = 's:research_progress',
  BlueprintLearned = 's:blueprint_learned',
  SeasonInfo = 's:season_info',
  WipeWarning = 's:wipe_warning',
  Explosion = 's:explosion',
  Lineage = 's:lineage',
  StoreItems = 'store:items',
  StorePurchaseResult = 'store:purchaseResult',
  BattlePassState = 'battlePass:state',
  GameNotification = 'game:notification',
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

export interface CustomizePayload {
  bodyColor?: string;
  bodyType?: string;
  accessory?: string | null;
  trail?: string | null;
  deathEffect?: string | null;
  title?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TutorialAdvancePayload {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TutorialSkipPayload {}

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
  hasSleepingBag: boolean;
  // Lineage fields (populated on true death)
  isLineDeath: boolean; // true = no sleeping bag, lineage advances
  lineage?: LineagePayload; // present only on line deaths
}

export interface LineagePayload {
  generation: number; // NEW generation number (after increment)
  ancestorSummary: {
    survivedSeconds: number;
    enemiesKilled: number;
    buildingsPlaced: number;
    causeOfDeath: string;
  };
  inheritedXP: number;
  inheritedBlueprints: number; // count of carried blueprints
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

// ─── Progression Payload Interfaces ───

export interface AchievementPayload {
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface LevelUpPayload {
  newLevel: number;
  rewards: { type: string; id: string; name: string }[];
}

export interface XpGainPayload {
  amount: number;
  totalXP: number;
  source: string; // 'kill', 'craft', 'gather', 'achievement', etc.
}

export interface CustomizationUpdatedPayload {
  bodyColor: string;
  bodyType: string;
  accessory: string | null;
  trail: string | null;
  deathEffect: string | null;
  title: string | null;
}

export interface TutorialStepPayload {
  step: string; // 'move' | 'gather' | 'craft' | 'build' | 'complete'
}

export interface PlayerProfilePayload {
  username: string;
  level: number;
  xp: number;
  title: string | null;
  achievements: string[]; // achievement IDs
  stats: {
    totalKills: number;
    totalDeaths: number;
    totalPlaytime: number;
    totalGathered: number;
    totalCrafted: number;
    totalBuildings: number;
    biomesVisited: number;
    journalsFound: number;
  };
}

// ─── Endgame Payload Interfaces ───

// Client payloads
export interface PlaceC4Payload {
  targetEntityId: number; // building entity to attach C4 to
}

export interface DoorInteractPayload {
  entityId: number; // door entity
}

export interface SetLockCodePayload {
  entityId: number; // door entity
  code: string; // 4-digit code
}

export interface EnterLockCodePayload {
  entityId: number; // door entity
  code: string;
}

export interface ContainerOpenPayload {
  entityId: number; // container entity
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ContainerClosePayload {}

export interface ContainerMoveItemPayload {
  fromSlot: number;
  toSlot: number;
  fromContainer: boolean; // true = from container, false = from player inventory
  toContainer: boolean;
}

export interface ResearchStartPayload {
  entityId: number; // research table entity
  itemSlot: number; // player inventory slot of item to research
}

export interface ResearchCancelPayload {
  entityId: number; // research table entity
}

export interface PlaceDeployablePayload {
  itemId: number; // item from inventory
  position: { x: number; y: number; z: number };
  rotation: number;
}

// Server payloads
export interface C4PlacedPayload {
  entityId: number;
  position: { x: number; y: number; z: number };
  fuseEndTime: number; // timestamp when it detonates
}

export interface C4DetonatedPayload {
  position: { x: number; y: number; z: number };
  destroyedEntityIds: number[];
}

export interface BaseAttackPayload {
  position: { x: number; y: number; z: number };
  attackerName: string;
}

export interface DoorStatePayload {
  entityId: number;
  isOpen: boolean;
  isLocked: boolean;
}

export interface CodeLockPromptPayload {
  entityId: number;
  isOwner: boolean; // owner can set code, others can enter code
}

export interface ContainerContentsPayload {
  entityId: number;
  containerType: string;
  slots: (ItemStack | null)[];
  maxSlots: number;
}

export interface ContainerClosedPayload {
  entityId: number;
}

export interface ResearchProgressPayload {
  entityId: number;
  progress: number; // 0-1
  isComplete: boolean;
  itemName?: string;
}

export interface BlueprintLearnedPayload {
  recipeId: number;
  recipeName: string;
}

export interface SeasonInfoPayload {
  seasonNumber: number;
  wipeTimestamp: number; // when the next wipe happens (ms epoch)
  seasonStartedAt: number;
}

export interface WipeWarningPayload {
  timeRemainingMs: number; // ms until wipe
  message: string;
}

export interface ExplosionPayload {
  position: { x: number; y: number; z: number };
  radius: number;
  type: 'c4' | 'landmine';
}

// ─── Monetization Payload Interfaces ───

export interface StoreItemsPayload {
  items: import('../types/monetization.js').StoreItem[];
}
export interface StorePurchasePayload {
  itemId: string;
}
export interface StorePurchaseResultPayload {
  success: boolean;
  message: string;
  itemId: string;
}
export interface BattlePassStatePayload {
  state: import('../types/monetization.js').BattlePassState;
}
export interface BattlePassClaimPayload {
  tier: number;
  track: 'free' | 'premium';
}
export interface GameNotificationPayload {
  type: import('../types/monetization.js').NotificationType;
  title: string;
  message?: string;
  duration?: number;
}
