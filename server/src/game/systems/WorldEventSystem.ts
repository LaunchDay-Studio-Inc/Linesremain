// ─── World Event System ───
// Manages world-wide events: Blood Moon, Supply Drop, and Fog.

import {
  ComponentType,
  type ItemStack,
  type PositionComponent,
  WORLD_SIZE,
} from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';
import { getDayNumber, isDaytime } from './DayNightSystem.js';

// ─── State ───

const FOG_DURATION = 300; // 5 minutes
const FOG_COOLDOWN = 1800; // 30 minutes
const SUPPLY_DROP_INTERVAL = 2700; // 45 minutes

let bloodMoonActive = false;
let lastBloodMoonDay = 0;
let fogActive = false;
let fogTimer = 0;
let fogCooldownTimer = FOG_COOLDOWN; // Start with full cooldown to prevent immediate trigger

let supplyDropTimer = SUPPLY_DROP_INTERVAL; // Start with full cooldown to prevent immediate trigger

/** Pending events to broadcast to clients */
const pendingEvents: Array<{
  eventType: 'blood_moon' | 'supply_drop' | 'fog';
  active: boolean;
  position?: { x: number; y: number; z: number };
}> = [];

// ─── System ───

export function worldEventSystem(world: GameWorld, dt: number): void {
  updateBloodMoon(world, dt);
  updateFog(world, dt);
  updateSupplyDrop(world, dt);
}

// ─── Blood Moon ───

function updateBloodMoon(world: GameWorld, _dt: number): void {
  const dayNumber = getDayNumber(world);
  const daytime = isDaytime(world);

  // Blood Moon triggers every 4th night
  const isBloodMoonNight = dayNumber % 4 === 0 && dayNumber > 0;

  // Night starts at ~0.8 and ends at ~0.2
  const isNight = !daytime;

  if (isBloodMoonNight && isNight && !bloodMoonActive && lastBloodMoonDay !== dayNumber) {
    bloodMoonActive = true;
    lastBloodMoonDay = dayNumber;
    pendingEvents.push({ eventType: 'blood_moon', active: true });
    logger.info({ day: dayNumber }, 'Blood Moon rising');
  }

  if (bloodMoonActive && daytime) {
    bloodMoonActive = false;
    pendingEvents.push({ eventType: 'blood_moon', active: false });
    logger.info({ day: dayNumber }, 'Blood Moon ended');
  }
}

// ─── Fog ───

function updateFog(world: GameWorld, dt: number): void {
  if (fogActive) {
    fogTimer -= dt;
    if (fogTimer <= 0) {
      fogActive = false;
      fogCooldownTimer = FOG_COOLDOWN;
      pendingEvents.push({ eventType: 'fog', active: false });
      logger.info('Fog event ended');
    }
  } else {
    fogCooldownTimer -= dt;
    if (fogCooldownTimer <= 0) {
      fogActive = true;
      fogTimer = FOG_DURATION;
      fogCooldownTimer = 0;
      pendingEvents.push({ eventType: 'fog', active: true });
      logger.info('Fog event started');
    }
  }
}

// ─── Supply Drop ───

function updateSupplyDrop(world: GameWorld, dt: number): void {
  supplyDropTimer -= dt;
  if (supplyDropTimer > 0) return;
  supplyDropTimer = SUPPLY_DROP_INTERVAL;

  // Find a random player position and drop near them
  const playerMap = world.getPlayerEntityMap();
  if (playerMap.size === 0) return;

  // Pick a random player without Array.from() allocation
  const targetIndex = Math.floor(Math.random() * playerMap.size);
  let idx = 0;
  let randomEntityId: number | undefined;
  for (const [, entityId] of playerMap) {
    if (idx === targetIndex) {
      randomEntityId = entityId;
      break;
    }
    idx++;
  }
  if (randomEntityId === undefined) return;
  const playerPos = world.ecs.getComponent<PositionComponent>(
    randomEntityId,
    ComponentType.Position,
  );
  if (!playerPos) return;

  // Drop within 50-150 blocks of a random player
  const angle = Math.random() * Math.PI * 2;
  const distance = 50 + Math.random() * 100;
  const dropX = Math.max(10, Math.min(WORLD_SIZE - 10, playerPos.x + Math.cos(angle) * distance));
  const dropZ = Math.max(10, Math.min(WORLD_SIZE - 10, playerPos.z + Math.sin(angle) * distance));

  // Find actual surface Y at drop position
  let dropY = 60;
  for (let y = 63; y >= 1; y--) {
    const block = world.chunkStore.getBlock(Math.floor(dropX), y, Math.floor(dropZ));
    if (block !== null && block !== 0 && block !== 14) { // solid, non-water
      dropY = y + 1;
      break;
    }
  }

  // Create a loot entity at the drop location (Tier 2-3 items)
  const lootTable = [
    { itemId: 10, quantity: 50, chance: 1.0 }, // Metal Fragments
    { itemId: 12, quantity: 5, chance: 0.5 }, // HQM
    { itemId: 44, quantity: 30, chance: 0.7 }, // Rifle Ammo
    { itemId: 42, quantity: 30, chance: 0.7 }, // Pistol Ammo
    { itemId: 59, quantity: 2, chance: 0.6 }, // Medical Syringe
    { itemId: 37, quantity: 1, chance: 0.3 }, // Revolver
    { itemId: 50, quantity: 1, chance: 0.2 }, // Road Sign Vest
    { itemId: 39, quantity: 1, chance: 0.15 }, // Semi-Auto Rifle
  ];

  // Resolve loot table into actual item stacks
  const items: ItemStack[] = [];
  for (const entry of lootTable) {
    if (Math.random() <= entry.chance) {
      items.push({ itemId: entry.itemId, quantity: entry.quantity });
    }
  }

  if (items.length === 0) return;

  world.createLootBagEntity({ x: dropX, y: dropY, z: dropZ }, items, 600);

  const dropPosition = { x: dropX, y: dropY, z: dropZ };
  pendingEvents.push({ eventType: 'supply_drop', active: true, position: dropPosition });
  logger.info({ x: dropX, z: dropZ }, 'Supply drop deployed');
}

// ─── Queries ───

export function isBloodMoon(): boolean {
  return bloodMoonActive;
}

export function isFogEvent(): boolean {
  return fogActive;
}

export function drainWorldEvents(): Array<{
  eventType: 'blood_moon' | 'supply_drop' | 'fog';
  active: boolean;
  position?: { x: number; y: number; z: number };
}> {
  const events = [...pendingEvents];
  pendingEvents.length = 0;
  return events;
}
