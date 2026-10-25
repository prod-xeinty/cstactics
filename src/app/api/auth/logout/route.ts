import { getPlatform } from "@/platform";
import { clearCookie, deleteSession, readCookie, SESSION_COOKIE } from "@/auth/session";
import { isSameOrigin, isValidCsrfToken, submittedCsrfToken } from "@/security/csrf";
import { clientIp } from "@/security/client-ip";
import { enforceRateLimit } from "@/security/rate-limit";

export const dynamic = "force-dynamic";

// Выход — только POST, только со своего сайта и с CSRF-токеном.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const platform = await getPlatform();
  const limited = await enforceRateLimit(platform.rateLimiter, "logout", clientIp(request));
  if (limited) return limited;

  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  if (!token) return new Response(null, { status: 303, headers });

  if (!(await isValidCsrfToken(token, await submittedCsrfToken(request)))) {
    return new Response("Forbidden", { status: 403 });
  }
  await deleteSession(platform.db, token);
  return new Response(null, { status: 303, headers });
}
