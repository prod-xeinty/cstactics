import { getPlatform } from "@/platform";
import { buildSteamLoginUrl } from "@/auth/steam-openid";
import { randomToken } from "@/auth/crypto";
import { serializeCookie, STATE_COOKIE, STATE_TTL_S } from "@/auth/session";
import { turnstileConfig } from "@/auth/login-config";
import { isSameOrigin } from "@/security/csrf";
import { clientIp } from "@/security/client-ip";
import { enforceRateLimit } from "@/security/rate-limit";
import { TURNSTILE_FIELD, verifyTurnstile } from "@/security/turnstile";

export const dynamic = "force-dynamic";

function redirect(to: string, cookie?: string): Response {
  const headers = new Headers({ Location: to, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

// Старые ссылки «Войти через Steam» ведут сюда GET-ом — отправляем на страницу входа с капчей.
export async function GET() {
  return redirect("/login");
}

// Шаг 1: форма со страницы /login. Проверяем, что форма наша, лимит по IP и капчу, потом — в Steam.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const platform = await getPlatform();
  const ip = clientIp(request);
  const limited = await enforceRateLimit(platform.rateLimiter, "loginStart", ip);
  if (limited) return limited;

  const url = new URL(request.url);
  const turnstile = turnstileConfig(platform);
  if (turnstile.mode === "misconfigured") {
    console.error("Turnstile: задан TURNSTILE_SITE_KEY, но нет секрета TURNSTILE_SECRET_KEY — вход закрыт");
    return redirect("/login?error=unavailable");
  }
  if (turnstile.mode === "on") {
    // Битое тело или не форма — считаем, что токена нет (а не 500).
    const token = await request
      .formData()
      .then((f) => f.get(TURNSTILE_FIELD))
      .catch(() => null);
    const check = await verifyTurnstile({
      secret: turnstile.secret,
      token: typeof token === "string" ? token : null,
      ip,
      expectedHostname: url.hostname,
      expectedAction: "login",
      fetch,
    });
    if (!check.ok) {
      console.warn("Turnstile не пройден:", check.reason);
      return redirect("/login?error=captcha");
    }
  }

  const state = randomToken(16);
  const returnTo = `${url.origin}/api/auth/steam/callback?state=${state}`;
  return redirect(buildSteamLoginUrl(returnTo, url.origin), serializeCookie(STATE_COOKIE, state, STATE_TTL_S));
}
