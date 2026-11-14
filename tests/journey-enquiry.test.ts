import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import seed from "../src/data/site.json";
import { POST } from "../src/app/api/enquiries/route";
import { listObjects, readObject } from "../src/lib/cms/storage";

let directory: string;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "citybond-journey-"));
  process.env.CMS_LOCAL_DIR = directory;
  delete process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
});
after(async () => {
  const target = path.resolve(directory);
  assert.equal(path.dirname(target), path.resolve(tmpdir()));
  assert.ok(path.basename(target).startsWith("citybond-journey-"));
  await rm(target, { recursive: true, force: true });
});

test("all six role enquiries retain their context in the inbox storage", async () => {
  for (const role of seed.roles) {
    const data = {
      name: "Journey Test", email: "journey@example.test", phone: "1234567890", city: "Test City",
      role: role.label, type: role.id === "dealer" ? "dealer" : role.id === "homeowner" ? "quiz" : "sample",
      product: "metallic-series", message: "Commercial / Exterior / Metallic", consent: true, website: "",
    };
    const body = new FormData(); body.set("data", JSON.stringify(data));
    const response = await POST(new Request("http://localhost:3001/api/enquiries", { method: "POST", headers: { origin: "http://localhost:3001", "x-forwarded-for": role.id }, body }));
    assert.equal(response.status, 200);
    const result = await response.json();
    const items = await listObjects("enquiries/");
    const item = items.find(item => item.key.includes(result.reference));
    assert.ok(item);
    const stored = (await readObject<typeof data>(item.key))!.data;
    assert.equal(stored.role, role.label);
    assert.equal(stored.product, data.product);
    assert.equal(stored.message, data.message);
    assert.equal(stored.type, data.type);
  }
  assert.equal((await listObjects("enquiries/")).length, 6);
});

test("missing consent does not save a lead or report successful results", async () => {
  const body = new FormData();
  body.set("data", JSON.stringify({ name: "Journey Test", email: "journey@example.test", phone: "1234567890", city: "Test City", role: "Homeowner", type: "quiz", consent: false }));
  const response = await POST(new Request("http://localhost:3001/api/enquiries", { method: "POST", headers: { origin: "http://localhost:3001" }, body }));
  assert.equal(response.status, 400);
  assert.equal((await listObjects("enquiries/")).length, 6);
});
