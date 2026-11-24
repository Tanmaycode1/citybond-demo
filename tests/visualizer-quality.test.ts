import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { finishQualityImage, materialReference, qualityPrompt, renderQuality } from "../src/lib/visualizer/quality-server";
import { POST } from "../src/app/api/visualizer/render/route";
const material = { id: "wooden:0", name: "Wooden", finish: "Oxford Cherry", texture: "", hex: "#804020" };

test("quality output retains the renderer's edge pixels and native resolution without a second coarse mask", async () => {
  const pixels = Buffer.from([120,40,20, 55,60,35, 130,90,70, 180,190,210]);
  const generated = await sharp(pixels, {raw:{width:2,height:2,channels:3}}).png().toBuffer();
  const result = await finishQualityImage(generated, 1600, 1600);
  assert.equal(result.width,2); assert.equal(result.height,2);
  const decoded = await sharp(Buffer.from(result.image.split(',')[1],'base64')).raw().toBuffer();
  assert.deepEqual(decoded,pixels);
  await assert.rejects(finishQualityImage(generated,1600,800),/framing/);
});
test("CMS solid swatch renders from its selected colour; arbitrary URLs and path traversal are rejected",async()=>{
  const swatch=await materialReference(material);
  assert.deepEqual([...await sharp(swatch).resize(1,1).raw().toBuffer()],[128,64,32]);
  await assert.rejects(materialReference({...material,texture:'/citybond/../../.env'}),/content portal/);
  await assert.rejects(materialReference({...material,texture:'https://127.0.0.1/secrets'}),/content portal/);
  const local=await materialReference({...material,texture:'/citybond/wooden-swatch.webp'});
  assert.ok((await sharp(local).metadata()).width!<=768);
});
test("quality request uses product references, preserves the photograph and specifies flat ACP rather than wood battens",()=>{
  const prompt=qualityPrompt(material);assert.match(prompt,/Oxford Cherry/);assert.match(prompt,/FLAT aluminium composite/);assert.match(prompt,/No wooden slats/);assert.match(prompt,/exact camera/);assert.match(prompt,/entrance surround/);
});
test("corrupt or tiny uploads never reach a paid render",async()=>{
  let called=false;await assert.rejects(renderQuality(Buffer.from('bad'),material,'unused',async()=>{called=true;}),/valid exterior/);assert.equal(called,false);
  const tiny=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(renderQuality(tiny,material,'unused',async()=>{called=true;}),/valid exterior/);assert.equal(called,false);
});
test("quality endpoint enforces origin, body type, body limit, valid JSON and real CMS material IDs",async()=>{
  const url='http://localhost:3006/api/visualizer/render';
  const send=(body:string,headers:Record<string,string>={})=>POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3006','content-type':'application/json',...headers},body}));
  assert.equal((await POST(new Request(url,{method:'POST',body:'{}'}))).status,403);
  assert.equal((await send('{}',{'content-type':'text/plain'})).status,415);
  assert.equal((await send('{}',{'content-length':String(7*1024*1024)})).status,413);
  assert.equal((await send('broken')).status,400);
  assert.equal((await send('null')).status,400);
  assert.equal((await send(JSON.stringify({photo:'data:image/png;base64,YQ==',materialId:'invented'}))).status,400);
});
