import type { MetadataRoute } from "next";
import { getPlatform } from "@/platform";
import { sitemapEntries } from "@/seo/metadata";
import { listPublishedTacticSeo } from "@/tactics/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try { return sitemapEntries(await listPublishedTacticSeo((await getPlatform()).db)); }
  catch { return sitemapEntries([]); }
}
