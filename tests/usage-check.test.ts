import { describe, expect, it } from "vitest";
import { evaluateUsage, issueBody, parseUsage, usageTable, usageVariables } from "../scripts/usage-lib.mjs";

const answer = {
  data: {
    viewer: {
      accounts: [
        {
          workers: [
            { sum: { requests: 60_000 }, dimensions: { scriptName: "kollgg" } },
            { sum: { requests: 15_000 }, dimensions: { scriptName: "kollgg-probe" } },
          ],
          d1: [{ sum: { rowsRead: 1_000_000, rowsWritten: 2_000 } }],
          durableObjects: [{ sum: { requests: 40_000 } }],
        },
      ],
    },
  },
};

describe("проверка лимитов Cloudflare", () => {
  it("суммирует все воркеры аккаунта (лимит общий на аккаунт)", () => {
    expect(parseUsage(answer)).toEqual({ workersRequests: 75_000, d1RowsRead: 1_000_000, d1RowsWritten: 2_000, durableObjectRequests: 40_000 });
  });

  it("порог 70%: Workers 75% — превышение, остальное нет", () => {
    const rows = evaluateUsage(parseUsage(answer), 0.7);
    expect(rows.filter((r) => r.over).map((r) => r.key)).toEqual(["workersRequests"]);
    expect(usageTable(rows)).toContain("**Workers: запросы**");
    expect(issueBody(rows, "2026-10-25", 0.7)).toContain("≥ 70%");
  });

  it("пустые данные (новый аккаунт) — нули, без падения", () => {
    const usage = parseUsage({ data: { viewer: { accounts: [{ workers: [], d1: [], durableObjects: [] }] } } });
    expect(evaluateUsage(usage).every((r) => r.used === 0 && !r.over)).toBe(true);
  });

  it("ошибки GraphQL и чужой аккаунт — понятная ошибка", () => {
    expect(() => parseUsage({ errors: [{ message: "not authorized" }] })).toThrow(/not authorized/);
    expect(() => parseUsage({ data: { viewer: { accounts: [] } } })).toThrow(/аккаунт не найден/);
  });

  it("сутки считаются по UTC", () => {
    expect(usageVariables("acc", new Date("2026-10-25T23:30:00+03:00"))).toEqual({
      accountTag: "acc",
      date: "2026-10-25",
      start: "2026-10-25T00:00:00Z",
      end: "2026-10-25T20:30:00.000Z",
    });
  });
});
