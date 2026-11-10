import captured from "../../../content/original-copy.json";
import { originalPageSchema } from "./original-copy-schema";
import { validateContent, type SiteContent } from "./schema";
import { canonicalPath, resolveRoute } from "../routes";

export function importedHref(
  href: string,
  sourceUrl: string,
  content: SiteContent,
) {
  if (/^javascript:/i.test(href)) return "/contact";
  if (!href) return "";
  const url = new URL(href, sourceUrl);
  if (["citybond.in", "www.citybond.in"].includes(url.hostname)) {
    if (url.hash === "#get_your_free_sample_kit")
      return "/samples?product=metacity";
    if (url.hash === "#contactus") return "/contact";
    if (url.hash === "#similar_products") return "/products";
    if (url.pathname === "/hpl-series") return "/hpl-sheet";
    if (resolveRoute(url.pathname, content) !== null)
      return url.pathname + url.search + url.hash;
    return "https://citybond.in" + url.pathname + url.search + url.hash;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  return url.href;
}

// Import captured, reviewed data only. This endpoint never fetches a supplied URL.
export function importOriginalCopy(content: SiteContent) {
  const next = structuredClone(content);
  const selected = new Map<string, (typeof captured.records)[number]>();
  for (const record of captured.records) {
    const route = resolveRoute(record.exactPath, next);
    if (route === null)
      throw new Error(`No destination for ${record.exactPath}`);
    if (!selected.has(route) || record.exactPath === canonicalPath(route))
      selected.set(route, record);
  }
  const pages = [...selected].map(([route, record]) =>
    originalPageSchema.parse({
      route,
      title: record.hero.title,
      description: record.hero.description,
      metaTitle: record.title || record.hero.title,
      metaDescription: record.metaDescription,
      sourceUrl: record.sourceUrl,
      importedAt: captured.fetchedAt,
      blocks: record.blocks.map((b) => ({
        ...b,
        href:
          b.type === "link" ? importedHref(b.href, record.sourceUrl, next) : "",
      })),
    }),
  );
  next.originalPages = [
    ...next.originalPages.filter((p) => !selected.has(p.route)),
    ...pages,
  ];
  // Keep cards and secondary references consistent with their page introductions.
  for (const copy of pages) {
    const page = next.pages.find((p) => p.slug === copy.route);
    if (page && copy.title) {
      page.title = copy.title;
      page.accent = "";
      page.description = copy.description;
    }
    const product = next.products.find(
      (p) => "products/" + p.slug === copy.route,
    );
    if (product) product.description = copy.description;
    const resource = next.resources.find(
      (p) => "resources/" + p.slug === copy.route,
    );
    if (resource) {
      if (copy.title) resource.title = copy.title;
      resource.description = copy.description;
    }
  }
  return {
    content: validateContent(next),
    pages: pages.length,
    sourceUrls: captured.records.length,
  };
}
