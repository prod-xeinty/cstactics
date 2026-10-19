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
  const buckets: Record<MediaBucket, R2Bucket> = {
    private: env.MEDIA_PRIVATE,
    public: env.MEDIA_PUBLIC,
  };
  return {
    db: d1(env.DB),
    media: (bucket) => r2(buckets[bucket]),
  };
}
