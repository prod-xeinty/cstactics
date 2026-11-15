import { describe, expect, it } from "vitest";
import { inspectVideo, privateVideoKey } from "@/tactics/video";

const mp4 = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01]);

describe("проверка видео", () => {
  it("распознаёт MP4 по ftyp и считает стабильный SHA-256", async () => {
    await expect(inspectVideo(mp4.buffer, "video/mp4")).resolves.toEqual({
      contentType: "video/mp4",
      extension: "mp4",
      size: 12,
      checksum: "9a3156818dc204048ffebe800a2d4e286e697e597c3d463ae687e76b2bce5353",
    });
  });

  it("распознаёт WebM по EBML", async () => {
    await expect(inspectVideo(webm.buffer, "video/webm")).resolves.toEqual({
      contentType: "video/webm",
      extension: "webm",
      size: 8,
      checksum: "78078cf617e6f4daa97d6890408e1a76ff575393db0af30e3554e3ca30e81cf5",
    });
  });

  it("отклоняет подменённый MIME, неизвестную сигнатуру и файл больше 10 МБ", async () => {
    await expect(inspectVideo(mp4.buffer, "video/webm")).rejects.toThrow("содержимое не совпадает");
    await expect(inspectVideo(new Uint8Array([1, 2, 3, 4]).buffer, "video/mp4")).rejects.toThrow("содержимое не совпадает");
    await expect(inspectVideo(new Uint8Array(10 * 1024 * 1024 + 1).buffer, "video/mp4")).rejects.toThrow("до 10 МБ");
  });

  it("строит приватный ключ только из серверных идентификаторов", () => {
    expect(privateVideoKey("tactic-id", "media-id", "webm")).toBe("pending/tactic-id/media-id.webm");
    expect(() => privateVideoKey("../tactic", "media-id", "mp4")).toThrow("идентификатор");
  });
});
