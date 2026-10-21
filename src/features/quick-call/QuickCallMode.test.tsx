import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { tacticsFixtures } from "@/tactics/fixtures";

import { QuickCallMode } from "./QuickCallMode";

const tactic = tacticsFixtures[0];

describe("QuickCallMode", () => {
  it("показывает первый шаг и все роли команды", () => {
    render(<QuickCallMode tactic={tactic} alternativeSlug="b-rush" />);

    expect(screen.getByText("Шаг 1 из 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: tactic.quick[0] })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: /роль/i })).toHaveLength(tactic.teamSize);
    expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
  });

  it("переходит вперёд и назад без выхода за границы", async () => {
    const user = userEvent.setup();
    render(<QuickCallMode tactic={tactic} alternativeSlug="b-rush" />);

    await user.click(screen.getByRole("button", { name: "Дальше" }));
    expect(screen.getByText("Шаг 2 из 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: tactic.quick[1] })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Шаг 1 из 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
  });

  it("на последнем шаге предлагает полный план", async () => {
    const user = userEvent.setup();
    render(<QuickCallMode tactic={tactic} alternativeSlug="b-rush" />);

    await user.click(screen.getByRole("button", { name: "Дальше" }));
    await user.click(screen.getByRole("button", { name: "Дальше" }));

    expect(screen.getByText("Шаг 3 из 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Дальше" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть полный план" })).toHaveAttribute(
      "href",
      `/tactics/${tactic.slug}`,
    );
  });

  it("ссылается на детерминированный альтернативный колл", () => {
    render(<QuickCallMode tactic={tactic} alternativeSlug="b-rush" />);

    expect(screen.getByRole("link", { name: "Другой колл" })).toHaveAttribute(
      "href",
      "/call/b-rush",
    );
  });

  it("показывает переход к следующему шагу до длинного списка ролей", () => {
    render(<QuickCallMode tactic={tactic} alternativeSlug="b-rush" />);

    const nextButton = screen.getByRole("button", { name: "Дальше" });
    const roles = screen.getByRole("list", { name: "Роли команды" });

    expect(
      Boolean(nextButton.compareDocumentPosition(roles) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});
