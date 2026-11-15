import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/for-me", "/login", "/submit", "/moderation"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
