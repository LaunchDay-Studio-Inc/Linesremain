// ─── Achievement System ───
// Tracks player stats, checks achievement conditions, awards XP, sends notifications.
// Uses a drain pattern for pending notifications.

import { ACHIEVEMENTS, getRewardsAtLevel, levelFromXP, XP_AWARDS } from '@lineremain/shared';
import { achievementRepository } from '../../database/repositories/AchievementRepository.js';
import { logger } from '../../utils/logger.js';
import type { GameWorld } from '../World.js';

// ─── Types ───

export interface AchievementNotification {
  playerId: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface LevelUpNotification {
  playerId: string;
  newLevel: number;
  rewards: { type: string; id: string; name: string }[];
}

export interface XpGainNotification {
  playerId: string;
  amount: number;
  totalXP: number;
  source: string;
}

// ─── Pending notification queues ───

const pendingAchievements: AchievementNotification[] = [];
const pendingLevelUps: LevelUpNotification[] = [];
const pendingXpGains: XpGainNotification[] = [];

export function drainAchievementNotifications(): AchievementNotification[] {
  return pendingAchievements.splice(0);
}

export function drainLevelUpNotifications(): LevelUpNotification[] {
  return pendingLevelUps.splice(0);
}

export function drainXpGainNotifications(): XpGainNotification[] {
  return pendingXpGains.splice(0);
}

// ─── In-memory player stats cache ───
// During gameplay, stats are tracked in memory and periodically flushed to DB

interface PlayerStats {
  xp: number;
  level: number;
  totalGathered: number;
  totalCrafted: number;
  totalKillsNpc: number;
  totalKillsPvp: number;
  totalBuildings: number;
  totalDeaths: number;
  biomesVisited: number;
  journalsFound: number;
  totalEaten: number;
  totalChats: number;
  teamsJoined: number;
  totalDrops: number;
  nightsSurvived: number;
  bloodMoonsSurvived: number;
  biomesVisitedSet: string[];
  unlockedAchievements: Set<string>;
  dirty: boolean;
}

const playerStatsCache = new Map<string, PlayerStats>();

/** Load a player's stats from DB into cache */
export async function loadPlayerStats(playerId: string): Promise<void> {
  const dbStats = await achievementRepository.getPlayerStats(playerId);
  if (!dbStats) return;

  const achievements = await achievementRepository.getPlayerAchievements(playerId);

  playerStatsCache.set(playerId, {
    xp: dbStats.xp,
    level: dbStats.level,
    totalGathered: dbStats.totalGathered,
    totalCrafted: dbStats.totalCrafted,
    totalKillsNpc: dbStats.totalKillsNpc,
    totalKillsPvp: dbStats.totalKillsPvp,
    totalBuildings: dbStats.totalBuildings,
    totalDeaths: dbStats.totalDeaths,
    biomesVisited: dbStats.biomesVisited,
    journalsFound: dbStats.journalsFound,
    totalEaten: dbStats.totalEaten,
    totalChats: dbStats.totalChats,
    teamsJoined: dbStats.teamsJoined,
    totalDrops: dbStats.totalDrops,
    nightsSurvived: dbStats.nightsSurvived,
    bloodMoonsSurvived: dbStats.bloodMoonsSurvived,
    biomesVisitedSet: (dbStats.biomesVisitedSet as string[]) ?? [],
    unlockedAchievements: new Set(achievements),
    dirty: false,
  });
}

/** Unload player stats and flush to DB */
export async function unloadPlayerStats(playerId: string): Promise<void> {
  const stats = playerStatsCache.get(playerId);
  if (!stats) return;
  if (stats.dirty) {
    await flushPlayerStats(playerId, stats);
  }
  playerStatsCache.delete(playerId);
}

/** Flush dirty stats to database */
async function flushPlayerStats(playerId: string, stats: PlayerStats): Promise<void> {
  try {
    await achievementRepository.updateXpAndLevel(playerId, stats.xp, stats.level);
    stats.dirty = false;
  } catch (err) {
    logger.error({ playerId, err }, 'Failed to flush player stats');
  }
}

/** Get cached stats for a player */
export function getPlayerStats(playerId: string): PlayerStats | undefined {
  return playerStatsCache.get(playerId);
}

// ─── Stat Tracking Functions (called by game systems) ───

function getOrCreateStats(playerId: string): PlayerStats {
  let stats = playerStatsCache.get(playerId);
  if (!stats) {
    stats = {
      xp: 0,
      level: 1,
      totalGathered: 0,
      totalCrafted: 0,
      totalKillsNpc: 0,
      totalKillsPvp: 0,
      totalBuildings: 0,
      totalDeaths: 0,
      biomesVisited: 0,
      journalsFound: 0,
      totalEaten: 0,
      totalChats: 0,
      teamsJoined: 0,
      totalDrops: 0,
      nightsSurvived: 0,
      bloodMoonsSurvived: 0,
      biomesVisitedSet: [],
      unlockedAchievements: new Set(),
      dirty: false,
    };
    playerStatsCache.set(playerId, stats);
  }
  return stats;
}

function awardXP(playerId: string, amount: number, source: string): void {
  const stats = getOrCreateStats(playerId);
  const oldLevel = stats.level;

  stats.xp = Math.max(0, stats.xp + amount);
  stats.level = levelFromXP(stats.xp);
  stats.dirty = true;

  if (amount !== 0) {
    pendingXpGains.push({
      playerId,
      amount,
      totalXP: stats.xp,
      source,
    });
  }

  // Check for level up
  if (stats.level > oldLevel) {
    const rewards = getRewardsAtLevel(stats.level);
    pendingLevelUps.push({
      playerId,
      newLevel: stats.level,
      rewards: rewards.map((r) => ({ type: r.type, id: r.id, name: r.name })),
    });
    logger.info({ playerId, newLevel: stats.level }, 'Player leveled up');
  }
}

function checkAchievements(playerId: string): void {
  const stats = getOrCreateStats(playerId);

  const statMap: Record<string, number> = {
    total_gathered: stats.totalGathered,
    total_crafted: stats.totalCrafted,
    total_kills_npc: stats.totalKillsNpc,
    total_kills_pvp: stats.totalKillsPvp,
    total_buildings: stats.totalBuildings,
    total_deaths: stats.totalDeaths,
    biomes_visited: stats.biomesVisited,
    journals_found: stats.journalsFound,
    total_eaten: stats.totalEaten,
    total_chats: stats.totalChats,
    teams_joined: stats.teamsJoined,
    total_drops: stats.totalDrops,
    nights_survived: stats.nightsSurvived,
    blood_moons_survived: stats.bloodMoonsSurvived,
    level: stats.level,
  };

  for (const achievement of Object.values(ACHIEVEMENTS)) {
    if (stats.unlockedAchievements.has(achievement.id)) continue;

    const current = statMap[achievement.requirement.stat] ?? 0;
    if (current >= achievement.requirement.threshold) {
      // Unlock!
      stats.unlockedAchievements.add(achievement.id);

      pendingAchievements.push({
        playerId,
        achievementId: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
      });

      // Award achievement XP
      awardXP(playerId, achievement.xpReward, 'achievement');

      // Persist to DB (fire and forget)
      achievementRepository.unlockAchievement(playerId, achievement.id).catch((err) => {
        logger.error(
          { playerId, achievementId: achievement.id, err },
          'Failed to persist achievement',
        );
      });

      logger.info({ playerId, achievementId: achievement.id }, 'Achievement unlocked');
    }
  }
}

// ─── Public Stat Increment Functions ───

export function trackGather(playerId: string, amount: number = 1): void {
  const stats = getOrCreateStats(playerId);
  stats.totalGathered += amount;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.blockBreak * amount, 'gather');
  checkAchievements(playerId);
}

