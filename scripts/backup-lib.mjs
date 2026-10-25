// Бэкапы D1: шифрование (age, X25519) и проверка, что выгрузка восстанавливается.
// Без побочных эффектов сети — используется в backup-run, backup-selftest и тестах.
import { readFileSync, readdirSync } from "node:fs";
import { posix, win32 } from "node:path";
import { Decrypter, Encrypter, generateX25519Identity, identityToRecipient } from "age-encryption";

/** Вырезать ссылки из вывода wrangler: `d1 export` печатает подписанную ссылку на открытую выгрузку. */
export function scrubUrls(text) {
  return String(text ?? "").replace(/https?:\/\/\S+/g, "[url]");
}

/** Лежит ли путь внутри папки (с учётом регистра путей на Windows). */
export function isInside(path, dir, platform = process.platform) {
  const p = platform === "win32" ? win32 : posix;
  const norm = (x) => (platform === "win32" ? p.resolve(x).toLowerCase() : p.resolve(x));
  const rel = p.relative(norm(dir), norm(path));
  // «..имя» — это файл внутри папки, выше — только «..» и «../…».
  const up = rel === ".." || rel.startsWith(`..${p.sep}`);
  return rel === "" || (!up && !p.isAbsolute(rel));
}

/** Публичные ключи получателей из security/backup-recipients.txt (строки age1…, комментарии # пропускаем). */
export function parseRecipients(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .filter((l) => {
      if (!/^age1[0-9a-z]{58}$/.test(l)) throw new Error(`не похоже на публичный ключ age: ${l.slice(0, 12)}…`);
      return true;
    });
}

export async function encryptBackup(data, recipients) {
  if (!recipients.length) throw new Error("нет получателей — шифровать некому");
  const e = new Encrypter();
  for (const r of recipients) e.addRecipient(r);
  return e.encrypt(data);
}

export async function decryptBackup(data, identity) {
  const d = new Decrypter();
  d.addIdentity(identity.trim());
  return d.decrypt(data, "text");
}

export async function newKeyPair() {
  const identity = await generateX25519Identity();
  return { identity, recipient: await identityToRecipient(identity) };
}

/**
 * Бэкап = схема целиком, потом данные. Полная выгрузка D1 идёт по таблицам в алфавитном порядке
 * (схема и данные вперемешку), и в пустую базу её не восстановить: строки `sessions` вставляются раньше,
 * чем создана `users` («no such table»). Поэтому выгружаем отдельно --no-data и --no-schema и склеиваем.
 */
export function combineExports(schemaSql, dataSql) {
  return `-- КОЛЛ.GG: бэкап D1. Сначала схема, потом данные. Восстанавливать целиком: wrangler d1 execute --file\n${schemaSql}\n${dataSql}\n`;
}

/** Таблицы, которые обязаны быть в бэкапе: все CREATE TABLE из migrations/*.sql. */
export function expectedTables(migrationsDir = "migrations") {
  const names = new Set();
  for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()) {
    for (const m of readFileSync(`${migrationsDir}/${f}`, "utf8").matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?[`"[]?(\w+)/gi)) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

/**
 * Восстановить выгрузку в чистую SQLite в памяти и проверить: SQL выполняется, все таблицы на месте,
 * целостность и внешние ключи в порядке. Возвращает число строк по таблицам (без содержимого).
 * Выполняем одной транзакцией — так `wrangler d1 execute --file` применяет файл в D1 (внешние ключи отложены).
 */
export function checkDump(sql, tables) {
  // node:sqlite подключаем только здесь: иначе keygen/decrypt печатали бы предупреждение «experimental».
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
    const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    const missing = tables.filter((t) => !present.has(t));
    if (missing.length) throw new Error(`в бэкапе нет таблиц: ${missing.join(", ")}`);
    const integrity = db.prepare("PRAGMA integrity_check").get();
    if (Object.values(integrity)[0] !== "ok") throw new Error(`integrity_check: ${JSON.stringify(integrity)}`);
    const fk = db.prepare("PRAGMA foreign_key_check").all();
    if (fk.length) throw new Error(`нарушены внешние ключи: ${fk.length}`);
    const counts = {};
    for (const t of tables) counts[t] = Number(db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n);
    return counts;
  } finally {
    db.close();
  }
}
