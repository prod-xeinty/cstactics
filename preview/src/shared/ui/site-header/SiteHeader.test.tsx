import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("открывает и закрывает мобильное меню с возвратом фокуса", async () => {
    render(<SiteHeader />);

    const trigger = screen.getByText("Открыть меню");
    fireEvent.click(trigger);
    expect(screen.getByRole("navigation", { name: "Мобильная навигация" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Мобильная навигация" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("не показывает ссылки на ещё не реализованные маршруты", () => {
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Под твоё эло" })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/tactics"]')).not.toBeInTheDocument();
  });
});
