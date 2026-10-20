import { describe, expect, it } from "vitest";

import {
  formatDifficulty,
  formatEconomy,
  formatFaceitBand,
  formatRatingSummary,
  formatSide,
  formatTeamSize,
} from "../format";

describe("подписи тактики", () => {
  it("форматирует сторону, состав, сложность, экономику и FACEIT-группу", () => {
    expect(formatSide("T")).toBe("Атака · T");
    expect(formatSide("CT")).toBe("Защита · CT");
    expect(formatTeamSize(2)).toBe("Дуо");
    expect(formatTeamSize(5)).toBe("Фулл стак");
    expect(formatDifficulty(3)).toBe("Сложная · 3/3");
    expect(formatEconomy("force")).toBe("Форс");
    expect(formatFaceitBand("high")).toBe("Хай · 8–10 лвл");
  });
});

describe("formatRatingSummary", () => {
  it("показывает две оценки при пяти и более голосах", () => {
    expect(
      formatRatingSummary({ works: 4.25, easy: 3.8, voteCount: 5, demo: true }),
    ).toEqual({
      works: "4,3",
      easy: "3,8",
      votes: "5 голосов",
      enoughVotes: true,
      demoLabel: "Демо-оценки",
    });
  });

  it("скрывает обе оценки, когда голосов меньше пяти", () => {
    expect(
      formatRatingSummary({ works: 4.9, easy: 4.7, voteCount: 4, demo: true }),
    ).toEqual({
      works: "мало голосов",
      easy: "мало голосов",
      votes: "4 голоса",
      enoughVotes: false,
      demoLabel: "Демо-оценки",
    });
  });
});
