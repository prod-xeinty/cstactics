import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { upsertSteamUser } from "@/users/repository";
import { claimNonce, createSession, deleteSession, findSession, readCookie, serializeCookie, SESSION_TTL_MS } from "@/auth/session";
import { sha256Hex, timingSafeEqual } from "@/auth/crypto";
import { cleanAvatarUrl, cleanNickname } from "@/auth/steam-profile";

const NOW = new Date("2026-10-20T19:00:00Z");

async function userAndToken() {
  const db = createTestDb();
  const user = await upsertSteamUser(db, { steamId64: "76561198000000001", nickname: "s1mple-fan", avatarUrl: null }, NOW);
  const token = await createSession(db, user.id, NOW);
  return { db, user, token };
}

describe("сессии", () => {
  it("в базе лежит только хеш токена", async () => {
    const { db, token } = await userAndToken();
    const rows = await db.all<{ token_hash: string }>("SELECT token_hash FROM sessions");
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(await sha256Hex(token));
    expect(rows[0].token_hash).not.toContain(token);
  });

  it("находит игрока по токену", async () => {
    const { db, token } = await userAndToken();
    const s = await findSession(db, token, NOW);
    expect(s?.user.nickname).toBe("s1mple-fan");
    expect(s?.user.role).toBe("user");
  });

  it("не находит по чужому токену и после истечения срока", async () => {
    const { db, token } = await userAndToken();
    expect(await findSession(db, token + "x", NOW)).toBeNull();
    expect(await findSession(db, token, new Date(NOW.getTime() + SESSION_TTL_MS + 1))).toBeNull();
  });

  it("выход удаляет сессию", async () => {
    const { db, token } = await userAndToken();
    await deleteSession(db, token);
    expect(await findSession(db, token, NOW)).toBeNull();
  });

  it("повторный вход обновляет ник, но не роль", async () => {
    const { db, user } = await userAndToken();
    await db.run("UPDATE users SET role = 'moderator' WHERE id = ?", [user.id]);
    const again = await upsertSteamUser(db, { steamId64: "76561198000000001", nickname: "новый ник", avatarUrl: null }, NOW);
    expect(again.id).toBe(user.id);
    expect(again.nickname).toBe("новый ник");
    expect(again.role).toBe("moderator");
  });

  it("nonce принимается один раз", async () => {
    const db = createTestDb();
    const exp = new Date(NOW.getTime() + 5 * 60 * 1000);
    expect(await claimNonce(db, "2026-10-20T19:00:00Zabc", exp, NOW)).toBe(true);
    expect(await claimNonce(db, "2026-10-20T19:00:00Zabc", exp, NOW)).toBe(false);
  });
});

describe("cookie и мелочи", () => {
  it("cookie сессии: HttpOnly, Secure, SameSite=Lax", () => {
    const c = serializeCookie("__Host-session", "tok", 60);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
  });

  it("readCookie достаёт нужное значение", () => {
    expect(readCookie("a=1; __Host-session=xyz; b=2", "__Host-session")).toBe("xyz");
    expect(readCookie(null, "__Host-session")).toBeUndefined();
  });

  it("timingSafeEqual", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("ник чистится от управляющих символов и обрезается", () => {
    expect(cleanNickname("  ni\u0000ck‮  ", "id")).toBe("nick");
    expect(cleanNickname("", "id")).toBe("id");
    expect(cleanNickname("я".repeat(100), "id")).toHaveLength(64);
  });

  it("аватар — только https со Steam CDN", () => {
    expect(cleanAvatarUrl("https://avatars.steamstatic.com/abc_full.jpg")).toBe("https://avatars.steamstatic.com/abc_full.jpg");
    expect(cleanAvatarUrl("http://avatars.steamstatic.com/abc.jpg")).toBeNull();
    expect(cleanAvatarUrl("https://evil.test/a.jpg")).toBeNull();
    expect(cleanAvatarUrl("javascript:alert(1)")).toBeNull();
  });
});
