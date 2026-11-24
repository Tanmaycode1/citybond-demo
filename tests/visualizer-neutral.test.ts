import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prepareNeutralScene, renderNeutral, refineNeutralMask, completeNeutralCoverage, paintNeutralMask, previewPoint, type NeutralRaster } from "../src/lib/visualizer/neutral-renderer";
import { createVisualizerSession, saveVisualizerLead, getVisualizerResult, getVisualizerSession, patchVisualizerSession, claimPhoto, photoFingerprint, savePreparedPhoto, loadPreparedPhoto, prepareVisualizerSession, neutralPipelineVersion } from "../src/lib/visualizer/neutral-server";
import { listObjects, readObject, storeFile, writeObject } from "../src/lib/cms/storage";
import { POST, GET } from "../src/app/api/visualizer/[action]/route";
let directory:string;
before(async()=>{directory=await mkdtemp(path.join(tmpdir(),"citybond-neutral-"));process.env.CMS_LOCAL_DIR=directory;delete process.env.BLOB_STORE_ID;delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.VERCEL;});
after(async()=>{assert.equal(path.dirname(directory),path.resolve(tmpdir()));assert.ok(path.basename(directory).startsWith("citybond-neutral-"));await rm(directory,{recursive:true,force:true});});
const raster=(w:number,h:number,value:number):NeutralRaster=>({width:w,height:h,data:Uint8ClampedArray.from({length:w*h*4},(_,i)=>i%4===3?255:value)});
test("local material changes preserve excluded pixels, neutral shadows and original alpha",()=>{
 const base=raster(80,80,150),alpha=new Uint8Array(6400);for(let y=15;y<65;y++)for(let x=15;x<65;x++){alpha[y*80+x]=255;if(x>40)for(let c=0;c<3;c++)base.data[(y*80+x)*4+c]=80;}
 const scene=prepareNeutralScene(base,alpha),red=renderNeutral(scene,{hex:'#aa3322',scale:1,turned:false});
 for(let i=0;i<alpha.length;i++){assert.equal(red.data[i*4+3],255);if(!alpha[i])assert.deepEqual(red.data.slice(i*4,i*4+4),base.data.slice(i*4,i*4+4));}
 assert.ok(red.data[(30*80+20)*4]>red.data[(30*80+55)*4]);
 const texture=raster(2,2,80);texture.data[0]=240;
 const tex=renderNeutral(scene,{hex:'#aa3322',texture,scale:1,turned:false});assert.notDeepEqual(tex.data,red.data);
 assert.notDeepEqual(renderNeutral(scene,{hex:'#aa3322',texture,scale:.6,turned:true}).data,tex.data);
 assert.deepEqual(base.data,scene.base.data);
});
test("difference refinement fills a coarse wall gap without recolouring an unchanged door",()=>{
 const original=raster(40,40,230),base=raster(40,40,140),coarse=new Uint8Array(1600).fill(1);
 for(let y=10;y<30;y++)for(let x=15;x<25;x++)for(let c=0;c<3;c++)base.data[(y*40+x)*4+c]=original.data[(y*40+x)*4+c];
 coarse[20*40+8]=0;
 const mask=refineNeutralMask(original,base,coarse);assert.ok(mask[20*40+8]>240);assert.equal(mask[20*40+20],0);
 assert.throws(()=>prepareNeutralScene(base,new Uint8Array(1600)),/No usable/);
});
test("whole-building guard recovers a disconnected recessed wall, including lightening",()=>{
 const W=100,H=60,original=raster(W,H,30),base=raster(W,H,140),coarse=new Uint8Array(W*H),building=new Uint8Array(W*H);
 for(let y=10;y<50;y++)for(let x=10;x<90;x++){building[y*W+x]=255;if(x<30)coarse[y*W+x]=255;}
 // A preserved doorway inside the previously unselected recessed wall.
 for(let y=20;y<40;y++)for(let x=65;x<75;x++)for(let c=0;c<3;c++)original.data[(y*W+x)*4+c]=base.data[(y*W+x)*4+c];
 const mask=refineNeutralMask(original,base,coarse,building);
 assert.ok(mask[30*W+55]>240,"Disconnected wall that became lighter is recovered");
 assert.equal(mask[30*W+70],0,"Unchanged door stays excluded");
 assert.equal(mask[2*W+50],0,"Changes outside the building remain excluded");
 assert.throws(()=>refineNeutralMask(original,base,coarse,new Uint8Array(2)),/Mismatched/);
});
test("equal-luminance colour changes are not mistaken for unchanged wall",()=>{
 const W=40,H=40,original=raster(W,H,128),base=raster(W,H,128),coarse=new Uint8Array(W*H).fill(1);
 for(let i=0;i<W*H;i++){original.data[i*4]=210;original.data[i*4+1]=103;original.data[i*4+2]=134;}
 const mask=refineNeutralMask(original,base,coarse);assert.ok(mask[20*W+20]>240);
});
test("recovery beyond wall instances rejects changed colourful surroundings",()=>{
 const W=60,H=60,original=raster(W,H,210),base=raster(W,H,128),building=new Uint8Array(W*H).fill(1),coarse=new Uint8Array(W*H);
 for(let y=15;y<45;y++)for(let x=15;x<45;x++){const p=(y*W+x)*4;base.data[p]=30;base.data[p+1]=140;base.data[p+2]=50;}
 const mask=refineNeutralMask(original,base,coarse,building);assert.equal(mask[30*W+30],0);assert.ok(mask[5*W+5]>240);
});
const lead={name:'Preview Test',email:'neutral@example.test',phone:'1234567890',city:'Test City',role:'Architect',type:'visualiser',product:'wooden-series',message:'Automated test',consent:true,website:''};
async function photo(){return sharp({create:{width:220,height:220,channels:3,background:'white'}}).png().toBuffer();}
test("preview is gated until a validated lead is saved; source photo and product reach portal storage",async()=>{
 const{id}=await createVisualizerSession(await photo());await assert.rejects(getVisualizerResult(id),/submit your details/);
 await assert.rejects(saveVisualizerLead(id,{...lead,consent:false}));assert.equal((await listObjects('enquiries/')).length,0);
 const saved=await saveVisualizerLead(id,lead);assert.ok(saved.reference);assert.deepEqual(await saveVisualizerLead(id,lead),saved);
 const entries=await listObjects('enquiries/');assert.equal(entries.length,1);const stored=(await readObject<Record<string,unknown>>(entries[0].key))!.data;
 assert.equal(stored.type,'visualiser');assert.equal(stored.product,lead.product);assert.equal(stored.attachment,`attachments/${id}.png`);assert.equal(stored.visualizerSession,id);
 await assert.rejects(getVisualizerResult(id),/still preparing/);
 await storeFile(`visualizer/results/${id}.json`,Buffer.from(JSON.stringify({base:'test',original:'source',mask:'mask',width:220,height:220,preparationMs:1})),'application/json');
 await patchVisualizerSession(id,{status:'ready'});assert.equal((await getVisualizerResult(id)).base,'test');assert.equal((await getVisualizerSession(id)).reference,saved.reference);
});
test("three-photo email limit is idempotent and safe under concurrent requests",async()=>{
 const email='quota@example.test';await claimPhoto(email,'one');await claimPhoto('QUOTA@example.test','one');
 const results=await Promise.allSettled(['two','three','four'].map(id=>claimPhoto(email,id)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test("expired and invalid sessions cannot expose results",async()=>{
 await assert.rejects(getVisualizerSession('../secret'),/invalid/);
 const{id}=await createVisualizerSession(await photo());await patchVisualizerSession(id,{expires:Date.now()-1});await assert.rejects(getVisualizerResult(id),/expired/);
});
test("HTTP preparation endpoints enforce origin and bounded payloads without a model call",async()=>{
 const url='http://localhost:3006/api/visualizer/session',ctx={params:Promise.resolve({action:'session'})};
 assert.equal((await POST(new Request(url,{method:'POST',body:'x'}),ctx)).status,403);
 assert.equal((await POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3006','content-type':'text/plain'},body:'x'}),ctx)).status,415);
 assert.equal((await POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3006','content-type':'image/png','content-length':'9999999'},body:'x'}),ctx)).status,413);
 assert.equal((await POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3006'},body:'null'}),{params:Promise.resolve({action:'lead'})})).status,400);
 assert.equal((await GET(new Request('http://localhost:3006/api/visualizer/result?id=invalid'),{params:Promise.resolve({action:'result'})})).status,400);
});

test("independent wall coverage includes unchanged columns with neutral shading, preserving openings",()=>{
 const W=60,H=60,original=raster(W,H,230),base=raster(W,H,230),mask=new Uint8Array(W*H),semantic=new Uint8Array(W*H),building=new Uint8Array(W*H).fill(255);
 for(let y=5;y<55;y++)for(let x=5;x<25;x++){mask[y*W+x]=255;for(let c=0;c<3;c++)base.data[(y*W+x)*4+c]=140;}
 for(let y=8;y<52;y++)for(let x=35;x<50;x++)semantic[y*W+x]=255;
 const filled=completeNeutralCoverage(original,base,mask,semantic,building);assert.ok(filled.recoveredPixels>400);assert.equal(filled.mask[30*W+42],255);assert.ok(Math.abs(filled.base.data[(30*W+42)*4]-140)<3);assert.equal(filled.mask[30*W+30],0);assert.equal(filled.base.data[(30*W+30)*4],230);
});
test("brush mapping respects contain letterboxing and continuous soft strokes support erase and undo",()=>{
 assert.equal(previewPoint(10,200,600,400,200,400),null);const point=previewPoint(300,200,600,400,200,400)!;assert.equal(point.x,100);assert.equal(point.y,200);
 const mask=new Uint8Array(100*100),undo=mask.slice();paintNeutralMask(mask,100,100,{x:10,y:50},{x:90,y:50},5,false);for(let x=10;x<=90;x++)assert.equal(mask[50*100+x],255);assert.equal(mask[5*100+5],0);
 paintNeutralMask(mask,100,100,{x:40,y:50},{x:60,y:50},5,true);assert.equal(mask[50*100+50],0);assert.equal(mask[50*100+20],255);assert.equal(undo.reduce((a,v)=>a+v,0),0);
});
test("removing coverage restores original photo pixels, not the AI grey preparation",()=>{
 const base=raster(40,40,140),original=raster(40,40,230),mask=new Uint8Array(1600).fill(255),scene=prepareNeutralScene(base,mask);scene.original=original;scene.automaticMask=mask.slice();scene.alpha[20*40+20]=0;const result=renderNeutral(scene,{hex:'#884422',scale:1,turned:false});assert.equal(result.data[(20*40+20)*4],230);
});
test("photo fingerprint uses decoded pixels and dimensions, independent of PNG metadata",async()=>{
 const first=await photo(),metadata=await sharp(first).withMetadata({density:150}).png().toBuffer();assert.equal(await photoFingerprint(first),await photoFingerprint(metadata));
 const changed=await sharp({create:{width:220,height:220,channels:3,background:'#eeeeee'}}).png().toBuffer();assert.notEqual(await photoFingerprint(first),await photoFingerprint(changed));assert.notEqual(await photoFingerprint(first),await photoFingerprint(await sharp(first).resize(230,220).png().toBuffer()));
});
test("identical uploads reuse the prepared scene without a provider call but keep separate lead gates",async t=>{
 const bytes=await photo(),first=await createVisualizerSession(bytes),second=await createVisualizerSession(bytes),fingerprint=(await getVisualizerSession(first.id)).fingerprint!;
 const bundle={width:220,height:220,original:'source',base:'neutral',mask:'mask',preparationMs:40000};await savePreparedPhoto(fingerprint,bundle);
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('Cache must not call provider');});
 await prepareVisualizerSession(second.id,'unused');assert.equal(fetch.mock.calls.length,0);await assert.rejects(getVisualizerResult(second.id),/submit your details/);
 await saveVisualizerLead(second.id,{...lead,email:'cache@example.test'});const result=await getVisualizerResult(second.id);assert.equal(result.base,bundle.base);assert.equal(result.mask,bundle.mask);assert.equal(result.cached,true);assert.ok(result.preparationMs<1000);assert.equal((await getVisualizerSession(first.id)).reference,undefined);
 await writeObject(`visualizer/scenes/${neutralPipelineVersion}/${fingerprint}.json`,{expires:Date.now()-1,bundle});assert.equal(await loadPreparedPhoto(fingerprint),null);
});

test("broad building guard closes an occluder gap without selecting the unchanged branch",()=>{
 const W=160,H=160,original=raster(W,H,230),base=raster(W,H,140),building=new Uint8Array(W*H),coarse=new Uint8Array(W*H);
 for(let y=20;y<140;y++)for(let x=20;x<140;x++)building[y*W+x]=255;
 for(let y=60;y<160;y++)for(let x=75;x<85;x++)building[y*W+x]=0;
 for(let y=65;y<130;y++)for(let x=79;x<81;x++)for(let c=0;c<3;c++){original.data[(y*W+x)*4+c]=35;base.data[(y*W+x)*4+c]=35;}
 const mask=refineNeutralMask(original,base,coarse,building);assert.ok(mask[90*W+76]>220);assert.ok(mask[90*W+80]<20);assert.equal(mask[4*W+4],0);
});
