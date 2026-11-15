import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { csrfTokenFor } from "@/security/csrf";
import { listPendingTactics, moderateTactic } from "@/tactics/moderation";
import { POST } from "@/app/api/moderation/[id]/route";

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
  beforeEach(async () => {
    vi.clearAllMocks();
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('author', '76561198000000000', '<b>Автор</b>', 'user', '2026-01-01', '2026-01-01'), ('mod', '76561198000000001', 'Модератор', 'moderator', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES ('pending', 'pending', 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'player', 'author', 'pending', '2026-01-01', '2026-01-01'), ('published', 'published', 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'player', 'author', 'published', '2026-01-01', '2026-01-01')", [content, content]);
    mocks.getPlatform.mockResolvedValue({ db });
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "mod", role: "moderator" } });
  });

  it("показывает только ожидающие заявки с автором и текстом", async () => {
    expect(await listPendingTactics(db)).toMatchObject([{ id: "pending", author: "<b>Автор</b>", title: "Сплит A <script>alert(1)</script>" }]);
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
