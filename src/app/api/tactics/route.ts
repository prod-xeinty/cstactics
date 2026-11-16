import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { getPlatform } from "@/platform";
import { isSameOrigin, isValidCsrfToken } from "@/security/csrf";
import { enforceRateLimit } from "@/security/rate-limit";
import { readRequestBody, RequestBodyTooLargeError } from "@/security/request-body";
import { submissionSchema } from "@/tactics/submission";
import { inspectVideo, MAX_VIDEO_BYTES, privateVideoKey } from "@/tactics/video";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const MAX_FORM_BYTES = 11 * 1024 * 1024;

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
  if (Number.isFinite(size) && size > MAX_FORM_BYTES) return json({ error: "Видео должно быть до 10 МБ" }, 413);
  let form: FormData;
  try {
    const body = await readRequestBody(request, MAX_FORM_BYTES);
    form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type")! }, body }).formData();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: "Видео должно быть до 10 МБ" }, 413);
    return json({ error: "Не удалось прочитать форму" }, 400);
  }
  const file = form.get("video");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_VIDEO_BYTES || !["video/mp4", "video/webm"].includes(file.type)) return json({ error: "Видео: только mp4 или webm до 10 МБ" }, 400);
  }
  const raw = form.get("payload");
  if (typeof raw !== "string" || raw.length > 30_000) return json({ error: "Проверь поля анкеты" }, 400);
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return json({ error: "Проверь поля анкеты" }, 400); }
  const parsed = submissionSchema.safeParse(data);
  if (!parsed.success) return json({ error: "Проверь обязательные поля и количество строк" }, 400);
  const id = crypto.randomUUID();
  const mediaId = file instanceof File && file.size > 0 ? crypto.randomUUID() : null;
  let privateKey: string | null = null;
  let video: Awaited<ReturnType<typeof inspectVideo>> | null = null;
  let privateStorage: ReturnType<typeof platform.media> = null;
  if (mediaId && file instanceof File) {
    let videoBytes: ArrayBuffer;
    try {
      videoBytes = await file.arrayBuffer();
      video = await inspectVideo(videoBytes, file.type);
    }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Не удалось проверить видео" }, 400); }
    privateStorage = platform.media("private");
    if (!privateStorage) return json({ error: "Хранилище видео пока не настроено" }, 503);
    privateKey = privateVideoKey(id, mediaId, video.extension);
    try {
      await privateStorage.put(privateKey, videoBytes, { contentType: video.contentType, onlyIfAbsent: true });
    } catch {
      return json({ error: "Не удалось сохранить видео. Попробуй ещё раз." }, 503);
    }
  }
  const now = new Date().toISOString();
  const content = mediaId ? { ...parsed.data, videoUrl: `/media/${mediaId}` } : parsed.data;
  const tacticInsert = {
    sql: `INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, spawn_dependent, content, game_version, source, author_id, status, featured, created_at, updated_at)
          VALUES (?, ?, 'dust2', ?, ?, ?, ?, ?, ?, ?, 'player', ?, 'pending', 0, ?, ?)`,
    params: [id, `player-${id}`, parsed.data.side, parsed.data.teamSize, parsed.data.economy, parsed.data.difficulty, parsed.data.spawnDependent ? 1 : 0, JSON.stringify(content), parsed.data.gameVersion, session.user.id, now, now],
  };
  try {
    if (mediaId && video && privateKey) {
      await platform.db.batch([tacticInsert, {
        sql: `INSERT INTO tactic_media (id, tactic_id, private_object_key, content_type, size_bytes, checksum, status, created_at, verified_at)
              VALUES (?, ?, ?, ?, ?, ?, 'verified', ?, ?)`,
        params: [mediaId, id, privateKey, video.contentType, video.size, video.checksum, now, now],
      }]);
    } else {
      await platform.db.run(tacticInsert.sql, tacticInsert.params);
    }
  } catch {
    if (privateStorage && privateKey) await privateStorage.delete(privateKey).catch(() => undefined);
    return json({ error: "Не удалось сохранить тактику. Попробуй ещё раз." }, 503);
  }
  return json({ id, status: "pending" }, 201);
}
