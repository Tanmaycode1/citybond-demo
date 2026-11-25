import type { Product, SiteContent } from "./cms/schema";
import { canonicalHref, canonicalPath } from "./routes";

type Menu = SiteContent["site"]["nav"][number];
const pathOnly = (href: string) => canonicalHref(href).split(/[?#]/)[0];
export const productPath = (product: Pick<Product, "slug">) => canonicalPath(`products/${product.slug}`);
function productMenu(c: SiteContent): Menu | undefined {
  return c.site.nav.find(item => pathOnly(item.href) === "/products");
}
export function productMenuCategory(product: Product, c: SiteContent): string {
  const existing = productMenu(c)?.children.find(link => pathOnly(link.href) === productPath(product));
  return product.menuCategory?.trim() || existing?.group || product.category.trim() || "Products";
}
export function productMenuCategories(c: SiteContent): string[] {
  return [...new Set([
    ...(productMenu(c)?.children.map(link => link.group).filter(Boolean) || []),
    ...c.productMenuCategories,
    ...c.products.map(product => product.category).filter(Boolean),
    ...c.products.map(product => productMenuCategory(product, c)),
  ])];
}
/** Product records own their menu entries; informational links remain editable. */
export function navigationWithProducts(c: SiteContent): SiteContent["site"]["nav"] {
  const menu = productMenu(c);
  const products = new Map(c.products.map(product => [productPath(product), product]));
  const seen = new Set<string>();
  const children: Menu["children"] = [];
  for (const link of menu?.children || []) {
    const href = pathOnly(link.href), product = products.get(href);
    if (product) {
      if (!seen.has(product.slug)) children.push({label: product.name, href: productPath(product), group: productMenuCategory(product, c)});
      seen.add(product.slug);
    } else if (!href.startsWith("/products/")) children.push(link);
  }
  for (const product of c.products) {
    if (!seen.has(product.slug)) children.push({label: product.name, href: productPath(product), group: productMenuCategory(product, c)});
  }
  return menu
    ? c.site.nav.map(item => item === menu ? {...item, children} : item)
    : [{label: "Products", href: "/products", children}, ...c.site.nav];
}
