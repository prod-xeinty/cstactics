// Точка входа воркера: отдаём запросы vinext и вешаем защитные заголовки.
// Отсюда же экспортируются классы Durable Objects — иначе Cloudflare их не увидит.
import handler from "vinext/server/app-router-entry";
import { withSecurityHeaders } from "../src/security/headers";

export { RateLimiterObject } from "../src/platform/rate-limiter-object";

type Handler = typeof handler;

export default {
  ...handler,
  async fetch(request: Request, env: Parameters<Handler["fetch"]>[1], ctx: Parameters<Handler["fetch"]>[2]) {
    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
} satisfies Handler;
