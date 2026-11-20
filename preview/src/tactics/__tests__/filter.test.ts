import { describe, expect, it } from "vitest";

import { parseTacticFilters, sortTacticsForBand } from "../filter";
import type { TacticSummary } from "../model";

const summary = (
  slug: string,
  works: number,
  voteCount = 10,
): TacticSummary => ({
  id: slug,
  slug,
  map: "dust2",
  side: "T",
  teamSize: 5,
  economy: "full",
  difficulty: 1,
  spawnDependent: false,
  title: slug,
  call: slug,
  duration: "20 сек",
  gameVersion: "demo",
  status: "published",
  featured: false,
  mapImage: `/images/tactics/${slug}.webp`,
  mapAlt: slug,
  ratings: {
    low: { works, easy: works, voteCount, demo: true },
    mid: { works, easy: works, voteCount, demo: true },
    high: { works, easy: works, voteCount, demo: true },
  },
});

describe("parseTacticFilters", () => {
  it("возвращает безопасные значения по умолчанию", () => {
    expect(parseTacticFilters(new URLSearchParams())).toEqual({
      map: "dust2",
      side: "all",
      teamSize: "all",
      band: "mid",
    });
  });

  it("принимает валидную комбинацию", () => {
    expect(
      parseTacticFilters(
        new URLSearchParams("map=dust2&side=CT&teamSize=3&band=high"),
      ),
    ).toEqual({ map: "dust2", side: "CT", teamSize: 3, band: "high" });
  });

  it("сбрасывает неизвестные и повторяющиеся значения отдельно", () => {
    expect(
      parseTacticFilters({
        map: "mirage",
        side: ["T", "CT"],
        teamSize: "99",
        band: "legend",
      }),
    ).toEqual({ map: "dust2", side: "all", teamSize: "all", band: "mid" });
  });
});

describe("sortTacticsForBand", () => {
  it("сортирует по оценке «Работает», затем по числу голосов и slug", () => {
    const tactics = [
      summary("charlie", 4.2, 20),
      summary("alpha", 4.8, 8),
      summary("bravo", 4.8, 12),
    ];

    expect(sortTacticsForBand(tactics, "mid").map(({ slug }) => slug)).toEqual([
      "bravo",
      "alpha",
      "charlie",
    ]);
    expect(tactics.map(({ slug }) => slug)).toEqual(["charlie", "alpha", "bravo"]);
  });
});
