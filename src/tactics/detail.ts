import type { Database } from "@/platform";
import { getRatings, type Ratings } from "@/ratings/repository";

export interface TacticDetail {
  id: string; slug: string; title: string; call: string; quick: string[];
  side: "T" | "CT"; teamSize: number; economy: string; difficulty: number;
  gameVersion: string; author: string; source: "authors" | "player";
  roles: { spawnZone: string; task: string; nades: string; fixed: boolean }[];
  roleFallback: string; nades: { who: string; type: string; to: string; from: string; when: string; why: string }[];
  flow: string[]; fallback: string; postPlant: string; counters: string; videoUrl: string | null;
  ratings: Ratings;
}

const value = (item: unknown) => typeof item === "string" ? item : "";
const lines = (item: unknown): string[] => Array.isArray(item) ? item.filter((part): part is string => typeof part === "string") : typeof item === "string" && item.trim() ? [item] : [];
const records = (item: unknown): Record<string, unknown>[] => Array.isArray(item) ? item.filter((part): part is Record<string, unknown> => !!part && typeof part === "object" && !Array.isArray(part)) : [];

export async function getPublishedDetail(db: Database, slug: string): Promise<TacticDetail | null> {
  if (!slug || slug.length > 128) return null;
  const row = await db.first<{ id: string; slug: string; content: string; side: "T" | "CT"; team_size: number; economy: string; difficulty: number; game_version: string; source: "authors" | "player"; nickname: string }>(
    `SELECT t.id, t.slug, t.content, t.side, t.team_size, t.economy, t.difficulty, t.game_version, t.source, u.nickname
     FROM tactics t JOIN users u ON u.id = t.author_id
     WHERE t.slug = ? AND t.map = 'dust2' AND t.status = 'published'`, [slug],
  );
  if (!row) return null;
  let content: unknown;
  try { content = JSON.parse(row.content); } catch { return null; }
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const data = content as Record<string, unknown>;
  if (!value(data.title) || !value(data.call)) return null;
  return {
    id: row.id, slug: row.slug, title: value(data.title), call: value(data.call), quick: lines(data.quick).slice(0, 4),
    side: row.side, teamSize: row.team_size, economy: row.economy, difficulty: row.difficulty,
    gameVersion: row.game_version, author: row.nickname, source: row.source,
    roles: records(data.roles).map((r) => ({ spawnZone: value(r.spawnZone), task: value(r.task), nades: value(r.nades), fixed: r.fixed === true })),
    roleFallback: value(data.roleFallback),
    nades: records(data.nades).map((n) => ({ who: value(n.who), type: value(n.type), to: value(n.to), from: value(n.from), when: value(n.when), why: value(n.why) })),
    flow: lines(data.flow), fallback: value(data.fallback), postPlant: value(data.postPlant), counters: value(data.counters),
    videoUrl: typeof data.videoUrl === "string" && data.videoUrl.startsWith("/media/") ? data.videoUrl : null,
    ratings: await getRatings(db, row.id),
  };
}
