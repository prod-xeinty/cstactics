import { getPlatform } from "@/platform";
import { findSession, readCookie, SESSION_COOKIE, type CurrentSession } from "./session";

/** Текущий игрок по cookie из заголовка запроса. Нет сессии или нет базы (обычный next dev) — null. */
export async function getCurrentSession(cookieHeader: string | null): Promise<CurrentSession | null> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  try {
    const platform = await getPlatform();
    return await findSession(platform.db, token, new Date());
  } catch {
    return null;
  }
}
