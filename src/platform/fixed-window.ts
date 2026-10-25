import type { RateLimitResult, RateLimitRule } from "./types";

/**
 * Счётчик «фиксированное окно» в памяти. Чистая логика без Cloudflare — её и тестируем.
 * Используется внутри Durable Object (src/platform/rate-limiter-object.ts).
 */
export class FixedWindowCounter {
  // Первое обращение всегда открывает новое окно.
  private windowStart = Number.NEGATIVE_INFINITY;
  private count = 0;

  hit(rule: RateLimitRule, now: number): RateLimitResult {
    if (now - this.windowStart >= rule.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    this.count += 1;
    const ok = this.count <= rule.limit;
    return {
      ok,
      remaining: Math.max(0, rule.limit - this.count),
      retryAfterMs: ok ? 0 : this.windowStart + rule.windowMs - now,
    };
  }
}
