import { describe, expect, it } from "vitest";
import { listPersonalized, splitPersonalized, type PersonalTactic } from "@/tactics/personalized";
import { createTestDb } from "./sqlite-db";

const score = (votes: number, works: number | null) => ({ votes, works, easy: works });
const tactic = (id: string, votes: number, works: number | null): PersonalTactic => ({
  id, slug: id, title: id, call: "Колл", side: "T", teamSize: 5, economy: "full", difficulty: 2,
  voteCount: 0, works: null, easy: null,
  source: "authors", author: "Игрок",
  scores: { low: score(0, null), mid: score(0, null), high: score(votes, works) },
});

describe("подборка по FACEIT-шкале", () => {
  it("рекомендует только оценку от 4 и минимум пять голосов", () => {
    const result = splitPersonalized([tactic("мало", 4, null), tactic("слабая", 20, 3.95), tactic("хорошая", 5, 4.2)], "high");
    expect(result.recommended.map((item) => item.id)).toEqual(["хорошая"]);
    expect(result.other.map((item) => item.id)).toEqual(["слабая", "мало"]);
  });

  it("не теряет старую высоко оценённую тактику после сотни новых", async () => {
    const db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Игрок', 'user', '2026-01-01', '2026-01-01')");
    for (let i = 0; i <= 100; i++) {
      const id = `t${i}`;
      await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES (?, ?, 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'authors', 'u', 'published', ?, ?)", [id, id, JSON.stringify({ title: id, call: "Колл" }), `2026-01-${String(i === 0 ? 1 : 2).padStart(2, "0")}`, "2026-01-02"]);
    }
    await db.run("INSERT INTO rating_stats (tactic_id, band, vote_count, works_sum, easy_sum, updated_at) VALUES ('t0', 'high', 5, 25, 20, '2026-01-02')");
    const items = await listPersonalized(db);
    expect(items).toHaveLength(101);
    expect(splitPersonalized(items, "high").recommended.map((item) => item.id)).toContain("t0");
  });
});
