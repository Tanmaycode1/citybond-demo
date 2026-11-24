import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import seed from "../src/data/site.json";
import { Website } from "../src/components/site/Website";
import { validateContent, type SiteContent } from "../src/lib/cms/schema";
import { roleSections } from "../src/lib/role-sections";

function render(content: SiteContent, route: string) {
  // Match the server page's content projection, rather than exposing unrelated
  // Original Pages records to the component under test.
  return renderToStaticMarkup(createElement(Website, {
    route,
    content: {
      ...validateContent(content),
      originalPages: content.originalPages.filter(page => page.route === route),
    },
  }));
}

test("contact heading edits and inserted copy retain the form and presence layout", () => {
  const content = validateContent(seed);
  const page = content.originalPages.find(page => page.route === "contact")!;
  page.blocks.find(block => block.id === "original-0007")!.text = "Speak with our team";
  page.blocks.find(block => block.id === "original-0009")!.text = "Find CityBond nearby";
  page.blocks.unshift({ ...page.blocks[1], id: "owner-introduction", text: "Owner-added office note" });
  const html = render(content, "contact");
  assert.ok(html.includes('class="wrap contact-main"'));
  assert.ok(html.includes('class="contact-form-area"'));
  assert.ok(html.includes('class="wrap contact-presence"'));
  for (const text of ["Speak with our team", "Find CityBond nearby", "Owner-added office note"])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('name="email"'));
  assert.ok(!html.includes("enquiry-layout"), "Must not fall back to the old layout");
});

test("resource heroes use editable original titles and descriptions on both imported routes", () => {
  for (const slug of ["product-catalogue", "growth-magazine"]) {
    const content = validateContent(seed);
    const route = `resources/${slug}`;
    const page = content.originalPages.find(page => page.route === route)!;
    page.title = "Owner resource heading";
    page.description = "Owner resource introduction";
    const html = render(content, route);
    assert.ok(html.includes("<h1>Owner resource heading</h1>"));
    assert.ok(html.includes('class="resource-description">Owner resource introduction</p>'));
    page.description = "";
    assert.ok(render(content, route).includes('class="resource-description"></p>'), "Clearing the introduction must not resurrect stale fallback copy");
  }
});

test("resources without imported copy retain their structured hero fields", () => {
  const content = validateContent(seed);
  const resource = content.resources.find(resource => !content.originalPages.some(page => page.route === `resources/${resource.slug}`))!;
  resource.title = "New editorial resource";
  resource.description = "Editable structured resource introduction";
  const html = render(content, `resources/${resource.slug}`);
  assert.ok(html.includes(`<h1>${resource.title}</h1>`));
  assert.ok(html.includes(resource.description));
});

test("new products render their saved structured specifications", () => {
  const content = validateContent(seed);
  const product = structuredClone(content.products[0]);
  product.slug = "owner-added-panel";
  product.specs = [{ label: "Panel thickness", value: "9 mm" }, { label: "Warranty", value: "Owner specification text" }];
  content.products.push(product);
  let html = render(content, `products/${product.slug}`);
  assert.ok(html.includes("<dt>Panel thickness</dt><dd>9 mm</dd>"));
  assert.ok(html.includes("<dt>Warranty</dt><dd>Owner specification text</dd>"));
  product.specs = [];
  html = render(content, `products/${product.slug}`);
  assert.ok(!html.includes("<dl>"), "Empty specification lists should not leave an empty component");
});

test("imported product specifications still take precedence over fallback fields", () => {
  const content = validateContent(seed);
  content.products[0].specs = [{ label: "Fallback only", value: "Must not duplicate imported specifications" }];
  const html = render(content, `products/${content.products[0].slug}`);
  assert.ok(!html.includes("Must not duplicate imported specifications"));
  assert.ok(html.includes("product-specification-table"));
});

test("every portal journey option validates and renders on an owner-edited role page", () => {
  const content = validateContent(seed);
  const role = content.roles.find(role => role.id === "homeowner")!;
  for (const section of ["collections", "technical", "brands", "testimonials", "quiz", "metacity", "dealer-enquiry"] as const)
    assert.ok(roleSections.includes(section), `${section} is offered by the portal`);
  role.sections = [...roleSections];
  const html = render(content, `for/${role.id}`);
  for (const section of roleSections.filter(section => section !== "contact"))
    assert.ok(html.includes(`data-journey-section="${section}"`), section);
  assert.ok(html.includes('class="contact-band"'), "Contact remains the final shared section");
});
