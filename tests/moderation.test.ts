import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { csrfTokenFor } from "@/security/csrf";
import { listPendingTactics, moderateTactic } from "@/tactics/moderation";
import { POST } from "@/app/api/moderation/[id]/route";
import { MP4_BYTES, MP4_SHA256 } from "./video-fixtures";

const mocks = vi.hoisted(() => ({ getPlatform: vi.fn(), getCurrentSession: vi.fn() }));
vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));

const content = JSON.stringify({ title: "Сплит A <script>alert(1)</script>", side: "T", teamSize: 5, economy: "full", difficulty: 2, gameVersion: "v1", spawnDependent: false, call: "Трое лонг, двое кат", quick: ["Забираем лонг"], roles: [], roleFallback: "", nades: [], flow: "", fallback: "", postPlant: "", counters: "" });
const token = "moderator-session";

async function post(id: string, action: string, reason = "", csrf = true, origin = "https://example.test") {
  const form = new FormData();
  form.set("action", action);
  form.set("reason", reason);
  if (csrf) form.set("csrf", await csrfTokenFor(token));
  return POST(new Request(`https://example.test/api/moderation/${id}`, { method: "POST", headers: { origin, cookie: `__Host-session=${token}` }, body: form }), { params: Promise.resolve({ id }) });
}

describe("модерация тактик", () => {
  let db: ReturnType<typeof createTestDb>;
  let privateStorage: { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let publicStorage: { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    vi.clearAllMocks();
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('author', '76561198000000000', '<b>Автор</b>', 'user', '2026-01-01', '2026-01-01'), ('mod', '76561198000000001', 'Модератор', 'moderator', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES ('pending', 'pending', 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'player', 'author', 'pending', '2026-01-01', '2026-01-01'), ('published', 'published', 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'player', 'author', 'published', '2026-01-01', '2026-01-01')", [content, content]);
    privateStorage = { get: vi.fn(async () => null), delete: vi.fn(async () => undefined) };
    publicStorage = { put: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
    mocks.getPlatform.mockResolvedValue({ db, rateLimiter: { hit: vi.fn(async () => ({ ok: true, remaining: 1, retryAfterMs: 0 })) }, media: (bucket: string) => bucket === "private" ? privateStorage : publicStorage });
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "mod", role: "moderator" } });
  });

  it("показывает только ожидающие заявки с автором и текстом", async () => {
    expect(await listPendingTactics(db)).toMatchObject([{ id: "pending", author: "<b>Автор</b>", title: "Сплит A <script>alert(1)</script>" }]);
    await db.run("UPDATE tactics SET content = ? WHERE id = 'pending'", [JSON.stringify({ ...JSON.parse(content), videoUrl: "/media/media" })]);
    expect(await listPendingTactics(db)).toMatchObject([{ id: "pending", videoUrl: "/media/media" }]);
  });

  it("публикует только pending и записывает одно решение", async () => {
    expect(await moderateTactic(db, "pending", "mod", "published", null)).toBe("ok");
    expect(await moderateTactic(db, "pending", "mod", "published", null)).toBe("conflict");
    expect(await db.all("SELECT status FROM tactics WHERE id = 'pending'")).toEqual([{ status: "published" }]);
    expect(await db.all("SELECT action, moderator_id FROM moderation_events WHERE tactic_id = 'pending'")).toEqual([{ action: "published", moderator_id: "mod" }]);
  });

  it("не публикует тактику с непроверенным видео", async () => {
    await db.run("INSERT INTO tactic_media (id, tactic_id, content_type, size_bytes, checksum, status, created_at) VALUES ('media', 'pending', 'video/mp4', 10, 'hash', 'uploaded', '2026-01-01')");
    expect(await moderateTactic(db, "pending", "mod", "published", null)).toBe("media_not_ready");
    expect(await db.all("SELECT status FROM tactics WHERE id = 'pending'")).toEqual([{ status: "pending" }]);
  });

  it("перед публикацией повторно проверяет видео и удаляет приватную копию", async () => {
    await db.run("INSERT INTO tactic_media (id, tactic_id, private_object_key, content_type, size_bytes, checksum, status, created_at, verified_at) VALUES ('media', 'pending', 'pending/tactic/media.mp4', 'video/mp4', 24, ?, 'verified', '2026-01-01', '2026-01-01')", [MP4_SHA256]);
    privateStorage.get.mockResolvedValue({ body: new Response(MP4_BYTES).body!, size: 24, contentType: "video/mp4" });

    expect((await post("pending", "published")).status).toBe(303);
    expect(publicStorage.put).toHaveBeenCalledOnce();
    expect(privateStorage.delete).toHaveBeenCalledWith("pending/tactic/media.mp4");
    expect(await db.all("SELECT status FROM tactics WHERE id = 'pending'")).toEqual([{ status: "published" }]);
    expect(await db.all("SELECT status FROM tactic_media WHERE id = 'media'")).toEqual([{ status: "published" }]);
  });

  it("не даёт обычному игроку менять статус и проверяет CSRF", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    expect((await post("pending", "published")).status).toBe(401);
    mocks.getCurrentSession.mockResolvedValueOnce({ user: { id: "author", role: "user" } });
    expect((await post("pending", "published")).status).toBe(403);
    expect((await post("pending", "published", "", false)).status).toBe(403);
    expect((await post("pending", "published", "", true, "https://other.test")).status).toBe(403);
    expect(await db.all("SELECT status FROM tactics WHERE id = 'pending'")).toEqual([{ status: "pending" }]);
  });

  it("отбрасывает слишком большой запрос до чтения формы", async () => {
    const response = await POST(new Request("https://example.test/api/moderation/pending", {
      method: "POST", headers: { origin: "https://example.test", cookie: `__Host-session=${token}`, "content-type": "application/x-www-form-urlencoded", "content-length": "5000" }, body: "action=published",
    }), { params: Promise.resolve({ id: "pending" }) });
    expect(response.status).toBe(413);
  });

  it("требует причину отклонения, затем сохраняет её и не принимает повтор", async () => {
    expect((await post("pending", "rejected", " ")).status).toBe(400);
    expect((await post("pending", "rejected", "Нужно проверить гранаты в игре")).status).toBe(303);
    expect((await post("pending", "published")).status).toBe(409);
    expect(await db.all("SELECT status FROM tactics WHERE id = 'pending'")).toEqual([{ status: "rejected" }]);
    expect(await db.all("SELECT action, reason FROM moderation_events WHERE tactic_id = 'pending'")).toEqual([{ action: "rejected", reason: "Нужно проверить гранаты в игре" }]);
  });
});
