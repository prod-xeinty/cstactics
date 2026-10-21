import { expect, test } from "@playwright/test";

test("быстрый колл переключает шаги и остаётся удобным без горизонтального скролла", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/call/a-split");

  await expect(page).toHaveTitle(/Сплит A: лонг \+ кат — быстрый колл/);
  await expect(page.getByText("Шаг 1 из 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Дальше" })).toBeInViewport();
  await expect(page.getByRole("list", { name: "Роли команды" }).getByRole("listitem")).toHaveCount(5);

  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.getByText("Шаг 2 из 3")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.getByText("Шаг 3 из 3")).toBeVisible();
  await expect(page.getByRole("link", { name: "Открыть полный план" })).toHaveAttribute(
    "href",
    "/tactics/a-split",
  );

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  expect(consoleErrors).toEqual([]);

  const screenshotPath = testInfo.outputPath("quick-call.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("quick-call", { path: screenshotPath, contentType: "image/png" });
});
