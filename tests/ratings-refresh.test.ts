import { describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { seedRatingTactic, seedRatingUser } from "./rating-fixtures";
import { castVote } from "@/ratings/repository";
import { refreshDueVoteBands } from "@/ratings/refresh";

const NOW = new Date("2026-11-14T00:00:00Z");
const DUE = new Date("2026-11-17T00:00:01Z");

async function setup() {
  const db = createTestDb();
  await seedRatingUser(db, "author");
  await seedRatingUser(db, "u1");
  await seedRatingUser(db, "u2");
  await seedRatingTactic(db, "t1");
  await castVote(db, { userId: "u1", tacticId: "t1", band: "low", works: 5, easy: 4 }, NOW);
  await castVote(db, { userId: "u2", tacticId: "t1", band: "low", works: 4, easy: 3 }, NOW);
  return db;
}

describe("периодическая проверка FACEIT-группы", () => {
  it("после срока переносит голоса и не хранит уровень или эло", async () => {
    const db = await setup();
    const lookup = vi.fn(async () => ({ status: "ready" as const, level: 8, elo: 1703, band: "high" as const }));
    expect(await refreshDueVoteBands(db, lookup, new Date("2026-11-16T23:59:00Z"))).toEqual({ checked: 0, retried: 0 });
    expect(await refreshDueVoteBands(db, lookup, DUE)).toEqual({ checked: 2, retried: 0 });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(await db.all("SELECT DISTINCT band FROM votes ORDER BY band")).toEqual([{ band: "high" }]);
    expect(await db.all("SELECT band, vote_count, works_sum FROM rating_stats WHERE tactic_id = 't1'")).toEqual([
      { band: "high", vote_count: 2, works_sum: 9 },
    ]);
    expect(await db.all("SELECT level, elo, faceit_id FROM faceit_profiles ORDER BY user_id")).toEqual([
      { level: null, elo: null, faceit_id: null },
      { level: null, elo: null, faceit_id: null },
    ]);
    expect(await refreshDueVoteBands(db, lookup, DUE)).toEqual({ checked: 0, retried: 0 });
  });

  it("при сбое сохраняет старую шкалу и повторяет проверку позже", async () => {
    const db = await setup();
    const lookup = vi.fn()
      .mockResolvedValueOnce({ status: "unavailable" })
      .mockResolvedValueOnce({ status: "ready", level: 2, elo: 700, band: "low" })
      .mockResolvedValueOnce({ status: "not_found", band: "none" });
    expect(await refreshDueVoteBands(db, lookup, DUE, 1)).toEqual({ checked: 0, retried: 1 });
    expect(await db.all("SELECT band FROM votes WHERE user_id = 'u1'")).toEqual([{ band: "low" }]);
    expect(await refreshDueVoteBands(db, lookup, new Date(DUE.getTime() + 30 * 60_000), 1)).toEqual({ checked: 1, retried: 0 });
    expect(lookup).toHaveBeenCalledTimes(2); // Следующим стал другой игрок.
    expect(await refreshDueVoteBands(db, lookup, new Date(DUE.getTime() + 60 * 60_000 + 1), 1)).toEqual({ checked: 1, retried: 0 });
    expect(await db.all("SELECT band FROM votes WHERE user_id = 'u1'")).toEqual([{ band: "none" }]);
  });
});
