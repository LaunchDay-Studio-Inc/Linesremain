// ─── Database Schema ───

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Custom Types ───

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ═══════════════════════════════════════
// PLAYERS
// ═══════════════════════════════════════

export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 32 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastLogin: timestamp('last_login', { withTimezone: true }),
    totalPlaytimeSeconds: integer('total_playtime_seconds').default(0).notNull(),
    totalKills: integer('total_kills').default(0).notNull(),
    totalDeaths: integer('total_deaths').default(0).notNull(),
    customization: jsonb('customization').default({}).notNull(),
    learnedBlueprints: jsonb('learned_blueprints').default([]).notNull(),
    // Progression fields
    xp: integer('xp').default(0).notNull(),
    level: integer('level').default(1).notNull(),
    totalGathered: integer('total_gathered').default(0).notNull(),
    totalCrafted: integer('total_crafted').default(0).notNull(),
    totalKillsNpc: integer('total_kills_npc').default(0).notNull(),
    totalKillsPvp: integer('total_kills_pvp').default(0).notNull(),
    totalBuildings: integer('total_buildings').default(0).notNull(),
    biomesVisited: integer('biomes_visited').default(0).notNull(),
    journalsFound: integer('journals_found').default(0).notNull(),
    tutorialStep: varchar('tutorial_step', { length: 16 }).default('move').notNull(),
    // Extended stat tracking
    totalEaten: integer('total_eaten').default(0).notNull(),
    totalChats: integer('total_chats').default(0).notNull(),
    teamsJoined: integer('teams_joined').default(0).notNull(),
    totalDrops: integer('total_drops').default(0).notNull(),
    nightsSurvived: integer('nights_survived').default(0).notNull(),
    bloodMoonsSurvived: integer('blood_moons_survived').default(0).notNull(),
    biomesVisitedSet: jsonb('biomes_visited_set').default([]).notNull(),
  },
  (table) => ({
    emailIdx: index('players_email_idx').on(table.email),
    usernameIdx: index('players_username_idx').on(table.username),
  }),
);

export const playersRelations = relations(players, ({ one, many }) => ({
  state: one(playerStates, {
    fields: [players.id],
    references: [playerStates.playerId],
  }),
  refreshTokens: many(refreshTokens),
  buildings: many(buildings),
  clanMemberships: many(clanMembers),
  achievements: many(playerAchievements),
}));

export type Player = InferSelectModel<typeof players>;
export type NewPlayer = InferInsertModel<typeof players>;

// ═══════════════════════════════════════
// PLAYER ACHIEVEMENTS
// ═══════════════════════════════════════

export const playerAchievements = pgTable(
  'player_achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    achievementId: varchar('achievement_id', { length: 64 }).notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playerIdx: index('player_achievements_player_idx').on(table.playerId),
    uniqueAchievement: index('player_achievements_unique_idx').on(
      table.playerId,
      table.achievementId,
    ),
  }),
);

export const playerAchievementsRelations = relations(playerAchievements, ({ one }) => ({
  player: one(players, {
    fields: [playerAchievements.playerId],
    references: [players.id],
  }),
}));

export type PlayerAchievement = InferSelectModel<typeof playerAchievements>;
export type NewPlayerAchievement = InferInsertModel<typeof playerAchievements>;

// ═══════════════════════════════════════
// PLAYER STATES
// ═══════════════════════════════════════

