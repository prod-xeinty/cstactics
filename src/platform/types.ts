// Интерфейсы платформы. Бизнес-логика зависит только от них, а не от Cloudflare (AGENTS.md, раздел 8).
// Реализации лежат рядом (cloudflare.ts); запасной вариант — Node + Postgres + S3.

export interface Database {
  /** Один запрос, вернуть первую строку или null. Параметры — только через `?`, никакой склейки строк. */
  first<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  all<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
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
}
