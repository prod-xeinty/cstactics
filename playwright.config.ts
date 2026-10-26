import { defineConfig, devices } from "@playwright/test";

// Сквозные тесты в настоящем браузере против собранного воркера (рантайм Workers, локальная D1).
// Локально: npm run build:vinext && npm run e2e. В CI — шаг в .github/workflows/ci.yml.
const PORT = Number(process.env.E2E_PORT ?? 8788);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false, // один сервер и общие лимиты — по порядку надёжнее
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // В песочнице разработки браузер предустановлен в нестандартном месте.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: "node scripts/e2e-serve.mjs",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
