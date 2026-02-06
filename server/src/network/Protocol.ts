// ─── Protocol ───
// Serialization helpers using @msgpack/msgpack for binary encoding.
// Provides encode/decode utilities and specialized pack/unpack functions
// for common message types (deltas, inputs, snapshots).

import { encode, decode } from '@msgpack/msgpack';
import type {
  InputPayload,
  DeltaPayload,
  SnapshotPayload,
  EntitySnapshot,
  PlayerStatsPayload,
  ChunkDataPayload,
} from '@lineremain/shared';

// ─── Generic Encode / Decode ───

/**
 * Encode any JSON-serializable value to a msgpack Uint8Array.
 */
export function packMessage<T>(data: T): Uint8Array {
  return encode(data);
}

/**
 * Decode a msgpack Uint8Array back to a typed value.
 */
export function unpackMessage<T>(buffer: Uint8Array): T {
  return decode(buffer) as T;
}

// ─── Input Packing ───

/**
 * Pack a client input payload into a compact binary format.
 * Layout: [seq(4), forward(1), right(1), flags(1), rotation(4), selectedSlot(1)] = 12 bytes
 * Flags byte: bit0=jump, bit1=crouch, bit2=sprint, bit3=primaryAction, bit4=secondaryAction
 */
export function packInput(input: InputPayload): Uint8Array {
  const buffer = new ArrayBuffer(12);
  const view = new DataView(buffer);

  view.setUint32(0, input.seq, true);
  view.setInt8(4, input.forward);
  view.setInt8(5, input.right);

  let flags = 0;
  if (input.jump) flags |= 0x01;
  if (input.crouch) flags |= 0x02;
  if (input.sprint) flags |= 0x04;
  if (input.primaryAction) flags |= 0x08;
  if (input.secondaryAction) flags |= 0x10;
  view.setUint8(6, flags);

  view.setFloat32(7, input.rotation, true);
  view.setUint8(11, input.selectedSlot);

  return new Uint8Array(buffer);
}

/**
 * Unpack a compact binary input payload.
 */
export function unpackInput(data: Uint8Array): InputPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const seq = view.getUint32(0, true);
  const forward = view.getInt8(4);
  const right = view.getInt8(5);
  const flags = view.getUint8(6);
  const rotation = view.getFloat32(7, true);
  const selectedSlot = view.getUint8(11);

  return {
    seq,
    forward,
    right,
    jump: (flags & 0x01) !== 0,
    crouch: (flags & 0x02) !== 0,
    sprint: (flags & 0x04) !== 0,
    primaryAction: (flags & 0x08) !== 0,
    secondaryAction: (flags & 0x10) !== 0,
    rotation,
    selectedSlot,
  };
}

// ─── Delta Packing ───

/**
 * Pack a delta payload using msgpack for efficient transmission.
 * Includes tick, created/updated entity snapshots, and removed entity IDs.
 */
export function packDelta(delta: DeltaPayload): Uint8Array {
  // Use msgpack for complex nested structures
  return encode({
    t: delta.tick,
    c: delta.created.map(compressSnapshot),
    u: delta.updated.map(compressSnapshot),
    r: delta.removed,
  });
}

/**
 * Unpack a delta payload from msgpack.
 */
export function unpackDelta(data: Uint8Array): DeltaPayload {
  const raw = decode(data) as {
    t: number;
    c: CompressedSnapshot[];
    u: CompressedSnapshot[];
    r: number[];
  };

  return {
    tick: raw.t,
    created: raw.c.map(decompressSnapshot),
    updated: raw.u.map(decompressSnapshot),
    removed: raw.r,
  };
}

// ─── Snapshot Packing ───

/**
 * Pack a full snapshot payload using msgpack.
 */
export function packSnapshot(snapshot: SnapshotPayload): Uint8Array {
  return encode({
    t: snapshot.tick,
    e: snapshot.entities.map(compressSnapshot),
    p: snapshot.playerEntityId,
  });
}

/**
 * Unpack a full snapshot payload from msgpack.
 */
export function unpackSnapshot(data: Uint8Array): SnapshotPayload {
  const raw = decode(data) as {
    t: number;
    e: CompressedSnapshot[];
    p: number;
  };

  return {
    tick: raw.t,
    entities: raw.e.map(decompressSnapshot),
    playerEntityId: raw.p,
  };
}

// ─── Player Stats Packing ───

/**
 * Pack player stats into a compact binary format.
 * Layout: [health(2), maxHealth(2), hunger(2), maxHunger(2), thirst(2), maxThirst(2), temp(4)] = 16 bytes
 */
export function packPlayerStats(stats: PlayerStatsPayload): Uint8Array {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);

  view.setUint16(0, Math.round(stats.health * 10), true);
  view.setUint16(2, Math.round(stats.maxHealth * 10), true);
  view.setUint16(4, Math.round(stats.hunger * 10), true);
  view.setUint16(6, Math.round(stats.maxHunger * 10), true);
  view.setUint16(8, Math.round(stats.thirst * 10), true);
  view.setUint16(10, Math.round(stats.maxThirst * 10), true);
  view.setFloat32(12, stats.temperature, true);

  return new Uint8Array(buffer);
}

/**
 * Unpack player stats from compact binary format.
 */
export function unpackPlayerStats(data: Uint8Array): PlayerStatsPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  return {
    health: view.getUint16(0, true) / 10,
    maxHealth: view.getUint16(2, true) / 10,
    hunger: view.getUint16(4, true) / 10,
    maxHunger: view.getUint16(6, true) / 10,
    thirst: view.getUint16(8, true) / 10,
    maxThirst: view.getUint16(10, true) / 10,
    temperature: view.getFloat32(12, true),
  };
}

// ─── Chunk Data Packing ───

/**
 * Pack chunk data using msgpack (block data is already a flat array).
 */
export function packChunkData(chunk: ChunkDataPayload): Uint8Array {
  return encode({
    x: chunk.chunkX,
    z: chunk.chunkZ,
    b: chunk.blocks,
  });
}

/**
 * Unpack chunk data from msgpack.
 */
export function unpackChunkData(data: Uint8Array): ChunkDataPayload {
  const raw = decode(data) as { x: number; z: number; b: number[] };
  return {
    chunkX: raw.x,
    chunkZ: raw.z,
    blocks: raw.b,
  };
}

// ─── Internal Compression Helpers ───

interface CompressedSnapshot {
  i: number; // entityId
  c: Record<string, unknown>; // components
}

function compressSnapshot(snapshot: EntitySnapshot): CompressedSnapshot {
  return {
    i: snapshot.entityId,
    c: snapshot.components,
  };
}

function decompressSnapshot(compressed: CompressedSnapshot): EntitySnapshot {
  return {
    entityId: compressed.i,
    components: compressed.c,
  };
}