import { describe, expect, it, vi } from "vitest";

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

  it("показывает импортированные черновики в предпросмотре, вне основного каталога", async () => {
    const filters = { map: "dust2", side: "all", teamSize: "all", band: "mid" } as const;
    try {
      vi.stubEnv("CSTACTICS_PAGES", undefined);
      vi.stubEnv("NODE_ENV", "development");
      const drafts = await tacticsRepository.listDrafts(filters);
      expect(drafts).toHaveLength(10);
      expect(new Set(drafts.map(({ slug }) => slug)).size).toBe(10);
      expect(drafts.every(({ status }) => status === "draft")).toBe(true);
      expect(await tacticsRepository.listDrafts({ ...filters, side: "CT" })).toHaveLength(4);
      await expect(tacticsRepository.bySlug(drafts[0].slug)).resolves.toMatchObject({ status: "draft" });
      expect((await tacticsRepository.list(filters)).every(({ status }) => status === "published")).toBe(true);

      vi.stubEnv("NODE_ENV", "production");
      await expect(tacticsRepository.listDrafts(filters)).resolves.toEqual([]);
      await expect(tacticsRepository.bySlug(drafts[0].slug)).resolves.toBeNull();

      vi.stubEnv("CSTACTICS_PAGES", "1");
      await expect(tacticsRepository.listDrafts(filters)).resolves.toEqual(drafts);
      await expect(tacticsRepository.bySlug(drafts[0].slug)).resolves.toMatchObject({ status: "draft" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
