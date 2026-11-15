export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

export interface InspectedVideo {
  contentType: "video/mp4" | "video/webm";
  extension: "mp4" | "webm";
  size: number;
  checksum: string;
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

export async function inspectVideo(bytes: ArrayBuffer, claimedType: string): Promise<InspectedVideo> {
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw new Error("Видео должно быть до 10 МБ");
  const data = new Uint8Array(bytes);
  const isMp4 = data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  const isWebm = data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3;
  const actual = isMp4 ? { contentType: "video/mp4" as const, extension: "mp4" as const }
    : isWebm ? { contentType: "video/webm" as const, extension: "webm" as const }
      : null;
  if (!actual || actual.contentType !== claimedType) throw new Error("Тип файла и его содержимое не совпадает: нужен mp4 или webm");
  const checksum = hex(await crypto.subtle.digest("SHA-256", bytes));
  return { ...actual, size: data.byteLength, checksum };
}

const safeId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);

export function privateVideoKey(tacticId: string, mediaId: string, extension: "mp4" | "webm"): string {
  if (!safeId(tacticId) || !safeId(mediaId)) throw new Error("Некорректный идентификатор видео");
  return `pending/${tacticId}/${mediaId}.${extension}`;
}
