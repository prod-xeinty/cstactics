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
  // UPDATE как оператор (в начале, после «;» или BEGIN в триггере), а не «ON UPDATE» во внешнем ключе.
  [/(^|;|\bBEGIN\b)\s*UPDATE\b/im, "UPDATE"],
  [/\b(INSERT\s+OR\s+REPLACE|REPLACE\s+INTO)\b/i, "REPLACE"],
];

/**
 * Убрать из SQL строковые литералы и комментарии (-- и блочные), сохранив границы слов.
 * Это защита от ошибок, а не от злоумышленника: основной барьер — ревью Code Owners.
 */
export function stripSql(sql) {
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === "`") {
      const end = sql.indexOf(c, i + 1);
      i = end === -1 ? sql.length : end;
      out += " ";
    } else if (c === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end - 1;
      out += " ";
    } else if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 1;
      out += " ";
    } else out += c;
  }
  return out;
}

/** Найти разрушающие операции в тексте миграции. */
export function findDestructive(sql) {
  const code = stripSql(sql);
  return DESTRUCTIVE.filter(([re]) => re.test(code)).map(([, name]) => name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.env.BASE_REF ? `origin/${process.env.BASE_REF}` : "origin/main";
  let files = [];
  try {
    // --no-renames: переименованный файл миграции — это новая миграция для wrangler, проверяем её как новую.
    files = execFileSync("git", ["diff", "--name-only", "--no-renames", "--diff-filter=AM", `${base}...HEAD`, "--", "migrations/*.sql"], {
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
