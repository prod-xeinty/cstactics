import type { Database } from "@/platform";
import type { CatalogBand, CatalogTactic } from "./catalog";

export type BandScore = { votes: number; works: number | null; easy: number | null };
export type PersonalTactic = CatalogTactic & { scores: Record<CatalogBand, BandScore> };
const bands: CatalogBand[] = ["low", "mid", "high"];

export async function listPersonalized(db: Database): Promise<PersonalTactic[]> {
  const rows = await db.all<{ id: string; slug: string; content: string; side: "T" | "CT"; team_size: number; economy: string; difficulty: number; source: "authors" | "player"; nickname: string }>(
    "SELECT t.id, t.slug, t.content, t.side, t.team_size, t.economy, t.difficulty, t.source, u.nickname FROM tactics t JOIN users u ON u.id = t.author_id WHERE t.map = 'dust2' AND t.status = 'published' ORDER BY t.created_at DESC, t.id",
  );
  const stats = await db.all<{ tactic_id: string; band: CatalogBand; vote_count: number; works_sum: number; easy_sum: number }>(
    "SELECT rs.tactic_id, rs.band, rs.vote_count, rs.works_sum, rs.easy_sum FROM rating_stats rs JOIN tactics t ON t.id = rs.tactic_id WHERE t.map = 'dust2' AND t.status = 'published' AND rs.band IN ('low','mid','high')",
  );
  const scores = new Map<string, Record<CatalogBand, BandScore>>();
  for (const row of rows) scores.set(row.id, { low: { votes: 0, works: null, easy: null }, mid: { votes: 0, works: null, easy: null }, high: { votes: 0, works: null, easy: null } });
  for (const stat of stats) {
    const item = scores.get(stat.tactic_id);
    if (!item || !bands.includes(stat.band)) continue;
    item[stat.band] = { votes: stat.vote_count, works: stat.vote_count >= 5 ? stat.works_sum / stat.vote_count : null, easy: stat.vote_count >= 5 ? stat.easy_sum / stat.vote_count : null };
  }
  return rows.flatMap((row) => {
    let content: unknown;
    try { content = JSON.parse(row.content); } catch { return []; }
    if (!content || typeof content !== "object") return [];
    const data = content as Record<string, unknown>;
    if (typeof data.title !== "string" || typeof data.call !== "string") return [];
    return [{ id: row.id, slug: row.slug, title: data.title, call: data.call, side: row.side, teamSize: row.team_size, economy: row.economy, difficulty: row.difficulty, source: row.source, author: row.nickname, voteCount: 0, works: null, easy: null, scores: scores.get(row.id)! }];
  });
}

export function splitPersonalized(items: PersonalTactic[], band: CatalogBand): { recommended: PersonalTactic[]; other: PersonalTactic[] } {
  const ordered = [...items].sort((a, b) => (b.scores[band].works ?? -1) - (a.scores[band].works ?? -1) || a.title.localeCompare(b.title, "ru"));
  return {
    recommended: ordered.filter((item) => item.scores[band].votes >= 5 && (item.scores[band].works ?? 0) >= 4),
    other: ordered.filter((item) => item.scores[band].votes < 5 || (item.scores[band].works ?? 0) < 4),
  };
}
