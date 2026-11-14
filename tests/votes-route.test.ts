import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { seedRatingTactic, seedRatingUser } from "./rating-fixtures";
import { csrfTokenFor } from "@/security/csrf";

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  getCurrentSession: vi.fn(),
  enforceRateLimit: vi.fn(async () => null as Response | null),
}));
vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET, POST } from "@/app/api/tactics/[id]/votes/route";

const TOKEN = "test-session-token";
const STEAM_ID = "76561199876410025";
const context = (id = "t1") => ({ params: Promise.resolve({ id }) });
const getRequest = () => new Request("https://example.test/api/tactics/t1/votes");
async function postRequest(body: unknown, options: { origin?: string; csrf?: string } = {}) {
  return new Request("https://example.test/api/tactics/t1/votes", {
    method: "POST",
    headers: {
      origin: options.origin ?? "https://example.test",
      cookie: `__Host-session=${TOKEN}`,
      "content-type": "application/json",
      "x-csrf-token": options.csrf ?? await csrfTokenFor(TOKEN),
    },
    body: JSON.stringify(body),
  });
}

describe("маршрут голосования", () => {
  let db: ReturnType<typeof createTestDb>;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    db = createTestDb();
    await seedRatingUser(db, "author");
    await seedRatingUser(db, "u1");
    await seedRatingTactic(db, "t1");
    await seedRatingTactic(db, "draft", "draft");
    mocks.getPlatform.mockResolvedValue({ db, secret: () => "server-key", rateLimiter: {} });
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "u1", steam_id64: STEAM_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ games: { cs2: { skill_level: 8, faceit_elo: 1703 } } })));
  });

  it("публично отдаёт четыре шкалы, но не раскрывает неопубликованную тактику", async () => {
    const response = await GET(getRequest(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { ratings: Record<string, { votes: number; works: number | null }> };
    expect(Object.keys(body.ratings).sort()).toEqual(["high", "low", "mid", "none"]);
    expect(body.ratings.high).toEqual({ votes: 0, works: null, easy: null });
    expect((await GET(getRequest(), context("draft"))).status).toBe(404);
  });

  it("не даёт голосовать без входа, с чужого сайта и без CSRF", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    expect((await POST(await postRequest({ works: 5, easy: 4 }), context())).status).toBe(401);
    expect((await POST(await postRequest({ works: 5, easy: 4 }, { origin: "https://evil.test" }), context())).status).toBe(403);
    expect((await POST(await postRequest({ works: 5, easy: 4 }, { csrf: "bad" }), context())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("проверяет оценки 1–5 и статус тактики", async () => {
    expect((await POST(await postRequest({ works: 0, easy: 4 }), context())).status).toBe(400);
    expect((await POST(await postRequest({ works: 5.5, easy: 4 }), context())).status).toBe(400);
    expect((await POST(await postRequest({ works: 5, easy: 4 }), context("draft"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("создаёт голос по текущей FACEIT-шкале и при повторе обновляет его", async () => {
    const first = await POST(await postRequest({ works: 5, easy: 4 }), context());
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect((await first.json() as { band: string }).band).toBe("high");
    expect((await POST(await postRequest({ works: 3, easy: 2 }), context())).status).toBe(200);
    expect(await db.all("SELECT band, works, easy FROM votes WHERE user_id = 'u1' AND tactic_id = 't1'")).toEqual([
      { band: "high", works: 3, easy: 2 },
    ]);
  });

  it("404 FACEIT кладёт голос в шкалу none, сбой API не меняет голос", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await POST(await postRequest({ works: 5, easy: 4 }), context())).status).toBe(200);
    expect(await db.all("SELECT band FROM votes WHERE user_id = 'u1'")).toEqual([{ band: "none" }]);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect((await POST(await postRequest({ works: 1, easy: 1 }), context())).status).toBe(503);
    expect(await db.all("SELECT band, works FROM votes WHERE user_id = 'u1'")).toEqual([{ band: "none", works: 5 }]);
  });

  it("останавливает частые запросы до FACEIT", async () => {
    mocks.enforceRateLimit.mockResolvedValue(new Response("Слишком часто", { status: 429 }));
    expect((await POST(await postRequest({ works: 5, easy: 4 }), context())).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("проверяет лимит до чтения большого тела запроса", async () => {
    mocks.enforceRateLimit.mockResolvedValue(new Response("Слишком часто", { status: 429 }));
    const request = await postRequest({ works: 5, easy: 4 });
    vi.spyOn(request, "json").mockRejectedValue(new Error("тело читать нельзя"));
    expect((await POST(request, context())).status).toBe(429);
    expect(request.json).not.toHaveBeenCalled();
  });
});
