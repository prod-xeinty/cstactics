#!/usr/bin/env node
// Проверка расхода бесплатных лимитов Cloudflare (запускается по расписанию в GitHub Actions).
// ≥ порога → открыть или обновить issue. Секретов нет → «не настроено», без падения.
import { appendFileSync } from "node:fs";
import {
  evaluateUsage,
  GRAPHQL_ENDPOINT,
  ISSUE_TITLE,
  issueBody,
  parseUsage,
  USAGE_QUERY,
  usageTable,
  usageVariables,
} from "./usage-lib.mjs";

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY } = process.env;
const threshold = Number(process.env.USAGE_THRESHOLD ?? "0.7");
const assignee = process.env.USAGE_ASSIGNEE ?? "";

function summary(text) {
  console.log(text);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${text}\n`);
}

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
  console.log("::warning::Проверка лимитов не настроена: нужны секреты CLOUDFLARE_API_TOKEN и CLOUDFLARE_ACCOUNT_ID (docs/ops/diagnostics.md).");
  summary("Проверка лимитов Cloudflare **не настроена**: нет секретов `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`.");
  process.exit(0);
}

const vars = usageVariables(CLOUDFLARE_ACCOUNT_ID);
const res = await fetch(GRAPHQL_ENDPOINT, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: USAGE_QUERY, variables: vars }),
});
if (!res.ok) {
  console.error(`Cloudflare GraphQL ответил ${res.status}`);
  process.exit(1);
}
const rows = evaluateUsage(parseUsage(await res.json()), threshold);
summary(`### Лимиты Cloudflare за ${vars.date} (UTC), порог ${Math.round(threshold * 100)}%\n\n${usageTable(rows)}`);

if (!rows.some((r) => r.over)) {
  summary("\nВсё в пределах нормы.");
  process.exit(0);
}

// Есть превышение порога → issue (одно открытое, обновляем комментарием).
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
  console.log("::warning::Порог превышен, но нет GITHUB_TOKEN — issue не создан.");
  process.exit(0);
}
const gh = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", ...(init.headers ?? {}) },
  });

const body = issueBody(rows, vars.date, threshold);
const open = await (await gh("/issues?state=open&per_page=100")).json();
const existing = Array.isArray(open) ? open.find((i) => i.title === ISSUE_TITLE && !i.pull_request) : undefined;
if (existing) {
  await gh(`/issues/${existing.number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  summary(`\nДобавлен комментарий в #${existing.number}.`);
} else {
  const created = await (
    await gh("/issues", {
      method: "POST",
      body: JSON.stringify({ title: ISSUE_TITLE, body, labels: ["бэк", "важно"], assignees: assignee ? [assignee] : [] }),
    })
  ).json();
  summary(`\nСоздан issue #${created.number}.`);
}
console.log("::warning::Расход близко к бесплатному лимиту Cloudflare — см. issue.");
