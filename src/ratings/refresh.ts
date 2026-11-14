import type { FaceitLookup } from "@/faceit/client";
import type { Database } from "@/platform";
import { moveUserVotes } from "./repository";

const RETRY_MS = 60 * 60 * 1000;

/** Небольшая партия игроков с голосами. Уровень и эло не сохраняются. */
export async function refreshDueVoteBands(
  db: Database,
  lookup: (steamId64: string) => Promise<FaceitLookup>,
  now: Date,
  limit = 10,
): Promise<{ checked: number; retried: number }> {
  const users = await db.all<{ id: string; steam_id64: string }>(
    `SELECT u.id, u.steam_id64 FROM users u
     LEFT JOIN faceit_profiles fp ON fp.user_id = u.id
     WHERE EXISTS (SELECT 1 FROM votes v WHERE v.user_id = u.id)
       AND (fp.next_check_at IS NULL OR fp.next_check_at <= ?)
     ORDER BY fp.next_check_at, u.id LIMIT ?`,
    [now.toISOString(), Math.max(1, Math.min(50, Math.trunc(limit)))],
  );

  let checked = 0;
  let retried = 0;
  for (const user of users) {
    let result: FaceitLookup;
    try {
      result = await lookup(user.steam_id64);
    } catch {
      result = { status: "unavailable" };
    }
    if (result.status === "unavailable") {
      await db.run(
        `INSERT INTO faceit_profiles (user_id, faceit_id, level, elo, band, status, next_check_at)
         VALUES (?, NULL, NULL, NULL, 'none', 'pending', ?)
         ON CONFLICT(user_id) DO UPDATE SET
           faceit_id = NULL, level = NULL, elo = NULL, band = 'none', status = 'pending',
           next_check_at = excluded.next_check_at
         WHERE faceit_profiles.checked_at IS NULL OR faceit_profiles.checked_at <= ?`,
        [user.id, new Date(now.getTime() + RETRY_MS).toISOString(), now.toISOString()],
      );
      retried++;
      continue;
    }
    await moveUserVotes(db, user.id, result.band, now);
    checked++;
  }
  return { checked, retried };
}
