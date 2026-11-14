import { getCurrentSession } from "@/auth/current-user";
import { lookupFaceitProfile } from "@/faceit/client";
import { getPlatform } from "@/platform";
import { enforceRateLimit } from "@/security/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Уровень и эло — только для вошедшего игрока. Данные FACEIT в D1 не записываем.
export async function GET(request: Request): Promise<Response> {
  const session = await getCurrentSession(request.headers.get("cookie"));
  if (!session) return Response.json({ error: "Нужно войти через Steam" }, { status: 401, headers: NO_STORE });

  const platform = await getPlatform();
  const limited = await enforceRateLimit(platform.rateLimiter, "faceitProfile", session.user.id);
  if (limited) return limited;

  const profile = await lookupFaceitProfile(session.user.steam_id64, {
    apiKey: platform.secret("FACEIT_API_KEY"),
    fetch,
  });
  return Response.json(
    { profile, source: "FACEIT" },
    { status: profile.status === "unavailable" ? 503 : 200, headers: NO_STORE },
  );
}
