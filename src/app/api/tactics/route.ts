import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { getPlatform } from "@/platform";
import { isSameOrigin, isValidCsrfToken } from "@/security/csrf";
import { enforceRateLimit } from "@/security/rate-limit";
import { submissionSchema } from "@/tactics/submission";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Запрос с другого сайта" }, 403);
  const session = await getCurrentSession(request.headers.get("cookie"));
  if (!session) return json({ error: "Нужно войти через Steam" }, 401);
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!(await isValidCsrfToken(token, request.headers.get("x-csrf-token")))) return json({ error: "Проверка запроса не прошла" }, 403);
  const platform = await getPlatform();
  const limited = await enforceRateLimit(platform.rateLimiter, "tacticSubmit", session.user.id);
  if (limited) return limited;
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return json({ error: "Нужна форма" }, 415);
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > 11 * 1024 * 1024) return json({ error: "Видео должно быть до 10 МБ" }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "Не удалось прочитать форму" }, 400); }
  const file = form.get("video");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024 || !["video/mp4", "video/webm"].includes(file.type)) return json({ error: "Видео: только mp4 или webm до 10 МБ" }, 400);
    return json({ error: "Видео пока не прикрепляем. Отправь тактику без файла — загрузку добавим позже." }, 503);
  }
  const raw = form.get("payload");
  if (typeof raw !== "string" || raw.length > 30_000) return json({ error: "Проверь поля анкеты" }, 400);
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return json({ error: "Проверь поля анкеты" }, 400); }
  const parsed = submissionSchema.safeParse(data);
  if (!parsed.success) return json({ error: "Проверь обязательные поля и количество строк" }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await platform.db.run(
    `INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, spawn_dependent, content, game_version, source, author_id, status, featured, created_at, updated_at)
     VALUES (?, ?, 'dust2', ?, ?, ?, ?, ?, ?, ?, 'player', ?, 'pending', 0, ?, ?)`,
    [id, `player-${id}`, parsed.data.side, parsed.data.teamSize, parsed.data.economy, parsed.data.difficulty, parsed.data.spawnDependent ? 1 : 0, JSON.stringify(parsed.data), parsed.data.gameVersion, session.user.id, now, now],
  );
  return json({ id, status: "pending" }, 201);
}
