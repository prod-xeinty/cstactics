// Схема D1 (Drizzle). Остальные таблицы (тактики, голоса, FACEIT и т.д.) — задача #11,
// см. docs/superpowers/specs/2026-10-19-cloudflare-architecture-design.md, раздел 5.
// Время храним текстом в ISO 8601 (UTC): строки так же сравниваются по порядку.
import { sql } from "drizzle-orm";
import { sqliteTable, text, index, check } from "drizzle-orm/sqlite-core";

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
