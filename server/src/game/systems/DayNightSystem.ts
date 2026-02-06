// ─── Day/Night Cycle System ───
// Advances worldTime each tick and periodically broadcasts to clients.

import type { GameWorld } from '../World.js';
import { DAY_LENGTH_SECONDS } from '@lineremain/shared';

// ─── State ───

let tickCounter = 0;

// ─── System ───

export function dayNightSystem(world: GameWorld, dt: number): void {
  // Advance world time
  world.worldTime += dt / DAY_LENGTH_SECONDS;
  if (world.worldTime >= 1) {
    world.worldTime -= 1;
  }

  tickCounter++;
}

// ─── Queries ───

export function getWorldTime(world: GameWorld): number {
  return world.worldTime;
}

/**
 * Daytime is roughly 0.2 (sunrise) to 0.8 (sunset).
 */
export function isDaytime(world: GameWorld): boolean {
  return world.worldTime > 0.2 && world.worldTime < 0.8;
}

/**
 * Get the current day number based on accumulated time.
 */
export function getDayNumber(world: GameWorld): number {
  // dayNumber is tracked externally — worldTime wraps 0-1 per day
  return Math.floor(world.worldTime) + 1;
}

/**
 * Check if the broadcast timer has elapsed (every 100 ticks = 5 seconds).
 */
export function shouldBroadcastTime(): boolean {
  return tickCounter % 100 === 0;
}

export function resetDayNightCounter(): void {
  tickCounter = 0;
}