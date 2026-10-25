// Точка входа воркера: отдаём запросы vinext, вешаем защитные заголовки и ID запроса.
// Отсюда же экспортируются классы Durable Objects — иначе Cloudflare их не увидит.
import handler from "vinext/server/app-router-entry";
import { withSecurityHeaders } from "../src/security/headers";
import { requestIdFrom, runWithRequestContext } from "../src/observability/context";
import { log } from "../src/observability/log";
import { errorPage } from "../src/observability/error-page";

export { RateLimiterObject } from "../src/platform/rate-limiter-object";

type Handler = typeof handler;

/** Обычный переход браузера на HTML-страницу (не RSC-запрос клиента Next, не API). */
function wantsHtmlPage(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.get("rsc") !== null) return false;
  if (new URL(request.url).pathname.startsWith("/api/")) return false;
  return (request.headers.get("accept") ?? "").includes("text/html");
}

export default {
  ...handler,
  async fetch(request: Request, env: Parameters<Handler["fetch"]>[1], ctx: Parameters<Handler["fetch"]>[2]) {
    const requestId = requestIdFrom(request);
    return runWithRequestContext({ requestId }, async () => {
      const path = new URL(request.url).pathname;
      let response: Response;
      try {
        response = await handler.fetch(request, env, ctx);
      } catch (err) {
        log.error("unhandled_error", { method: request.method, path, error: err });
        return withSecurityHeaders(errorPage(requestId));
      }
      if (response.status >= 500) {
        log.error("server_error", { method: request.method, path, status: response.status });
        if (wantsHtmlPage(request)) return withSecurityHeaders(errorPage(requestId, response.status));
      }
      const res = withSecurityHeaders(response);
      res.headers.set("X-Request-Id", requestId);
      return res;
    });
  },
} satisfies Handler;
