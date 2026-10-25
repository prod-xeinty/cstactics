#!/usr/bin/env node
// Проверка боевого сайта после деплоя: health, защитные заголовки, страницы.
// node scripts/smoke-prod.mjs https://kollgg.kollgg-probe-test.workers.dev
const base = (process.argv[2] ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
// http — только для проверки самого скрипта на локальном воркере (SMOKE_ALLOW_HTTP=1).
if (!base.startsWith("https://") && !(process.env.SMOKE_ALLOW_HTTP === "1" && base.startsWith("http://127.0.0.1"))) {
  console.error("Нужен адрес сайта (https://…)");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
};

// Новая версия расходится по Cloudflare за секунды — даём до ~1 минуты.
let health;
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 6);
for (let i = 0; i < attempts; i++) {
  try {
    const res = await fetch(`${base}/api/health`, { headers: { "cache-control": "no-cache" } });
    health = { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
    if (health.status === 200 && health.body?.ok) break;
  } catch (err) {
    health = { error: String(err) };
  }
  if (i < attempts - 1) await sleep(10_000);
}
check(health?.status === 200 && health.body?.ok === true, `/api/health → 200 ok (${JSON.stringify(health?.body ?? health?.error)})`);
check(health?.body?.checks?.db === "ok", "база отвечает");
check(health?.body?.checks?.rate_limiter === "ok", "лимитер (Durable Object) отвечает");
check(!!health?.headers?.get?.("x-request-id"), "есть X-Request-Id");
check((health?.headers?.get?.("content-security-policy") ?? "").includes("frame-ancestors 'none'"), "есть CSP");

for (const [path, want] of [
  ["/", 200],
  ["/login", 200],
]) {
  const res = await fetch(`${base}${path}`, { headers: { accept: "text/html" }, redirect: "manual" }).catch(() => null);
  check(res?.status === want, `${path} → ${want} (получили ${res?.status ?? "ошибку сети"})`);
}

if (failures.length) {
  console.error(`\nСмоук не прошёл (${failures.length}). Откат: npx wrangler rollback (см. docs/ops/deploy.md).`);
  process.exit(1);
}
console.log("\nБоевой сайт в порядке.");
