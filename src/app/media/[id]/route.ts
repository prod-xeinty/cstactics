import { getPlatform } from "@/platform";
import { getCurrentSession } from "@/auth/current-user";

export const dynamic = "force-dynamic";

interface PublicMediaRow {
  private_object_key: string | null;
  public_object_key: string | null;
  content_type: string;
  size_bytes: number;
  media_status: string;
  tactic_status: string;
}

const missing = () => new Response("Видео не найдено", { status: 404, headers: { "Cache-Control": "no-store" } });

type ByteRange = { start: number; end: number } | "invalid" | null;

function parseRange(value: string | null, size: number): ByteRange {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isInteger(suffix) || suffix <= 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) return "invalid";
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return missing();
  const platform = await getPlatform();
  const media = await platform.db.first<PublicMediaRow>(
    `SELECT m.private_object_key, m.public_object_key, m.content_type, m.size_bytes,
            m.status AS media_status, t.status AS tactic_status
     FROM tactic_media m JOIN tactics t ON t.id = m.tactic_id
     WHERE m.id = ? LIMIT 1`,
    [id],
  );
  if (!media) return missing();
  let bucket: "private" | "public";
  let key: string;
  let cacheControl: string;
  if (media.tactic_status === "published" && media.media_status === "published" && media.public_object_key) {
    bucket = "public";
    key = media.public_object_key;
    cacheControl = "public, max-age=3600, immutable";
  } else if (media.tactic_status === "pending" && media.media_status === "verified" && media.private_object_key) {
    const session = await getCurrentSession(request.headers.get("cookie"));
    if (!session || (session.user.role !== "moderator" && session.user.role !== "admin")) return missing();
    bucket = "private";
    key = media.private_object_key;
    cacheControl = "private, no-store";
  } else {
    return missing();
  }
  const storage = platform.media(bucket);
  if (!storage) return new Response("Хранилище видео недоступно", { status: 503, headers: { "Cache-Control": "no-store" } });
  const range = parseRange(request.headers.get("range"), media.size_bytes);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${media.size_bytes}`, "Cache-Control": cacheControl, "Accept-Ranges": "bytes" } });
  }
  let object;
  try { object = range ? await storage.get(key, range) : await storage.get(key); }
  catch { return new Response("Хранилище видео недоступно", { status: 503, headers: { "Cache-Control": "no-store" } }); }
  if (!object) return missing();
  if (object.contentType !== media.content_type || (object.size !== null && object.size !== media.size_bytes)) {
    return new Response("Видео не прошло проверку", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const commonHeaders = {
    "Content-Type": media.content_type,
    "Content-Disposition": "inline",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Accept-Ranges": "bytes",
  };
  if (range) {
    return new Response(object.body, { status: 206, headers: {
      ...commonHeaders,
      "Content-Length": String(range.end - range.start + 1),
      "Content-Range": `bytes ${range.start}-${range.end}/${media.size_bytes}`,
    } });
  }
  return new Response(object.body, {
    headers: {
      ...commonHeaders,
      "Content-Length": String(media.size_bytes),
    },
  });
}
