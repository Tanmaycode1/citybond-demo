import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import seed from "../src/data/site.json";
import { validateContent, safeUrl, enquirySchema } from "../src/lib/cms/schema";
import {
  passwordHash,
  passwordMatches,
  signSession,
  validSession,
  assertOrigin,
  allowAttempt,
} from "../src/lib/cms/auth";
import { readObject, writeObject, ConflictError } from "../src/lib/cms/storage";
import {
  saveDraft,
  publishDraft,
  getPublicContent,
  getEditorState,
} from "../src/lib/cms/content";
import { detectFile, uploadFile, MAX_UPLOAD } from "../src/lib/cms/uploads";
import { routes, legacyRoute } from "../src/lib/routes";
let dir: string;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "citybond-cms-test-"));
  process.env.CMS_LOCAL_DIR = dir;
  delete process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  process.env.CMS_SESSION_SECRET =
    "test-secret-that-is-at-least-thirty-two-characters";
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});
test("official seed validates, every image exists and editorial links resolve", async () => {
  const c = validateContent(seed);
  const paths = new Set(routes(c));
  assert.equal(paths.size, routes(c).length);
  const { access } = await import("node:fs/promises");
  async function visit(v: unknown) {
    if (typeof v === "string") {
      if (/^\/(citybond|images|stock)\//.test(v))
        await access(path.join(process.cwd(), "public", v));
      if (
        v.startsWith("/") &&
        !/^\/(citybond|images|stock)\//.test(v) &&
        !v.includes("?") &&
        !v.includes("#")
      )
        assert.ok(paths.has(v.slice(1)), v);
    } else if (v && typeof v === "object")
      for (const child of Object.values(v)) await visit(child);
  }
  await visit(c);
  assert.equal(legacyRoute("lamio-series", c), "products/lamio-series");
});
test("older published content receives new UI labels without overwriting owner copy", () => {
  const older = structuredClone(seed) as Omit<typeof seed, "ui"> & {
    ui: Record<string, string>;
  };
  delete older.ui.stockCaption;
  delete older.ui.storyInstruction;
  older.ui.explore = "See our materials";
  const result = validateContent(older);
  assert.equal(result.ui.stockCaption, seed.ui.stockCaption);
  assert.equal(result.ui.storyInstruction, seed.ui.storyInstruction);
  assert.equal(result.ui.explore, "See our materials");
  assert.equal(result.home.title, older.home.title);
});
test("older content gets the approved footer lockup while owner logos stay editable", () => {
  const older = structuredClone(seed) as Omit<typeof seed, "site"> & {
    site: Omit<typeof seed.site, "footerLogo"> & { footerLogo?: string };
  };
  delete older.site.footerLogo;
  older.site.logo = "/citybond/wordmark.svg";
  assert.equal(validateContent(older).site.footerLogo, seed.site.footerLogo);
  assert.equal(validateContent(older).site.logo, older.site.logo);
  older.site.footerLogo = "/citybond/wordmark.svg";
  assert.equal(validateContent(older).site.footerLogo, older.site.footerLogo);
});
test("content rejects executable links, duplicate routes, missing core pages and invalid project references", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,evil",
    "//evil.test",
    "/\\evil.test",
  ])
    assert.equal(safeUrl.safeParse(url).success, false);
  for (const url of [
    "/products",
    "https://citybond.in/",
    "mailto:info@citybond.in",
    "tel:+916264913414",
  ])
    assert.ok(safeUrl.safeParse(url).success);
  const duplicate = structuredClone(seed);
  duplicate.products.push(duplicate.products[0]);
  assert.throws(() => validateContent(duplicate), /Duplicate/);
  const missing = structuredClone(seed);
  missing.pages.shift();
  assert.throws(() => validateContent(missing), /Required/);
  const bad = structuredClone(seed);
  (bad.projects[0].products as string[]).push("does-not-exist");
  assert.throws(() => validateContent(bad), /Unknown/);
});
test("password hashing and session signing reject tampering and expiry", () => {
  const hash = passwordHash("correct horse battery");
  assert.ok(passwordMatches("correct horse battery", hash));
  assert.equal(passwordMatches("wrong", hash), false);
  const secret = process.env.CMS_SESSION_SECRET!;
  const now = Date.now();
  const token = signSession(secret, now);
  assert.ok(validSession(token, secret, now));
  assert.equal(validSession(token + "x", secret, now), false);
  assert.equal(validSession(token, "wrong", now), false);
  assert.equal(validSession(token, secret, now + 8 * 3600000), false);
});
test("same-origin writes reject cross-site and absent origins", () => {
  assert.doesNotThrow(() =>
    assertOrigin(
      new Request("https://example.test/api", {
        headers: { origin: "https://example.test" },
      }),
    ),
  );
  for (const headers of [
    {} as Record<string, string>,
    { origin: "https://evil.test" },
  ])
    assert.throws(
      () => assertOrigin(new Request("https://example.test/api", { headers })),
      /origin/,
    );
});
test("compare-and-swap prevents lost updates and path traversal", async () => {
  const etag = await writeObject("test/item.json", { version: 1 }, null);
  await assert.rejects(
    () => writeObject("test/item.json", { version: 2 }, null),
    ConflictError,
  );
  const results = await Promise.allSettled([
    writeObject("test/item.json", { version: 2 }, etag),
    writeObject("test/item.json", { version: 3 }, etag),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(() => readObject("../secret.json"), /Invalid/);
});
test("draft stays private until publish, and stale publishing is rejected", async () => {
  const baseline = await getPublicContent();
  const edited = structuredClone(baseline);
  edited.home.title = "Draft-only title";
  const saved = await saveDraft(edited, null);
  assert.equal((await getPublicContent()).home.title, baseline.home.title);
  assert.equal((await getEditorState()).content.home.title, "Draft-only title");
  await publishDraft(saved.draftEtag, null);
  assert.equal((await getPublicContent()).home.title, "Draft-only title");
  await assert.rejects(
    () => publishDraft(saved.draftEtag, null),
    ConflictError,
  );
  await assert.rejects(() => saveDraft(baseline, "stale"), ConflictError);
});
test("upload format inspection rejects SVG and oversized files", async () => {
  assert.equal(detectFile(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(
    detectFile(Buffer.from("%PDF-1.7 test document"))?.type,
    "application/pdf",
  );
  await assert.rejects(
    () =>
      uploadFile(
        new File(["<svg>malicious image</svg>"], "photo.png", {
          type: "image/png",
        }),
        "media",
      ),
    /Use a/,
  );
  await assert.rejects(
    () =>
      uploadFile(
        new File([new Uint8Array(MAX_UPLOAD + 1)], "large.jpg"),
        "media",
      ),
    /smaller/,
  );
  await assert.rejects(
    () =>
      uploadFile(
        new File(["%PDF-1.7 test document"], "resume.pdf"),
        "attachments",
        false,
      ),
    /Use a/,
  );
});
test("enquiries require valid contact details and consent", () => {
  const valid = {
    name: "Example Person",
    email: "person@example.com",
    phone: "+91 9000000000",
    city: "Delhi",
    role: "Architect",
    type: "contact",
    consent: true,
  };
  assert.ok(enquirySchema.safeParse(valid).success);
  assert.equal(
    enquirySchema.safeParse({ ...valid, consent: false }).success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({ ...valid, email: "invalid" }).success,
    false,
  );
});
test("rate limit persists and rejects attempts after the quota", async () => {
  assert.ok(await allowAttempt("test", "127.0.0.1", 2, 60000));
  assert.ok(await allowAttempt("test", "127.0.0.1", 2, 60000));
  assert.equal(await allowAttempt("test", "127.0.0.1", 2, 60000), false);
});
