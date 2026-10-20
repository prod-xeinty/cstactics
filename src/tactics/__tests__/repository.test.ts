import { describe, expect, it } from "vitest";

import { tacticsFixtures } from "../fixtures";
import { tacticsRepository } from "../repository";

describe("tacticsRepository", () => {
  it("фильтрует опубликованные тактики по стороне и составу", async () => {
    const tactics = await tacticsRepository.list({
      map: "dust2",
      side: "CT",
      teamSize: 2,
      band: "mid",
    });

    expect(tactics).not.toHaveLength(0);
    expect(tactics.every(({ side, teamSize }) => side === "CT" && teamSize === 2)).toBe(true);
  });

  it("выбирает featured по рейтингу указанной FACEIT-группы", async () => {
    const filters = { map: "dust2", side: "T", teamSize: 5, band: "low" } as const;
    const tactic = await tacticsRepository.featured(filters);

    expect(tactic?.slug).toBe("b-rush");
  });

  it("возвращает пустой результат для отсутствующей комбинации", async () => {
    await expect(
      tacticsRepository.list({ map: "dust2", side: "CT", teamSize: 4, band: "mid" }),
    ).resolves.toEqual([]);
  });

  it("находит известный slug и возвращает null для неизвестного", async () => {
    await expect(tacticsRepository.bySlug("a-split")).resolves.toMatchObject({
      title: "Сплит A: лонг + кат",
    });
    await expect(tacticsRepository.bySlug("unknown")).resolves.toBeNull();
  });

  it("не отдаёт наружу массивы исходного fixture", async () => {
    const first = await tacticsRepository.bySlug("a-split");
    expect(first).not.toBeNull();
    first?.quick.push("лишний шаг");

    const second = await tacticsRepository.bySlug("a-split");
    expect(second?.quick).not.toContain("лишний шаг");
  });

  it("хранит отдельную содержательную схему для каждой тактики", () => {
    const images = tacticsFixtures.map(({ mapImage }) => mapImage);

    expect(images.every(Boolean)).toBe(true);
    expect(new Set(images).size).toBe(tacticsFixtures.length);
  });
});
