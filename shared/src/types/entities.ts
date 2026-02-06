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