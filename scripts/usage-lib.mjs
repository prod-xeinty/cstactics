// Логика проверки расхода бесплатных лимитов Cloudflare. Без побочных эффектов — её тестируем (tests/usage-check.test.ts).

/** Бесплатные лимиты Workers Free в сутки (сброс в 00:00 UTC). Источник — docs/ops/diagnostics.md. */
export const FREE_DAILY_LIMITS = {
  workersRequests: { label: "Workers: запросы", limit: 100_000 },
  d1RowsRead: { label: "D1: прочитано строк", limit: 5_000_000 },
  d1RowsWritten: { label: "D1: записано строк", limit: 100_000 },
  durableObjectRequests: { label: "Durable Objects: запросы", limit: 100_000 },
};

export const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

export const USAGE_QUERY = `query Usage($accountTag: string!, $date: Date!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workers: workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
        sum { requests }
        dimensions { scriptName }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $date, date_leq: $date }) {
        sum { rowsRead rowsWritten }
      }
      durableObjects: durableObjectsInvocationsAdaptiveGroups(limit: 10000, filter: { date_geq: $date, date_leq: $date }) {
        sum { requests }
      }
    }
  }
}`;

/** Переменные запроса за текущие сутки UTC. */
export function usageVariables(accountTag, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return { accountTag, date, start: `${date}T00:00:00Z`, end: now.toISOString() };
}

const sum = (rows, field) => (rows ?? []).reduce((acc, r) => acc + (Number(r?.sum?.[field]) || 0), 0);

/** Ответ GraphQL → { метрика: число }. Бросает ошибку, если Cloudflare вернул errors. */
export function parseUsage(json) {
  if (json?.errors?.length) {
    throw new Error(`Cloudflare GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  const acc = json?.data?.viewer?.accounts?.[0];
  if (!acc) throw new Error("Cloudflare GraphQL: аккаунт не найден (проверь CLOUDFLARE_ACCOUNT_ID и права токена)");
  return {
    workersRequests: sum(acc.workers, "requests"),
    d1RowsRead: sum(acc.d1, "rowsRead"),
    d1RowsWritten: sum(acc.d1, "rowsWritten"),
    durableObjectRequests: sum(acc.durableObjects, "requests"),
  };
}

/** Сравнить с лимитами. threshold — доля (0.7 = 70%). */
export function evaluateUsage(usage, threshold = 0.7) {
  return Object.entries(FREE_DAILY_LIMITS).map(([key, { label, limit }]) => {
    const used = usage[key] ?? 0;
    const ratio = used / limit;
    return { key, label, used, limit, ratio, over: ratio >= threshold };
  });
}

const fmt = (n) => n.toLocaleString("ru-RU");

export function usageTable(rows) {
  const lines = ["| Что | Использовано сегодня (UTC) | Лимит | % |", "|---|---|---|---|"];
  for (const r of rows) {
    lines.push(`| ${r.over ? "**" + r.label + "**" : r.label} | ${fmt(r.used)} | ${fmt(r.limit)} | ${(r.ratio * 100).toFixed(1)}% |`);
  }
  return lines.join("\n");
}

export const ISSUE_TITLE = "Лимиты Cloudflare: расход близко к бесплатному лимиту";

export function issueBody(rows, date, threshold) {
  return [
    `Проверка за **${date} (UTC)** нашла расход ≥ ${Math.round(threshold * 100)}% бесплатного суточного лимита.`,
    "",
    usageTable(rows),
    "",
    "При превышении операции этого типа падают с ошибкой до 03:00 МСК (00:00 UTC). Что делать — `docs/ops/diagnostics.md`, раздел «Лимиты».",
    "",
    "_Создано автоматически workflow «Лимиты Cloudflare» (`.github/workflows/usage-check.yml`)._",
  ].join("\n");
}
