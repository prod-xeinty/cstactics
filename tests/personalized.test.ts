import { describe, expect, it } from "vitest";
import { splitPersonalized, type PersonalTactic } from "@/tactics/personalized";

const score = (votes: number, works: number | null) => ({ votes, works, easy: works });
const tactic = (id: string, votes: number, works: number | null): PersonalTactic => ({
  id, title: id, call: "Колл", side: "T", teamSize: 5, economy: "full", difficulty: 2,
  voteCount: 0, works: null, easy: null,
  scores: { low: score(0, null), mid: score(0, null), high: score(votes, works) },
});

describe("подборка по FACEIT-шкале", () => {
  it("рекомендует только оценку от 4 и минимум пять голосов", () => {
    const result = splitPersonalized([tactic("мало", 4, null), tactic("слабая", 5, 3.9), tactic("хорошая", 5, 4.2)], "high");
    expect(result.recommended.map((item) => item.id)).toEqual(["хорошая"]);
    expect(result.other.map((item) => item.id)).toEqual(["слабая", "мало"]);
  });
});
