#!/usr/bin/env node
// Расшифровать бэкап: npm run backup:decrypt -- <файл.sql.age> <файл-ключа> <куда.sql>
import { readFileSync, writeFileSync } from "node:fs";
import { decryptBackup, isInside } from "./backup-lib.mjs";

const [input, keyFile, output] = process.argv.slice(2);
if (!input || !keyFile || !output) {
  console.error("Использование: npm run backup:decrypt -- kollgg-ДАТА.sql.age путь/к/kollgg-backup-key.txt C:\\Users\\<ты>\\Downloads\\kollgg-ДАТА.sql");
  process.exit(1);
}
const identity = readFileSync(keyFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("AGE-SECRET-KEY-"));
if (!identity) {
  console.error("В файле ключа нет строки AGE-SECRET-KEY-…");
  process.exit(1);
}
// Открытый SQL — только ВНЕ проекта: иначе его легко случайно закоммитить в публичный репозиторий.
if (isInside(output, process.cwd())) {
  console.error("Не расшифровывай внутрь папки проекта — открытые данные игроков легко закоммитить. Укажи путь снаружи (например, в Загрузки).");
  process.exit(1);
}
// flag "wx": не перезаписываем существующий файл.
writeFileSync(output, await decryptBackup(readFileSync(input), identity), { mode: 0o600, flag: "wx" });
console.log(`Готово: ${output}. Это открытые данные игроков — не коммить, удали после восстановления.`);
