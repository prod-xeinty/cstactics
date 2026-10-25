import { getPlatform } from "@/platform";
import { findSession, readCookie, SESSION_COOKIE, type CurrentSession } from "./session";
import { log } from "@/observability/log";

/** Текущий игрок по cookie из заголовка запроса. Нет сессии или нет базы (обычный next dev) — null. */
export async function getCurrentSession(cookieHeader: string | null): Promise<CurrentSession | null> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  let platform;
  try {
    platform = await getPlatform();
  } catch {
    return null; // обычный next dev без Cloudflare
  }
  try {
    return await findSession(platform.db, token, new Date());
  } catch (err) {
    // Игрок увидит «не вошёл», но мы должны узнать, что база не отвечает (например, не применена миграция).
    log.error("session_lookup_failed", { error: err });
    return null;
  }
}
