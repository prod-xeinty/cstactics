import type { Database } from "@/platform";

export interface UserRow {
  id: string;
  steam_id64: string;
  nickname: string;
  avatar_url: string | null;
  role: "user" | "moderator" | "admin";
}

/** Создать игрока при первом входе или обновить ник и аватар при следующих. Роль не трогаем. */
export async function upsertSteamUser(
  db: Database,
  input: { steamId64: string; nickname: string; avatarUrl: string | null },
  now: Date,
): Promise<UserRow> {
  const ts = now.toISOString();
  const row = await db.first<UserRow>(
    `INSERT INTO users (id, steam_id64, nickname, avatar_url, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'user', ?, ?)
     ON CONFLICT (steam_id64) DO UPDATE SET
       nickname = excluded.nickname,
       avatar_url = excluded.avatar_url,
       updated_at = excluded.updated_at
     RETURNING id, steam_id64, nickname, avatar_url, role`,
    [crypto.randomUUID(), input.steamId64, input.nickname, input.avatarUrl, ts, ts],
  );
  if (!row) throw new Error("upsert users не вернул строку");
  return row;
}
