#!/usr/bin/env node
// CI: новые и изменённые миграции должны быть только добавляющими — их применяет автодеплой
// до нового кода, а при сбое откатывается только код (docs/ops/deploy.md, «Правила для миграций»).
// Разрушающая миграция пропускается только с меткой PR «разрушающая миграция» (ALLOW_DESTRUCTIVE_MIGRATION=1).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const DESTRUCTIVE = [
  [/\bDROP\s+(TABLE|COLUMN|INDEX|VIEW|TRIGGER)\b/i, "DROP"],
  [/\bALTER\s+TABLE\s+\S+\s+RENAME\b/i, "переименование"],
  [/\bALTER\s+TABLE\s+\S+\s+DROP\b/i, "удаление колонки"],
  [/\bDELETE\s+FROM\b/i, "DELETE"],
  [/\bUPDATE\s+\S+\s+SET\b/i, "UPDATE"],
];

/** Найти разрушающие операции в тексте миграции (комментарии -- … не считаем). */
export function findDestructive(sql) {
  const code = sql.replace(/--[^\n]*/g, "");
  return DESTRUCTIVE.filter(([re]) => re.test(code)).map(([, name]) => name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.env.BASE_REF ? `origin/${process.env.BASE_REF}` : "origin/main";
  let files = [];
  try {
    files = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "migrations/*.sql"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    console.error(`Не удалось сравнить с ${base} (нужен fetch-depth: 0).`);
    process.exit(2);
  }
  const bad = files.map((f) => [f, findDestructive(readFileSync(f, "utf8"))]).filter(([, ops]) => ops.length);
  if (!bad.length) {
    console.log(`Миграции: ${files.length ? files.join(", ") : "новых нет"} — только добавляющие.`);
    process.exit(0);
  }
  for (const [f, ops] of bad) console.log(`::error file=${f}::Разрушающая миграция (${ops.join(", ")}): автодеплой применит её до кода, откатить можно только через Time Travel.`);
  if (process.env.ALLOW_DESTRUCTIVE_MIGRATION === "1") {
    console.log("Есть метка «разрушающая миграция» — пропускаю. Перед мержем: план отката и время (Time Travel).");
    process.exit(0);
  }
  console.log("Если так и задумано — поставь PR метку «разрушающая миграция» и распиши в описании план (docs/ops/deploy.md).");
  process.exit(1);
}
