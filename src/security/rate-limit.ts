import type { RateLimiter, RateLimitRule } from "@/platform";

// Правила лимитов. Голоса (#13) и анкета (#7) добавят свои строки сюда.
export const RATE_LIMITS = {
  /** Старт входа через Steam: на IP. */
  loginStart: { limit: 10, windowMs: 60_000 },
  /** Возврат из Steam: на IP. */
  loginCallback: { limit: 10, windowMs: 60_000 },
  /** Выход: на IP. */
  logout: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * null — можно продолжать, Response — ответ 429.
 * Если лимитер недоступен, пропускаем запрос (fail-open) и пишем в лог: лучше пропустить спам,
 * чем уронить вход всем. Для голосов и анкеты можно будет выбрать fail-closed.
 */
export async function enforceRateLimit(
  limiter: RateLimiter,
  name: RateLimitName,
  subject: string,
): Promise<Response | null> {
  let result;
  try {
    result = await limiter.hit(`${name}:${subject}`, RATE_LIMITS[name]);
  } catch (err) {
    console.error("rate limiter недоступен:", name, err instanceof Error ? err.message : String(err));
    return null;
  }
  if (result.ok) return null;
  const retryAfter = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return new Response("Слишком часто. Подожди немного и попробуй снова.", {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