export function trackCraft(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalCrafted += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.craftItem, 'craft');
  checkAchievements(playerId);
}

export function trackNPCKill(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalKillsNpc += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.killNPC, 'kill_npc');
  checkAchievements(playerId);
}

export function trackPVPKill(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalKillsPvp += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.killPlayer, 'kill_pvp');
  checkAchievements(playerId);
}

export function trackBuildingPlace(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalBuildings += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.placeBuilding, 'building');
  checkAchievements(playerId);
}

export function trackDeath(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalDeaths += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.deathPenalty, 'death');
  checkAchievements(playerId);
}

export function trackJournalFound(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.journalsFound += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.journalFound, 'journal');
  checkAchievements(playerId);
}

export function trackBiomeVisited(playerId: string, biomeName: string): void {
  const stats = getOrCreateStats(playerId);
  if (!stats.biomesVisitedSet.includes(biomeName)) {
    stats.biomesVisitedSet.push(biomeName);
    stats.biomesVisited = stats.biomesVisitedSet.length;
    stats.dirty = true;
    awardXP(playerId, XP_AWARDS.biomeDiscovered, 'biome');
    checkAchievements(playerId);
  }
}

export function trackNightSurvived(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.nightsSurvived += 1;
  stats.dirty = true;
  awardXP(playerId, XP_AWARDS.surviveNight, 'night');
  checkAchievements(playerId);
}

export function trackBloodMoonSurvived(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.bloodMoonsSurvived += 1;
  stats.dirty = true;
  checkAchievements(playerId);
}

export function trackChat(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalChats += 1;
  stats.dirty = true;
  checkAchievements(playerId);
}

export function trackTeamJoined(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.teamsJoined += 1;
  stats.dirty = true;
  checkAchievements(playerId);
}

export function trackItemDrop(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalDrops += 1;
  stats.dirty = true;
  checkAchievements(playerId);
}

export function trackEat(playerId: string): void {
  const stats = getOrCreateStats(playerId);
  stats.totalEaten += 1;
  stats.dirty = true;
  checkAchievements(playerId);
}

export function trackBlockPlace(playerId: string): void {
  awardXP(playerId, XP_AWARDS.blockPlace, 'block_place');
}

// ─── Periodic flush (called from game loop) ───

let flushCounter = 0;
const FLUSH_INTERVAL_TICKS = 600; // Every 30 seconds at 20 TPS

export function achievementSystem(_world: GameWorld, _dt: number): void {
  flushCounter++;
  if (flushCounter >= FLUSH_INTERVAL_TICKS) {
    flushCounter = 0;
    // Flush all dirty stats
    for (const [playerId, stats] of playerStatsCache) {
      if (stats.dirty) {
        flushPlayerStats(playerId, stats).catch((err) => {
          logger.error({ playerId, err }, 'Failed to flush player stats on interval');
        });
      }
    }
  }
}
