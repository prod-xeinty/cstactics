import { getPlatform } from "@/platform";

export const dynamic = "force-dynamic";

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

  const ok = Object.values(checks).every((v) => v !== "fail");
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
