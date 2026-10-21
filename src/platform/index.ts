export type { Database, MediaBucket, ObjectStorage, Platform, SecretName, StoredObjectInfo } from "./types";

// Реализация подгружается лениво: под обычным `next dev` модуля `cloudflare:workers` нет,
// и статический импорт ронял бы весь маршрут ещё до первой проверки.
export async function getPlatform() {
  const { getPlatform: create } = await import("./cloudflare");
  return create();
}
