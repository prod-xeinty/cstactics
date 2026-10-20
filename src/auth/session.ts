import type { Database } from "@/platform";
import type { UserRow } from "@/users/repository";
import { randomToken, sha256Hex } from "./crypto";

// __Host-: только HTTPS, только наш домен, Path=/. Браузеры разрешают Secure и на http://localhost.
export const SESSION_COOKIE = "__Host-session";
export const STATE_COOKIE = "__Host-steam_state";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STATE_TTL_S = 10 * 60;
// last_seen_at обновляем не чаще раза в час: у D1 на бесплатном тарифе лимит на записи.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface CurrentSession {
  sessionId: string;
  user: Pick<UserRow, "id" | "steam_id64" | "nickname" | "avatar_url" | "role">;
}

export async function createSession(db: Database, userId: string, now: Date): Promise<string> {
  const token = randomToken(32);
  const ts = now.toISOString();
  await db.run(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), userId, await sha256Hex(token), new Date(now.getTime() + SESSION_TTL_MS).toISOString(), ts, ts],
  );
  return token;
}

export async function findSession(db: Database, token: string, now: Date): Promise<CurrentSession | null> {
  if (!token || token.length > 128) return null;
  const row = await db.first<{
    session_id: string;
    last_seen_at: string;
    id: string;
    steam_id64: string;
    nickname: string;
    avatar_url: string | null;
    role: UserRow["role"];
  }>(
    `SELECT s.id AS session_id, s.last_seen_at, u.id, u.steam_id64, u.nickname, u.avatar_url, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [await sha256Hex(token), now.toISOString()],
  );
  if (!row) return null;
  if (now.getTime() - Date.parse(row.last_seen_at) > TOUCH_INTERVAL_MS) {
    await db.run(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`, [now.toISOString(), row.session_id]);
  }
  const { session_id, last_seen_at: _seen, ...user } = row;
  return { sessionId: session_id, user };
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  if (!token) return;
  await db.run(`DELETE FROM sessions WHERE token_hash = ?`, [await sha256Hex(token)]);
}

/** Запомнить nonce Steam; заодно подчищаем просроченные. */
export async function claimNonce(db: Database, nonce: string, expiresAt: Date, now: Date): Promise<boolean> {
  await db.run(`DELETE FROM openid_nonces WHERE expires_at < ?`, [now.toISOString()]);
  const res = await db.run(`INSERT OR IGNORE INTO openid_nonces (nonce, expires_at) VALUES (?, ?)`, [
    nonce,
    expiresAt.toISOString(),
  ]);
  return res.changes === 1;
}

// --- cookie ---

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", 0);
}
