import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { tacticsFixtures } from "@/tactics/fixtures";

import { TacticMeta } from "./TacticMeta";

describe("TacticMeta", () => {
  it("показывает централизованные русские подписи", () => {
    render(<TacticMeta tactic={tacticsFixtures[0]} band="mid" />);

    expect(screen.getByText("Атака · T")).toBeInTheDocument();
    expect(screen.getByText("Фулл стак")).toBeInTheDocument();
    expect(screen.getByText("Мид · 4–7 лвл")).toBeInTheDocument();
    expect(screen.getByText("Демо-оценки")).toBeInTheDocument();
  });
});
