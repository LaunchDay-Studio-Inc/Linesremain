// ─── Game World ───
// Central game world container that owns the ECS, chunk storage, terrain generation,
// and orchestrates system execution each tick.

import {
  AIBehavior,
  AIState,
  BUILDING_REGISTRY,
  ComponentType,
  DECAY_NO_TC_DELAY_SECONDS,
  DECAY_TIME_PER_TIER,
  NPCCreatureType,
  PLAYER_HEIGHT,
  PLAYER_INVENTORY_SLOTS,
  PLAYER_WIDTH,
  type AIComponent,
  type BarricadeComponent,
  type BuildingComponent,
  type BuildingPieceType,
  type BuildingTier,
  type ColliderComponent,
  type ContainerComponent,
  type CraftQueueComponent,
  type DecayComponent,
  type DoorStateComponent,
  type EntityId,
  type EquipmentComponent,
  type ExplosiveComponent,
  type HealthComponent,
  type HungerComponent,
  type InventoryComponent,
  type ItemStack,
  type LandmineComponent,
  type LootableComponent,
  type LootTableEntry,
  type NPCTypeComponent,
  type OwnershipComponent,
  type PositionComponent,
  type ProjectileComponent,
  type ResearchComponent,
  type ResourceNodeComponent,
  type TemperatureComponent,
  type ThirstComponent,
  type VelocityComponent,
} from '@lineremain/shared';
import { logger } from '../utils/logger.js';
import { ChunkStore } from '../world/ChunkStore.js';
import { TerrainGenerator } from '../world/TerrainGenerator.js';
import { ECSWorld } from './ECS.js';

// ─── System Function Type ───
export type SystemFn = (world: GameWorld, dt: number) => void;

// ─── Game World ───

export class GameWorld {
  readonly ecs: ECSWorld;
  readonly chunkStore: ChunkStore;
  terrainGenerator!: TerrainGenerator;

  /** Day/night cycle progress: 0 = dawn, 0.5 = dusk, 0.75 = midnight */
  worldTime = 0;

  /** Ordered list of systems to run each tick */
  private systems: SystemFn[] = [];

  /** Map from playerId (string) → entityId (number) */
  private playerEntityMap = new Map<string, EntityId>();

  constructor() {
    this.ecs = new ECSWorld();
    this.chunkStore = new ChunkStore();
  }

  // ─── Initialization ───

  initialize(seed: number): void {
    this.terrainGenerator = new TerrainGenerator(seed);

    // Register all component stores
    this.ecs.registerComponent<PositionComponent>(ComponentType.Position);
    this.ecs.registerComponent<VelocityComponent>(ComponentType.Velocity);
    this.ecs.registerComponent<HealthComponent>(ComponentType.Health);
    this.ecs.registerComponent<HungerComponent>(ComponentType.Hunger);
    this.ecs.registerComponent<ThirstComponent>(ComponentType.Thirst);
    this.ecs.registerComponent<TemperatureComponent>(ComponentType.Temperature);
    this.ecs.registerComponent<InventoryComponent>(ComponentType.Inventory);
    this.ecs.registerComponent<EquipmentComponent>(ComponentType.Equipment);
    this.ecs.registerComponent<BuildingComponent>(ComponentType.Building);
    this.ecs.registerComponent<ColliderComponent>(ComponentType.Collider);
    this.ecs.registerComponent<DecayComponent>(ComponentType.Decay);
    this.ecs.registerComponent<OwnershipComponent>(ComponentType.Ownership);
    this.ecs.registerComponent<ResourceNodeComponent>(ComponentType.ResourceNode);
    this.ecs.registerComponent<ProjectileComponent>(ComponentType.Projectile);
    this.ecs.registerComponent<NPCTypeComponent>(ComponentType.NPCType);
    this.ecs.registerComponent<CraftQueueComponent>(ComponentType.CraftQueue);
    this.ecs.registerComponent<AIComponent>(ComponentType.AI);
    this.ecs.registerComponent<LootableComponent>(ComponentType.Lootable);
    this.ecs.registerComponent<ExplosiveComponent>(ComponentType.Explosive);
    this.ecs.registerComponent<DoorStateComponent>(ComponentType.DoorState);
    this.ecs.registerComponent<ContainerComponent>(ComponentType.Container);
    this.ecs.registerComponent<LandmineComponent>(ComponentType.Landmine);
    this.ecs.registerComponent<ResearchComponent>(ComponentType.Research);
    this.ecs.registerComponent<BarricadeComponent>(ComponentType.Barricade);

    logger.info({ seed }, 'GameWorld initialized');
  }

  // ─── System Management ───

  addSystem(system: SystemFn): void {
    this.systems.push(system);
  }

  // ─── Update (called each server tick) ───

  update(dt: number): void {
    // Flush stale query cache before systems run so mid-tick queries
    // are recomputed fresh but can still be reused within this tick
    this.ecs.flushQueryCache();

    // Run all systems in order
    for (const system of this.systems) {
      system(this, dt);
    }
  }

  // ─── Player Entity Factory ───

