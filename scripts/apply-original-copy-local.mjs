// Use the same authenticated import / save / publish actions as the content portal.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = "http://localhost:3001";
const password = (
  await readFile(new URL("../.owner-access.txt", import.meta.url), "utf8")
).match(/(?:Owner password|Password):\s*(\S+)/i)?.[1];
const login = await fetch(base + "/api/studio/login", {
  method: "POST",
  headers: { origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
async function api(action, data) {
  const r = await fetch(base + "/api/studio/" + action, {
    method: data ? "POST" : "GET",
    headers: { cookie, origin: base, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
const before = await api("content");
const imported = await api("import-original", { draftEtag: before.draftEtag });
assert.equal(imported.sourceUrls, 69);
assert.equal(imported.pages, 62);
const state = await api("content");
assert.equal(state.content.originalPages.length, 62);
const changed = structuredClone(state.content);
changed.originalPages.find((p) => p.route === "about").title =
  "Private original-copy edit check";
const saved = await api("save", {
  content: changed,
  draftEtag: state.draftEtag,
});
const preview = await (
  await fetch(base + "/about?preview=1", { headers: { cookie } })
).text();
assert.ok(preview.includes("Private original-copy edit check"));
assert.ok(
  !(await (await fetch(base + "/about")).text()).includes(
    "Private original-copy edit check",
  ),
);
const restored = await api("save", {
  content: state.content,
  draftEtag: saved.draftEtag,
});
await api("publish", {
  draftEtag: restored.draftEtag,
  publishedEtag: state.publishedEtag,
});
const page = await (await fetch(base + "/about")).text();
assert.ok(
  page.includes("Premium Aluminium Composite Panels for timeless statements."),
);
console.log(
  "PASS imported 69 source URLs into 62 portal records, edited and previewed privately, restored exact source copy and published through portal APIs.",
);
