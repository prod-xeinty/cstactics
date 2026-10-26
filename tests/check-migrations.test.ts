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
  it.each([
    ["INSERT INTO t VALUES ('--'); DROP TABLE x;", "DROP"],
    ["DROP/**/TABLE x;", "DROP"],
    ["UPDATE OR REPLACE t SET a = 1;", "UPDATE"],
    ["UPDATE t AS a SET b = 1;", "UPDATE"],
    ["INSERT OR REPLACE INTO t VALUES (1);", "REPLACE"],
    ["REPLACE INTO t VALUES (1);", "REPLACE"],
  ])("обход эвристики не проходит: %s", (sql, op) => {
    expect(findDestructive(sql)).toContain(op);
  });
  it("ON UPDATE / ON DELETE во внешнем ключе — не разрушающие", () => {
    expect(findDestructive("CREATE TABLE s (u text REFERENCES users(id) ON UPDATE no action ON DELETE cascade);")).toEqual([]);
  });
  it("UPDATE в теле триггера ловится", () => {
    expect(findDestructive("CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET x = 1; END;")).toContain("UPDATE");
  });
  it("слова внутри строк не считаются", () => {
    expect(findDestructive("INSERT INTO t VALUES ('DROP TABLE users');")).toEqual([]);
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
