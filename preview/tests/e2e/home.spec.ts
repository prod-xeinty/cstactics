import { expect, test } from "@playwright/test";

test("главная страница фильтрует тактики через URL", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(page).toHaveTitle(/КОЛЛ\.GG/i);
  await expect(page.getByRole("heading", { name: "План на следующий раунд" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Фильтры тактик" })).toBeVisible();

  await page.getByLabel("Сторона").selectOption("CT");
  await expect(page).toHaveURL(/side=CT/);

  await page.getByLabel("Состав").selectOption("4");
  await expect(page).toHaveURL(/side=CT.*teamSize=4|teamSize=4.*side=CT/);
  await expect(page.getByRole("heading", { name: "Под такой колл пока пусто" })).toBeVisible();

  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Рекомендация на раунд")).toBeVisible();
  expect(consoleErrors).toEqual([]);

  const screenshotPath = testInfo.outputPath("home-page.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("home-page", { path: screenshotPath, contentType: "image/png" });
});
