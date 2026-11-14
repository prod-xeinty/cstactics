import { z } from "zod";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { lookupFaceitProfile } from "@/faceit/client";
import { getPlatform } from "@/platform";
import { castVote, getRatings } from "@/ratings/repository";
import { isSameOrigin, isValidCsrfToken, submittedCsrfToken } from "@/security/csrf";
import { enforceRateLimit } from "@/security/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const voteSchema = z.object({ works: z.number().int().min(1).max(5), easy: z.number().int().min(1).max(5) }).strict();
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function publishedTactic(db: Awaited<ReturnType<typeof getPlatform>>["db"], id: string): Promise<boolean> {
  if (!id || id.length > 128) return false;
  return !!(await db.first("SELECT id FROM tactics WHERE id = ? AND status = 'published'", [id]));
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  const platform = await getPlatform();
  if (!(await publishedTactic(platform.db, id))) return json({ error: "Тактика не найдена" }, 404);
  return json({ ratings: await getRatings(platform.db, id) });
}

export async function POST(request: Request, context: Context): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Запрос с другого сайта" }, 403);
  const session = await getCurrentSession(request.headers.get("cookie"));
  if (!session) return json({ error: "Нужно войти через Steam" }, 401);
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!(await isValidCsrfToken(token, await submittedCsrfToken(request)))) {
    return json({ error: "Проверка запроса не прошла" }, 403);
  }

  const { id } = await context.params;
  const platform = await getPlatform();
  if (!(await publishedTactic(platform.db, id))) return json({ error: "Тактика не найдена" }, 404);

  const limited = await enforceRateLimit(platform.rateLimiter, "vote", session.user.id);
  if (limited) return limited;

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Нужны оценки от 1 до 5" }, 400);
  }
  const parsed = voteSchema.safeParse(data);
  if (!parsed.success) return json({ error: "Нужны оценки от 1 до 5" }, 400);

  const faceit = await lookupFaceitProfile(session.user.steam_id64, {
    apiKey: platform.secret("FACEIT_API_KEY"),
    fetch,
  });
  if (faceit.status === "unavailable") return json({ error: "FACEIT пока не отвечает. Голос не изменён." }, 503);

  await castVote(platform.db, {
    userId: session.user.id,
    tacticId: id,
    band: faceit.band,
    works: parsed.data.works,
    easy: parsed.data.easy,
  }, new Date());
  return json({ band: faceit.band, ratings: await getRatings(platform.db, id) });
}
