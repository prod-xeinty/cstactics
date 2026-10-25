import { DurableObject } from "cloudflare:workers";
import { FixedWindowCounter } from "./fixed-window";
import type { RateLimitResult, RateLimitRule } from "./types";

/**
 * Durable Object для лимитов: один экземпляр на ключ (idFromName(key)), поэтому счёт точный.
 * Счётчик только в памяти: в хранилище DO не пишем — на бесплатном тарифе всего 100 000 записей в сутки,
 * а потерять счётчик при выгрузке объекта для защиты от спама не страшно.
 * Экспортируется из точки входа воркера (worker/index.ts).
 */
export class RateLimiterObject extends DurableObject {
  private counter = new FixedWindowCounter();

  async hit(rule: RateLimitRule): Promise<RateLimitResult> {
    return this.counter.hit(rule, Date.now());
  }
}
