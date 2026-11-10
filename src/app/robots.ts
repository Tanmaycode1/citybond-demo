import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/studio-7c9e", "/api/", "/*?preview="],
    },
    sitemap: new URL(
      "/sitemap.xml",
      process.env.SITE_URL || "https://citybond.in",
    ).href,
  };
}
