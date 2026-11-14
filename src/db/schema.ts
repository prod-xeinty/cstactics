// Схема D1 (Drizzle), см. архитектурную спецификацию, раздел 5.
// Время храним текстом в ISO 8601 (UTC): строки так же сравниваются по порядку.
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, check } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
  id: text("id").primaryKey(),
  steamId64: text("steam_id64").notNull().unique(),
  nickname: text("nickname").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["user", "moderator", "admin"] }).notNull().default("user"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  },
  (t) => [check("users_role_check", sql`${t.role} IN ('user', 'moderator', 'admin')`)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // В cookie лежит сам токен, здесь — только его SHA-256.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId), index("sessions_expires_at_idx").on(t.expiresAt)],
);

// Одноразовые response_nonce от Steam: защита от повторной отправки одного и того же ответа.
export const openidNonces = sqliteTable("openid_nonces", {
  nonce: text("nonce").primaryKey(),
  expiresAt: text("expires_at").notNull(),
});

export const faceitProfiles = sqliteTable("faceit_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  faceitId: text("faceit_id"),
  level: integer("level"),
  elo: integer("elo"),
  band: text("band", { enum: ["low", "mid", "high", "none"] }).notNull().default("none"),
  status: text("status", { enum: ["pending", "ready", "not_found", "error"] }).notNull().default("pending"),
  checkedAt: text("checked_at"),
  nextCheckAt: text("next_check_at"),
}, (t) => [check("faceit_band_check", sql`${t.band} IN ('low','mid','high','none')`), check("faceit_level_check", sql`${t.level} IS NULL OR ${t.level} BETWEEN 1 AND 10`)]);

export const tactics = sqliteTable("tactics", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  map: text("map", { enum: ["dust2"] }).notNull(),
  side: text("side", { enum: ["T", "CT"] }).notNull(),
  teamSize: integer("team_size").notNull(),
  economy: text("economy", { enum: ["eco", "force", "full", "any"] }).notNull(),
  difficulty: integer("difficulty").notNull(),
  spawnDependent: integer("spawn_dependent", { mode: "boolean" }).notNull().default(false),
  content: text("content", { mode: "json" }).notNull(),
  gameVersion: text("game_version").notNull(),
  source: text("source", { enum: ["authors", "player"] }).notNull(),
  authorId: text("author_id").notNull().references(() => users.id),
  status: text("status", { enum: ["draft", "pending", "published", "rejected"] }).notNull().default("draft"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("tactics_catalog_idx").on(t.map, t.status, t.side, t.teamSize),
  index("tactics_author_idx").on(t.authorId),
  check("tactics_team_size_check", sql`${t.teamSize} BETWEEN 2 AND 5`),
  check("tactics_difficulty_check", sql`${t.difficulty} BETWEEN 1 AND 3`),
  check("tactics_status_check", sql`${t.status} IN ('draft','pending','published','rejected')`),
]);

export const clutches = sqliteTable("clutches", {
  id: text("id").primaryKey(),
  map: text("map", { enum: ["dust2"] }).notNull(),
  side: text("side", { enum: ["T", "CT"] }).notNull(),
  enemies: integer("enemies").notNull(),
  bomb: text("bomb", { enum: ["none", "A", "B"] }).notNull(),
  content: text("content", { mode: "json" }).notNull(),
}, (t) => [check("clutches_enemies_check", sql`${t.enemies} BETWEEN 1 AND 5`)]);

export const votes = sqliteTable("votes", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tacticId: text("tactic_id").notNull().references(() => tactics.id, { onDelete: "cascade" }),
  band: text("band", { enum: ["low", "mid", "high", "none"] }).notNull(),
  works: integer("works").notNull(),
  easy: integer("easy").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.tacticId] }), index("votes_tactic_band_idx").on(t.tacticId, t.band), check("votes_works_check", sql`${t.works} BETWEEN 1 AND 5`), check("votes_easy_check", sql`${t.easy} BETWEEN 1 AND 5`)]);

export const ratingStats = sqliteTable("rating_stats", {
  tacticId: text("tactic_id").notNull().references(() => tactics.id, { onDelete: "cascade" }),
  band: text("band", { enum: ["low", "mid", "high", "none"] }).notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  worksSum: integer("works_sum").notNull().default(0),
  easySum: integer("easy_sum").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.tacticId, t.band] })]);

export const gamePatches = sqliteTable("game_patches", {
  id: text("id").primaryKey(),
  version: text("version").notNull().unique(),
  releasedAt: text("released_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const tacticMedia = sqliteTable("tactic_media", {
  id: text("id").primaryKey(),
  tacticId: text("tactic_id").notNull().references(() => tactics.id, { onDelete: "cascade" }),
  privateObjectKey: text("private_object_key"),
  publicObjectKey: text("public_object_key"),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum").notNull(),
  status: text("status", { enum: ["uploading", "uploaded", "verified", "published", "rejected", "failed"] }).notNull(),
  createdAt: text("created_at").notNull(),
  verifiedAt: text("verified_at"),
}, (t) => [uniqueIndex("tactic_media_private_key_idx").on(t.privateObjectKey), uniqueIndex("tactic_media_public_key_idx").on(t.publicObjectKey)]);

export const moderationEvents = sqliteTable("moderation_events", {
  id: text("id").primaryKey(),
  tacticId: text("tactic_id").notNull().references(() => tactics.id),
  moderatorId: text("moderator_id").notNull().references(() => users.id),
  action: text("action", { enum: ["published", "rejected"] }).notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
}, (t) => [index("moderation_events_tactic_idx").on(t.tacticId)]);
