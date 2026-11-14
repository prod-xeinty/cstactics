import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(`migrations/${file}`, "utf8").replaceAll("--> statement-breakpoint", "\n"));
  }
  return db;
}

describe("модель данных", () => {
  it("применяет миграции и сиды повторно без дублей и публикации демо", () => {
    const db = database();
    const seed = readFileSync("seeds/demo.sql", "utf8");
    db.exec(seed);
    db.exec(seed);
    expect(db.prepare("SELECT count(*) AS count FROM tactics").get()).toEqual({ count: 6 });
    expect(db.prepare("SELECT count(*) AS count FROM clutches").get()).toEqual({ count: 3 });
    expect(db.prepare("SELECT count(*) AS count FROM tactics WHERE status != 'draft' OR game_version != 'unverified-demo'").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT count(*) AS count FROM tactics WHERE json_valid(content) = 0").get()).toEqual({ count: 0 });
    db.close();
  });

  it("ограничивает повторный голос и диапазон оценок", () => {
    const db = database();
    db.exec(readFileSync("seeds/demo.sql", "utf8"));
    const vote = "INSERT INTO votes (user_id, tactic_id, band, works, easy, created_at, updated_at) VALUES ('demo-author','demo-a-split','none',5,4,'2026-10-19','2026-10-19')";
    db.exec(vote);
    expect(() => db.exec(vote)).toThrow();
    expect(() => db.exec(vote.replace("'none',5,4", "'none',6,4").replace("'demo-a-split'", "'demo-b-rush'"))).toThrow();
    db.close();
  });
});
