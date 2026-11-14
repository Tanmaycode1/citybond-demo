import type { Product, SiteContent } from "./cms/schema";

export type ProductFilters = {
  segment: string;
  category: string;
  thickness: string;
  search: string;
};

export const emptyProductFilters: ProductFilters = {
  segment: "all", category: "all", thickness: "all", search: "",
};

// Read only panel thickness, never coil/skin thickness, lengths, or coating values.
function millimetres(value: string): number[] {
  return [...value.matchAll(/\b(\d+(?:\.\d+)?)\s*mm\b/gi)]
    .map(match => Number(match[1])).filter(value => value > 0);
}

export function productThicknesses(product: Product, content: SiteContent): number[] {
  const original = content.originalPages.find(page => page.route === `products/${product.slug}`);
  const values: number[] = [];
  if (original) {
    for (const block of original.blocks) {
      if (block.type !== "table") continue;
      const headerIndex = block.rows.findIndex(row => row.some(cell => /^(panel|panel thickness(?:\s*\(mm\))?)$/i.test(cell.trim())));
      if (headerIndex >= 0) {
        const column = block.rows[headerIndex].findIndex(cell => /^(panel|panel thickness(?:\s*\(mm\))?)$/i.test(cell.trim()));
        for (const row of block.rows.slice(headerIndex + 1)) values.push(...millimetres(row[column] || ""));
      }
      for (const row of block.rows) {
        const labelIndex = row.findIndex(cell => /^(?:thickness of composite panel|panel thickness|acp thickness)(?:\s*\(mm\))?$/i.test(cell.trim()));
        if (labelIndex >= 0) values.push(...row.slice(labelIndex + 1).flatMap(millimetres));
      }
    }
  } else {
    // Products without imported copy can use their editable structured specs.
    for (const spec of product.specs) {
      if (/^(?:published thickness(?:es)?|panel thickness|acp thickness)$/i.test(spec.label.trim())) values.push(...millimetres(spec.value));
    }
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

export function catalogueEntries(content: SiteContent) {
  return content.products.map(product => ({ product, thicknesses: productThicknesses(product, content) }));
}

export function filterCatalogue(entries: ReturnType<typeof catalogueEntries>, filters: ProductFilters) {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(({ product, thicknesses }) => {
    const text = [product.name, product.category, product.collection, product.description, ...product.finishes.map(finish => finish.name)].join(" ").toLowerCase();
    return (filters.segment === "all" || product.segments.some(segment => segment === filters.segment))
      && (filters.category === "all" || product.category === filters.category)
      && (filters.thickness === "all" || thicknesses.includes(Number(filters.thickness)))
      && terms.every(term => text.includes(term));
  }).map(entry => entry.product);
}