export const playerStates = pgTable('player_states', {
  playerId: uuid('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),
  positionX: real('position_x').default(0).notNull(),
  positionY: real('position_y').default(0).notNull(),
  positionZ: real('position_z').default(0).notNull(),
  health: real('health').default(100).notNull(),
  hunger: real('hunger').default(500).notNull(),
  thirst: real('thirst').default(250).notNull(),
  inventory: jsonb('inventory').default([]).notNull(),
  equipment: jsonb('equipment').default({}).notNull(),
  hotbar: jsonb('hotbar').default([]).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const playerStatesRelations = relations(playerStates, ({ one }) => ({
  player: one(players, {
    fields: [playerStates.playerId],
    references: [players.id],
  }),
}));

export type PlayerState = InferSelectModel<typeof playerStates>;
export type NewPlayerState = InferInsertModel<typeof playerStates>;

// ═══════════════════════════════════════
// CLANS
// ═══════════════════════════════════════

export const clans = pgTable(
  'clans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 32 }).notNull().unique(),
    leaderId: uuid('leader_id')
      .notNull()
      .references(() => players.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('clans_name_idx').on(table.name),
  }),
);

export const clansRelations = relations(clans, ({ one, many }) => ({
  leader: one(players, {
    fields: [clans.leaderId],
    references: [players.id],
  }),
  members: many(clanMembers),
  buildings: many(buildings),
}));

export type Clan = InferSelectModel<typeof clans>;
export type NewClan = InferInsertModel<typeof clans>;

// ═══════════════════════════════════════
// CLAN MEMBERS
// ═══════════════════════════════════════

export const clanMembers = pgTable(
  'clan_members',
  {
    clanId: uuid('clan_id')
      .notNull()
      .references(() => clans.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(), // 'leader', 'officer', 'member'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clanId, table.playerId] }),
    playerIdx: index('clan_members_player_idx').on(table.playerId),
  }),
);

export const clanMembersRelations = relations(clanMembers, ({ one }) => ({
  clan: one(clans, {
    fields: [clanMembers.clanId],
    references: [clans.id],
  }),
  player: one(players, {
    fields: [clanMembers.playerId],
    references: [players.id],
  }),
}));

export type ClanMember = InferSelectModel<typeof clanMembers>;
export type NewClanMember = InferInsertModel<typeof clanMembers>;

// ═══════════════════════════════════════
// WORLD CHUNKS
// ═══════════════════════════════════════

export const worldChunks = pgTable(
  'world_chunks',
  {
    chunkX: integer('chunk_x').notNull(),
    chunkZ: integer('chunk_z').notNull(),
    blockData: bytea('block_data').notNull(),
    modifiedAt: timestamp('modified_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chunkX, table.chunkZ] }),
  }),
);

export type WorldChunk = InferSelectModel<typeof worldChunks>;
export type NewWorldChunk = InferInsertModel<typeof worldChunks>;

// ═══════════════════════════════════════
// BUILDINGS
// ═══════════════════════════════════════

export const buildings = pgTable(
  'buildings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id),
    clanId: uuid('clan_id').references(() => clans.id),
    buildingType: varchar('building_type', { length: 32 }).notNull(),
    tier: integer('tier').default(0).notNull(),
    positionX: real('position_x').notNull(),
    positionY: real('position_y').notNull(),
    positionZ: real('position_z').notNull(),
    rotation: real('rotation').default(0).notNull(),
    health: real('health').notNull(),
    placedAt: timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
    lockCode: varchar('lock_code', { length: 8 }),
  },
  (table) => ({
    ownerIdx: index('buildings_owner_idx').on(table.ownerId),
    clanIdx: index('buildings_clan_idx').on(table.clanId),
    positionIdx: index('buildings_position_idx').on(table.positionX, table.positionZ),
  }),
);

export const buildingsRelations = relations(buildings, ({ one }) => ({
  owner: one(players, {
    fields: [buildings.ownerId],
    references: [players.id],
  }),
  clan: one(clans, {
    fields: [buildings.clanId],
    references: [clans.id],
  }),
  toolCupboard: one(toolCupboards, {
    fields: [buildings.id],
    references: [toolCupboards.buildingId],
  }),
}));

export type Building = InferSelectModel<typeof buildings>;
export type NewBuilding = InferInsertModel<typeof buildings>;

// ═══════════════════════════════════════
// TOOL CUPBOARDS
// ═══════════════════════════════════════

export const toolCupboards = pgTable('tool_cupboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  authorizedPlayers: jsonb('authorized_players').default([]).notNull(),
  radius: real('radius').default(32).notNull(),
});

export const toolCupboardsRelations = relations(toolCupboards, ({ one }) => ({
  building: one(buildings, {
    fields: [toolCupboards.buildingId],
    references: [buildings.id],
  }),
}));

export type ToolCupboard = InferSelectModel<typeof toolCupboards>;
export type NewToolCupboard = InferInsertModel<typeof toolCupboards>;

// ═══════════════════════════════════════
// REFRESH TOKENS
// ═══════════════════════════════════════

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playerIdx: index('refresh_tokens_player_idx').on(table.playerId),
  }),
);

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  player: one(players, {
    fields: [refreshTokens.playerId],
    references: [players.id],
  }),
}));

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;

// ═══════════════════════════════════════
// SEASONS
// ═══════════════════════════════════════

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonNumber: integer('season_number').notNull().unique(),
  worldSeed: integer('world_seed').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  leaderboardSnapshot: jsonb('leaderboard_snapshot').default({}).notNull(),
});

export type Season = InferSelectModel<typeof seasons>;
export type NewSeason = InferInsertModel<typeof seasons>;

// ═══════════════════════════════════════
// CONTAINER ITEMS
// ═══════════════════════════════════════

export const containerItems = pgTable(
  'container_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'cascade' }),
    slotIndex: integer('slot_index').notNull(),
    itemId: integer('item_id').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => ({
    buildingIdx: index('container_items_building_idx').on(table.buildingId),
    uniqueSlot: index('container_items_unique_slot_idx').on(table.buildingId, table.slotIndex),
  }),
);

export type ContainerItem = InferSelectModel<typeof containerItems>;
export type NewContainerItem = InferInsertModel<typeof containerItems>;

// ═══════════════════════════════════════
// STORE ITEMS
// ═══════════════════════════════════════

export const storeItems = pgTable('store_items', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 32 }).notNull(),
  priceCents: integer('price_cents').notNull(),
  previewData: jsonb('preview_data'),
  releasedAt: timestamp('released_at', { withTimezone: true }).defaultNow(),
  isActive: boolean('is_active').default(true),
});

export type StoreItem = InferSelectModel<typeof storeItems>;
export type NewStoreItem = InferInsertModel<typeof storeItems>;

// ═══════════════════════════════════════
// PLAYER PURCHASES
// ═══════════════════════════════════════

export const playerPurchases = pgTable('player_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }),
  storeItemId: varchar('store_item_id', { length: 64 }).references(() => storeItems.id),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow(),
  pricePaidCents: integer('price_paid_cents').notNull(),
  transactionId: varchar('transaction_id', { length: 255 }),
});

export type PlayerPurchase = InferSelectModel<typeof playerPurchases>;
export type NewPlayerPurchase = InferInsertModel<typeof playerPurchases>;

// ═══════════════════════════════════════
// BATTLE PASSES
// ═══════════════════════════════════════

export const battlePasses = pgTable('battle_passes', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }),
  season: integer('season').notNull(),
  tier: integer('tier').default(0),
  xpInTier: integer('xp_in_tier').default(0),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow(),
});

export type BattlePass = InferSelectModel<typeof battlePasses>;
export type NewBattlePass = InferInsertModel<typeof battlePasses>;
