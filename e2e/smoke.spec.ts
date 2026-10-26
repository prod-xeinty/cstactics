import { expect, test, type Page } from "@playwright/test";

// Сквозные проверки собранного сайта в браузере: то, что юнит-тесты не видят
// (настоящие заголовки, редиректы, cookie, CSP в браузере, вёрстка на телефоне).

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Report-Only CSP пишет предупреждения — ожидаемо (docs/security/app-security.md); ловим только ошибки.
    // «Failed to load resource» проверяем ниже по самим ответам — там видно, какой ресурс.
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    // Иконки сайта пока нет (дизайн — #21), браузер запрашивает её сам.
    if (r.status() >= 400 && !new URL(r.url()).pathname.startsWith("/favicon")) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

test.describe("главная и вход", () => {
  test("главная открывается без ошибок в консоли, есть вход через Steam", async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("КОЛЛ.GG");
    await expect(page.getByRole("link", { name: "Войти через Steam" })).toHaveAttribute("href", "/login");
    expect(errors).toEqual([]);
  });

  test("вход: форма → редирект в Steam с нашим return_to и cookie state", async ({ page, context }) => {
    // В Steam по-настоящему не ходим: ловим ответ нашей формы (303) и смотрим, куда он отправляет.
    await page.route("https://steamcommunity.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Steam (заглушка)</h1>" }),
    );
    await page.goto("/login");
    const [formResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/auth/steam/login") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Войти через Steam" }).click(),
    ]);
    expect(formResponse.status()).toBe(303);
    const steamUrl = new URL(formResponse.headers()["location"]);

    expect(steamUrl.origin).toBe("https://steamcommunity.com");
    expect(steamUrl.pathname).toBe("/openid/login");
    const returnTo = new URL(steamUrl.searchParams.get("openid.return_to")!);
    expect(returnTo.pathname).toBe("/api/auth/steam/callback");
    const state = returnTo.searchParams.get("state");
    expect(state).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const cookie = (await context.cookies()).find((c) => c.name === "__Host-steam_state");
    expect(cookie?.value).toBe(state);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("подделанный ответ Steam не пускает", async ({ page }) => {
    await page.goto("/api/auth/steam/callback?state=x&openid.mode=id_res");
    await expect(page).toHaveURL(/\/\?login=failed$/);
    await expect(page.getByText("Не вышло зайти через Steam")).toBeVisible();
  });

  test("/login не падает на мусорном ?error", async ({ page }) => {
    for (const e of ["__proto__", "constructor", "<script>"]) {
      const res = await page.goto(`/login?error=${encodeURIComponent(e)}`);
      expect(res?.status(), e).toBe(200);
    }
  });
});

test.describe("защита", () => {
  test("защитные заголовки и X-Request-Id на страницах и API", async ({ request }) => {
    for (const path of ["/", "/login", "/api/health"]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["strict-transport-security"], path).toContain("max-age=");
      expect(h["x-request-id"], path).toBeTruthy();
    }
  });

  test("вход без своего Origin — 403", async ({ request }) => {
    const res = await request.post("/api/auth/steam/login", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });

  test("лимит входа: 10 попыток с одного IP, дальше 429 с Retry-After", async ({ request, baseURL }) => {
    const headers = { origin: baseURL!, "cf-connecting-ip": "203.0.113.77" };
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request.post("/api/auth/steam/login", { headers, maxRedirects: 0 });
      codes.push(res.status());
      if (res.status() === 429) expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
    }
    expect(codes.slice(0, 10).every((c) => c === 303)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  test("выход без CSRF-токена — 403", async ({ request, baseURL }) => {
    const res = await request.post("/api/auth/logout", {
      headers: { origin: baseURL!, cookie: "__Host-session=fake-session-token" },
      form: {},
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });

  test("health: база и лимитер на месте", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checks.db).toBe("ok");
    expect(body.checks.rate_limiter).toBe("ok");
  });
});

test.describe("телефон", () => {
  test("главная и вход без горизонтальной прокрутки @mobile", async ({ page }) => {
    for (const path of ["/", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
