#!/usr/bin/env node
// Проверка зависимостей поверх `npm audit`.
// Правило: critical — нельзя нигде, high — нельзя в продовых зависимостях.
// Исключения — только из security/audit-allowlist.json, с причиной и сроком.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ORDER = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const today = new Date().toISOString().slice(0, 10);

const allowlist = JSON.parse(readFileSync(new URL("../security/audit-allowlist.json", import.meta.url), "utf8")).allow;
const allowed = new Map(allowlist.map((a) => [a.id, a]));

function advisories(args) {
  const res = spawnSync("npm", ["audit", "--json", ...args], { encoding: "utf8", shell: process.platform === "win32" });
  let data;
  try {
    data = JSON.parse(res.stdout);
  } catch {
    console.error("npm audit не вернул JSON:", res.stderr || res.stdout);
    process.exit(2);
  }
  const found = new Map();
  for (const v of Object.values(data.vulnerabilities ?? {})) {
    for (const via of v.via) {
      if (typeof via !== "object") continue;
      const id = /GHSA-[\w-]+/.exec(via.url ?? "")?.[0] ?? `npm-${via.source}`;
      found.set(id, { id, pkg: via.name, severity: via.severity, title: via.title, url: via.url });
    }
  }
  return [...found.values()];
}

const failures = [];
const notes = [];

function gate(list, minSeverity, scope) {
  for (const a of list) {
    if (ORDER[a.severity] < ORDER[minSeverity]) continue;
    const ex = allowed.get(a.id);
    if (ex && ex.expires >= today) {
      notes.push(`  исключение до ${ex.expires}: ${a.severity} ${a.pkg} ${a.id}`);
      continue;
    }
    const why = ex ? `исключение истекло ${ex.expires}` : "нет в исключениях";
    failures.push(`  ${a.severity} [${scope}] ${a.pkg}: ${a.title} ${a.url} (${why})`);
  }
}

gate(advisories([]), "critical", "все");
gate(advisories(["--omit=dev"]), "high", "прод");

if (notes.length) console.log(`Пропущено по исключениям:\n${[...new Set(notes)].join("\n")}`);
if (failures.length) {
  console.error(`\nУязвимые зависимости:\n${[...new Set(failures)].join("\n")}`);
  console.error("\nОбнови пакет или, если риск понятен и принят, добавь исключение с причиной и сроком в security/audit-allowlist.json.");
  process.exit(1);
}
console.log("npm audit: критичных уязвимостей нет (critical — везде, high — в продовых).");
