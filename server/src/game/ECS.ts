// ─── Entity Component System ───
// Lightweight ECS with cached queries for the Lineremain game server.

import type { EntityId } from '@lineremain/shared';

// ─── Component Store ───

export class ComponentStore<T> {
  readonly name: string;
  private data = new Map<EntityId, T>();

  constructor(name: string) {
    this.name = name;
  }

  set(entityId: EntityId, component: T): void {
    this.data.set(entityId, component);
  }

  get(entityId: EntityId): T | undefined {
    return this.data.get(entityId);
  }

  has(entityId: EntityId): boolean {
    return this.data.has(entityId);
  }

  delete(entityId: EntityId): boolean {
    return this.data.delete(entityId);
  }

  entities(): IterableIterator<EntityId> {
    return this.data.keys();
  }

  entries(): IterableIterator<[EntityId, T]> {
    return this.data.entries();
  }

  get size(): number {
    return this.data.size;
  }
}

// ─── System Function ───
// Note: SystemFn is typed generically here. GameWorld re-exports a concrete type.

// ─── ECS World ───

export class ECSWorld {
  private nextEntityId: EntityId = 1;
  private stores = new Map<string, ComponentStore<unknown>>();
  private entityStores = new Map<EntityId, Set<string>>(); // which stores each entity is in
  private queryCache = new Map<string, EntityId[]>();
  private queryCacheDirty = true;

  // ─── Component Registration ───

  registerComponent<T>(name: string): ComponentStore<T> {
    if (this.stores.has(name)) {
      return this.stores.get(name) as ComponentStore<T>;
    }
    const store = new ComponentStore<T>(name);
    this.stores.set(name, store as ComponentStore<unknown>);
    return store;
  }

  getStore<T>(name: string): ComponentStore<T> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`Component store '${name}' not registered`);
    return store as ComponentStore<T>;
  }

  // ─── Entity Lifecycle ───

  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.entityStores.set(id, new Set());
    this.queryCacheDirty = true;
    return id;
  }

  destroyEntity(entityId: EntityId): void {
    const storeNames = this.entityStores.get(entityId);
    if (!storeNames) return;

    for (const name of storeNames) {
      this.stores.get(name)?.delete(entityId);
    }
    this.entityStores.delete(entityId);
    this.queryCacheDirty = true;
  }

  entityExists(entityId: EntityId): boolean {
    return this.entityStores.has(entityId);
  }

  // ─── Component Operations ───

  addComponent<T>(entityId: EntityId, storeName: string, data: T): void {
    const store = this.stores.get(storeName);
    if (!store) throw new Error(`Component store '${storeName}' not registered`);

    store.set(entityId, data);
    this.entityStores.get(entityId)?.add(storeName);
    this.queryCacheDirty = true;
  }

  getComponent<T>(entityId: EntityId, storeName: string): T | undefined {
    const store = this.stores.get(storeName);
    return store?.get(entityId) as T | undefined;
  }

  hasComponent(entityId: EntityId, storeName: string): boolean {
    const store = this.stores.get(storeName);
    return store?.has(entityId) ?? false;
  }

  removeComponent(entityId: EntityId, storeName: string): void {
    const store = this.stores.get(storeName);
    if (store) {
      store.delete(entityId);
      this.entityStores.get(entityId)?.delete(storeName);
      this.queryCacheDirty = true;
    }
  }

  // ─── Query ───

  /**
   * Returns entity IDs that have ALL specified components.
   * Results are cached and invalidated on add/remove operations.
   */
  query(...storeNames: string[]): EntityId[] {
    const cacheKey = storeNames.sort().join('|');

    // Return cached result if available (even within a dirty tick,
    // the cache is cleared once at the start via flushQueryCache)
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached;

    // Find the smallest store to iterate
    let smallest: ComponentStore<unknown> | null = null;
    let smallestSize = Infinity;
    for (const name of storeNames) {
      const store = this.stores.get(name);
      if (!store) return [];
      if (store.size < smallestSize) {
        smallest = store;
        smallestSize = store.size;
      }
    }

    if (!smallest) return [];

    const result: EntityId[] = [];
    for (const entityId of smallest.entities()) {
      let hasAll = true;
      for (const name of storeNames) {
        if (name === smallest.name) continue;
        if (!this.stores.get(name)!.has(entityId)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) result.push(entityId);
    }

    this.queryCache.set(cacheKey, result);
    return result;
  }

  /**
   * Call at the start of each tick to invalidate stale cache entries.
   * Clears all cached queries so they are recomputed fresh this tick,
   * then resets the dirty flag so mid-tick queries can be cached and reused.
   */
  flushQueryCache(): void {
    if (this.queryCacheDirty) {
      this.queryCache.clear();
      this.queryCacheDirty = false;
    }
  }

  // ─── Utility ───

  getAllEntities(): EntityId[] {
    return Array.from(this.entityStores.keys());
  }

  getEntityCount(): number {
    return this.entityStores.size;
  }
}