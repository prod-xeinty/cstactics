import type { FaceitBand } from "@/faceit/client";
import type { Database, SqlStatement } from "@/platform";

const RECHECK_MS = 3 * 24 * 60 * 60 * 1000;
const BANDS: FaceitBand[] = ["low", "mid", "high", "none"];

export interface VoteInput {
  userId: string;
  tacticId: string;
  band: FaceitBand;
  works: number;
  easy: number;
}

export interface BandRating {
  votes: number;
  works: number | null;
  easy: number | null;
}

export type Ratings = Record<FaceitBand, BandRating>;

function checkSchedule(userId: string, now: Date): SqlStatement {
  const checkedAt = now.toISOString();
  const nextCheckAt = new Date(now.getTime() + RECHECK_MS).toISOString();
  return {
    sql: `INSERT INTO faceit_profiles (user_id, faceit_id, level, elo, band, status, checked_at, next_check_at)
          VALUES (?, NULL, NULL, NULL, 'none', 'pending', ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            faceit_id = NULL, level = NULL, elo = NULL, band = 'none', status = 'pending',
            checked_at = excluded.checked_at, next_check_at = excluded.next_check_at
          WHERE faceit_profiles.checked_at IS NULL OR faceit_profiles.checked_at <= excluded.checked_at`,
    params: [userId, checkedAt, nextCheckAt],
  };
}

function rebuildRatings(userId: string, now: Date): SqlStatement[] {
  return [
    {
      sql: "DELETE FROM rating_stats WHERE tactic_id IN (SELECT tactic_id FROM votes WHERE user_id = ?)",
      params: [userId],
    },
    {
      sql: `INSERT INTO rating_stats (tactic_id, band, vote_count, works_sum, easy_sum, updated_at)
            SELECT tactic_id, band, COUNT(*), SUM(works), SUM(easy), ?
            FROM votes WHERE tactic_id IN (SELECT tactic_id FROM votes WHERE user_id = ?)
            GROUP BY tactic_id, band`,
      params: [now.toISOString(), userId],
    },
  ];
}

/** Записать/изменить голос и пересчитать все затронутые шкалы одной транзакцией. */
export async function castVote(db: Database, input: VoteInput, now: Date): Promise<void> {
  const ts = now.toISOString();
  await db.batch([
    { sql: "UPDATE votes SET band = ? WHERE user_id = ? AND band != ?", params: [input.band, input.userId, input.band] },
    {
      sql: `INSERT INTO votes (user_id, tactic_id, band, works, easy, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, tactic_id) DO UPDATE SET
              band = excluded.band, works = excluded.works, easy = excluded.easy, updated_at = excluded.updated_at`,
      params: [input.userId, input.tacticId, input.band, input.works, input.easy, ts, ts],
    },
    checkSchedule(input.userId, now),
    ...rebuildRatings(input.userId, now),
  ]);
}

/** Перенести все голоса игрока после очередной проверки FACEIT. */
export async function moveUserVotes(db: Database, userId: string, band: FaceitBand, now: Date): Promise<void> {
  await db.batch([
    {
      sql: `UPDATE votes SET band = ? WHERE user_id = ? AND band != ?
            AND NOT EXISTS (SELECT 1 FROM faceit_profiles WHERE user_id = ? AND checked_at > ?)`,
      params: [band, userId, band, userId, now.toISOString()],
    },
    checkSchedule(userId, now),
    ...rebuildRatings(userId, now),
  ]);
}

export async function getRatings(db: Database, tacticId: string): Promise<Ratings> {
  const rows = await db.all<{ band: FaceitBand; vote_count: number; works_sum: number; easy_sum: number }>(
    "SELECT band, vote_count, works_sum, easy_sum FROM rating_stats WHERE tactic_id = ?",
    [tacticId],
  );
  const ratings = Object.fromEntries(BANDS.map((band) => [band, { votes: 0, works: null, easy: null }])) as Ratings;
  for (const row of rows) {
    if (!BANDS.includes(row.band)) continue;
    ratings[row.band] = {
      votes: row.vote_count,
      works: row.vote_count >= 5 ? Math.round((row.works_sum / row.vote_count) * 10) / 10 : null,
      easy: row.vote_count >= 5 ? Math.round((row.easy_sum / row.vote_count) * 10) / 10 : null,
    };
  }
  return ratings;
}
