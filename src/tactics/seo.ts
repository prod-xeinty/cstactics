import type { Database } from "@/platform";

export interface PublishedTacticSeo {
  slug: string;
  title: string;
  call: string;
  updatedAt: string;
}

interface Row { slug: string; content: string; updated_at: string }

function parseRow(row: Row): PublishedTacticSeo | null {
  if (!row.slug || row.slug.length > 128) return null;
  let content: unknown;
  try { content = JSON.parse(row.content); } catch { return null; }
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const { title, call } = content as Record<string, unknown>;
  if (typeof title !== "string" || !title.trim() || typeof call !== "string" || !call.trim()) return null;
  return { slug: row.slug, title, call, updatedAt: row.updated_at };
}

export async function getPublishedTacticSeo(db: Database, slug: string): Promise<PublishedTacticSeo | null> {
  if (!slug || slug.length > 128) return null;
  const row = await db.first<Row>(
    "SELECT slug, content, updated_at FROM tactics WHERE slug = ? AND map = 'dust2' AND status = 'published'",
    [slug],
  );
  return row ? parseRow(row) : null;
}

export async function listPublishedTacticSeo(db: Database): Promise<PublishedTacticSeo[]> {
  const rows = await db.all<Row>(
    "SELECT slug, content, updated_at FROM tactics WHERE map = 'dust2' AND status = 'published' ORDER BY updated_at DESC, slug LIMIT 50000",
  );
  return rows.flatMap((row) => { const parsed = parseRow(row); return parsed ? [parsed] : []; });
}
