// ─── Achievement Repository ───
// Database operations for player achievements and progression stats

import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { playerAchievements, players } from '../schema.js';

export class AchievementRepository {
  /** Get all unlocked achievement IDs for a player */
  async getPlayerAchievements(playerId: string): Promise<string[]> {
    const rows = await db
      .select({ achievementId: playerAchievements.achievementId })
      .from(playerAchievements)
      .where(eq(playerAchievements.playerId, playerId));
    return rows.map((r) => r.achievementId);
  }

  /** Unlock an achievement for a player (idempotent) */
  async unlockAchievement(playerId: string, achievementId: string): Promise<boolean> {
    // Check if already unlocked
    const existing = await db
      .select({ id: playerAchievements.id })
      .from(playerAchievements)
      .where(eq(playerAchievements.playerId, playerId))
      .limit(1);

    const alreadyUnlocked = existing.some(
      () => false, // placeholder — we need a compound where
    );

    // Use a simple insert that ignores conflicts
    try {
      await db.insert(playerAchievements).values({
        playerId,
        achievementId,
      });
      return true; // newly unlocked
    } catch {
      return false; // already exists or error
    }
  }

  /** Get player progression stats */
  async getPlayerStats(playerId: string) {
    const rows = await db
      .select({
        xp: players.xp,
        level: players.level,
        totalGathered: players.totalGathered,
        totalCrafted: players.totalCrafted,
        totalKillsNpc: players.totalKillsNpc,
        totalKillsPvp: players.totalKillsPvp,
        totalBuildings: players.totalBuildings,
        totalDeaths: players.totalDeaths,
        biomesVisited: players.biomesVisited,
        journalsFound: players.journalsFound,
        tutorialStep: players.tutorialStep,
        totalPlaytimeSeconds: players.totalPlaytimeSeconds,
        totalKills: players.totalKills,
        customization: players.customization,
        username: players.username,
        totalEaten: players.totalEaten,
        totalChats: players.totalChats,
        teamsJoined: players.teamsJoined,
        totalDrops: players.totalDrops,
        nightsSurvived: players.nightsSurvived,
        bloodMoonsSurvived: players.bloodMoonsSurvived,
        biomesVisitedSet: players.biomesVisitedSet,
        generation: players.generation,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Update XP and level for a player */
  async updateXpAndLevel(playerId: string, xp: number, level: number): Promise<void> {
    await db.update(players).set({ xp, level }).where(eq(players.id, playerId));
  }

  /** Increment a specific stat counter */
  async incrementStat(
    playerId: string,
    stat: keyof typeof players.$inferSelect,
    amount: number,
  ): Promise<void> {
    const current = await db
      .select({ value: players[stat] })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (current[0]) {
      const newValue = (current[0].value as number) + amount;
      await db
        .update(players)
        .set({ [stat]: newValue })
        .where(eq(players.id, playerId));
    }
  }

  /** Update tutorial step */
  async updateTutorialStep(playerId: string, step: string): Promise<void> {
    await db.update(players).set({ tutorialStep: step }).where(eq(players.id, playerId));
  }

  /** Update customization */
  async updateCustomization(
    playerId: string,
    customization: Record<string, unknown>,
  ): Promise<void> {
    await db.update(players).set({ customization }).where(eq(players.id, playerId));
  }

  /** Update biomes visited set and count */
  async updateBiomesVisited(playerId: string, biomesSet: string[], count: number): Promise<void> {
    await db
      .update(players)
      .set({ biomesVisitedSet: biomesSet, biomesVisited: count })
      .where(eq(players.id, playerId));
  }

  /** Get leaderboard data sorted by a stat */
  async getLeaderboard(
    sortBy: 'totalKills' | 'totalPlaytimeSeconds' | 'level' | 'totalBuildings',
    limit: number = 25,
  ) {
    const rows = await db
      .select({
        username: players.username,
        level: players.level,
        xp: players.xp,
        totalKills: players.totalKills,
        totalDeaths: players.totalDeaths,
        totalPlaytimeSeconds: players.totalPlaytimeSeconds,
        totalBuildings: players.totalBuildings,
        totalGathered: players.totalGathered,
        totalCrafted: players.totalCrafted,
      })
      .from(players)
      .orderBy(players[sortBy])
      .limit(limit);

    // Sort descending (drizzle orderBy defaults to ASC)
    return rows.reverse();
  }

  /** Get full player profile by username */
  async getPlayerProfile(username: string) {
    const rows = await db
      .select({
        id: players.id,
        username: players.username,
        level: players.level,
        xp: players.xp,
        totalKills: players.totalKills,
        totalDeaths: players.totalDeaths,
        totalPlaytimeSeconds: players.totalPlaytimeSeconds,
        totalGathered: players.totalGathered,
        totalCrafted: players.totalCrafted,
        totalBuildings: players.totalBuildings,
        biomesVisited: players.biomesVisited,
        journalsFound: players.journalsFound,
        customization: players.customization,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (!rows[0]) return null;

    const achievements = await this.getPlayerAchievements(rows[0].id);
    return { ...rows[0], achievements };
  }
}

export const achievementRepository = new AchievementRepository();
