import { getPublicContent } from "@/lib/cms/content";
import { sitemapPaths } from "@/lib/routes";
export const dynamic = "force-dynamic";
export default async function sitemap() {
  const c = await getPublicContent();
  return sitemapPaths(c).map((path) => ({
    url: new URL(path, process.env.SITE_URL || "https://citybond.in").href,
  }));
}
