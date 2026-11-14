import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  getCurrentSession: vi.fn(),
  enforceRateLimit: vi.fn(async () => null as Response | null),
}));

vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET } from "@/app/api/faceit/me/route";

const STEAM_ID = "76561199876410025";
const request = () => new Request("https://example.test/api/faceit/me", { headers: { cookie: "__Host-session=test" } });

describe("маршрут FACEIT-профиля", () => {
  const dbRun = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "u1", steam_id64: STEAM_ID } });
    mocks.getPlatform.mockResolvedValue({ secret: () => "server-key", rateLimiter: {}, db: { run: dbRun } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    fetchMock.mockResolvedValue(Response.json({ games: { cs2: { skill_level: 8, faceit_elo: 2040 } } }));
  });

  it("требует входа и не зовёт FACEIT без сессии", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getPlatform).not.toHaveBeenCalled();
  });

  it("возвращает текущие уровень, эло и шкалу без сохранения в D1", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ profile: { status: "ready", level: 8, elo: 2040, band: "high" }, source: "FACEIT" });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({}, "faceitProfile", "u1");
    expect(dbRun).not.toHaveBeenCalled();
  });

  it("404 означает шкалу без FACEIT, ошибка API — временную недоступность", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const absent = await GET(request());
    expect(absent.status).toBe(200);
    expect(await absent.json()).toEqual({ profile: { status: "not_found", band: "none" }, source: "FACEIT" });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    const unavailable = await GET(request());
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("cache-control")).toBe("no-store");
    expect(await unavailable.json()).toEqual({ profile: { status: "unavailable" }, source: "FACEIT" });
  });

  it("соблюдает локальный лимит до обращения к FACEIT", async () => {
    mocks.enforceRateLimit.mockResolvedValue(new Response("Слишком часто", { status: 429, headers: { "Cache-Control": "no-store" } }));
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("без серверного ключа сообщает о недоступности и не вызывает FACEIT", async () => {
    mocks.getPlatform.mockResolvedValue({ secret: () => undefined, rateLimiter: {}, db: { run: dbRun } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbRun).not.toHaveBeenCalled();
  });
});
