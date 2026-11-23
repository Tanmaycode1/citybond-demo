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

const valid = { name: 'Form Test', email: 'form@example.test', phone: '+91 9000000000', city: 'Delhi', role: 'Contractor', type: 'contact', consent: true };
async function submitCase(data: unknown, file?: File) {
  const body = new FormData(); body.set('data', typeof data === 'string' ? data : JSON.stringify(data));
  if (file) body.set('file', file);
  return POST(new Request('http://localhost:3001/api/enquiries', {method:'POST', headers:{origin:'http://localhost:3001','x-forwarded-for':crypto.randomUUID()},body}));
}
test('invalid roles, products, phone digits and malformed payloads do not create leads', async()=>{
  const before=(await listObjects('enquiries/')).length;
  for (const input of ['not-json', 'null', {...valid,role:''}, {...valid,role:'Unconfigured role'}, {...valid,product:'missing-product'}, {...valid,phone:'-------'}])
    assert.equal((await submitCase(input)).status,400);
  assert.equal((await listObjects('enquiries/')).length,before);
});
test('Third Eye View requires a photo on the server and rejects disguised files',async()=>{
  const before=(await listObjects('enquiries/')).length;
  const response=await submitCase({...valid,type:'visualiser'});
  assert.equal(response.status,400);assert.ok((await response.json()).fields.attachment);
  const invalid=await submitCase({...valid,type:'visualiser'},new File(['not an image file'], 'building.jpg', {type:'image/jpeg'}));
  assert.notEqual(invalid.status,200);
  assert.equal((await listObjects('enquiries/')).length,before);
});
test('career applicants need no customer role; quiz context survives an independent message',async()=>{
  for(const input of [{...valid,type:'career',role:''},{...valid,type:'quiz',useCase:'Commercial / Signage / Metallic',message:'Please call tomorrow',source:'/product-finder'}]) {
    const response=await submitCase(input);assert.equal(response.status,200);
    const result=await response.json();const key=(await listObjects('enquiries/')).find(item=>item.key.includes(result.reference))!.key;
    const saved=(await readObject<Record<string,unknown>>(key))!.data;
    assert.equal(saved.reference,result.reference);assert.equal(saved.role,input.role);
    if('useCase' in input){assert.equal(saved.useCase,input.useCase);assert.equal(saved.message,input.message);assert.equal(saved.source,input.source);}
  }
});
