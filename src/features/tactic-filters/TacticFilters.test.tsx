import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { serializeTacticFilters, TacticFilters } from "./TacticFilters";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const defaults = { map: "dust2", side: "all", teamSize: "all", band: "mid" } as const;

describe("serializeTacticFilters", () => {
  it("сериализует только поддерживаемые отличия от значений по умолчанию", () => {
    expect(serializeTacticFilters({ ...defaults, side: "CT", teamSize: 3, band: "high" })).toBe(
      "/?side=CT&teamSize=3&band=high",
    );
    expect(serializeTacticFilters(defaults)).toBe("/");
  });
});

describe("TacticFilters", () => {
  beforeEach(() => replace.mockClear());

  it("меняет URL через доступный нативный select", async () => {
    const user = userEvent.setup();
    render(<TacticFilters filters={defaults} />);

    const side = screen.getByRole("combobox", { name: "Сторона" });
    side.focus();
    await user.selectOptions(side, "CT");

    expect(side).toHaveFocus();
    expect(replace).toHaveBeenCalledWith("/?side=CT");
  });

  it("сбрасывает фильтры к каноническому корню", async () => {
    const user = userEvent.setup();
    render(<TacticFilters filters={{ ...defaults, side: "T" }} />);

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(replace).toHaveBeenCalledWith("/");
  });
});
