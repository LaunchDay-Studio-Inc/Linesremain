// ─── Entity & Component Types ───

/** Unique identifier for any entity in the ECS */
export type EntityId = number;

/** All component types available in the ECS */
export enum ComponentType {
  Position = 'Position',
  Velocity = 'Velocity',
  Health = 'Health',
  Hunger = 'Hunger',
  Thirst = 'Thirst',
  Temperature = 'Temperature',
  Inventory = 'Inventory',
  Equipment = 'Equipment',
  Building = 'Building',
  Collider = 'Collider',
  Decay = 'Decay',
  Ownership = 'Ownership',
  AI = 'AI',
  Lootable = 'Lootable',
  ResourceNode = 'ResourceNode',
  Projectile = 'Projectile',
  NPCType = 'NPCType',
  CraftQueue = 'CraftQueue',
  Explosive = 'Explosive',
  DoorState = 'DoorState',
  Container = 'Container',
  Landmine = 'Landmine',
  Research = 'Research',
  Barricade = 'Barricade',
  SleepingBag = 'SleepingBag',
}

// ─── Component Interfaces ───

export interface PositionComponent {
  x: number;
  y: number;
  z: number;
  rotation: number; // radians
}

export interface VelocityComponent {
  vx: number;
  vy: number;
  vz: number;
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface HungerComponent {
  current: number;
  max: number;
  drainRate: number; // per second
}

export interface ThirstComponent {
  current: number;
  max: number;
  drainRate: number; // per second
}

export interface TemperatureComponent {
  current: number; // body temperature in °C
  environmental: number; // ambient temperature in °C
}

export interface InventoryComponent {
  slots: (import('./items.js').ItemStack | null)[];
  maxSlots: number;
}

export interface EquipmentComponent {
  head: import('./items.js').ItemStack | null;
  chest: import('./items.js').ItemStack | null;
  legs: import('./items.js').ItemStack | null;
  feet: import('./items.js').ItemStack | null;
  held: import('./items.js').ItemStack | null;
}

export interface BuildingComponent {
  pieceType: import('./buildings.js').BuildingPieceType;
  tier: import('./buildings.js').BuildingTier;
  stability: number; // 0-1
}

export interface ColliderComponent {
  width: number;
  height: number;
  depth: number;
  isStatic: boolean;
}

export interface DecayComponent {
  lastInteractionTime: number; // timestamp ms
  decayStartDelay: number; // seconds before decay begins
  decayRate: number; // hp per second
}

export interface OwnershipComponent {
  ownerId: string; // player id
  teamId: string | null;
  isLocked: boolean;
  authPlayerIds: string[];
}

export enum AIState {
  Idle = 'Idle',
  Roaming = 'Roaming',
  Chasing = 'Chasing',
  Attacking = 'Attacking',
  Fleeing = 'Fleeing',
}

export interface AIComponent {
  state: AIState;
  aggroRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number; // seconds
  lastAttackTime: number;
  targetEntityId: EntityId | null;
  homePosition: PositionComponent;
  roamRadius: number;
}

export interface LootableComponent {
  lootTable: LootTableEntry[];
  isLooted: boolean;
}

export interface LootTableEntry {
  itemId: number;
  quantity: number;
  chance: number; // 0-1
}

export interface ResourceNodeComponent {
  resourceItemId: number;
  amountRemaining: number;
  maxAmount: number;
  respawnTimeSeconds: number;
  lastDepletedTime: number | null;
}

export interface ProjectileComponent {
  sourceEntityId: EntityId;
  sourcePlayerId: string;
  weaponId: number;
  damage: number;
  maxRange: number;
  distanceTraveled: number;
  spawnTime: number;
  maxLifetime: number; // seconds
}

export enum NPCCreatureType {
  DustHopper = 'DustHopper',
  RidgeGrazer = 'RidgeGrazer',
  TuskWalker = 'TuskWalker',
  HuskWalker = 'HuskWalker',
  SporeCrawler = 'SporeCrawler',
  MireBrute = 'MireBrute',
  ShoreSnapper = 'ShoreSnapper',
  FrostStalker = 'FrostStalker',
  CrimsonHusk = 'CrimsonHusk',
  Boar = 'Boar',
  Wolf = 'Wolf',
  Bear = 'Bear',
  Zombie = 'Zombie',
  Bandit = 'Bandit',
  ScrapHulk = 'ScrapHulk',
}

export enum AIBehavior {
  Passive = 'passive',
  Hostile = 'hostile',
  Neutral = 'neutral',
}

export interface NPCTypeComponent {
  creatureType: NPCCreatureType;
  behavior: AIBehavior;
  walkSpeed: number;
  runSpeed: number;
  wanderRadius: number;
  wanderTarget: { x: number; y: number; z: number } | null;
  wanderWaitUntil: number;
  fleeUntil: number;
  neutralAggroUntil: number; // for neutral creatures hit by player
  nightOnly: boolean;
  fleeHealthPercent: number;
  packRadius: number;
  isBoss: boolean;
}

export interface CraftQueueItem {
  recipeId: number;
  progress: number; // seconds elapsed
  totalTime: number; // seconds required
}

export interface CraftQueueComponent {
  queue: CraftQueueItem[];
  maxQueue: number;
}

// ─── Endgame Component Interfaces ───

export interface ExplosiveComponent {
  placerId: string; // player who placed it
  targetEntityId: EntityId; // building entity it's attached to
  fuseStartTime: number; // timestamp when placed
  fuseDuration: number; // seconds (default 10)
  damage: number; // direct damage
  splashDamage: number; // damage to adjacent pieces
  splashRadius: number; // blocks
}

export interface DoorStateComponent {
  isOpen: boolean;
  lockCode: string | null; // null = unlocked
  authorizedPlayerIds: string[];
  ownerId: string;
  doorItemId: number; // 61 = wooden, 62 = metal
}

export interface ContainerComponent {
  containerType: 'storage_box' | 'large_storage_box' | 'research_table';
  slots: (import('./items.js').ItemStack | null)[];
  maxSlots: number;
}

export interface LandmineComponent {
  placerId: string;
  armedAt: number; // timestamp when it becomes active (5s after place)
  isArmed: boolean;
  damage: number;
  triggerRadius: number; // blocks
}

export interface ResearchComponent {
  researchingItemId: number | null;
  researchStartTime: number | null;
  researchDuration: number; // seconds (default 10)
  researcherId: string | null; // player doing research
}

export interface BarricadeComponent {
  placerId: string;
}

export interface SleepingBagComponent {
  placerId: string;
  lastUsedTime: number; // timestamp of last respawn use (for cooldown)
}
