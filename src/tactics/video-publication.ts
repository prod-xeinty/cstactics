import type { Platform, StoredObject } from "@/platform";
import { inspectVideo, MAX_VIDEO_BYTES } from "./video";

export type VideoPublicationErrorCode = "not_ready" | "invalid" | "unavailable";

export class VideoPublicationError extends Error {
  constructor(public readonly code: VideoPublicationErrorCode) {
    super(code);
    this.name = "VideoPublicationError";
  }
}

interface MediaRow {
  id: string;
  private_object_key: string | null;
  public_object_key: string | null;
  content_type: string;
  size_bytes: number;
  checksum: string;
  status: string;
}

async function readLimited(object: StoredObject): Promise<ArrayBuffer> {
  if (object.size !== null && object.size > MAX_VIDEO_BYTES) throw new VideoPublicationError("invalid");
  const reader = object.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    total += chunk.byteLength;
    if (total > MAX_VIDEO_BYTES) {
      await reader.cancel();
      throw new VideoPublicationError("invalid");
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

/** Возвращает приватные ключи, которые можно удалить только после публикации тактики в D1. */
export async function prepareTacticMediaForPublication(platform: Platform, tacticId: string): Promise<string[]> {
  const rows = await platform.db.all<MediaRow>(
    `SELECT m.id, m.private_object_key, m.public_object_key, m.content_type, m.size_bytes, m.checksum, m.status
     FROM tactic_media m JOIN tactics t ON t.id = m.tactic_id
     WHERE m.tactic_id = ? AND t.status = 'pending' ORDER BY m.id`,
    [tacticId],
  );
  if (rows.length === 0) return [];
  const privateStorage = platform.media("private");
  const publicStorage = platform.media("public");
  if (!privateStorage || !publicStorage) throw new VideoPublicationError("unavailable");
  const privateKeys: string[] = [];

  for (const row of rows) {
    if (row.status === "published" && row.public_object_key) {
      if (row.private_object_key) privateKeys.push(row.private_object_key);
      continue;
    }
    if (row.status !== "verified" || !row.private_object_key) throw new VideoPublicationError("not_ready");
    let object: StoredObject | null;
    try { object = await privateStorage.get(row.private_object_key); }
    catch { throw new VideoPublicationError("unavailable"); }
    if (!object || object.contentType !== row.content_type) throw new VideoPublicationError("invalid");
    let bytes: ArrayBuffer;
    let inspected: Awaited<ReturnType<typeof inspectVideo>>;
    try {
      bytes = await readLimited(object);
      inspected = await inspectVideo(bytes, row.content_type);
    } catch (error) {
      if (error instanceof VideoPublicationError) throw error;
      throw new VideoPublicationError("invalid");
    }
    if ((object.size !== null && object.size !== inspected.size) || inspected.size !== row.size_bytes || inspected.checksum !== row.checksum) {
      throw new VideoPublicationError("invalid");
    }
    const publicKey = `published/${tacticId}/${row.id}-${crypto.randomUUID()}.${inspected.extension}`;
    try {
      await publicStorage.put(publicKey, bytes, { contentType: inspected.contentType, onlyIfAbsent: true });
    } catch { throw new VideoPublicationError("unavailable"); }
    try {
      const updated = await platform.db.run(
        `UPDATE tactic_media SET public_object_key = ?, status = 'published'
         WHERE id = ? AND tactic_id = ? AND status = 'verified' AND private_object_key = ?
           AND content_type = ? AND size_bytes = ? AND checksum = ?`,
        [publicKey, row.id, tacticId, row.private_object_key, inspected.contentType, inspected.size, inspected.checksum],
      );
      if (updated.changes !== 1) {
        await publicStorage.delete(publicKey).catch(() => undefined);
        throw new VideoPublicationError("not_ready");
      }
    } catch (error) {
      if (error instanceof VideoPublicationError) throw error;
      await publicStorage.delete(publicKey).catch(() => undefined);
      throw new VideoPublicationError("unavailable");
    }
    privateKeys.push(row.private_object_key);
  }
  return privateKeys;
}
