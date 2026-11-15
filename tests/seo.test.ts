import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { getPublishedTacticSeo, listPublishedTacticSeo } from "@/tactics/seo";
import { sitemapEntries, tacticMetadata, unlistedTacticMetadata } from "@/seo/metadata";
import { OG_IMAGE_URL, SITE_ORIGIN } from "@/seo/site";
import robots from "@/app/robots";

describe("SEO тактик", () => {
  it("в sitemap попадают только опубликованные тактики с читаемым содержимым", async () => {
    const db = createTestDb();
    await db.run("INSERT INTO users (id, steam_id64, nickname, role, created_at, updated_at) VALUES ('u', '76561198000000000', 'Игрок', 'user', '2026-01-01', '2026-01-01')");
    for (const [id, status, content] of [
      ["published", "published", JSON.stringify({ title: "Разбор", call: "Тестовый колл" })],
      ["pending", "pending", JSON.stringify({ title: "Черновик", call: "Не показывать" })],
      ["broken", "published", "{"],
    ] as const) {
      await db.run("INSERT INTO tactics (id, slug, map, side, team_size, economy, difficulty, content, game_version, source, author_id, status, created_at, updated_at) VALUES (?, ?, 'dust2', 'T', 5, 'full', 2, ?, 'v1', 'authors', 'u', ?, '2026-01-01', '2026-01-02')", [id, id, content, status]);
    }
    const tactics = await listPublishedTacticSeo(db);
    expect(tactics.map((t) => t.slug)).toEqual(["published"]);
    expect(await getPublishedTacticSeo(db, "pending")).toBeNull();
    expect(await getPublishedTacticSeo(db, "published")).toMatchObject({ title: "Разбор", call: "Тестовый колл" });
    expect(sitemapEntries(tactics).map((entry) => entry.url)).toEqual([
      SITE_ORIGIN, `${SITE_ORIGIN}/tactics`, `${SITE_ORIGIN}/tactics/published`,
    ]);
  });

  it("даёт опубликованной странице свой canonical и Open Graph, а черновику noindex", () => {
    const metadata = tacticMetadata({ slug: "published", title: "Разбор", call: "Тестовый колл", updatedAt: "2026-01-02" });
    expect(metadata.title).toBe("Разбор — тактика Dust2 | КОЛЛ.GG");
    expect(metadata.alternates?.canonical).toBe(`${SITE_ORIGIN}/tactics/published`);
    expect(metadata.openGraph).toMatchObject({ url: `${SITE_ORIGIN}/tactics/published`, images: [{ url: OG_IMAGE_URL }] });
    expect(unlistedTacticMetadata("Демо").robots).toMatchObject({ index: false, follow: false });
    expect(existsSync("public/og-default.png")).toBe(true);
  });

  it("robots.txt указывает на sitemap и не направляет ботов в API", () => {
    expect(robots()).toMatchObject({
      sitemap: `${SITE_ORIGIN}/sitemap.xml`, rules: { userAgent: "*", disallow: expect.arrayContaining(["/api/"]) },
    });
  });
});
