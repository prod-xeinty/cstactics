import type { Metadata, MetadataRoute } from "next";
import type { PublishedTacticSeo } from "@/tactics/seo";
import { OG_IMAGE_URL, SITE_NAME, SITE_ORIGIN, tacticUrl } from "./site";

export function tacticMetadata(tactic: PublishedTacticSeo): Metadata {
  const title = `${tactic.title} — тактика Dust2 | ${SITE_NAME}`;
  const description = tactic.call.trim().slice(0, 160);
  const url = tacticUrl(tactic.slug);
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: "article", locale: "ru_RU", images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: `${SITE_NAME} — тактики Dust2` }] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE_URL] },
  };
}

export function unlistedTacticMetadata(title = "Разбор тактики"): Metadata {
  return { title: `${title} | ${SITE_NAME}`, robots: { index: false, follow: false } };
}

export function sitemapEntries(tactics: readonly PublishedTacticSeo[]): MetadataRoute.Sitemap {
  return [
    { url: SITE_ORIGIN, priority: 1 },
    { url: `${SITE_ORIGIN}/tactics`, priority: 0.8 },
    ...tactics.map((tactic) => {
      const date = new Date(tactic.updatedAt);
      return { url: tacticUrl(tactic.slug), ...(Number.isFinite(date.getTime()) ? { lastModified: date } : {}), priority: 0.7 };
    }),
  ];
}
