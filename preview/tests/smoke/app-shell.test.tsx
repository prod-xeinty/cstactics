import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("корневая оболочка", () => {
  it("показывает название проекта и основную навигацию", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <p>Контент</p>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");

    expect(document.documentElement.lang).toBe("ru");
    expect(document.body.textContent).toContain("КОЛЛ.GG");
    expect(document.querySelector('nav a[href="/"]')?.textContent).toContain("Тактики");
    expect(document.querySelector('a[href="#main-content"]')?.textContent).toContain(
      "Перейти к содержимому",
    );
  });
});
