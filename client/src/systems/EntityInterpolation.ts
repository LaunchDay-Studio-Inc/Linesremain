// ─── Entity Interpolation System ───
// Smooth interpolation for remote player entities between server snapshots.
// Uses a buffer of recent states and interpolates between them with a fixed delay.

import * as THREE from 'three';

// ─── Types ───

export interface EntitySnapshot {
  timestamp: number;
  position: THREE.Vector3;
  yaw: number;
}

interface InterpolatedEntity {
  snapshots: EntitySnapshot[];
  currentPosition: THREE.Vector3;
  currentYaw: number;
}

// ─── Constants ───

const INTERPOLATION_DELAY_MS = 100; // 100ms interpolation delay
const MAX_SNAPSHOTS = 6;
const MAX_EXTRAPOLATION_MS = 200; // max time to extrapolate beyond last snapshot

// Reusable vector to avoid per-frame allocations during extrapolation
const _extrapolationVelocity = new THREE.Vector3();

// ─── Entity Interpolation ───

export class EntityInterpolation {
  private entities = new Map<string, InterpolatedEntity>();

  // ─── Snapshot Management ───

  /**
   * Add a new snapshot for an entity from a server update.
   */
  addSnapshot(entityId: string, timestamp: number, position: THREE.Vector3, yaw: number): void {
    let entity = this.entities.get(entityId);
    if (!entity) {
      entity = {
        snapshots: [],
        currentPosition: position.clone(),
        currentYaw: yaw,
      };
      this.entities.set(entityId, entity);
    }

    entity.snapshots.push({
      timestamp,
      position: position.clone(),
      yaw,
    });

    // Keep buffer bounded
    if (entity.snapshots.length > MAX_SNAPSHOTS) {
      entity.snapshots.shift();
    }
  }

  /**
   * Remove an entity from the interpolation system.
   */
  removeEntity(entityId: string): void {
    this.entities.delete(entityId);
  }

  // ─── Update ───

  /**
   * Update all entity interpolations. Call each frame.
   * @param serverTime Current estimated server time in milliseconds.
   */
  update(serverTime: number): void {
    const renderTime = serverTime - INTERPOLATION_DELAY_MS;

    for (const [, entity] of this.entities) {
      this.interpolateEntity(entity, renderTime);
    }
  }

  private interpolateEntity(entity: InterpolatedEntity, renderTime: number): void {
    const snapshots = entity.snapshots;

    if (snapshots.length === 0) return;

    if (snapshots.length === 1) {
      const snap = snapshots[0]!;
      entity.currentPosition.copy(snap.position);
      entity.currentYaw = snap.yaw;
      return;
    }

    // Find the two snapshots surrounding renderTime
    let i = 0;
    while (i < snapshots.length - 1 && (snapshots[i + 1]?.timestamp ?? 0) <= renderTime) {
      i++;
    }

    const from = snapshots[i]!;

    if (i >= snapshots.length - 1) {
      // We're past the last snapshot — extrapolate cautiously
      const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : undefined;
      if (prev && renderTime - from.timestamp < MAX_EXTRAPOLATION_MS) {
        const duration = from.timestamp - prev.timestamp;
        if (duration > 0) {
          const t = (renderTime - from.timestamp) / duration;
          const clampedT = Math.min(t, 1); // don't extrapolate too far
          // Extrapolate: position = from + (from - prev) * t
          entity.currentPosition
            .copy(from.position)
            .addScaledVector(
              _extrapolationVelocity.copy(from.position).sub(prev.position),
              clampedT,
            );
          entity.currentYaw = from.yaw + (from.yaw - prev.yaw) * clampedT;
        }
      } else {
        entity.currentPosition.copy(from.position);
        entity.currentYaw = from.yaw;
      }
      return;
    }

    const to = snapshots[i + 1]!;
    const duration = to.timestamp - from.timestamp;

    if (duration <= 0) {
      entity.currentPosition.copy(to.position);
      entity.currentYaw = to.yaw;
      return;
    }

    const t = Math.max(0, Math.min(1, (renderTime - from.timestamp) / duration));

    // Lerp position
    entity.currentPosition.lerpVectors(from.position, to.position, t);

    // Lerp yaw (handle wrapping)
    let yawDiff = to.yaw - from.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    entity.currentYaw = from.yaw + yawDiff * t;

    // Prune old snapshots (keep at least 2)
    while (snapshots.length > 2 && (snapshots[1]?.timestamp ?? 0) < renderTime) {
      snapshots.shift();
    }
  }

  // ─── Queries ───

  getPosition(entityId: string): THREE.Vector3 | null {
    const entity = this.entities.get(entityId);
    return entity ? entity.currentPosition : null;
  }

  getYaw(entityId: string): number | null {
    const entity = this.entities.get(entityId);
    return entity ? entity.currentYaw : null;
  }

  hasEntity(entityId: string): boolean {
    return this.entities.has(entityId);
  }

  getEntityIds(): IterableIterator<string> {
    return this.entities.keys();
  }

  // ─── Cleanup ───

  clear(): void {
    this.entities.clear();
  }
}
