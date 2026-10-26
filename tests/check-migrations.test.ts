import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { findDestructive } from "../scripts/check-migrations.mjs";

describe("проверка миграций", () => {
  it("добавляющие — ок", () => {
    expect(findDestructive("CREATE TABLE x (id text);\nALTER TABLE x ADD COLUMN y text DEFAULT '';\nCREATE INDEX i ON x(y);")).toEqual([]);
  });
  it.each([
    ["DROP TABLE users;", "DROP"],
    ["ALTER TABLE users DROP COLUMN nickname;", "DROP"],
    ["ALTER TABLE users RENAME TO players;", "переименование"],
    ["DELETE FROM sessions;", "DELETE"],
    ["UPDATE users SET role = 'admin';", "UPDATE"],
  ])("разрушающая: %s", (sql, op) => {
    expect(findDestructive(sql)).toContain(op);
  });
  it("комментарии не считаются", () => {
    expect(findDestructive("-- DROP TABLE users — так не делаем\nCREATE TABLE x (id text);")).toEqual([]);
  });
  it("текущие миграции проекта — добавляющие", () => {
    for (const f of readdirSync("migrations").filter((n) => n.endsWith(".sql"))) {
      expect(findDestructive(readFileSync(`migrations/${f}`, "utf8")), f).toEqual([]);
    }
  });
});
