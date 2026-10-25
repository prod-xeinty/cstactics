#!/usr/bin/env node
// Создать ключ для бэкапов. Запускать на СВОЁМ компьютере: npm run backup:keygen
// Секретный ключ сохраняется в файл вне репозитория, публичный — печатается (его кладём в security/backup-recipients.txt).
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isInside, newKeyPair } from "./backup-lib.mjs";

const target = resolve(process.argv[2] ?? join(homedir(), "kollgg-backup-key.txt"));
if (isInside(target, process.cwd())) {
  console.error("Не клади секретный ключ внутрь папки проекта — его легко случайно закоммитить. Укажи путь снаружи.");
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`Файл ${target} уже есть — не перезаписываю (иначе старые бэкапы будет не открыть).`);
  process.exit(1);
}
const { identity, recipient } = await newKeyPair();
writeFileSync(target, `# Секретный ключ бэкапов КОЛЛ.GG. Никому не отправлять, не коммитить. Без него бэкапы не открыть.\n# публичный: ${recipient}\n${identity}\n`, { mode: 0o600, flag: "wx" });
console.log(`Секретный ключ сохранён: ${target}`);
console.log("Сделай его копию в надёжное место (менеджер паролей / флешка). Потеряешь — бэкапы не расшифровать.");
console.log("Не держи его в папке, которая синхронизируется в облако (OneDrive, Google Drive).\n");
console.log("Публичный ключ (его можно показывать всем, он идёт в security/backup-recipients.txt):");
console.log(recipient);
