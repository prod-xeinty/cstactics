import { getPlatform } from "@/platform";
import { timingSafeEqual } from "@/auth/crypto";
import { verifySteamResponse } from "@/auth/steam-openid";
import { fetchSteamProfile } from "@/auth/steam-profile";
import {
  claimNonce,
  clearCookie,
  createSession,
  deleteSession,
  readCookie,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  STATE_COOKIE,
} from "@/auth/session";
import { upsertSteamUser } from "@/users/repository";
import { clientIp } from "@/security/client-ip";
import { enforceRateLimit } from "@/security/rate-limit";

export const dynamic = "force-dynamic";

function redirect(to: string, cookies: string[]): Response {
  const headers = new Headers({ Location: to, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}

// Шаг 2: Steam вернул игрока. Проверяем state, подпись у Steam, одноразовость nonce, потом создаём сессию.
// Любая внутренняя ошибка (например, не применена миграция) → «не вышло зайти», а не 500; причина — в логе.
export async function GET(request: Request) {
  try {
    return await handleCallback(request);
  } catch (err) {
    console.error("steam login error:", err instanceof Error ? err.message : String(err));
    return redirect("/?login=failed", [clearCookie(STATE_COOKIE)]);
  }
}

async function handleCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const cookieHeader = request.headers.get("cookie");
  const fail = (reason: string) => {
    // В лог только причина, без параметров запроса.
    console.warn("steam login failed:", reason);
    return redirect("/?login=failed", [clearCookie(STATE_COOKIE)]);
  };

  const platform = await getPlatform();
  const limited = await enforceRateLimit(platform.rateLimiter, "loginCallback", clientIp(request));
  if (limited) return limited;

  const cookieState = readCookie(cookieHeader, STATE_COOKIE);
  const queryState = url.searchParams.get("state");
  if (!cookieState || !queryState || !timingSafeEqual(cookieState, queryState)) return fail("bad_state");

  const now = new Date();
  const result = await verifySteamResponse(url.searchParams, {
    expectedReturnTo: `${origin}/api/auth/steam/callback?state=${cookieState}`,
    now,
    fetch,
    claimNonce: (nonce, expiresAt) => claimNonce(platform.db, nonce, expiresAt, now),
  });
  if (!result.ok) return fail(result.reason);

  const profile = await fetchSteamProfile(result.steamId64, { apiKey: platform.secret("STEAM_API_KEY"), fetch });
  const user = await upsertSteamUser(platform.db, { steamId64: result.steamId64, ...profile }, now);

  // Против фиксации сессии: старую (если была) удаляем, выдаём новую.
  const oldToken = readCookie(cookieHeader, SESSION_COOKIE);
  if (oldToken) await deleteSession(platform.db, oldToken);
  const token = await createSession(platform.db, user.id, now);

  return redirect("/", [serializeCookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000), clearCookie(STATE_COOKIE)]);
}
