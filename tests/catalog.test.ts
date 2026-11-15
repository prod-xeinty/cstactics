import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { hasPublishedTactics, listCatalog, parseCatalogFilters } from "@/tactics/catalog";

describe("каталог тактик", () => {
  it("игнорирует неизвестные значения фильтров", () => {
    expect(parseCatalogFilters({ side: "bad", team: "4", band: "none" })).toEqual({ side: "all", team: "all", band: "mid" });
  });

  it("совмещает фильтры и сортирует по выбранной шкале, скрывая среднее до пяти голосов", async () => {
    const db = createTestDb();
    expect(await hasPublishedTactics(db)).toBe(false);
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Игрок', 'user', '2026-01-01', '2026-01-01')");
    for (const [id, side, team, title] of [["a", "T", 5, "Альфа"], ["b", "T", 5, "Бета"], ["c", "CT", 3, "Гамма"]] as const) {
      await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES (?, ?, 'dust2', ?, ?, 'full', 2, ?, 'v1', 'authors', 'u', 'published', '2026-01-01', '2026-01-01')", [id, id, side, team, JSON.stringify({ title, call: "Колл" })]);
    }
    await db.run("INSERT INTO rating_stats (tactic_id, band, vote_count, works_sum, easy_sum, updated_at) VALUES ('a','high',5,20,15,'2026-01-01'),('b','high',5,25,20,'2026-01-01'),('a','mid',4,20,16,'2026-01-01')");
    expect(await hasPublishedTactics(db)).toBe(true);
    const high = await listCatalog(db, { side: "T", team: "5", band: "high" });
    expect(high.map((t) => [t.id, t.works])).toEqual([["b", 5], ["a", 4]]);
    const mid = await listCatalog(db, { side: "T", team: "5", band: "mid" });
    expect(mid.find((t) => t.id === "a")).toMatchObject({ voteCount: 4, works: null, easy: null });
    expect(await listCatalog(db, { side: "CT", team: "2", band: "high" })).toEqual([]);
    // Пустой результат фильтра не означает, что весь каталог ещё демо.
    expect(await hasPublishedTactics(db)).toBe(true);
  });

  it("показывает автора опубликованной игроком тактики и скрывает pending", async () => {
    const db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Игрок', 'user', '2026-01-01', '2026-01-01')");
    for (const [id, status] of [["yes", "published"], ["no", "pending"]] as const) {
      await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES (?, ?, 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'player', 'u', ?, '2026-01-01', '2026-01-01')", [id, id, JSON.stringify({ title: "Колл", call: "Лонг" }), status]);
    }
    expect(await listCatalog(db, { side: "all", team: "all", band: "mid" })).toMatchObject([{ id: "yes", source: "player", author: "Игрок" }]);
  });
});
