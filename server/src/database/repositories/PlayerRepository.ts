// ─── Player Repository ───

import type { AncestorRecord } from '@lineremain/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../connection.js';
import type { NewPlayerState, Player, PlayerState } from '../schema.js';
import { players, playerStates } from '../schema.js';

export class PlayerRepository {
  /**
   * Create a new player account.
   */
  async createPlayer(username: string, email: string, passwordHash: string): Promise<Player> {
    const [player] = await db.insert(players).values({ username, email, passwordHash }).returning();

    if (!player) {
      throw new Error('Failed to create player');
    }

    return player;
  }

  /**
   * Find a player by email address.
   */
  async findByEmail(email: string): Promise<Player | null> {
    const [player] = await db.select().from(players).where(eq(players.email, email)).limit(1);

    return player ?? null;
  }

  /**
   * Find a player by username.
   */
  async findByUsername(username: string): Promise<Player | null> {
    const [player] = await db.select().from(players).where(eq(players.username, username)).limit(1);

    return player ?? null;
  }

  /**
   * Find a player by UUID.
   */
  async findById(id: string): Promise<Player | null> {
    const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);

    return player ?? null;
  }

  /**
   * Update the last login timestamp.
   */
  async updateLastLogin(id: string): Promise<void> {
    await db.update(players).set({ lastLogin: new Date() }).where(eq(players.id, id));
  }

  /**
   * Update player statistics (playtime, kills, deaths).
   */
  async updateStats(
    id: string,
    stats: {
      totalPlaytimeSeconds?: number;
      totalKills?: number;
      totalDeaths?: number;
    },
  ): Promise<void> {
    const updates: Record<string, unknown> = {};

    if (stats.totalPlaytimeSeconds !== undefined) {
      updates['totalPlaytimeSeconds'] = stats.totalPlaytimeSeconds;
    }
    if (stats.totalKills !== undefined) {
      updates['totalKills'] = stats.totalKills;
    }
    if (stats.totalDeaths !== undefined) {
      updates['totalDeaths'] = stats.totalDeaths;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(players).set(updates).where(eq(players.id, id));
    }
  }

  /**
   * Save (upsert) a player's in-game state.
   */
  async savePlayerState(playerId: string, state: Omit<NewPlayerState, 'playerId'>): Promise<void> {
    await db
      .insert(playerStates)
      .values({ playerId, ...state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: playerStates.playerId,
        set: { ...state, updatedAt: new Date() },
      });
  }

  /**
   * Load a player's saved in-game state.
   */
  async loadPlayerState(playerId: string): Promise<PlayerState | null> {
    const [state] = await db
      .select()
      .from(playerStates)
      .where(eq(playerStates.playerId, playerId))
      .limit(1);

    return state ?? null;
  }

  /**
   * Update player customization (body color, head accessory, etc.).
   */
  async updateCustomization(
    playerId: string,
    customization: Record<string, unknown>,
  ): Promise<void> {
    await db.update(players).set({ customization }).where(eq(players.id, playerId));
  }

  /**
   * Add a learned blueprint (recipe ID) to the player's learned list.
   */
  async addLearnedBlueprint(playerId: string, recipeId: number): Promise<void> {
    await db
      .update(players)
      .set({
        learnedBlueprints: sql`(
          SELECT jsonb_agg(DISTINCT val)
          FROM (
            SELECT jsonb_array_elements(${players.learnedBlueprints}) AS val
            UNION
            SELECT to_jsonb(${recipeId}::int)
          ) sub
        )`,
      })
      .where(eq(players.id, playerId));
  }

  /**
   * Get lineage data for a player.
   */
  async getLineage(
    playerId: string,
  ): Promise<{ generation: number; ancestors: AncestorRecord[] } | null> {
    const [player] = await db
      .select({
        generation: players.generation,
        ancestors: players.ancestors,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) return null;

    return {
      generation: player.generation,
      ancestors: (player.ancestors ?? []) as AncestorRecord[],
    };
  }

  /**
   * Advance a player's generation (line death).
   * Sets XP to inherited amount, increments generation, prepends ancestor record (max 5).
   */
  async advanceGeneration(
    playerId: string,
    newGeneration: number,
    inheritedXP: number,
    ancestorRecord: AncestorRecord,
  ): Promise<void> {
    // Load current ancestors to prepend
    const current = await this.getLineage(playerId);
    const ancestors = current?.ancestors ?? [];
    ancestors.unshift(ancestorRecord);
    // Keep only last 5 ancestors
    if (ancestors.length > 5) ancestors.length = 5;

    await db
      .update(players)
      .set({
        generation: newGeneration,
        xp: inheritedXP,
        ancestors: ancestors as unknown as Record<string, unknown>,
        lineageStartedAt: new Date(),
      })
      .where(eq(players.id, playerId));
  }
}

export const playerRepository = new PlayerRepository();
