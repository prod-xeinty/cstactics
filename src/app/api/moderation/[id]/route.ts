import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { getPlatform } from "@/platform";
import { isSameOrigin, isValidCsrfToken, submittedCsrfToken } from "@/security/csrf";
import { enforceRateLimit } from "@/security/rate-limit";
import { moderateTactic } from "@/tactics/moderation";

export const dynamic = "force-dynamic";
const reply = (message: string, status: number) => new Response(message, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOrigin(request)) return reply("Запрос с другого сайта", 403);
  const session = await getCurrentSession(request.headers.get("cookie"));
  if (!session) return reply("Нужно войти через Steam", 401);
  if (session.user.role !== "moderator" && session.user.role !== "admin") return reply("Нет доступа", 403);
  if (!request.headers.get("content-type")?.includes("multipart/form-data") && !request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) return reply("Нужна форма", 415);
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > 4096) return reply("Слишком длинный запрос", 413);
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  let submitted: string | null;
  let form: FormData;
  try {
    submitted = await submittedCsrfToken(request);
    form = await request.formData();
  } catch { return reply("Не удалось прочитать форму", 400); }
  if (!(await isValidCsrfToken(token, submitted))) return reply("Проверка запроса не прошла", 403);
  const action = form.get("action");
  const rawReason = form.get("reason");
  const reason = typeof rawReason === "string" ? rawReason.trim() : "";
  if (action !== "published" && action !== "rejected") return reply("Неизвестное действие", 400);
  if (reason.length > 500 || (action === "rejected" && !reason)) return reply("Напиши причину отклонения (до 500 символов)", 400);
  const platform = await getPlatform();
  const limited = await enforceRateLimit(platform.rateLimiter, "patch", session.user.id);
  if (limited) return limited;
  const { id } = await params;
  const result = await moderateTactic(platform.db, id, session.user.id, action, action === "rejected" ? reason : null);
  if (result === "media_not_ready") return reply("Видео ещё не готово к публикации", 409);
  if (result === "conflict") return reply("Эту заявку уже разобрали или она не найдена", 409);
  return new Response(null, { status: 303, headers: { Location: `/moderation?done=${action}`, "Cache-Control": "no-store" } });
}
