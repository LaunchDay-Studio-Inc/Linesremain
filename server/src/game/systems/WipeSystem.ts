// ─── Wipe / Season System ───
// Tracks wipe scheduling, sends countdown warnings, signals wipe execution,
// and manages season metadata. The actual DB reset and world regeneration is
// handled by the GameLoop / server startup — this system only deals with
// timing, notifications, and season bookkeeping.

import { DEFAULT_WIPE_CYCLE_SECONDS } from '@lineremain/shared';
import { logger } from '../../utils/logger.js';
import type { GameWorld, SystemFn } from '../World.js';

// ─── Warning Thresholds ───

const WARNING_24H_MS = 24 * 60 * 60 * 1000;
const WARNING_1H_MS = 60 * 60 * 1000;
const WARNING_10M_MS = 10 * 60 * 1000;

// ─── Module-level State ───

let seasonNumber = 1;
let seasonStartedAt = Date.now();
let nextWipeAt = Date.now() + DEFAULT_WIPE_CYCLE_SECONDS * 1000;
let lastWarningLevel = 0; // 0=none, 1=24h, 2=1h, 3=10min

// ─── Notification Queues (drain pattern) ───

const wipeWarnings: { timeRemainingMs: number; message: string }[] = [];
const seasonInfoUpdates: {
  seasonNumber: number;
  wipeTimestamp: number;
  seasonStartedAt: number;
}[] = [];

// ─── Check Timer ───

let checkAccumulator = 0;
const CHECK_INTERVAL = 60; // check every 60 seconds

// ─── Season Reward Titles ───

export interface SeasonRewardTitle {
  category: 'kills' | 'buildings' | 'playtime' | 'general';
  rank: number; // 1 = first place, 10 = top 10
  title: string;
}

const SEASON_REWARD_TITLES: SeasonRewardTitle[] = [
  { category: 'kills', rank: 1, title: 'The Reaper' },
  { category: 'buildings', rank: 1, title: 'The Architect' },
  { category: 'playtime', rank: 1, title: 'The Enduring' },
  { category: 'general', rank: 10, title: 'Season {season} Veteran' },
];

/**
 * Returns the season reward title mappings.
 * The `{season}` placeholder in titles should be replaced with the actual
 * season number when awarding.
 */
export function getSeasonRewardTitles(currentSeason?: number): SeasonRewardTitle[] {
  if (currentSeason === undefined) {
    return SEASON_REWARD_TITLES;
  }

  return SEASON_REWARD_TITLES.map((reward) => ({
    ...reward,
    title: reward.title.replace('{season}', String(currentSeason)),
  }));
}

// ─── Initialization ───

/**
 * Initialize season state from DB on server startup.
 * Call this before the game loop begins so the wipe system has accurate
 * timing data from a previous session.
 */
export function initSeason(seasonNum: number, startedAt: number, wipeAt: number): void {
  seasonNumber = seasonNum;
  seasonStartedAt = startedAt;
  nextWipeAt = wipeAt;
  lastWarningLevel = 0;
  checkAccumulator = 0;

  logger.info(
    {
      seasonNumber,
      seasonStartedAt: new Date(seasonStartedAt).toISOString(),
      nextWipeAt: new Date(nextWipeAt).toISOString(),
    },
    'Wipe system initialized for season %d',
    seasonNumber,
  );
}

// ─── Core System ───

/**
 * The wipe system function, registered with the GameWorld system list.
 * Accumulates delta time and checks wipe timing every CHECK_INTERVAL seconds.
 */
