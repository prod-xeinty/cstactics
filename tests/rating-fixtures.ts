import type { Database } from "@/platform";

export async function seedRatingUser(db: Database, id: string): Promise<void> {
  await db.run(
    "INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES (?, ?, ?, 'user', ?, ?)",
    [id, `7656119${id.padStart(10, "0")}`, id, "2026-11-14T00:00:00Z", "2026-11-14T00:00:00Z"],
  );
}

export async function seedRatingTactic(db: Database, id: string, status = "published"): Promise<void> {
  await db.run(
    `INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at)
     VALUES (?, ?, 'dust2', 'T', 5, 'full', 2, '{}', 'test', 'authors', 'author', ?, ?, ?)`,
    [id, id, status, "2026-11-14T00:00:00Z", "2026-11-14T00:00:00Z"],
  );
}
