import type { Database } from "@/platform";

export type CatalogBand = "low" | "mid" | "high";
export type CatalogSide = "all" | "T" | "CT";
export type CatalogTeam = "all" | "2" | "3" | "5";
export interface CatalogFilters { side: CatalogSide; team: CatalogTeam; band: CatalogBand }
export interface CatalogTactic {
  id: string;
  title: string;
  call: string;
  side: "T" | "CT";
  teamSize: number;
  economy: string;
  difficulty: number;
  voteCount: number;
  works: number | null;
  easy: number | null;
}

export function parseCatalogFilters(params: Record<string, string | string[] | undefined>): CatalogFilters {
  return {
    side: params.side === "T" || params.side === "CT" ? params.side : "all",
    team: params.team === "2" || params.team === "3" || params.team === "5" ? params.team : "all",
    band: params.band === "low" || params.band === "high" ? params.band : "mid",
  };
}

interface Row { id: string; content: string; side: "T" | "CT"; team_size: number; economy: string; difficulty: number; vote_count: number | null; works_sum: number | null; easy_sum: number | null }

export async function listCatalog(db: Database, filters: CatalogFilters): Promise<CatalogTactic[]> {
  const rows = await db.all<Row>(
    `SELECT t.id, t.content, t.side, t.team_size, t.economy, t.difficulty,
            rs.vote_count, rs.works_sum, rs.easy_sum
     FROM tactics t LEFT JOIN rating_stats rs ON rs.tactic_id = t.id AND rs.band = ?
     WHERE t.map = 'dust2' AND t.status = 'published'
       AND (? = 'all' OR t.side = ?)
       AND (? = 'all' OR t.team_size = CAST(? AS INTEGER))
     ORDER BY CASE WHEN rs.vote_count >= 5 THEN 0 ELSE 1 END,
              CASE WHEN rs.vote_count >= 5 THEN CAST(rs.works_sum AS REAL) / rs.vote_count END DESC,
              t.created_at DESC, t.id
     LIMIT 100`,
    [filters.band, filters.side, filters.side, filters.team, filters.team],
  );
  return rows.flatMap((row) => {
    let content: unknown;
    try { content = JSON.parse(row.content); } catch { return []; }
    if (!content || typeof content !== "object") return [];
    const data = content as Record<string, unknown>;
    if (typeof data.title !== "string" || typeof data.call !== "string") return [];
    const count = row.vote_count ?? 0;
    return [{
      id: row.id, title: data.title, call: data.call,
      side: row.side, teamSize: row.team_size, economy: row.economy, difficulty: row.difficulty,
      voteCount: count,
      works: count >= 5 && row.works_sum !== null ? Math.round(row.works_sum / count * 10) / 10 : null,
      easy: count >= 5 && row.easy_sum !== null ? Math.round(row.easy_sum / count * 10) / 10 : null,
    }];
  });
}
