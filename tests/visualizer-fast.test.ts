import { test } from "node:test";
import assert from "node:assert/strict";
import { fastMaterials } from "../src/lib/visualizer/fast-types";
import { rectangle, quadTransform, project, validQuad, paintMask, prepareShade, renderMaterial, type PreparedPhoto } from "../src/lib/visualizer/fast-renderer";
import { SceneCache, parseMasks, segmentPhoto, VisualizerError, decodeRegionRaster } from "../src/lib/visualizer/fast-server";

test("decoded masks stay one channel after resize: no striped or shifted coverage",async()=>{
  const raster=await decodeRegionRaster({id:'a',left:0,top:0,width:4,height:4,maskWidth:2,maskHeight:2,pixels:new Uint8Array([1,0,0,1])});
  assert.deepEqual([...raster],[255,255,0,0,255,255,0,0,0,0,255,255,0,0,255,255]);
});

test("perspective maps a trapezoid to the four texture corners, rejects crossed and collapsed quads", () => {
  const q = [{x:20,y:0},{x:90,y:10},{x:100,y:90},{x:0,y:100}] as const;
  const h = quadTransform([...q])!;
  q.forEach((p,i) => { const uv = project(h,p); assert.ok(Math.abs(uv.x-(i===1||i===2?1:0))<1e-8); assert.ok(Math.abs(uv.y-(i>=2?1:0))<1e-8); });
  assert.equal(validQuad([...q]), true);
  assert.equal(validQuad([q[0],q[2],q[1],q[3]]), false);
  assert.equal(quadTransform(rectangle(0,0,0,0)), null);
});
test("render preserves every excluded pixel and original alpha exactly; shadow stays darker", () => {
  const original = {width:4,height:1,data:new Uint8ClampedArray([255,255,255,255,100,100,100,255,21,41,61,255,11,31,51,255])};
  const labels = new Uint8Array([1,1,0,0]);
  const scene:PreparedPhoto={ original,labels,building:labels,shade:prepareShade(original,labels),surfaces:[{id:'a',enabled:true,quad:rectangle(0,0,4,1)}] };
  const material={id:'wood',name:'Wood',finish:'Cherry',texture:'',hex:'#804020'};
  const options={scale:1,joints:false,turned:false,split:0,mask:false};
  const result=renderMaterial(scene,material,null,options);
  assert.deepEqual(result.data.slice(8),original.data.slice(8));
  assert.ok(result.data[0]>result.data[4]); assert.equal(result.data[3],255);
  assert.deepEqual(renderMaterial(scene,material,null,{...options,split:1}).data,original.data);
  scene.surfaces[0].enabled=false;
  assert.deepEqual(renderMaterial(scene,material,null,options).data,original.data);
});
test("provided material pixels take precedence over fallback colour",()=>{
  const original={width:2,height:2,data:new Uint8ClampedArray(16).fill(255)},labels=new Uint8Array(4).fill(1);
  const scene:PreparedPhoto={original,labels,building:labels,shade:new Float32Array(4).fill(1),surfaces:[{id:'a',enabled:true,quad:rectangle(0,0,2,2)}]};
  const texture={width:1,height:1,data:new Uint8ClampedArray([65,120,180,255])};
  const result=renderMaterial(scene,{id:'a',name:'a',finish:'a',texture:'x',hex:'#ff0000'},texture,{scale:1,joints:false,turned:false,split:0,mask:false});
  for(let c=0;c<3;c++) assert.ok(Math.abs(result.data[c]-texture.data[c])<=1);
});
test("restoring walls is clipped to building; erase and undo snapshots do not mutate original labels",()=>{
  const labels=new Uint8Array(9),building=new Uint8Array([0,0,0,0,1,0,0,0,0]);
  const original=labels.slice(); paintMask(labels,building,3,3,{x:1,y:1},20,2,false);
  assert.deepEqual([...labels],[0,0,0,0,2,0,0,0,0]);
  paintMask(labels,building,3,3,{x:1,y:1},1,2,true);
  assert.deepEqual(labels,original);
});
test("CMS edits and added finishes flow directly to the swatch catalogue",()=>{
  const items=fastMaterials([{slug:'custom',name:'Edited title',finishes:[{name:'New finish',image:'/api/media/test.png',hex:'#123456'},{name:'Solid',image:'',hex:'#654321'}]}]);
  assert.equal(items.length,2); assert.equal(items[0].texture,'/api/media/test.png'); assert.equal(items[0].name,'Edited title'); assert.equal(items[1].hex,'#654321');
});
test("cache coalesces requests, expires entries and retries failed computations",async()=>{
  const cache=new SceneCache<number>(2,100); let calls=0;
  const work=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return 7;};
  const [a,b]=await Promise.all([cache.get('a',work,0),cache.get('a',work,0)]);
  assert.equal(calls,1); assert.equal(a.cached,false); assert.equal(b.cached,true);
  await cache.get('a',work,101); assert.equal(calls,2);
  await assert.rejects(cache.get('bad',async()=>{throw new Error('offline');},101));
  assert.equal((await cache.get('bad',work,101)).value,7);
});
test("unreadable or tiny images fail locally before any model call",async()=>{
  await assert.rejects(segmentPhoto(Buffer.from('not an image'),'unused'),(e:unknown)=>e instanceof VisualizerError&&e.status===400);
  assert.deepEqual(parseMasks('',200,200),[]);
});
