import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { csrfTokenFor } from "@/security/csrf";
import { listPendingTactics } from "@/tactics/moderation";
import { MP4_BYTES, MP4_SHA256 } from "./video-fixtures";

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
  let privateStorage: { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    vi.clearAllMocks();
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Автор', 'user', '2026-01-01', '2026-01-01')");
    privateStorage = { put: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
    mocks.getPlatform.mockResolvedValue({ db, rateLimiter: {}, media: (bucket: string) => bucket === "private" ? privateStorage : null });
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

  it("не принимает неподходящее видео", async () => {
    expect((await POST(await request(payload, new File(["x"], "bad.txt", { type: "text/plain" })))).status).toBe(400);
    expect((await POST(await request(payload, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.mp4", { type: "video/mp4" })))).status).toBe(400);
    expect(await db.all("SELECT id FROM tactics")).toEqual([]);
  });

  it("проверяет MP4, кладёт его приватно и сохраняет внутреннюю ссылку", async () => {
    const response = await POST(await request(payload, new File([MP4_BYTES], "round.mp4", { type: "video/mp4" })));

    expect(response.status).toBe(201);
    expect(privateStorage.put).toHaveBeenCalledOnce();
    const [key, body, options] = privateStorage.put.mock.calls[0];
    expect(key).toMatch(/^pending\/[0-9a-f-]+\/[0-9a-f-]+\.mp4$/);
    expect(new Uint8Array(body)).toEqual(MP4_BYTES);
    expect(options).toEqual({ contentType: "video/mp4", onlyIfAbsent: true });
    const media = await db.first<{ id: string; status: string; checksum: string; size_bytes: number; private_object_key: string }>("SELECT id, status, checksum, size_bytes, private_object_key FROM tactic_media");
    expect(media).toMatchObject({ status: "verified", checksum: MP4_SHA256, size_bytes: 24 });
    expect(media?.private_object_key).toBe(key);
    const tactic = await db.first<{ content: string }>("SELECT content FROM tactics");
    expect(JSON.parse(tactic!.content).videoUrl).toBe(`/media/${media!.id}`);
    expect(await listPendingTactics(db)).toMatchObject([{ id: expect.any(String), videoUrl: `/media/${media!.id}` }]);
  });

  it("не создаёт тактику, если приватное хранилище не подключено", async () => {
    mocks.getPlatform.mockResolvedValueOnce({ db, rateLimiter: {}, media: () => null });
    expect((await POST(await request(payload, new File([MP4_BYTES], "round.mp4", { type: "video/mp4" })))).status).toBe(503);
    expect(await db.all("SELECT id FROM tactics")).toEqual([]);
  });

  it("отклоняет фактическое тело больше 11 МБ без Content-Length", async () => {
    const form = new FormData();
    form.set("payload", JSON.stringify(payload));
    form.set("video", new File([MP4_BYTES], "round.mp4", { type: "video/mp4" }));
    form.set("extra", new File([new Uint8Array(12 * 1024 * 1024)], "extra.bin"));
    const oversized = new Request("https://example.test/api/tactics", {
      method: "POST",
      headers: { origin: "https://example.test", cookie: `__Host-session=${TOKEN}`, "x-csrf-token": await csrfTokenFor(TOKEN) },
      body: form,
    });
    expect(oversized.headers.get("content-length")).toBeNull();
    expect((await POST(oversized)).status).toBe(413);
    expect(await db.all("SELECT id FROM tactics")).toEqual([]);
  });
});
