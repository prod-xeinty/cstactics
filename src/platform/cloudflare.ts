import { env } from "cloudflare:workers";
import type { Database, MediaBucket, ObjectStorage, Platform } from "./types";

// Единственное место, где мы трогаем Cloudflare-биндинги.
function d1(binding: D1Database): Database {
  const prepare = (sql: string, params: readonly unknown[]) => binding.prepare(sql).bind(...params);
  return {
    async first<T>(sql: string, params: readonly unknown[] = []) {
      return (await prepare(sql, params).first<T>()) ?? null;
    },
    async all<T>(sql: string, params: readonly unknown[] = []) {
      return (await prepare(sql, params).all<T>()).results;
    },
  };
}

function r2(bucket: R2Bucket): ObjectStorage {
  return {
    async list(options) {
      const res = await bucket.list({ prefix: options?.prefix, limit: options?.limit });
      return res.objects.map((o) => ({ key: o.key, size: o.size }));
    },
    async put(key, body, options) {
      await bucket.put(key, body, { httpMetadata: { contentType: options?.contentType } });
    },
    async get(key) {
      const obj = await bucket.get(key);
      return obj ? obj.body : null;
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

export function getPlatform(): Platform {
  // R2-бакеты могут быть не подключены (см. wrangler.jsonc), поэтому типизируем их как необязательные.
  const optional = env as unknown as { MEDIA_PRIVATE?: R2Bucket; MEDIA_PUBLIC?: R2Bucket };
  const buckets: Record<MediaBucket, R2Bucket | undefined> = {
    private: optional.MEDIA_PRIVATE,
    public: optional.MEDIA_PUBLIC,
  };
  return {
    db: d1(env.DB),
    media: (bucket) => {
      const b = buckets[bucket];
      return b ? r2(b) : null;
    },
  };
}
