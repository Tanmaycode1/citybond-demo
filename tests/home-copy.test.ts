import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/data/site.json";
import { validateContent } from "../src/lib/cms/schema";
import { homeCopySections } from "../src/lib/home-copy";

const page = validateContent(seed).originalPages.find((p) => p.route === "")!;
test("homepage sections retain every original content block exactly once", () => {
  const groups = homeCopySections(page.blocks);
  const flattened = groups.flatMap((g) => [
    ...(g.heading ? [g.heading] : []),
    ...g.blocks,
  ]);
  assert.deepEqual(flattened, page.blocks);
  assert.deepEqual(
    groups.map((g) => g.kind),
    [
      "about",
      "products",
      "certifications",
      "brochure",
      "benefits",
      "industries",
      "brands",
      "stories",
      "awards",
      "projects",
    ],
  );
});
test("portal edits to headings and copy do not break the designed section mapping", () => {
  const blocks = structuredClone(page.blocks);
  blocks[0].text = "An owner-edited heading";
  blocks[1].text = "New introduction from the content portal.";
  const section = homeCopySections(blocks)[0];
  assert.equal(section.kind, "about");
  assert.equal(section.heading?.text, blocks[0].text);
  assert.equal(section.blocks[0].text, blocks[1].text);
});
test("new CMS sections and leading content remain visible instead of being discarded", () => {
  const extra = { ...page.blocks[0], id: "owner-section", text: "New section" };
  const paragraph = {
    ...page.blocks[1],
    id: "owner-paragraph",
    text: "New text",
  };
  const blocks = [paragraph, ...page.blocks, extra, paragraph];
  const groups = homeCopySections(blocks);
  assert.deepEqual(
    groups.flatMap((g) => [...(g.heading ? [g.heading] : []), ...g.blocks]),
    blocks,
  );
  assert.equal(groups[0].kind, "extra");
  assert.equal(groups.at(-1)?.kind, "extra");
  assert.deepEqual(homeCopySections([]), []);
});
