import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const staging = process.env.SITE_INDEXABLE === "false" || (!!process.env.VERCEL && process.env.SITE_INDEXABLE !== "true");
  return {
    rules: {
      userAgent: "*",
      ...(staging ? {} : {allow: "/"}),
      disallow: staging ? ["/"] : ["/studio-7c9e", "/api/", "/blog/category/", "/blog/tag/", "/*?preview="],
    },
    sitemap: new URL(
      "/sitemap.xml",
      process.env.SITE_URL || "https://citybond.in",
    ).href,
  };
}
