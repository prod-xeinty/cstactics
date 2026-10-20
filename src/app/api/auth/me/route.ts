import { getCurrentSession } from "@/auth/current-user";

export const dynamic = "force-dynamic";

// Кто я. Steam ID отдаём только самому игроку, токены и id сессии — никогда.
export async function GET(request: Request) {
  const session = await getCurrentSession(request.headers.get("cookie"));
  const user = session
    ? {
        steamId64: session.user.steam_id64,
        nickname: session.user.nickname,
        avatarUrl: session.user.avatar_url,
        role: session.user.role,
      }
    : null;
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
