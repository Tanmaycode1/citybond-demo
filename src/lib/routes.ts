import type { SiteContent } from "./cms/schema";
import canonicalPaths from "@/data/canonical-paths.json";
import { blogPath, blogRoutes } from "./blog";
const paths: Record<string, string> = canonicalPaths;
const duplicates: Record<string, string> = {
  index: "",
  "index.php": "",
  "contact.php": "contact",
  "network.php": "network",
  "projects.php": "projects",
  "infrastructure.php": "about/infrastructure",
  "privacy-policy.php": "privacy",
  "thankyou.php": "thank-you",
  "sitemap.html": "site-map",
};
export function canonicalPath(route: string): string {
  if (route in duplicates) return canonicalPath(duplicates[route]);
  if (route === "blog" || route.startsWith("blog/"))
    return "/" + route.replace(/\/$/, "") + "/";
  return (
    paths[route] ??
    Object.values(paths).find((p) => p.replace(/^\/|\/$/g, "") === route) ??
    "/" + route
  );
}
export function canonicalHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const match = href.match(/^([^?#]*)(.*)$/)!;
  return canonicalPath(match[1].replace(/^\/|\/$/g, "")) + match[2];
}
export function contentRoutes(c: SiteContent) {
  return [
    "",
    ...c.pages.map((p) => p.slug),
    ...c.products.map((p) => "products/" + p.slug),
    ...c.projects.map((p) => "projects/" + p.slug),
    ...c.resources.map((p) => "resources/" + p.slug),
    ...c.roles.map((p) => "for/" + p.id),
  ];
}
// Resolve a legacy address to a renderer, without redirecting the browser.
export function resolveRoute(route: string, c: SiteContent): string | null {
  const normalized = route.replace(/^\/|\/$/g, "");
  const target =
    normalized in duplicates
      ? duplicates[normalized]
      : (Object.entries(paths).find(
          ([, path]) => path.replace(/^\/|\/$/g, "") === normalized,
        )?.[0] ?? normalized);
  return contentRoutes(c).includes(target) ? target : null;
}
// Kept for older callers; this returns the renderer only, never an HTTP redirect.
export function legacyRoute(route: string, c: SiteContent) {
  const target = resolveRoute(route, c);
  return target !== route ? target : null;
}
export function routes(
  c: SiteContent,
  options: { includeDrafts?: boolean } = {},
) {
  return [
    ...new Set([
      ...contentRoutes(c).map((r) => canonicalPath(r).slice(1)),
      ...contentRoutes(c),
      ...Object.keys(duplicates),
      ...blogRoutes(c),
      ...c.blogs
        .filter((p) => options.includeDrafts || p.status === "published")
        .map((p) => blogPath(p.slug).slice(1)),
    ]),
  ];
}
export function sitemapPaths(c: SiteContent) {
  return [
    ...new Set([
      ...contentRoutes(c)
        .filter((r) => !["thank-you", "site-map"].includes(r))
        .map(canonicalPath),
      "/blog/",
      ...c.blogs
        .filter((p) => p.status === "published" && !p.example)
        .map((p) => blogPath(p.slug)),
    ]),
  ];
}
