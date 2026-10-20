import { buildSteamLoginUrl } from "@/auth/steam-openid";
import { randomToken } from "@/auth/crypto";
import { serializeCookie, STATE_COOKIE, STATE_TTL_S } from "@/auth/session";

export const dynamic = "force-dynamic";

// Шаг 1: одноразовый state в cookie и в return_to, потом редирект в Steam.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const state = randomToken(16);
  const returnTo = `${origin}/api/auth/steam/callback?state=${state}`;

  const headers = new Headers({ Location: buildSteamLoginUrl(returnTo, origin), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", serializeCookie(STATE_COOKIE, state, STATE_TTL_S));
  return new Response(null, { status: 302, headers });
}
