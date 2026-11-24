// Run against a disposable local CMS store. All edited content is restored.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.CHECK_BASE || "http://localhost:3001";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local test server");
const password = (await readFile(new URL("../.owner-access.txt", import.meta.url), "utf8"))
  .match(/(?:Owner password|Password):\s*(\S+)/i)?.[1];
assert.ok(password);
const login = await fetch(base + "/api/studio/login", {
  method: "POST", headers: { origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
async function api(action, body) {
  const response = await fetch(`${base}/api/studio/${action}`, {
    method: body ? "POST" : "GET",
    headers: { cookie, origin: base, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, 200, `${action}: ${await response.clone().text()}`);
  return response.json();
}
async function main(path, preview) {
  const response = await fetch(`${base}${path}${preview ? "?preview=1" : ""}`, {
    headers: preview ? { cookie } : {},
  });
  assert.equal(response.status, 200, path);
  return (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
}
const original = await api("content");
const content = structuredClone(original.content);
const contact = content.originalPages.find(page => page.route === "contact");
contact.blocks.find(block => block.id === "original-0007").text = "Portal QA contact heading";
contact.blocks.find(block => block.id === "original-0009").text = "Portal QA presence heading";
const resource = content.originalPages.find(page => page.route === "resources/product-catalogue");
resource.title = "Portal QA catalogue heading";
resource.description = "Portal QA catalogue introduction";
const product = structuredClone(content.products[0]);
product.slug = "portal-qa-panel";
product.specs = [{ label: "Portal QA specification", value: "9 mm" }];
content.products.push(product);
const role = content.roles.find(role => role.id === "homeowner");
role.sections = ["technical", "collections", "brands", "testimonials", "quiz", "metacity", "dealer-enquiry", "contact"];
async function verify(preview) {
  const contactHtml = await main("/contact", preview);
  assert.ok(contactHtml.includes('class="wrap contact-main"'));
  assert.ok(contactHtml.includes("Portal QA contact heading"));
  assert.ok(contactHtml.includes("Portal QA presence heading"));
  const resourceHtml = await main("/catalogue-download", preview);
  assert.ok(resourceHtml.includes("<h1>Portal QA catalogue heading</h1>"));
  assert.ok(resourceHtml.includes("Portal QA catalogue introduction"));
  const productHtml = await main("/products/portal-qa-panel", preview);
  assert.ok(productHtml.includes("<dt>Portal QA specification</dt><dd>9 mm</dd>"));
  const roleHtml = await main("/for/homeowner", preview);
  for (const section of role.sections.filter(section => section !== "contact"))
    assert.ok(roleHtml.includes(`data-journey-section="${section}"`), section);
}
let saved = false;
let published = false;
try {
  const draft = await api("save", { content, draftEtag: original.draftEtag });
  saved = true;
  assert.ok(!(await main("/contact", false)).includes("Portal QA contact heading"));
  assert.ok(!(await main("/catalogue-download", false)).includes("Portal QA catalogue heading"));
  assert.equal((await fetch(`${base}/products/portal-qa-panel`)).status, 404);
  await verify(true);
  console.log("PASS edited contact layout, resource hero, new product specs and seven journey sections render in private preview");
  await api("publish", { draftEtag: draft.draftEtag, publishedEtag: original.publishedEtag });
  published = true;
  await verify(false);
  console.log("PASS all four portal fixes render after publication; draft edits stayed private beforehand");
} finally {
  if (saved) {
    const latest = await api("content");
    const restored = await api("save", { content: original.content, draftEtag: latest.draftEtag });
    if (published) await api("publish", { draftEtag: restored.draftEtag, publishedEtag: latest.publishedEtag });
  }
}
assert.deepEqual((await api("content")).content, original.content);
assert.ok(!(await main("/contact", false)).includes("Portal QA contact heading"));
assert.equal((await fetch(`${base}/products/portal-qa-panel`)).status, 404);
console.log("PASS original content restored and temporary product removed");
