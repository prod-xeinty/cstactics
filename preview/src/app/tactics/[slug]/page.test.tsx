import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TacticPage, { generateMetadata } from "./page";

describe("страница тактики", () => {
  it("показывает тактику из репозитория и ссылку на её быстрый колл", async () => {
    const props = { params: Promise.resolve({ slug: "a-split" }) };
    render(await TacticPage(props));

    expect(screen.getByRole("heading", { level: 1, name: "Сплит A: лонг + кат" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Запустить быстрый колл" })).toHaveAttribute("href", "/call/a-split");
    await expect(generateMetadata(props)).resolves.toEqual({ title: "Сплит A: лонг + кат · КОЛЛ.GG" });
  });

  it("вызывает 404 для неизвестной тактики", async () => {
    const props = { params: Promise.resolve({ slug: "unknown" }) };

    await expect(TacticPage(props)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(generateMetadata(props)).resolves.toEqual({ title: "Тактика не найдена · КОЛЛ.GG" });
  });
});
