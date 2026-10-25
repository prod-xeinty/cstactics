import { afterEach, describe, expect, it, vi } from "vitest";
import { log, redact } from "@/observability/log";
import { currentRequestId, requestIdFrom, runWithRequestContext } from "@/observability/context";
import { errorPage } from "@/observability/error-page";
import { FixedWindowCounter } from "@/platform/fixed-window";

const STEAM = "76561198000000001";
// Токеноподобная строка собирается во время теста: литерал в коде ловил бы gitleaks.
const TOKEN = ["gK1L", "q".repeat(20), "9abcd", "Z".repeat(12)].join("");

afterEach(() => vi.restoreAllMocks());

describe("redact: что не попадает в логи", () => {
  it("секретные ключи скрываются целиком", () => {
    const out = redact({
      cookie: "__Host-session=abc",
      token: "t",
      sessionToken: "t",
      csrf: "c",
      authorization: "Bearer x",
      steamId64: STEAM,
      "openid.claimed_id": "x",
      ip: "1.2.3.4",
      clientIp: "1.2.3.4",
      email: "a@b.c",
      TURNSTILE_SECRET_KEY: "s",
      rule: "loginStart",
    }) as Record<string, unknown>;
    for (const k of Object.keys(out)) {
      if (k === "rule") expect(out[k]).toBe("loginStart");
      else expect(out[k], k).toBe("[скрыто]");
    }
  });

  it("Steam ID, токены и параметры URL вычищаются из текста", () => {
    const s = redact(
      `D1 error for ${STEAM} token ${TOKEN} at https://kollgg.test/api/auth/steam/callback?state=abc&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F${STEAM}`,
    ) as string;
    expect(s).not.toContain(STEAM);
    expect(s).not.toContain(TOKEN);
    expect(s).not.toContain("state=");
    expect(s).toContain("https://kollgg.test/api/auth/steam/callback");
    expect(s).toContain("[steamid]");
  });

  it("ошибка — только имя и очищенное сообщение, без стека", () => {
    const out = redact(new Error(`no user ${STEAM}`)) as Record<string, unknown>;
    expect(out).toEqual({ name: "Error", message: "no user [steamid]" });
  });

  it("вложенность и длина ограничены", () => {
    const deep = { a: { b: { c: { d: { e: "x" } } } } };
    expect(JSON.stringify(redact(deep))).toContain("[…]");
    expect((redact("я".repeat(2000)) as string).length).toBeLessThan(600);
  });
});

describe("log: формат записи", () => {
  it("пишет объект с уровнем, событием и ID запроса", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    runWithRequestContext({ requestId: "ray-123" }, () => log.warn("steam_login_failed", { reason: "bad_state", cookie: "x" }));
    expect(spy).toHaveBeenCalledWith({ level: "warn", event: "steam_login_failed", requestId: "ray-123", reason: "bad_state", cookie: "[скрыто]" });
  });

  it("без контекста (обычный next dev) — тоже пишет, requestId пустой", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("x");
    expect((spy.mock.calls[0][0] as { requestId?: string }).requestId).toBeUndefined();
  });
});

describe("ID запроса", () => {
  it("берём cf-ray, если он похож на cf-ray; иначе свой", () => {
    const req = (ray?: string) => new Request("https://x.test", { headers: ray ? { "cf-ray": ray } : {} });
    expect(requestIdFrom(req("8f1a2b3c4d5e6f70-WAW"))).toBe("8f1a2b3c4d5e6f70-WAW");
    expect(requestIdFrom(req("<script>alert(1)</script>"))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFrom(req())).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("контекст виден внутри async-цепочки и не протекает наружу", async () => {
    await runWithRequestContext({ requestId: "r1" }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      expect(currentRequestId()).toBe("r1");
    });
    expect(currentRequestId()).toBeUndefined();
  });
});

describe("страница ошибки", () => {
  it("показывает код, не кешируется, экранирует", async () => {
    const res = errorPage('ray"<b>', 503);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("ray&quot;&lt;b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).not.toMatch(/<script/i);
  });
});

describe("лимит: в лог только первый отказ в окне", () => {
  it("firstBlock только на limit+1", () => {
    const c = new FixedWindowCounter();
    const rule = { limit: 2, windowMs: 1000 };
    const flags = [0, 1, 2, 3, 4].map(() => c.hit(rule, 0).firstBlock);
    expect(flags).toEqual([false, false, true, false, false]);
  });
});

describe("исправления после security-reviewer (#32)", () => {
  it("x-forwarded-for, ник, аватар, user-agent — скрыты", () => {
    const out = redact({ "x-forwarded-for": "1.2.3.4", nickname: "s1mple", personaname: "x", avatarUrl: "u", "user-agent": "ua" }) as Record<string, unknown>;
    expect(Object.values(out).every((v) => v === "[скрыто]")).toBe(true);
  });

  it("IP, другие форматы Steam ID и параметры относительных путей вычищаются из текста", () => {
    const s = redact(
      "from 10.1.2.3 and 2001:db8:aa:bb::1 user STEAM_0:1:12345 [U:1:24691] path /api/auth/steam/callback?state=abc&openid.sig=AAAA",
    ) as string;
    for (const bad of ["10.1.2.3", "2001:db8", "STEAM_0", "[U:1:", "state=", "openid.sig"]) expect(s, bad).not.toContain(bad);
    expect(s).toContain("/api/auth/steam/callback");
  });

  it("поле, которое бросает при чтении, не роняет логгер", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const evil = Object.defineProperty({}, "x", { enumerable: true, get() { throw new Error("boom"); } });
    expect(() => log.error("evil", { evil })).not.toThrow();
    expect(spy.mock.calls[0][0]).toMatchObject({ event: "evil", logError: expect.any(String) });
  });
});
