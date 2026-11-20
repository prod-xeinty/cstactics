import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { tacticsFixtures } from "@/tactics/fixtures";

import { TacticList } from "./TacticList";

describe("TacticList", () => {
  it("показывает данные и две независимые оценки", () => {
    const tactic = {
      ...tacticsFixtures[0],
      ratings: {
        ...tacticsFixtures[0].ratings,
        mid: { works: 4.2, easy: 3.5, voteCount: 8, demo: true as const },
      },
    };
    render(<TacticList tactics={[tactic]} band="mid" />);

    expect(screen.getByText("4,2")).toBeInTheDocument();
    expect(screen.getByText("3,5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Сплит A/ })).toHaveAttribute(
      "href",
      "/tactics/a-split",
    );
  });

  it("показывает «мало голосов» вместо обеих оценок", () => {
    render(<TacticList tactics={[tacticsFixtures[3]]} band="high" />);

    expect(screen.getAllByText("мало голосов")).toHaveLength(2);
  });

  it("показывает empty и error состояния", () => {
    const { rerender } = render(<TacticList tactics={[]} band="mid" />);
    expect(screen.getByText("Под такой колл пока пусто")).toBeInTheDocument();

    const retry = vi.fn();
    rerender(<TacticList tactics={[]} band="mid" state="error" onRetry={retry} />);
    expect(screen.getByText("Тактики не загрузились")).toBeInTheDocument();
  });
});
