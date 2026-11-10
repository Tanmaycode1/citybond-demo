import { test } from "node:test";
import assert from "node:assert/strict";
import captured from "../content/original-copy.json";
import seed from "../src/data/site.json";
import { validateContent } from "../src/lib/cms/schema";
import { importOriginalCopy, importedHref } from "../src/lib/cms/original-copy";
import { originalBlockSchema } from "../src/lib/cms/original-copy-schema";
import { canonicalPath, resolveRoute } from "../src/lib/routes";
const c = validateContent(seed);
test("all 69 original source pages preserve extracted main-content text", () => {
  assert.equal(captured.records.length, 69);
  for (const r of captured.records) {
    assert.equal(r.httpStatus, 200, r.sourceUrl);
    assert.equal(r.textParityVerified, true, r.sourceUrl);
    assert.equal(r.sourceTextHash, r.extractedTextHash, r.sourceUrl);
    assert.ok(r.hero.title, r.sourceUrl);
  }
});
test("import maps all original addresses to 62 editable records and preserves wording", () => {
  const result = importOriginalCopy(c);
  assert.equal(result.pages, 62);
  for (const r of captured.records) {
    const route = resolveRoute(r.exactPath, c);
    const p = result.content.originalPages.find((p) => p.route === route)!;
    assert.ok(p, r.exactPath);
    if (r.exactPath !== canonicalPath(route!)) continue;
    assert.equal(p.title, r.hero.title);
    assert.equal(p.description, r.hero.description);
    assert.equal(p.blocks.length, r.blocks.length);
    for (let i = 0; i < p.blocks.length; i++) {
      for (const key of ["text", "items", "rows"] as const)
        assert.deepEqual(
          p.blocks[i][key],
          r.blocks[i][key],
          r.exactPath + " " + key,
        );
    }
  }
});
test("import preserves owner images, blogs, navigation and unrelated content", () => {
  const edited = structuredClone(c);
  edited.home.image = "/stock/folded-facade.webp";
  edited.blogs[0].title = "Owner blog";
  edited.site.tagline = "Owner tagline";
  const result = importOriginalCopy(edited).content;
  assert.equal(result.home.image, edited.home.image);
  assert.deepEqual(result.blogs, edited.blogs);
  assert.deepEqual(result.site, edited.site);
  assert.deepEqual(
    result.products.map((p) => p.image),
    edited.products.map((p) => p.image),
  );
  assert.deepEqual(
    importOriginalCopy(result).content.originalPages,
    result.originalPages,
  );
});
test("every imported field remains editable after validation and executable source links cannot run", () => {
  const result = importOriginalCopy(c).content;
  const p = result.originalPages.find((p) => p.route === "about")!;
  p.title = "Owner heading";
  p.description = "Owner introduction";
  p.metaDescription = "Owner SEO description";
  p.blocks[0].text = "Owner section text";
  const validated = validateContent(result).originalPages.find(
    (p) => p.route === "about",
  )!;
  assert.equal(validated.blocks[0].text, "Owner section text");
  assert.equal(validated.title, "Owner heading");
  assert.equal(validated.metaDescription, "Owner SEO description");
  assert.equal(
    importedHref("JavaScript:void(0);", "https://citybond.in/about", c),
    "/contact",
  );
  assert.equal(
    originalBlockSchema.safeParse({
      ...p.blocks[0],
      href: "javascript:alert(1)",
    }).success,
    false,
  );
});
