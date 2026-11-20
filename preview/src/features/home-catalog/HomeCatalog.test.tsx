import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { parseTacticFilters } from "@/tactics/filter";
import { tacticsFixtures } from "@/tactics/fixtures";

import { CatalogResults } from "./HomeCatalog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe("каталог Dust2", () => {
  it("показывает все тактики, даже если часть уже выведена в рекомендации", () => {
    render(<CatalogResults tactics={tacticsFixtures} drafts={[]} filters={parseTacticFilters({})} />);

    const catalog = within(screen.getByRole("region", { name: "Тактики Dust2" }));
    expect(catalog.getAllByRole("link")).toHaveLength(tacticsFixtures.length);
  });

  it("показывает подходящую тактику, даже когда нет рекомендации", () => {
    const filters = parseTacticFilters({ side: "CT", teamSize: "3" });
    render(<CatalogResults tactics={tacticsFixtures} drafts={[]} filters={filters} />);

    const catalog = within(screen.getByRole("region", { name: "Тактики Dust2" }));
    const matching = tacticsFixtures.filter(({ side, teamSize }) => side === "CT" && teamSize === 3);
    expect(matching).toHaveLength(1);
    expect(catalog.getAllByRole("link").map((link) => link.textContent)).toEqual(matching.map(({ title }) => title));
    expect(screen.queryByText("Рекомендация на раунд")).not.toBeInTheDocument();
  });
});
