import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { getPublishedDetail } from "@/tactics/detail";

describe("страница разбора тактики", () => {
  it("отдаёт только опубликованную тактику по slug с ролями, гранатами и оценками", async () => {
    const db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Игрок', 'user', '2026-01-01', '2026-01-01')");
    const content = JSON.stringify({
      title: "Разбор", call: "Короткий колл", quick: ["Первый шаг", "Второй шаг"],
      roles: [{ spawnZone: "центр", task: "Задача", nades: "Смок", fixed: false }], roleFallback: "Запасной вариант",
      nades: [{ who: "Игрок 1", type: "smoke", to: "крест", when: "После колла", why: "Закрыть проход" }],
      flow: "Ход раунда", fallback: "План Б", postPlant: "После плента", counters: "Контр-ход",
      videoUrl: "https://example.org/unsafe.mp4",
    });
    for (const [id, status] of [["pub", "published"], ["pending", "pending"]] as const) {
      await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES (?, ?, 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'player', 'u', ?, '2026-01-01', '2026-01-01')", [id, id, content, status]);
    }
    await db.run("INSERT INTO rating_stats (tactic_id, band, vote_count, works_sum, easy_sum, updated_at) VALUES ('pub', 'high', 5, 20, 15, '2026-01-01'), ('pub', 'mid', 4, 20, 16, '2026-01-01')");
    const detail = await getPublishedDetail(db, "pub");
    expect(detail).toMatchObject({ slug: "pub", title: "Разбор", author: "Игрок", quick: ["Первый шаг", "Второй шаг"], flow: ["Ход раунда"], roleFallback: "Запасной вариант", videoUrl: null });
    expect(detail?.roles).toHaveLength(1);
    expect(detail?.nades[0]).toMatchObject({ type: "smoke", to: "крест", when: "После колла" });
    expect(detail?.ratings.high).toMatchObject({ votes: 5, works: 4, easy: 3 });
    expect(detail?.ratings.mid).toMatchObject({ votes: 4, works: null, easy: null });
    expect(await getPublishedDetail(db, "pending")).toBeNull();
    expect(await getPublishedDetail(db, "absent")).toBeNull();
  });
});
