import { getPlatform } from "@/platform";
import { turnstileConfig } from "@/auth/login-config";

export const dynamic = "force-dynamic";

// Проверка лимитера стоит запрос к Durable Object — кешируем результат в памяти изолята,
// чтобы частые запросы к /api/health не тратили бесплатную квоту DO.
const RATE_LIMITER_PROBE_TTL_MS = 30_000;
let rateLimiterProbe: { at: number; ok: boolean } | null = null;

// Проверка, что приложение видит базу и хранилище. Без секретов и без данных пользователей.
export async function GET() {
  const checks: Record<string, "ok" | "fail" | "skipped"> = {};

  let platform;
  try {
    platform = await getPlatform();
  } catch {
    // Например, обычный `next dev` без Workers-рантайма: биндингов нет.
    return Response.json(
      { ok: false, error: "no-bindings", hint: "запусти npm run dev:vinext" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const row = await platform.db.first<{ ok: number }>("SELECT 1 AS ok");
    checks.db = row?.ok === 1 ? "ok" : "fail";
  } catch {
    checks.db = "fail";
  }

  for (const bucket of ["private", "public"] as const) {
    const storage = platform.media(bucket);
    if (!storage) {
      // Бакет не подключён — не считаем ошибкой, пока R2 не включён (#12).
      checks[`media_${bucket}`] = "skipped";
      continue;
    }
    try {
      await storage.list({ limit: 1 });
      checks[`media_${bucket}`] = "ok";
    } catch {
      checks[`media_${bucket}`] = "fail";
    }
  }

  // Лимитер: один запрос к Durable Object. Если биндинг потерялся, лимиты молча стали бы fail-open — тут это видно.
  const now = Date.now();
  if (!rateLimiterProbe || now - rateLimiterProbe.at > RATE_LIMITER_PROBE_TTL_MS) {
    let ok = true;
    try {
      await platform.rateLimiter.hit("health:probe", { limit: 1_000_000, windowMs: 60_000 });
    } catch {
      ok = false;
    }
    rateLimiterProbe = { at: now, ok };
  }
  checks.rate_limiter = rateLimiterProbe.ok ? "ok" : "fail";

  // Настройка, а не проверка: показываем, включена ли капча (без ключей).
  const turnstile = turnstileConfig(platform).mode;
  if (turnstile === "misconfigured") checks.turnstile = "fail";

  const ok = Object.values(checks).every((v) => v !== "fail");
  return Response.json({ ok, checks, turnstile }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
