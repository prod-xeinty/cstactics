#!/usr/bin/env node
// Ежедневный бэкап боевой D1 (GitHub Actions, .github/workflows/backup.yml):
// выгрузка → проверка восстановления → шифрование → файл для артефакта. Открытый SQL на диске не остаётся.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { checkDump, combineExports, encryptBackup, expectedTables, parseRecipients } from "./backup-lib.mjs";

const { CF_BACKUP_TOKEN, CLOUDFLARE_ACCOUNT_ID, GITHUB_STEP_SUMMARY } = process.env;
const OUT_DIR = "backup-out";
const summary = (t) => {
  console.log(t);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${t}\n`);
};

const recipients = parseRecipients(readFileSync("security/backup-recipients.txt", "utf8"));
if (!CF_BACKUP_TOKEN || !CLOUDFLARE_ACCOUNT_ID || recipients.length === 0) {
  const missing = [
    !CF_BACKUP_TOKEN && "секрет CF_BACKUP_TOKEN",
    !CLOUDFLARE_ACCOUNT_ID && "секрет CLOUDFLARE_ACCOUNT_ID",
    recipients.length === 0 && "публичный ключ в security/backup-recipients.txt",
  ].filter(Boolean);
  console.log(`::warning::Бэкап не настроен, не хватает: ${missing.join("; ")} (docs/ops/backup-restore.md).`);
  summary(`Бэкап D1 **не настроен**, не хватает: ${missing.join("; ")}.`);
  process.exit(0);
}

const date = new Date().toISOString().slice(0, 10);
const tmpBase = `${process.env.RUNNER_TEMP ?? "/tmp"}/kollgg-${date}`;
const tmpSchema = `${tmpBase}.schema.sql`;
const tmpData = `${tmpBase}.data.sql`;
mkdirSync(OUT_DIR, { recursive: true });
const exportD1 = (flag, out) =>
  execFileSync("npx", ["wrangler", "d1", "export", "kollgg", "--remote", flag, "--output", out, "--skip-confirmation"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_BACKUP_TOKEN, WRANGLER_SEND_METRICS: "false" },
  });
try {
  // Схема и данные отдельно — иначе выгрузку не восстановить (см. combineExports).
  exportD1("--no-data", tmpSchema);
  exportD1("--no-schema", tmpData);
  const sql = combineExports(readFileSync(tmpSchema, "utf8"), readFileSync(tmpData, "utf8"));
  const counts = checkDump(sql, expectedTables()); // бросит, если бэкап не восстанавливается
  const encrypted = await encryptBackup(sql, recipients);
  const file = `${OUT_DIR}/kollgg-${date}.sql.age`;
  writeFileSync(file, encrypted);
  const sha256 = createHash("sha256").update(encrypted).digest("hex");
  writeFileSync(`${file}.sha256`, `${sha256}  kollgg-${date}.sql.age\n`);
  const rows = Object.entries(counts).map(([t, n]) => `| ${t} | ${n} |`).join("\n");
  summary(`### Бэкап D1 за ${date}\n\nВосстановление проверено, файл зашифрован для ${recipients.length} получател(я/ей).\n\n| Таблица | Строк |\n|---|---|\n${rows}\n\nsha256: \`${sha256}\``);
} finally {
  // Открытая выгрузка не должна попасть в артефакт или кеш.
  rmSync(tmpSchema, { force: true });
  rmSync(tmpData, { force: true });
}
