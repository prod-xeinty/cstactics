import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { csrfTokenFor } from "@/security/csrf";

export const dynamic = "force-dynamic";

// Кто я. Steam ID и производный CSRF-токен отдаём только самому игроку; токен сессии — никогда.
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie");
  const session = await getCurrentSession(cookie);
  const user = session
    ? {
        steamId64: session.user.steam_id64,
        nickname: session.user.nickname,
        avatarUrl: session.user.avatar_url,
        role: session.user.role,
      }
    : null;
  const sessionToken = session ? readCookie(cookie, SESSION_COOKIE) : undefined;
  const csrfToken = sessionToken ? await csrfTokenFor(sessionToken) : null;
  return Response.json({ user, csrfToken }, { headers: { "Cache-Control": "no-store" } });
}
