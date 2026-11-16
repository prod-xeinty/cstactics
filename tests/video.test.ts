import { describe, expect, it } from "vitest";
import { inspectVideo, privateVideoKey } from "@/tactics/video";
import { MP4_BYTES, MP4_SHA256, WEBM_BYTES, WEBM_SHA256 } from "./video-fixtures";

describe("проверка видео", () => {
  it("распознаёт MP4 по ftyp и считает стабильный SHA-256", async () => {
    await expect(inspectVideo(MP4_BYTES.buffer, "video/mp4")).resolves.toEqual({
      contentType: "video/mp4",
      extension: "mp4",
      size: 24,
      checksum: MP4_SHA256,
    });
  });

  it("распознаёт WebM по EBML", async () => {
    await expect(inspectVideo(WEBM_BYTES.buffer, "video/webm")).resolves.toEqual({
      contentType: "video/webm",
      extension: "webm",
      size: 12,
      checksum: WEBM_SHA256,
    });
  });

  it("отклоняет подменённый MIME, неизвестную сигнатуру и файл больше 10 МБ", async () => {
    await expect(inspectVideo(MP4_BYTES.buffer, "video/webm")).rejects.toThrow("содержимое не совпадает");
    await expect(inspectVideo(new Uint8Array([1, 2, 3, 4]).buffer, "video/mp4")).rejects.toThrow("содержимое не совпадает");
    await expect(inspectVideo(new Uint8Array(10 * 1024 * 1024 + 1).buffer, "video/mp4")).rejects.toThrow("до 10 МБ");
  });

  it("отклоняет обрезанный EBML и AVIF с box ftyp", async () => {
    await expect(inspectVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]).buffer, "video/webm")).rejects.toThrow("содержимое не совпадает");
    const avif = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0]);
    await expect(inspectVideo(avif.buffer, "video/mp4")).rejects.toThrow("содержимое не совпадает");
  });

  it("строит приватный ключ только из серверных идентификаторов", () => {
    expect(privateVideoKey("tactic-id", "media-id", "webm")).toBe("pending/tactic-id/media-id.webm");
    expect(() => privateVideoKey("../tactic", "media-id", "mp4")).toThrow("идентификатор");
  });
});
