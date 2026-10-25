import { AsyncLocalStorage } from "node:async_hooks";

// Контекст запроса (сейчас только ID), доступный из любого места обработки без передачи параметром.
// Заполняется в worker/index.ts. Под обычным next dev контекста нет — логгер это переживает.
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/**
 * ID запроса: cf-ray от Cloudflare (тот же, что в встроенных логах Workers и на страницах ошибок Cloudflare),
 * локально — случайный. Берём только безопасные символы, чтобы чужой заголовок не попал в лог как есть.
 */
export function requestIdFrom(request: Request): string {
  const ray = request.headers.get("cf-ray");
  if (ray && /^[0-9a-zA-Z-]{8,64}$/.test(ray)) return ray;
  return crypto.randomUUID();
}
