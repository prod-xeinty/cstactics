import { describe, expect, it } from "vitest";
import { fixtureClutchSource, fixtureTacticSource, readList, type ListSource } from "@/tactics/source";
import type { TacticPreview } from "@/tactics/types";

describe("типизированные данные для интерфейса", () => {
  it("читает три тактики и два клатча как непроверенные fixtures", async () => {
    const tactics = await readList(fixtureTacticSource);
    const clutches = await readList(fixtureClutchSource);
    expect(tactics).toHaveLength(3);
    expect(new Set(tactics.map((t) => t.slug)).size).toBe(3);
    expect(tactics.every((t) => t.kind === "fixture" && t.verified === false && t.quick.length >= 1 && t.quick.length <= 4)).toBe(true);
    expect(clutches).toHaveLength(2);
    expect(clutches.every((c) => c.kind === "fixture" && c.verified === false && c.map === "dust2" && c.idea.includes("после проверки"))).toBe(true);
  });

  it("одинаково читает fixture и другой источник списка", async () => {
    const alternate: ListSource<TacticPreview> = {
      async list() { return [{ slug: "published", title: "Готовая тактика", side: "T", teamSize: 5, economy: "full", difficulty: 1, call: "Колл", quick: ["Шаг"], verified: true }]; },
    };
    expect((await readList(fixtureTacticSource))[0].slug).toBe("demo-a-split");
    expect((await readList(alternate))[0].slug).toBe("published");
  });
});