  createPlayerEntity(
    playerId: string,
    position: { x: number; y: number; z: number },
    state?: Partial<{
      health: number;
      hunger: number;
      thirst: number;
    }>,
  ): EntityId {
    const entityId = this.ecs.createEntity();

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: 0,
    });

    this.ecs.addComponent<VelocityComponent>(entityId, ComponentType.Velocity, {
      vx: 0,
      vy: 0,
      vz: 0,
    });

    this.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
      current: state?.health ?? 100,
      max: 100,
    });

    this.ecs.addComponent<HungerComponent>(entityId, ComponentType.Hunger, {
      current: state?.hunger ?? 100,
      max: 100,
      drainRate: 0.03, // ~5 min to drain from full
    });

    this.ecs.addComponent<ThirstComponent>(entityId, ComponentType.Thirst, {
      current: state?.thirst ?? 100,
      max: 100,
      drainRate: 0.05, // ~3.3 min to drain from full
    });

    this.ecs.addComponent<TemperatureComponent>(entityId, ComponentType.Temperature, {
      current: 37,
      environmental: 20,
    });

    this.ecs.addComponent<InventoryComponent>(entityId, ComponentType.Inventory, {
      slots: new Array(PLAYER_INVENTORY_SLOTS).fill(null),
      maxSlots: PLAYER_INVENTORY_SLOTS,
    });

    this.ecs.addComponent<EquipmentComponent>(entityId, ComponentType.Equipment, {
      head: null,
      chest: null,
      legs: null,
      feet: null,
      held: null,
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      depth: PLAYER_WIDTH,
      isStatic: false,
    });

    this.playerEntityMap.set(playerId, entityId);
    return entityId;
  }

  removePlayerEntity(playerId: string): void {
    const entityId = this.playerEntityMap.get(playerId);
    if (entityId !== undefined) {
      this.ecs.destroyEntity(entityId);
      this.playerEntityMap.delete(playerId);
    }
  }

  getPlayerEntity(playerId: string): EntityId | undefined {
    return this.playerEntityMap.get(playerId);
  }

  getPlayerEntityMap(): ReadonlyMap<string, EntityId> {
    return this.playerEntityMap;
  }

  // ─── Building Entity Factory ───

  createBuildingEntity(data: {
    pieceType: BuildingPieceType;
    tier: BuildingTier;
    position: { x: number; y: number; z: number };
    rotation: number;
    ownerId: string;
    dimensions: { width: number; height: number; depth: number };
  }): EntityId {
    const entityId = this.ecs.createEntity();
    const stats = BUILDING_REGISTRY[data.pieceType];
    const maxHealth = stats?.healthPerTier[data.tier] ?? 100;
    const decayTime = DECAY_TIME_PER_TIER[data.tier] ?? 10800;

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: data.position.x,
      y: data.position.y,
      z: data.position.z,
      rotation: data.rotation,
    });

    this.ecs.addComponent<BuildingComponent>(entityId, ComponentType.Building, {
      pieceType: data.pieceType,
      tier: data.tier,
      stability: 1,
    });

    this.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
      current: maxHealth,
      max: maxHealth,
    });

    this.ecs.addComponent<OwnershipComponent>(entityId, ComponentType.Ownership, {
      ownerId: data.ownerId,
      teamId: null,
      isLocked: false,
      authPlayerIds: [data.ownerId],
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: data.dimensions.width,
      height: data.dimensions.height,
      depth: data.dimensions.depth,
      isStatic: true,
    });

    this.ecs.addComponent<DecayComponent>(entityId, ComponentType.Decay, {
      lastInteractionTime: Date.now(),
      decayStartDelay: DECAY_NO_TC_DELAY_SECONDS,
      decayRate: maxHealth / decayTime,
    });

    return entityId;
  }

  // ─── Resource Node Entity Factory ───

  createResourceNodeEntity(
    resourceItemId: number,
    position: { x: number; y: number; z: number },
    amount: number,
  ): EntityId {
    const entityId = this.ecs.createEntity();

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: 0,
    });

    this.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
      current: amount * 10,
      max: amount * 10,
    });

    this.ecs.addComponent<ResourceNodeComponent>(entityId, ComponentType.ResourceNode, {
      resourceItemId,
      amountRemaining: amount,
      maxAmount: amount,
      respawnTimeSeconds: 600,
      lastDepletedTime: null,
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: 1.5,
      height: 1.5,
      depth: 1.5,
      isStatic: true,
    });

    return entityId;
  }

  // ─── Item Drop Entity Factory ───

  createItemDropEntity(
    itemStack: ItemStack,
    position: { x: number; y: number; z: number },
  ): EntityId {
    const entityId = this.ecs.createEntity();

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: 0,
    });

    this.ecs.addComponent<InventoryComponent>(entityId, ComponentType.Inventory, {
      slots: [itemStack],
      maxSlots: 1,
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: 0.4,
      height: 0.4,
      depth: 0.4,
      isStatic: false,
    });

    return entityId;
  }

  // ─── NPC Entity Factory ───

  createNPCEntity(
    type: string,
    position: { x: number; y: number; z: number },
    config?: {
      creatureType?: NPCCreatureType;
      behavior?: AIBehavior;
      health?: number;
      damage?: number;
      walkSpeed?: number;
      runSpeed?: number;
      aggroRange?: number;
      attackRange?: number;
      attackCooldown?: number;
      wanderRadius?: number;
      colliderWidth?: number;
      colliderHeight?: number;
      lootTable?: LootTableEntry[];
      nightOnly?: boolean;
      fleeHealthPercent?: number;
      packRadius?: number;
      isBoss?: boolean;
    },
  ): EntityId {
    const entityId = this.ecs.createEntity();

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: 0,
    });

    this.ecs.addComponent<VelocityComponent>(entityId, ComponentType.Velocity, {
      vx: 0,
      vy: 0,
      vz: 0,
    });

    const hp = config?.health ?? 150;
    this.ecs.addComponent<HealthComponent>(entityId, ComponentType.Health, {
      current: hp,
      max: hp,
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: config?.colliderWidth ?? 0.8,
      height: config?.colliderHeight ?? 1.8,
      depth: config?.colliderWidth ?? 0.8,
      isStatic: false,
    });

    this.ecs.addComponent<AIComponent>(entityId, ComponentType.AI, {
      state: AIState.Idle,
      aggroRange: config?.aggroRange ?? 15,
      attackRange: config?.attackRange ?? 2.0,
      attackDamage: config?.damage ?? 20,
      attackCooldown: config?.attackCooldown ?? 1.5,
      lastAttackTime: 0,
      targetEntityId: null,
      homePosition: { x: position.x, y: position.y, z: position.z, rotation: 0 },
      roamRadius: config?.wanderRadius ?? 20,
    });

    this.ecs.addComponent<NPCTypeComponent>(entityId, ComponentType.NPCType, {
      creatureType: config?.creatureType ?? NPCCreatureType.DustHopper,
      behavior: config?.behavior ?? AIBehavior.Passive,
      walkSpeed: config?.walkSpeed ?? 2.0,
      runSpeed: config?.runSpeed ?? 5.0,
      wanderRadius: config?.wanderRadius ?? 20,
      wanderTarget: null,
      wanderWaitUntil: 0,
      fleeUntil: 0,
      neutralAggroUntil: 0,
      nightOnly: config?.nightOnly ?? false,
      fleeHealthPercent: config?.fleeHealthPercent ?? 0,
      packRadius: config?.packRadius ?? 0,
      isBoss: config?.isBoss ?? false,
    });

    if (config?.lootTable && config.lootTable.length > 0) {
      this.ecs.addComponent<LootableComponent>(entityId, ComponentType.Lootable, {
        lootTable: config.lootTable,
        isLooted: false,
      });
    }

    return entityId;
  }

  // ─── Projectile Entity Factory ───

  createProjectileEntity(
    sourceEntityId: EntityId,
    sourcePlayerId: string,
    weaponId: number,
    damage: number,
    position: { x: number; y: number; z: number },
    velocity: { vx: number; vy: number; vz: number },
    maxRange: number,
    maxLifetime: number,
  ): EntityId {
    const entityId = this.ecs.createEntity();

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: 0,
    });

    this.ecs.addComponent<VelocityComponent>(entityId, ComponentType.Velocity, {
      vx: velocity.vx,
      vy: velocity.vy,
      vz: velocity.vz,
    });

    this.ecs.addComponent<ProjectileComponent>(entityId, ComponentType.Projectile, {
      sourceEntityId,
      sourcePlayerId,
      weaponId,
      damage,
      maxRange,
      distanceTraveled: 0,
      spawnTime: Date.now(),
      maxLifetime,
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: 0.1,
      height: 0.1,
      depth: 0.1,
      isStatic: false,
    });

    return entityId;
  }

  // ─── Loot Bag Entity Factory ───

  createLootBagEntity(
    position: { x: number; y: number; z: number },
    items: (ItemStack | null)[],
    despawnSeconds: number,
  ): EntityId {
    const entityId = this.ecs.createEntity();

    this.ecs.addComponent<PositionComponent>(entityId, ComponentType.Position, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: 0,
    });

    this.ecs.addComponent<InventoryComponent>(entityId, ComponentType.Inventory, {
      slots: items.filter((s) => s !== null) as ItemStack[],
      maxSlots: items.filter((s) => s !== null).length,
    });

    this.ecs.addComponent<LootableComponent>(entityId, ComponentType.Lootable, {
      lootTable: [],
      isLooted: false,
    });

    this.ecs.addComponent<ColliderComponent>(entityId, ComponentType.Collider, {
      width: 0.6,
      height: 0.6,
      depth: 0.6,
      isStatic: true,
    });

    this.ecs.addComponent<DecayComponent>(entityId, ComponentType.Decay, {
      lastInteractionTime: Date.now(),
      decayStartDelay: despawnSeconds,
      decayRate: 9999, // instant removal once decay starts
    });

    return entityId;
  }
}
