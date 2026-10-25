import { describe, expect, it } from "vitest";
import { checkDump, combineExports, decryptBackup, encryptBackup, expectedTables, newKeyPair, parseRecipients } from "../scripts/backup-lib.mjs";

// Минимальная копия того, как D1 выгружает: таблицы по алфавиту, sessions ссылается на users.
const SCHEMA = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id));
CREATE TABLE users (id text PRIMARY KEY, nickname text);`;
const DATA = `PRAGMA defer_foreign_keys=TRUE;
INSERT INTO "sessions" VALUES('s1','u1');
INSERT INTO "users" VALUES('u1','игрок');`;
// Полная выгрузка «одним файлом»: схема и данные вперемешку по таблицам.
const FULL_MIXED = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id));
INSERT INTO "sessions" VALUES('s1','u1');
CREATE TABLE users (id text PRIMARY KEY, nickname text);
INSERT INTO "users" VALUES('u1','игрок');`;

describe("бэкап D1", () => {
  it("полная выгрузка вперемешку НЕ восстанавливается — поэтому схема и данные отдельно", () => {
    expect(() => checkDump(FULL_MIXED, ["sessions", "users"])).toThrow(/no such table/);
    expect(checkDump(combineExports(SCHEMA, DATA), ["sessions", "users"])).toEqual({ sessions: 1, users: 1 });
  });

  it("нет таблицы из миграций — ошибка", () => {
    expect(() => checkDump(combineExports(SCHEMA, DATA), ["sessions", "users", "votes"])).toThrow(/нет таблиц: votes/);
  });

  it("сломанный внешний ключ — ошибка", () => {
    const bad = combineExports(SCHEMA, `INSERT INTO "sessions" VALUES('s1','нет-такого');`);
    expect(() => checkDump(bad, ["sessions", "users"])).toThrow(/FOREIGN KEY|внешние ключи/);
  });

  it("таблицы берутся из миграций проекта", () => {
    expect(expectedTables()).toEqual(expect.arrayContaining(["users", "sessions", "openid_nonces"]));
  });

  it("шифрование: расшифровывается только своим ключом, без изменений", async () => {
    const a = await newKeyPair();
    const b = await newKeyPair();
    const sql = combineExports(SCHEMA, DATA);
    const enc = await encryptBackup(sql, [a.recipient]);
    expect(new TextDecoder().decode(enc)).not.toContain("игрок");
    expect(await decryptBackup(enc, a.identity)).toBe(sql);
    await expect(decryptBackup(enc, b.identity)).rejects.toThrow();
  });

  it("получатели: комментарии пропускаются, мусор — ошибка, пусто — нельзя шифровать", async () => {
    const { recipient } = await newKeyPair();
    expect(parseRecipients(`# комментарий\n\n${recipient}\n`)).toEqual([recipient]);
    expect(() => parseRecipients("AGE-SECRET-KEY-1XXXX")).toThrow(/публичный ключ/);
    await expect(encryptBackup("x", [])).rejects.toThrow(/нет получателей/);
  });
});
