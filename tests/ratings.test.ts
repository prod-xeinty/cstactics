import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { seedRatingTactic, seedRatingUser } from "./rating-fixtures";
import { castVote, getRatings, moveUserVotes } from "@/ratings/repository";

const NOW = new Date("2026-11-14T01:00:00Z");

async function setup() {
  const db = createTestDb();
  await seedRatingUser(db, "author");
  await seedRatingUser(db, "u1");
  await seedRatingUser(db, "u2");
  await seedRatingTactic(db, "t1");
  await seedRatingTactic(db, "t2");
  return db;
}

describe("голоса и агрегаты", () => {
  it("первый и повторный голос сохраняют одну строку и точные суммы", async () => {
    const db = await setup();
    await castVote(db, { userId: "u1", tacticId: "t1", band: "low", works: 5, easy: 4 }, NOW);
    await castVote(db, { userId: "u1", tacticId: "t1", band: "low", works: 3, easy: 2 }, NOW);
    expect(await db.all("SELECT user_id, tactic_id, band, works, easy FROM votes")).toEqual([
      { user_id: "u1", tactic_id: "t1", band: "low", works: 3, easy: 2 },
    ]);
    expect(await db.all("SELECT band, vote_count, works_sum, easy_sum FROM rating_stats WHERE tactic_id = 't1'")).toEqual([
      { band: "low", vote_count: 1, works_sum: 3, easy_sum: 2 },
    ]);
  });

  it("средние скрыты до пяти голосов в каждой шкале", async () => {
    const db = await setup();
    for (let i = 1; i <= 5; i++) {
      const id = `v${i}`;
      await seedRatingUser(db, id);
      await castVote(db, { userId: id, tacticId: "t1", band: "mid", works: i, easy: 4 }, NOW);
      const ratings = await getRatings(db, "t1");
      expect(ratings.mid.votes).toBe(i);
      expect(ratings.mid.works).toBe(i < 5 ? null : 3);
      expect(ratings.mid.easy).toBe(i < 5 ? null : 4);
    }
    expect((await getRatings(db, "t1")).low).toEqual({ votes: 0, works: null, easy: null });
  });

  it("при переходе игрока в другую шкалу переносит все его голоса без двойного учёта", async () => {
    const db = await setup();
    await castVote(db, { userId: "u1", tacticId: "t1", band: "low", works: 5, easy: 4 }, NOW);
    await castVote(db, { userId: "u1", tacticId: "t2", band: "low", works: 2, easy: 3 }, NOW);
    await castVote(db, { userId: "u2", tacticId: "t1", band: "low", works: 4, easy: 5 }, NOW);
    await moveUserVotes(db, "u1", "high", NOW);
    await moveUserVotes(db, "u1", "high", NOW);
    expect(await db.all("SELECT tactic_id, band, vote_count, works_sum FROM rating_stats ORDER BY tactic_id, band")).toEqual([
      { tactic_id: "t1", band: "high", vote_count: 1, works_sum: 5 },
      { tactic_id: "t1", band: "low", vote_count: 1, works_sum: 4 },
      { tactic_id: "t2", band: "high", vote_count: 1, works_sum: 2 },
    ]);
    expect(await db.all("SELECT DISTINCT band FROM votes WHERE user_id = 'u1'")).toEqual([{ band: "high" }]);
  });

  it("запоздавшая фоновая проверка не отменяет более свежий голос", async () => {
    const db = await setup();
    const later = new Date(NOW.getTime() + 60_000);
    await castVote(db, { userId: "u1", tacticId: "t1", band: "high", works: 5, easy: 4 }, later);
    await moveUserVotes(db, "u1", "low", NOW);
    expect(await db.all("SELECT band FROM votes WHERE user_id = 'u1'")).toEqual([{ band: "high" }]);
    expect(await db.all("SELECT checked_at FROM faceit_profiles WHERE user_id = 'u1'")).toEqual([{ checked_at: later.toISOString() }]);
  });

  it("ошибка в середине batch откатывает все записи", async () => {
    const db = createTestDb();
    await expect(db.batch([
      { sql: "INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000001', 'u', 'user', 'now', 'now')" },
      { sql: "INSERT INTO missing_table VALUES (1)" },
    ])).rejects.toThrow();
    expect(await db.all("SELECT id FROM users WHERE id = 'u'")).toEqual([]);
  });
});
