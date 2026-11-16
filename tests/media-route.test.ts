import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";

const mocks = vi.hoisted(() => ({ getPlatform: vi.fn() }));
vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
import { GET } from "@/app/media/[id]/route";

const bytes = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70]);

describe("выдача опубликованного видео", () => {
  let db: ReturnType<typeof createTestDb>;
  let publicStorage: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('author', '76561198000000000', 'Автор', 'user', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES ('tactic', 'tactic', 'dust2', 'T', 5, 'full', 2, '{}', 'v1', 'player', 'author', 'published', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactic_media (id, tactic_id, private_object_key, public_object_key, content_type, size_bytes, checksum, status, created_at, verified_at) VALUES ('media', 'tactic', 'pending/tactic/media.mp4', 'published/tactic/media.mp4', 'video/mp4', 8, 'hash', 'published', '2026-01-01', '2026-01-01')");
    publicStorage = { get: vi.fn(async () => ({ body: new Response(bytes).body!, size: 8, contentType: "video/mp4" })) };
    mocks.getPlatform.mockResolvedValue({ db, media: (bucket: string) => bucket === "public" ? publicStorage : null });
  });

  it("отдаёт только проверенный публичный объект с безопасными заголовками", async () => {
    const response = await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) });

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, immutable");
    expect(publicStorage.get).toHaveBeenCalledWith("published/tactic/media.mp4");
  });

  it("скрывает pending, неизвестный и некорректный media-id", async () => {
    await db.run("UPDATE tactics SET status = 'pending' WHERE id = 'tactic'");
    expect((await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) })).status).toBe(404);
    expect((await GET(new Request("https://example.test/media/missing"), { params: Promise.resolve({ id: "missing" }) })).status).toBe(404);
    expect((await GET(new Request("https://example.test/media/bad%2Fid"), { params: Promise.resolve({ id: "bad/id" }) })).status).toBe(404);
    expect(publicStorage.get).not.toHaveBeenCalled();
  });

  it("не отдаёт объект, если метаданные хранилища не совпали с D1", async () => {
    publicStorage.get.mockResolvedValueOnce({ body: new Response(bytes).body!, size: 7, contentType: "video/mp4" });
    expect((await GET(new Request("https://example.test/media/media"), { params: Promise.resolve({ id: "media" }) })).status).toBe(503);
  });
});
