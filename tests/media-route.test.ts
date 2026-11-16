import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";

const mocks = vi.hoisted(() => ({ getPlatform: vi.fn() }));
vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
const auth = vi.hoisted(() => ({ getCurrentSession: vi.fn() }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: auth.getCurrentSession }));
import { GET } from "@/app/media/[id]/route";
import { MP4_BYTES } from "./video-fixtures";

describe("выдача опубликованного видео", () => {
  let db: ReturnType<typeof createTestDb>;
  let publicStorage: { get: ReturnType<typeof vi.fn> };
  let privateStorage: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('author', '76561198000000000', 'Автор', 'user', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES ('tactic', 'tactic', 'dust2', 'T', 5, 'full', 2, '{}', 'v1', 'player', 'author', 'published', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactic_media (id, tactic_id, private_object_key, public_object_key, content_type, size_bytes, checksum, status, created_at, verified_at) VALUES ('media', 'tactic', 'pending/tactic/media.mp4', 'published/tactic/media.mp4', 'video/mp4', 24, 'hash', 'published', '2026-01-01', '2026-01-01')");
    publicStorage = { get: vi.fn(async () => ({ body: new Response(MP4_BYTES).body!, size: 24, contentType: "video/mp4" })) };
    privateStorage = { get: vi.fn(async () => ({ body: new Response(MP4_BYTES).body!, size: 24, contentType: "video/mp4" })) };
    auth.getCurrentSession.mockResolvedValue(null);
    mocks.getPlatform.mockResolvedValue({ db, media: (bucket: string) => bucket === "public" ? publicStorage : privateStorage });
  });

  it("отдаёт только проверенный публичный объект с безопасными заголовками", async () => {
    const response = await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) });

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(MP4_BYTES);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("24");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, immutable");
    expect(publicStorage.get).toHaveBeenCalledWith("published/tactic/media.mp4");
  });

  it("поддерживает Range для воспроизведения и перемотки", async () => {
    const response = await GET(new Request("https://example.test/media/media", { headers: { Range: "bytes=4-7" } }), { params: Promise.resolve({ id: "media" }) });
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(MP4_BYTES.slice(4, 8));
    expect(response.headers.get("content-range")).toBe("bytes 4-7/24");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    const invalid = await GET(new Request("https://example.test/media/media", { headers: { Range: "bytes=30-40" } }), { params: Promise.resolve({ id: "media" }) });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */24");
  });

  it("даёт moderator приватный preview pending-видео, но не обычному игроку", async () => {
    await db.run("UPDATE tactics SET status = 'pending' WHERE id = 'tactic'");
    await db.run("UPDATE tactic_media SET status = 'verified', public_object_key = NULL WHERE id = 'media'");
    auth.getCurrentSession.mockResolvedValueOnce({ user: { id: "mod", role: "moderator" } });
    const preview = await GET(new Request("https://example.test/media/media", { headers: { cookie: "__Host-session=token" } }), { params: Promise.resolve({ id: "media" }) });
    expect(preview.status).toBe(200);
    expect(preview.headers.get("cache-control")).toBe("private, no-store");
    expect(privateStorage.get).toHaveBeenCalledWith("pending/tactic/media.mp4");
    auth.getCurrentSession.mockResolvedValueOnce({ user: { id: "user", role: "user" } });
    expect((await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) })).status).toBe(404);
  });

  it("скрывает pending, неизвестный и некорректный media-id", async () => {
    await db.run("UPDATE tactics SET status = 'pending' WHERE id = 'tactic'");
    expect((await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) })).status).toBe(404);
    expect((await GET(new Request("https://example.test/media/missing"), { params: Promise.resolve({ id: "missing" }) })).status).toBe(404);
    expect((await GET(new Request("https://example.test/media/bad%2Fid"), { params: Promise.resolve({ id: "bad/id" }) })).status).toBe(404);
    expect(publicStorage.get).not.toHaveBeenCalled();
  });

  it("не отдаёт объект, если метаданные хранилища не совпали с D1", async () => {
    publicStorage.get.mockResolvedValueOnce({ body: new Response(MP4_BYTES).body!, size: 23, contentType: "video/mp4" });
    expect((await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) })).status).toBe(503);
  });
});
