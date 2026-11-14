// Точка входа воркера: отдаём запросы vinext, вешаем защитные заголовки и ID запроса.
// Отсюда же экспортируются классы Durable Objects — иначе Cloudflare их не увидит.
import handler from "vinext/server/app-router-entry";
import { withSecurityHeaders } from "../src/security/headers";
import { requestIdFrom, runWithRequestContext } from "../src/observability/context";
import { log } from "../src/observability/log";
import { errorPage } from "../src/observability/error-page";
import { createCloudflarePlatform, type WorkerBindings } from "../src/platform/cloudflare";
import { lookupFaceitProfile } from "../src/faceit/client";
import { refreshDueVoteBands } from "../src/ratings/refresh";

export { RateLimiterObject } from "../src/platform/rate-limiter-object";

type Handler = typeof handler;
type WorkerHandler = Handler & { scheduled(controller: ScheduledController, env: Parameters<Handler["fetch"]>[1]): Promise<void> };

/** Обычный переход браузера на HTML-страницу (не RSC-запрос клиента Next, не API). */
function wantsHtmlPage(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.get("rsc") !== null) return false;
  if (new URL(request.url).pathname.startsWith("/api/")) return false;
  return (request.headers.get("accept") ?? "").includes("text/html");
}

export default {
  ...handler,
  async scheduled(controller: ScheduledController, runtimeEnv: Parameters<Handler["fetch"]>[1]) {
    const platform = createCloudflarePlatform(runtimeEnv as WorkerBindings);
    const key = platform.secret("FACEIT_API_KEY");
    if (!key) {
      log.warn("faceit_refresh_key_missing");
      return;
    }
    const result = await refreshDueVoteBands(platform.db, (steamId64) =>
      lookupFaceitProfile(steamId64, { apiKey: key, fetch }), new Date(controller.scheduledTime));
    log.info("faceit_refresh", result);
  },
  async fetch(request: Request, env: Parameters<Handler["fetch"]>[1], ctx: Parameters<Handler["fetch"]>[2]) {
    const requestId = requestIdFrom(request);
    return runWithRequestContext({ requestId }, async () => {
      const path = new URL(request.url).pathname;
      const started = Date.now();
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
      // Своя запись о запросе вместо встроенной (invocation_logs выключены): только метод, путь, статус и время —
      // ни заголовков, ни параметров, ни IP.
      log.info("request", { method: request.method, path, status: response.status, ms: Date.now() - started });
      const res = withSecurityHeaders(response);
      res.headers.set("X-Request-Id", requestId);
      return res;
    });
  },
} satisfies WorkerHandler;
