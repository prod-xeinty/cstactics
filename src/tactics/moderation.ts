import type { Database } from "@/platform";
import { submissionSchema, type Submission } from "./submission";

export interface PendingTactic extends Submission {
  id: string;
  author: string;
  createdAt: string;
}

/** Очередь ограничена первыми 50 заявками, чтобы страница не читала всю D1. */
export async function listPendingTactics(db: Database): Promise<PendingTactic[]> {
  const rows = await db.all<{ id: string; content: string; nickname: string; created_at: string }>(
    `SELECT t.id, t.content, u.nickname, t.created_at
     FROM tactics t JOIN users u ON u.id = t.author_id
     WHERE t.status = 'pending' AND t.source = 'player'
     ORDER BY t.created_at, t.id LIMIT 50`,
  );
  return rows.flatMap((row) => {
    let content: unknown;
    try { content = JSON.parse(row.content); } catch { return []; }
    const parsed = submissionSchema.safeParse(content);
    return parsed.success ? [{ id: row.id, author: row.nickname, createdAt: row.created_at, ...parsed.data }] : [];
  });
}

export type ModerationResult = "ok" | "conflict" | "media_not_ready";

/** Меняем статус и пишем журнал одной транзакцией; повторный запрос не создаёт событие. */
export async function moderateTactic(
  db: Database,
  tacticId: string,
  moderatorId: string,
  action: "published" | "rejected",
  reason: string | null,
): Promise<ModerationResult> {
  if (!tacticId || tacticId.length > 128) return "conflict";
  if (action === "published") {
    const media = await db.first<{ id: string }>(
      `SELECT m.id FROM tactic_media m JOIN tactics t ON t.id = m.tactic_id
       WHERE t.id = ? AND t.status = 'pending'
         AND (m.status != 'published' OR m.public_object_key IS NULL) LIMIT 1`,
      [tacticId],
    );
    if (media) return "media_not_ready";
  }
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const [updated] = await db.batch([
    {
      sql: `UPDATE tactics SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending' AND source = 'player'
            AND (? != 'published' OR NOT EXISTS (
              SELECT 1 FROM tactic_media m WHERE m.tactic_id = tactics.id
                AND (m.status != 'published' OR m.public_object_key IS NULL)))`,
      params: [action, now, tacticId, action],
    },
    {
      sql: `INSERT INTO moderation_events (id, tactic_id, moderator_id, action, reason, created_at)
            SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
      params: [eventId, tacticId, moderatorId, action, reason, now],
    },
  ]);
  return updated.changes === 1 ? "ok" : "conflict";
}
