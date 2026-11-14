import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/data/site.json";
import { validateContent } from "../src/lib/cms/schema";
import { catalogueEntries, emptyProductFilters, filterCatalogue, productThicknesses } from "../src/lib/product-filters";

const content = validateContent(seed);

test("filter thicknesses match the supplied panel specifications for every product", () => {
  const expected: Record<string, number[]> = {
    "lamio-series": [3, 4, 6], "exclusive-series": [3, 4, 6],
    "wooden-series": [3, 4, 6], "marble-series": [3, 4, 6],
    "metallic-series": [3, 4], "satin-series": [3], "solid-series": [3, 4],
    "gloss-series": [3], "sparkle-series": [3], "mirror-series": [3],
    "hpl-sheet": [6], "3d-panels-series": [3], "metacity": [], "soffit-panels": [],
  };
  assert.equal(Object.keys(expected).length, content.products.length);
  for (const product of content.products) assert.deepEqual(productThicknesses(product, content), expected[product.slug], product.slug);
});

test("thickness filtering excludes unspecified products but All keeps them", () => {
  const entries = catalogueEntries(content);
  assert.equal(filterCatalogue(entries, emptyProductFilters).length, 14);
  for (const [value, count] of [[3, 11], [4, 6], [6, 5]]) {
    assert.equal(filterCatalogue(entries, { ...emptyProductFilters, thickness: String(value) }).length, count);
  }
  for (const value of [0.18, 0.25, 0.5, 24, 960, 2900]) {
    assert.equal(filterCatalogue(entries, { ...emptyProductFilters, thickness: String(value) }).length, 0, "Coil thickness, coating and panel length must not match");
  }
});

test("segment, type, thickness and normalized search combine rather than replace one another", () => {
  const entries = catalogueEntries(content);
  const filters = { segment: "commercial", category: "ACP", thickness: "6", search: "  WOODEN   " };
  assert.deepEqual(filterCatalogue(entries, filters).map(p => p.slug), ["wooden-series", "hpl-sheet"]);
  assert.equal(filterCatalogue(entries, { ...filters, category: "Louvers" }).length, 0);
  assert.equal(filterCatalogue(entries, { ...filters, search: "no-such-product" }).length, 0);
  const single = [{ ...entries[0], product: { ...entries[0].product, segments: ["residential" as const] } }];
  assert.equal(filterCatalogue(single, { ...emptyProductFilters, segment: "commercial" }).length, 0);
  assert.equal(filterCatalogue(single, { ...emptyProductFilters, segment: "residential" }).length, 1);
});

test("search includes editable finish names and tolerates whitespace", () => {
  const entries = catalogueEntries(content);
  const first = entries.find(entry => entry.product.finishes.length)!;
  assert.ok(filterCatalogue(entries, { ...emptyProductFilters, search: `  ${first.product.finishes[0].name.toUpperCase()}  ` }).some(p => p.slug === first.product.slug));
  assert.equal(filterCatalogue(entries, { ...emptyProductFilters, search: "   " }).length, entries.length);
});

test("editing an original panel table immediately changes filter results without a duplicate mapping", () => {
  const edited = structuredClone(content);
  const page = edited.originalPages.find(p => p.route === "products/satin-series")!;
  const table = page.blocks.find(b => b.type === "table")!;
  table.rows[3][1] = "4 mm";
  assert.deepEqual(productThicknesses(edited.products.find(p => p.slug === "satin-series")!, edited), [4]);
  const entries = catalogueEntries(edited);
  assert.equal(filterCatalogue(entries, { ...emptyProductFilters, thickness: "4" }).length, 7);
  assert.equal(filterCatalogue(entries, { ...emptyProductFilters, thickness: "3" }).length, 10);
});

test("imported copy takes precedence over stale fallback specs; new products use explicit structured thickness specs", () => {
  const edited = structuredClone(content);
  const product = edited.products[0];
  const page = edited.originalPages.find(p => p.route === `products/${product.slug}`)!;
  page.blocks = [];
  assert.deepEqual(productThicknesses(product, edited), []);
  edited.originalPages = edited.originalPages.filter(p => p !== page);
  assert.deepEqual(productThicknesses(product, edited), [3, 4, 6]);
  product.specs = [{ label: "Skin Thickness", value: "0.25 mm" }, { label: "Panel thickness", value: "4 mm · 6 mm" }];
  assert.deepEqual(productThicknesses(product, edited), [4, 6]);
});
