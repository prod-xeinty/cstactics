import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { csrfTokenFor } from "@/security/csrf";

const mocks = vi.hoisted(() => ({ getPlatform: vi.fn(), getCurrentSession: vi.fn(), enforceRateLimit: vi.fn(async () => null as Response | null) }));
vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
import { POST } from "@/app/api/tactics/route";

const TOKEN = "session-token";
const payload = { title: "Сплит A", side: "T", teamSize: 5, economy: "full", difficulty: 2, gameVersion: "версия теста", spawnDependent: false, call: "Трое лонг, двое кат", quick: ["Забираем лонг"], roles: [], roleFallback: "", nades: [], flow: "", fallback: "", postPlant: "", counters: "" };
async function request(data: unknown = payload, file?: File, csrf = true) {
  const form = new FormData();
  form.set("payload", JSON.stringify(data));
  if (file) form.set("video", file);
  return new Request("https://example.test/api/tactics", { method: "POST", headers: { origin: "https://example.test", cookie: `__Host-session=${TOKEN}`, ...(csrf ? { "x-csrf-token": await csrfTokenFor(TOKEN) } : {}) }, body: form });
}

describe("отправка тактики", () => {
  let db: ReturnType<typeof createTestDb>;
  beforeEach(async () => {
    vi.clearAllMocks();
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Автор', 'user', '2026-01-01', '2026-01-01')");
    mocks.getPlatform.mockResolvedValue({ db, rateLimiter: {} });
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "u" } });
    mocks.enforceRateLimit.mockResolvedValue(null);
  });

  it("требует вход и CSRF", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    expect((await POST(await request())).status).toBe(401);
    expect((await POST(await request(payload, undefined, false))).status).toBe(403);
  });

  it("создаёт только pending, отвергает пустое название", async () => {
    expect((await POST(await request({ ...payload, title: "" }))).status).toBe(400);
    const response = await POST(await request());
    expect(response.status).toBe(201);
    expect(await db.all("SELECT status, source FROM tactics")).toEqual([{ status: "pending", source: "player" }]);
  });

  it("не принимает неподходящее видео и не обещает загрузку до #12", async () => {
    expect((await POST(await request(payload, new File(["x"], "bad.txt", { type: "text/plain" })))).status).toBe(400);
    expect((await POST(await request(payload, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.mp4", { type: "video/mp4" })))).status).toBe(400);
    expect((await POST(await request(payload, new File(["x"], "good.mp4", { type: "video/mp4" })))).status).toBe(503);
    expect(await db.all("SELECT id FROM tactics")).toEqual([]);
  });
});
