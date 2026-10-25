#!/usr/bin/env node
// Самопроверка всей цепочки бэкапа на локальной D1 (без сети и секретов), гоняется в CI:
// миграции → тестовые данные → wrangler d1 export → проверка восстановления → шифрование → расшифровка → сравнение.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDump, combineExports, decryptBackup, encryptBackup, expectedTables, newKeyPair } from "./backup-lib.mjs";

// Отдельная папка с копией конфига и миграций: у неё своя локальная база (.wrangler внутри),
// рабочую локальную базу проекта не трогаем. (У `d1 export` нет --persist-to, поэтому через --cwd.)
const dir = mkdtempSync(join(tmpdir(), "kollgg-backup-selftest-"));
cpSync("wrangler.jsonc", join(dir, "wrangler.jsonc"));
cpSync("migrations", join(dir, "migrations"), { recursive: true });
const wrangler = (...args) =>
  execFileSync("npx", ["wrangler", ...args, "--local", "--cwd", dir], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
try {
  wrangler("d1", "migrations", "apply", "DB");
  wrangler(
    "d1",
    "execute",
    "DB",
    "--command",
    "INSERT INTO users VALUES ('u1','76561198000000001','игрок «1»',NULL,'user','2026-10-25T00:00:00Z','2026-10-25T00:00:00Z');" +
      "INSERT INTO sessions VALUES ('s1','u1','hash1','2030-01-01T00:00:00Z','2026-10-25T00:00:00Z','2026-10-25T00:00:00Z');",
  );
  wrangler("d1", "export", "DB", "--no-data", "--output", join(dir, "schema.sql"));
  wrangler("d1", "export", "DB", "--no-schema", "--output", join(dir, "data.sql"));
  const sql = combineExports(readFileSync(join(dir, "schema.sql"), "utf8"), readFileSync(join(dir, "data.sql"), "utf8"));
  const tables = expectedTables();
  const before = checkDump(sql, tables);
  if (before.users !== 1 || before.sessions !== 1) throw new Error(`ожидали по 1 строке, получили ${JSON.stringify(before)}`);

  const { identity, recipient } = await newKeyPair();
  const restored = await decryptBackup(await encryptBackup(sql, [recipient]), identity);
  if (restored !== sql) throw new Error("после шифрования и расшифровки выгрузка изменилась");
  const after = checkDump(restored, tables);
  // Как при настоящем восстановлении: в пустую D1 через wrangler d1 execute --file.
  const restoreDir = mkdtempSync(join(tmpdir(), "kollgg-restore-"));
  try {
    cpSync("wrangler.jsonc", join(restoreDir, "wrangler.jsonc"));
    const restoreFile = join(dir, "restore.sql");
    writeFileSync(restoreFile, restored);
    const run = (...a) =>
      execFileSync("npx", ["wrangler", ...a, "--local", "--cwd", restoreDir], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      }).toString();
    run("d1", "execute", "DB", "--file", restoreFile);
    const out = run("d1", "execute", "DB", "--json", "--command", "SELECT (SELECT COUNT(*) FROM users) AS u, (SELECT COUNT(*) FROM sessions) AS s");
    const row = JSON.parse(out.slice(out.indexOf("[")))[0].results[0];
    if (row.u !== 1 || row.s !== 1) throw new Error(`после восстановления в D1 ожидали по 1 строке: ${JSON.stringify(row)}`);
  } finally {
    rmSync(restoreDir, { recursive: true, force: true });
  }
  console.log(`Бэкап: самопроверка пройдена (выгрузка → проверка → шифрование → расшифровка → восстановление в D1). Таблицы: ${JSON.stringify(after)}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
