#!/usr/bin/env node
// Сервер для сквозных тестов: собранный воркер на рантайме Workers с отдельной локальной базой.
// Запускает Playwright (playwright.config.ts → webServer). Нужна сборка: npm run build:vinext.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const PORT = process.env.E2E_PORT ?? "8788";
const STATE = ".wrangler/e2e-state";
if (!existsSync("dist/server/wrangler.json")) {
  console.error("Нет сборки: сначала npm run build:vinext");
  process.exit(1);
}
rmSync(STATE, { recursive: true, force: true }); // каждый прогон — с чистой базой и чистыми лимитами
const env = { ...process.env, WRANGLER_SEND_METRICS: "false" };
execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", STATE], { stdio: "inherit", env });
const child = spawn(
  "npx",
  ["wrangler", "dev", "--config", "dist/server/wrangler.json", "--port", PORT, "--ip", "127.0.0.1", "--persist-to", STATE],
  { stdio: "inherit", env },
);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
