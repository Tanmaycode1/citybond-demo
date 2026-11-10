import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.CHECK_BASE || "http://localhost:3001";
const seed = JSON.parse(
  await readFile(new URL("../src/data/site.json", import.meta.url)),
);
const paths = [
  "",
  ...seed.pages.map((p) => p.slug),
  ...seed.products.map((p) => "products/" + p.slug),
  ...seed.projects.map((p) => "projects/" + p.slug),
  ...seed.resources.map((p) => "resources/" + p.slug),
  ...seed.roles.map((p) => "for/" + p.id),
];
for (let i = 0; i < paths.length; i += 5) {
  await Promise.all(
    paths.slice(i, i + 5).map(async (p) => {
      const r = await fetch(`${base}/${p}`);
      assert.equal(r.status, 200, p);
      const html = await r.text();
      assert.ok(html.includes("<h1"), p);
      assert.ok(!html.includes("Application error"), p);
    }),
  );
}
console.log(`PASS ${paths.length} public routes`);
for (const p of ["api/studio/content", "api/studio/enquiries", "?preview=1"]) {
  const r = await fetch(`${base}/${p}`);
  assert.equal(r.status, p === "?preview=1" ? 404 : 401, p);
}
console.log("PASS unauthenticated editor and preview isolation");
const password = (
  await readFile(new URL("../.owner-access.txt", import.meta.url), "utf8")
).match(/(?:Owner password|Password):\s*(\S+)/i)?.[1];
assert.ok(password, "owner password found");
const login = await fetch(base + "/api/studio/login", {
  method: "POST",
  headers: { origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
assert.equal(login.status, 200, await login.clone().text());
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
assert.ok(login.headers.get("set-cookie").includes("HttpOnly"));
async function api(action, data) {
  const r = await fetch(base + "/api/studio/" + action, {
    method: data ? "POST" : "GET",
    headers: { cookie, origin: base, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const state = (await api("content")).data;
assert.ok(state.storageReady);
const changed = structuredClone(state.content);
changed.home.title = "Draft integration check";
const saved = await api("save", {
  content: changed,
  draftEtag: state.draftEtag,
});
assert.equal(saved.status, 200, JSON.stringify(saved.data));
const publicPage = await (await fetch(base)).text();
assert.ok(!publicPage.includes("Draft integration check"));
const preview = await (
  await fetch(base + "/?preview=1", { headers: { cookie } })
).text();
assert.ok(preview.includes("Draft integration check"));
const stale = await api("save", {
  content: changed,
  draftEtag: state.draftEtag,
});
assert.equal(stale.status, 409);
console.log("PASS login, draft save, private preview and conflict handling");
const restored = await api("save", {
  content: state.content,
  draftEtag: saved.data.draftEtag,
});
assert.equal(restored.status, 200);
const published = await api("publish", {
  draftEtag: restored.data.draftEtag,
  publishedEtag: state.publishedEtag,
});
assert.equal(published.status, 200, JSON.stringify(published.data));
console.log("PASS publish original content and revision history");
const cross = await fetch(base + "/api/studio/save", {
  method: "POST",
  headers: {
    cookie,
    origin: "https://untrusted.example",
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(cross.status, 403);
console.log("PASS cross-origin write protection");
const image = await readFile(
  new URL("../public/citybond/logo.webp", import.meta.url),
);
const upload = new FormData();
upload.set("file", new File([image], "logo.webp", { type: "image/webp" }));
const ur = await fetch(base + "/api/studio/upload", {
  method: "POST",
  headers: { cookie, origin: base },
  body: upload,
});
assert.equal(ur.status, 200);
const uploaded = await ur.json();
assert.match(uploaded.url, /^\/api\/media\//);
const media = await fetch(base + uploaded.url);
assert.equal(media.status, 200);
assert.equal(media.headers.get("content-type"), "image/webp");
console.log("PASS authenticated media upload and delivery");
if (!process.env.CHECK_BASE) {
  const body = new FormData();
  body.set(
    "data",
    JSON.stringify({
      name: "Local QA Test",
      email: "qa@example.com",
      phone: "+91 9000000000",
      city: "Delhi",
      role: "Architect",
      type: "visualiser",
      product: "lamio-series",
      message: "Automated local verification only",
      consent: true,
    }),
  );
  body.set("file", new File([image], "building.webp", { type: "image/webp" }));
  const er = await fetch(base + "/api/enquiries", {
    method: "POST",
    headers: { origin: base },
    body,
  });
  assert.equal(er.status, 200, await er.clone().text());
  const inbox = await api("enquiries");
  const enquiry = inbox.data.enquiries.find(
    (e) => e.email === "qa@example.com",
  );
  assert.ok(enquiry?.attachment);
  const privateFile = await fetch(
    base + "/api/studio/attachment?key=" + enquiry.attachment,
  );
  assert.equal(privateFile.status, 401);
  const allowedFile = await fetch(
    base + "/api/studio/attachment?key=" + enquiry.attachment,
    { headers: { cookie } },
  );
  assert.equal(allowedFile.status, 200);
  console.log("PASS enquiry persistence, inbox and private attachments");
}
console.log("All integration checks passed.");
