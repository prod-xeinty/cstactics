import { getPlatform } from "@/platform";

export const dynamic = "force-dynamic";

interface PublicMediaRow {
  public_object_key: string;
  content_type: string;
  size_bytes: number;
}

const missing = () => new Response("Видео не найдено", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return missing();
  const platform = await getPlatform();
  const media = await platform.db.first<PublicMediaRow>(
    `SELECT m.public_object_key, m.content_type, m.size_bytes
     FROM tactic_media m JOIN tactics t ON t.id = m.tactic_id
     WHERE m.id = ? AND m.status = 'published' AND m.public_object_key IS NOT NULL
       AND t.status = 'published' LIMIT 1`,
    [id],
  );
  if (!media) return missing();
  const storage = platform.media("public");
  if (!storage) return new Response("Хранилище видео недоступно", { status: 503, headers: { "Cache-Control": "no-store" } });
  let object;
  try { object = await storage.get(media.public_object_key); }
  catch { return new Response("Хранилище видео недоступно", { status: 503, headers: { "Cache-Control": "no-store" } }); }
  if (!object) return missing();
  if (object.contentType !== media.content_type || (object.size !== null && object.size !== media.size_bytes)) {
    return new Response("Видео не прошло проверку", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": media.content_type,
      "Content-Length": String(media.size_bytes),
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=3600, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
