import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import type { ObjectStorage, Platform, StoredObject } from "@/platform";
import { prepareTacticMediaForPublication, VideoPublicationError } from "@/tactics/video-publication";

const bytes = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const checksum = "9a3156818dc204048ffebe800a2d4e286e697e597c3d463ae687e76b2bce5353";

function storage(object: StoredObject | null = null): ObjectStorage & { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(async () => object),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

describe("публикация видео", () => {
  let db: ReturnType<typeof createTestDb>;
  let privateStorage: ReturnType<typeof storage>;
  let publicStorage: ReturnType<typeof storage>;
  let platform: Platform;

  beforeEach(async () => {
    db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('author', '76561198000000000', 'Автор', 'user', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES ('tactic', 'tactic', 'dust2', 'T', 5, 'full', 2, '{}', 'v1', 'player', 'author', 'pending', '2026-01-01', '2026-01-01')");
    await db.run("INSERT INTO tactic_media (id, tactic_id, private_object_key, content_type, size_bytes, checksum, status, created_at, verified_at) VALUES ('media', 'tactic', 'pending/tactic/media.mp4', 'video/mp4', 12, ?, 'verified', '2026-01-01', '2026-01-01')", [checksum]);
    privateStorage = storage({ body: new Response(bytes).body!, size: 12, contentType: "video/mp4" });
    publicStorage = storage();
    platform = {
      db,
      media: (bucket) => bucket === "private" ? privateStorage : publicStorage,
      secret: () => undefined,
      publicVar: () => undefined,
      rateLimiter: { hit: vi.fn(async () => ({ ok: true, remaining: 1, retryAfterMs: 0 })) },
    };
  });

  it("повторно проверяет байты и копирует их под новый неизменяемый ключ", async () => {
    const privateKeys = await prepareTacticMediaForPublication(platform, "tactic");

    expect(privateKeys).toEqual(["pending/tactic/media.mp4"]);
    expect(publicStorage.put).toHaveBeenCalledOnce();
    const [key, body, options] = publicStorage.put.mock.calls[0];
    expect(key).toMatch(/^published\/tactic\/media-[0-9a-f-]+\.mp4$/);
    expect(new Uint8Array(body)).toEqual(bytes);
    expect(options).toEqual({ contentType: "video/mp4", onlyIfAbsent: true });
    expect(await db.all("SELECT status, public_object_key FROM tactic_media")).toEqual([{ status: "published", public_object_key: key }]);
  });

  it.each([
    ["размер", { size_bytes: 11, checksum, contentType: "video/mp4" }],
    ["MIME", { size_bytes: 12, checksum, contentType: "video/webm" }],
    ["checksum", { size_bytes: 12, checksum: "0".repeat(64), contentType: "video/mp4" }],
  ])("не публикует, если изменился %s", async (_name, changed) => {
    await db.run("UPDATE tactic_media SET size_bytes = ?, checksum = ? WHERE id = 'media'", [changed.size_bytes, changed.checksum]);
    privateStorage = storage({ body: new Response(bytes).body!, size: 12, contentType: changed.contentType });
    platform = { ...platform, media: (bucket) => bucket === "private" ? privateStorage : publicStorage };

    await expect(prepareTacticMediaForPublication(platform, "tactic")).rejects.toEqual(expect.objectContaining<Partial<VideoPublicationError>>({ code: "invalid" }));
    expect(publicStorage.put).not.toHaveBeenCalled();
    expect(await db.all("SELECT status FROM tactic_media")).toEqual([{ status: "verified" }]);
  });
});
