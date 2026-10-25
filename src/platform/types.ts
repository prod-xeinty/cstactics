// Интерфейсы платформы. Бизнес-логика зависит только от них, а не от Cloudflare (AGENTS.md, раздел 8).
// Реализации лежат рядом (cloudflare.ts); запасной вариант — Node + Postgres + S3.

export interface Database {
  /** Один запрос, вернуть первую строку или null. Параметры — только через `?`, никакой склейки строк. */
  first<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  all<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** INSERT/UPDATE/DELETE. `changes` — сколько строк затронуто. */
  run(sql: string, params?: readonly unknown[]): Promise<{ changes: number }>;
}

/** Имена серверных секретов. Значения — только в Workers Secrets / .dev.vars. */
export type SecretName = "STEAM_API_KEY" | "TURNSTILE_SECRET_KEY";

/** Публичные настройки (wrangler.jsonc → vars). Не секреты: их можно отдавать в HTML. */
export type PublicVarName = "TURNSTILE_SITE_KEY";

export interface RateLimitRule {
  /** Сколько запросов разрешено в окне. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Через сколько мс окно сбросится (для Retry-After). */
  retryAfterMs: number;
  /** Первый отказ в этом окне — чтобы писать в лог один раз, а не на каждый запрос атаки. */
  firstBlock?: boolean;
}

export interface RateLimiter {
  /** Засчитать одно обращение по ключу (например, «login:ip:1.2.3.4»). */
  hit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

export interface StoredObjectInfo {
  key: string;
  size: number;
}

export interface ObjectStorage {
  /** Список объектов (для проверки доступа и служебных задач). */
  list(options?: { prefix?: string; limit?: number }): Promise<StoredObjectInfo[]>;
  put(key: string, body: ArrayBuffer | ReadableStream | string, options?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}

export type MediaBucket = "private" | "public";

export interface Platform {
  db: Database;
  /** null — хранилище не подключено (например, R2 ещё не включён). */
  media(bucket: MediaBucket): ObjectStorage | null;
  /** Секрет или undefined, если не задан. Никогда не отдаём его клиенту и не пишем в логи. */
  secret(name: SecretName): string | undefined;
  /** Публичная настройка или undefined, если не задана. */
  publicVar(name: PublicVarName): string | undefined;
  rateLimiter: RateLimiter;
}
