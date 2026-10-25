import { env } from "cloudflare:workers";
import type { RateLimiterObject } from "./rate-limiter-object";
import type { Database, MediaBucket, ObjectStorage, Platform, PublicVarName, RateLimiter, SecretName } from "./types";

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
    async run(sql: string, params: readonly unknown[] = []) {
      const res = await prepare(sql, params).run();
      return { changes: res.meta.changes ?? 0 };
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

function durableRateLimiter(ns: DurableObjectNamespace<RateLimiterObject> | undefined): RateLimiter {
  return {
    async hit(key, rule) {
      if (!ns) throw new Error("нет биндинга RATE_LIMITER (wrangler.jsonc → durable_objects)");
      const stub = ns.get(ns.idFromName(key));
      return stub.hit(rule);
    },
  };
}

export function getPlatform(): Platform {
  // R2-бакеты могут быть не подключены (см. wrangler.jsonc), поэтому типизируем их как необязательные.
  const optional = env as unknown as {
    MEDIA_PRIVATE?: R2Bucket;
    MEDIA_PUBLIC?: R2Bucket;
    RATE_LIMITER?: DurableObjectNamespace<RateLimiterObject>;
  } & Partial<Record<SecretName | PublicVarName, string>>;
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
    secret: (name) => {
      const v = optional[name];
      return typeof v === "string" && v.length > 0 ? v : undefined;
    },
    publicVar: (name) => {
      const v = optional[name];
      return typeof v === "string" && v.length > 0 ? v : undefined;
    },
    rateLimiter: durableRateLimiter(optional.RATE_LIMITER),
  };
}
