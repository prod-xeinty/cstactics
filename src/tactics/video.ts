export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

export interface InspectedVideo {
  contentType: "video/mp4" | "video/webm";
  extension: "mp4" | "webm";
  size: number;
  checksum: string;
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
const text = (data: Uint8Array, start: number, length: number) => String.fromCharCode(...data.slice(start, start + length));
const mp4Brands = new Set(["isom", "iso2", "mp41", "mp42", "avc1", "dash", "M4V "]);

function isMp4(data: Uint8Array): boolean {
  if (data.length < 16 || text(data, 4, 4) !== "ftyp") return false;
  const size = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
  if (size < 16 || size > data.length || size % 4 !== 0) return false;
  if (mp4Brands.has(text(data, 8, 4))) return true;
  for (let offset = 16; offset + 4 <= size; offset += 4) if (mp4Brands.has(text(data, offset, 4))) return true;
  return false;
}

function readVint(data: Uint8Array, offset: number): { length: number; value: number } | null {
  const first = data[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  let marker = 0x80;
  while (length <= 8 && (first & marker) === 0) { length += 1; marker >>= 1; }
  if (length > 8 || offset + length > data.length) return null;
  let value = first & (marker - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + data[offset + index];
  return { length, value };
}

function isWebm(data: Uint8Array): boolean {
  if (data.length < 12 || data[0] !== 0x1a || data[1] !== 0x45 || data[2] !== 0xdf || data[3] !== 0xa3) return false;
  const headerSize = readVint(data, 4);
  if (!headerSize) return false;
  const start = 4 + headerSize.length;
  const end = start + headerSize.value;
  if (end > data.length) return false;
  for (let offset = start; offset + 3 <= end; offset += 1) {
    if (data[offset] !== 0x42 || data[offset + 1] !== 0x82) continue;
    const size = readVint(data, offset + 2);
    if (!size) return false;
    const valueStart = offset + 2 + size.length;
    return size.value === 4 && valueStart + 4 <= end && text(data, valueStart, 4) === "webm";
  }
  return false;
}

export async function inspectVideo(bytes: ArrayBuffer, claimedType: string): Promise<InspectedVideo> {
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw new Error("Видео должно быть до 10 МБ");
  const data = new Uint8Array(bytes);
  const actual = isMp4(data) ? { contentType: "video/mp4" as const, extension: "mp4" as const }
    : isWebm(data) ? { contentType: "video/webm" as const, extension: "webm" as const }
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