export const wipeSystem: SystemFn = (_world: GameWorld, dt: number): void => {
  checkAccumulator += dt;

  if (checkAccumulator < CHECK_INTERVAL) {
    return;
  }

  checkAccumulator -= CHECK_INTERVAL;

  const now = Date.now();
  const timeRemaining = nextWipeAt - now;

  // ── Countdown Warnings ──
  // Each threshold fires only once per wipe cycle (tracked via lastWarningLevel).

  if (timeRemaining <= WARNING_10M_MS && lastWarningLevel < 3) {
    lastWarningLevel = 3;
    const minutes = Math.max(0, Math.ceil(timeRemaining / 60_000));
    const message = `Server wipe in ${minutes} minute${minutes !== 1 ? 's' : ''}! Prepare yourselves.`;
    wipeWarnings.push({ timeRemainingMs: timeRemaining, message });
    logger.warn({ timeRemaining, seasonNumber }, message);
  } else if (timeRemaining <= WARNING_1H_MS && lastWarningLevel < 2) {
    lastWarningLevel = 2;
    const minutes = Math.max(0, Math.ceil(timeRemaining / 60_000));
    const message = `Server wipe in ${minutes} minute${minutes !== 1 ? 's' : ''}. Secure your valuables!`;
    wipeWarnings.push({ timeRemainingMs: timeRemaining, message });
    logger.warn({ timeRemaining, seasonNumber }, message);
  } else if (timeRemaining <= WARNING_24H_MS && lastWarningLevel < 1) {
    lastWarningLevel = 1;
    const hours = Math.max(0, Math.ceil(timeRemaining / 3_600_000));
    const message = `Server wipe in approximately ${hours} hour${hours !== 1 ? 's' : ''}. A new season approaches.`;
    wipeWarnings.push({ timeRemainingMs: timeRemaining, message });
    logger.info({ timeRemaining, seasonNumber }, message);
  }

  // ── Wipe Trigger ──

  if (timeRemaining <= 0) {
    executeWipe(_world);
  }
};

// ─── Wipe Execution ───

/**
 * Signals that a wipe should occur. This function pushes notification events
 * but does NOT perform the actual DB reset or world regeneration — that is
 * handled by the GameLoop / server startup since it requires restarting
 * multiple systems and flushing persistent state.
 */
function executeWipe(_world: GameWorld): void {
  logger.info(
    { seasonNumber, nextWipeAt: new Date(nextWipeAt).toISOString() },
    'Executing world wipe for season %d',
    seasonNumber,
  );

  // Notify all connected clients
  const newSeason = seasonNumber + 1;
  wipeWarnings.push({
    timeRemainingMs: 0,
    message: `The world has been redrawn. Season ${newSeason} begins.`,
  });

  // Advance season
  seasonNumber = newSeason;
  const now = Date.now();
  seasonStartedAt = now;
  nextWipeAt = now + DEFAULT_WIPE_CYCLE_SECONDS * 1000;
  lastWarningLevel = 0;

  // Push updated season info so the server can persist & broadcast it
  seasonInfoUpdates.push({
    seasonNumber,
    wipeTimestamp: nextWipeAt,
    seasonStartedAt,
  });

  logger.info(
    {
      seasonNumber,
      seasonStartedAt: new Date(seasonStartedAt).toISOString(),
      nextWipeAt: new Date(nextWipeAt).toISOString(),
    },
    'Season %d started — next wipe scheduled',
    seasonNumber,
  );
}

// ─── Drain Functions ───

/**
 * Drain all pending wipe warning messages. Returns the accumulated warnings
 * and clears the internal buffer. Typically called by the network broadcast
 * loop each tick.
 */
export function drainWipeWarnings(): { timeRemainingMs: number; message: string }[] {
  return wipeWarnings.splice(0);
}

/**
 * Drain all pending season info updates. Returns the accumulated updates
 * and clears the internal buffer. The server should persist these to DB
 * and broadcast to connected clients.
 */
export function drainSeasonInfoUpdates(): {
  seasonNumber: number;
  wipeTimestamp: number;
  seasonStartedAt: number;
}[] {
  return seasonInfoUpdates.splice(0);
}

// ─── Queries ───

/**
 * Get current season information.
 */
export function getSeasonInfo(): {
  seasonNumber: number;
  wipeTimestamp: number;
  seasonStartedAt: number;
} {
  return {
    seasonNumber,
    wipeTimestamp: nextWipeAt,
    seasonStartedAt,
  };
}

/**
 * Get the current season number.
 */
export function getCurrentSeason(): number {
  return seasonNumber;
}

/**
 * Get the epoch-ms timestamp of the next scheduled wipe.
 */
export function getNextWipeTimestamp(): number {
  return nextWipeAt;
}
