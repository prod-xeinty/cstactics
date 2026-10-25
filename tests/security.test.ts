import { describe, expect, it, vi } from "vitest";
import { FixedWindowCounter } from "@/platform/fixed-window";
import type { RateLimiter } from "@/platform";
import { enforceRateLimit, RATE_LIMITS } from "@/security/rate-limit";
import { csrfTokenFor, isSameOrigin, isValidCsrfToken, submittedCsrfToken } from "@/security/csrf";
import { verifyTurnstile } from "@/security/turnstile";
import { SECURITY_HEADERS, withSecurityHeaders } from "@/security/headers";
import { turnstileConfig } from "@/auth/login-config";

const SITE = "https://kollgg.test";

describe("лимиты: фиксированное окно", () => {
  it("пропускает limit запросов, потом 429 до конца окна", () => {
    const c = new FixedWindowCounter();
    const rule = { limit: 3, windowMs: 60_000 };
    expect([1, 2, 3].map(() => c.hit(rule, 1000).ok)).toEqual([true, true, true]);
    const blocked = c.hit(rule, 31_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(30_000);
  });

  it("новое окно — счётчик с нуля", () => {
    const c = new FixedWindowCounter();
    const rule = { limit: 1, windowMs: 1000 };
    expect(c.hit(rule, 0).ok).toBe(true);
    expect(c.hit(rule, 500).ok).toBe(false);
    expect(c.hit(rule, 1000).ok).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  const fakeLimiter = (): RateLimiter => {
    const counters = new Map<string, FixedWindowCounter>();
    return {
      async hit(key, rule) {
        if (!counters.has(key)) counters.set(key, new FixedWindowCounter());
        return counters.get(key)!.hit(rule, 0);
      },
    };
  };

  it("после лимита отдаёт 429 с Retry-After, разные IP считаются отдельно", async () => {
    const limiter = fakeLimiter();
    for (let i = 0; i < RATE_LIMITS.loginStart.limit; i++) {
      expect(await enforceRateLimit(limiter, "loginStart", "1.1.1.1")).toBeNull();
    }
    const res = await enforceRateLimit(limiter, "loginStart", "1.1.1.1");
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await enforceRateLimit(limiter, "loginStart", "2.2.2.2")).toBeNull();
  });

  it("ключ включает имя правила: лимит входа не съедает лимит выхода", async () => {
    const hit = vi.fn(async () => ({ ok: true, remaining: 1, retryAfterMs: 0 }));
    await enforceRateLimit({ hit }, "logout", "1.1.1.1");
    expect(hit).toHaveBeenCalledWith("logout:1.1.1.1", RATE_LIMITS.logout);
  });

  it("если лимитер упал — пропускаем (fail-open), а не роняем вход", async () => {
    const limiter: RateLimiter = { hit: async () => Promise.reject(new Error("DO down")) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await enforceRateLimit(limiter, "loginStart", "1.1.1.1")).toBeNull();
    spy.mockRestore();
  });
});

describe("CSRF", () => {
  const post = (headers: Record<string, string>, body?: string) =>
    new Request(`${SITE}/api/auth/logout`, { method: "POST", headers, body });

  it("свой Origin — ок, чужой — нет, без Origin смотрим Sec-Fetch-Site", () => {
    expect(isSameOrigin(post({ origin: SITE }))).toBe(true);
    expect(isSameOrigin(post({ origin: "https://evil.test" }))).toBe(false);
    expect(isSameOrigin(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(post({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(post({}))).toBe(false);
    // Чужой Origin не спасает даже «same-origin» в Sec-Fetch-Site.
    expect(isSameOrigin(post({ origin: "https://evil.test", "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it("токен из сессии проходит, чужой и пустой — нет", async () => {
    const t = await csrfTokenFor("session-token-A");
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t).not.toContain("session-token-A");
    expect(await isValidCsrfToken("session-token-A", t)).toBe(true);
    expect(await isValidCsrfToken("session-token-B", t)).toBe(false);
    expect(await isValidCsrfToken("session-token-A", null)).toBe(false);
    expect(await isValidCsrfToken(undefined, t)).toBe(false);
    expect(await isValidCsrfToken("session-token-A", t.slice(0, 63))).toBe(false);
  });

  it("токен читается из заголовка и из формы, тело остаётся доступным обработчику", async () => {
    expect(await submittedCsrfToken(post({ "x-csrf-token": "abc" }))).toBe("abc");
    const req = post({ "content-type": "application/x-www-form-urlencoded" }, "csrf=xyz&a=1");
    expect(await submittedCsrfToken(req)).toBe("xyz");
    expect((await req.formData()).get("a")).toBe("1");
  });
});

describe("Turnstile", () => {
  const answer = (data: object) => vi.fn(async () => Response.json(data));
  const base = { secret: "s", ip: "1.1.1.1", expectedHostname: "kollgg.test", expectedAction: "login" };

  it("успех с нашим hostname", async () => {
    const f = answer({ success: true, hostname: "kollgg.test", action: "login" });
    expect(await verifyTurnstile({ ...base, token: "tok", fetch: f as unknown as typeof fetch })).toEqual({ ok: true });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const sent = init.body as URLSearchParams;
    expect(sent.get("secret")).toBe("s");
    expect(sent.get("response")).toBe("tok");
  });

  it("нет токена — даже не спрашиваем Cloudflare", async () => {
    const f = answer({ success: true });
    expect(await verifyTurnstile({ ...base, token: null, fetch: f as unknown as typeof fetch })).toEqual({
      ok: false,
      reason: "missing_token",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    [{ success: false }, "rejected"],
    [{ success: true, hostname: "evil.test", action: "login" }, "bad_hostname"],
    [{ success: true, hostname: "kollgg.test", action: "vote" }, "bad_action"],
  ])("отказ: %j → %s", async (data, reason) => {
    const f = answer(data);
    expect(await verifyTurnstile({ ...base, token: "tok", fetch: f as unknown as typeof fetch })).toEqual({ ok: false, reason });
  });

  it("Cloudflare недоступен — не пускаем", async () => {
    const f = vi.fn(async () => {
      throw new Error("net");
    });
    expect(await verifyTurnstile({ ...base, token: "tok", fetch: f as unknown as typeof fetch })).toEqual({
      ok: false,
      reason: "unreachable",
    });
  });

  it("конфиг: нет site key — выключен; site key без секрета — ошибка настройки", () => {
    const p = (vars: Record<string, string>) =>
      ({ publicVar: (n: string) => vars[n], secret: (n: string) => vars[n] }) as never;
    expect(turnstileConfig(p({})).mode).toBe("off");
    expect(turnstileConfig(p({ TURNSTILE_SITE_KEY: "k" })).mode).toBe("misconfigured");
    expect(turnstileConfig(p({ TURNSTILE_SITE_KEY: "k", TURNSTILE_SECRET_KEY: "s" })).mode).toBe("on");
  });
});

describe("защитные заголовки", () => {
  it("вешаются на ответ и не перетирают выставленные приложением", () => {
    const res = withSecurityHeaders(new Response("x", { headers: { "Referrer-Policy": "no-referrer" } }));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    for (const name of Object.keys(SECURITY_HEADERS)) expect(res.headers.has(name)).toBe(true);
  });

  it("CSP: запрет фреймов, base и object; формы только к себе и в Steam", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self' https://steamcommunity.com");
  });

  it("редирект сохраняет статус и Location", () => {
    const res = withSecurityHeaders(new Response(null, { status: 303, headers: { Location: "/" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/");
  });
});
