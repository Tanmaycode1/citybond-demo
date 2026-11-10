// Exercise the same authenticated actions used by the content portal.
// The test restores all original content even if an assertion fails.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.CHECK_BASE || "http://localhost:3001";
const password = (
  await readFile(new URL("../.owner-access.txt", import.meta.url), "utf8")
).match(/(?:Owner password|Password):\s*(\S+)/i)?.[1];
assert.ok(password, "Owner password is configured");
const login = await fetch(`${base}/api/studio/login`, {
  method: "POST",
  headers: { origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
assert.equal(login.status, 200, "Portal login succeeds");
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
async function api(action, data) {
  const r = await fetch(`${base}/api/studio/${action}`, {
    method: data ? "POST" : "GET",
    headers: { cookie, origin: base, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.equal(r.status, 200, `${action}: ${await r.clone().text()}`);
  return r.json();
}
async function main(preview = false) {
  const r = await fetch(`${base}/${preview ? "?preview=1" : ""}`, {
    headers: preview ? { cookie } : {},
    cache: "no-store",
  });
  assert.equal(r.status, 200);
  const html = await r.text();
  // Assert actual rendered HTML, not content serialized into React scripts.
  return (
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || ""
  );
}
const original = await api("content");
assert.ok(original.storageReady);
const before = await main();
const content = structuredClone(original.content);
const home = content.originalPages.find((p) => p.route === "");
assert.ok(home);
home.title = "CityBond content QA heading";
home.blocks.find((b) => b.id === "original-0011").text =
  "CityBond content QA benefits";
home.blocks.find((b) => b.id === "original-0013").text =
  "CityBond content QA body";
content.home.imageAlt = "CityBond content QA image description";
const markers = [
  home.title,
  "CityBond content QA benefits",
  "CityBond content QA body",
  content.home.imageAlt,
];
let saved = false;
let published = false;
try {
  const draft = await api("save", { content, draftEtag: original.draftEtag });
  saved = true;
  const publicDraft = await main();
  const preview = await main(true);
  for (const marker of markers) {
    assert.ok(!publicDraft.includes(marker), `Draft stays private: ${marker}`);
    assert.ok(preview.includes(marker), `Private preview renders: ${marker}`);
  }
  assert.ok(
    preview.includes('class="home-benefits"'),
    "Edited headings keep their designed layout",
  );
  console.log(
    "PASS homepage title, section heading, body and image alt edits render in private preview only",
  );
  await api("publish", {
    draftEtag: draft.draftEtag,
    publishedEtag: original.publishedEtag,
  });
  published = true;
  const live = await main();
  for (const marker of markers)
    assert.ok(live.includes(marker), `Published page renders: ${marker}`);
  console.log(
    "PASS saved portal edits publish to the actual public homepage HTML",
  );
} finally {
  if (saved) {
    const latest = await api("content");
    const restored = await api("save", {
      content: original.content,
      draftEtag: latest.draftEtag,
    });
    if (published)
      await api("publish", {
        draftEtag: restored.draftEtag,
        publishedEtag: latest.publishedEtag,
      });
  }
}
assert.deepEqual((await api("content")).content, original.content);
const after = await main();
for (const marker of markers)
  assert.ok(!after.includes(marker), "QA markers removed");
assert.ok(
  before.includes(
    original.content.originalPages.find((p) => p.route === "").title,
  ),
  "Start from published original content",
);
console.log("PASS original content restored; no QA copy remains");
