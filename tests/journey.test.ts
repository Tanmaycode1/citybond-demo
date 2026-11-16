import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/data/site.json";
import { journeyHref, resolveJourneyRole } from "../src/lib/journey";
import { navigationTarget } from "../src/lib/navigation";

test("role routes take precedence; only configured perspectives are accepted", () => {
  for (const role of seed.roles) {
    assert.equal(resolveJourneyRole(`for/${role.id}`, "wrong", seed.roles), role.id);
    assert.equal(resolveJourneyRole("contact", role.id, seed.roles), role.id);
  }
  assert.equal(resolveJourneyRole("contact", "unknown-role", seed.roles), "");
  assert.equal(resolveJourneyRole("contact", ["architect"], seed.roles), "");
});

test("browsing preserves perspective alongside product/project context and anchors", () => {
  assert.equal(journeyHref("/samples?product=metallic-series#form", "architect"), "/samples?product=metallic-series&role=architect#form");
  assert.equal(journeyHref("/contact?project=fortune-sakura", "contractor"), "/contact?project=fortune-sakura&role=contractor");
  assert.equal(journeyHref("/products?role=homeowner", "architect"), "/products?role=homeowner");
  assert.equal(journeyHref("/products", ""), "/products");
});

test("home, switching roles, external links, downloads and same-page anchors do not inherit an old perspective", () => {
  for (const href of ["/", "/?explore=1#material-story", "/architects", "/for/dealer", "#audience-options", "https://example.test/catalogue", "//example.test", "mailto:info@example.test", "/catalogue.pdf", "/api/media/image.png"]) {
    assert.equal(journeyHref(href, "architect"), href);
  }
});

test("Explore is a query navigation; scroll waits for the revealed homepage", () => {
  assert.deepEqual(navigationTarget("/?explore=1#material-story", "https://example.test/"), { pathname: "/", hash: "#material-story", samePage: false });
  assert.equal(navigationTarget("#material-story", "https://example.test/?explore=1")?.samePage, true);
});

test("PDF role journeys contain their priority steps without dropping contact", () => {
  const firstSteps: Record<string, string[]> = {
    architect: ["projects", "products", "technical", "visualiser", "collections", "brands", "resources"],
    dealer: ["network", "dealer-enquiry", "products", "collections", "about"],
    signage: ["products", "metacity", "about", "brands", "resources"],
    "brand-manager": ["projects", "about", "brands", "resources", "products", "collections"],
    contractor: ["products", "technical", "about", "collections", "resources", "network"],
    homeowner: ["visualiser", "quiz", "projects", "about", "testimonials", "network"],
  };
  for (const role of seed.roles) {
    assert.deepEqual(role.sections.slice(0, firstSteps[role.id].length), firstSteps[role.id]);
    assert.equal(role.sections.at(-1), "contact");
  }
  assert.deepEqual(seed.projects.find(project => project.slug === "fortune-sakura")?.products, ["metallic-series"]);
});
