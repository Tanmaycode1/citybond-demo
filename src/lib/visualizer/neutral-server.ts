import { randomUUID, createHmac, createHash } from "node:crypto";
import sharp from "sharp";
import { readObject, writeObject, storeFile, readFileObject, ConflictError } from "../cms/storage";
import { enquirySchema } from "../cms/schema";
import { SceneCache, detect, parseMasks, decodeRegionRaster, VisualizerError } from "./fast-server";
import { refineNeutralMask, completeNeutralCoverage, type NeutralBundle, type NeutralRaster } from "./neutral-renderer";
export type VisualizerSession={id:string;createdAt:string;expires:number;source:string;status:"queued"|"preparing"|"ready"|"error";base?:string;building?:string;semantic?:string;coarse?:string;fingerprint?:string;reference?:string;error?:string};
const key=(id:string)=>`visualizer/sessions/${id}.json`;
export async function getVisualizerSession(id:string){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new VisualizerError("This preview session is invalid. Please upload your photo again.",400);
 const entry=await readObject<VisualizerSession>(key(id));
 if(!entry||entry.data.expires<Date.now())throw new VisualizerError("Your preview session has expired. Please upload the photo again.",410);
 return entry.data;
}
export async function patchVisualizerSession(id:string,patch:Partial<VisualizerSession>){
 for(let i=0;i<5;i++){const prior=await readObject<VisualizerSession>(key(id));if(!prior)throw new VisualizerError("Preview session not found.",404);try{await writeObject(key(id),{...prior.data,...patch},prior.etag);return;}catch(e){if(!(e instanceof ConflictError))throw e;}}
 throw new VisualizerError("The preview is updating. Please try again.",409);
}
export const neutralPipelineVersion="neutral-v4-source-walls";
export async function photoFingerprint(bytes:Buffer){
 const {data,info}=await sharp(bytes).rotate().flatten({background:"white"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 return createHash("sha256").update(`${info.width}x${info.height}:`).update(data).digest("hex");
}
export async function createVisualizerSession(bytes:Buffer){
 let photo:Buffer;
 try{const decoded=await sharp(bytes,{limitInputPixels:24_000_000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).flatten({background:"white"}).png().toBuffer({resolveWithObject:true});if(decoded.info.width<200||decoded.info.height<200)throw new Error("small");photo=decoded.data;}
 catch{throw new VisualizerError("Choose a clear exterior photo between 200 × 200 pixels and 24 megapixels.",400);}
 const fingerprint=await photoFingerprint(photo);
 const id=randomUUID(),source=`attachments/${id}.png`,createdAt=new Date().toISOString();
 await storeFile(source,photo,"image/png");
 await writeObject(key(id),{id,source,fingerprint,createdAt,expires:Date.now()+60*60_000,status:"queued"} satisfies VisualizerSession,null);
 return {id};
}
async function fileBytes(path:string){const file=await readFileObject(path);if(!file)throw new VisualizerError("Your photo is no longer available. Please upload it again.",410);return Buffer.from(await new Response(file.body).arrayBuffer());}
export const neutralPrompt=`Edit the supplied ORIGINAL photograph into a photorealistic neutral material preparation for an exterior cladding colour visualizer. Replace only ALL exterior facade wall surfaces with smooth MATTE NEUTRAL MID-GREY aluminium composite panels, base colour approximately RGB 128,128,128 under neutral light. No texture or grain. Use broad flush panels with subtle narrow hairline joints that follow each wall plane's perspective; no battens, no raised slats, no thick grooves. Cover sunlit and shaded parts of each wall consistently, including the garage surround, rear upper parapet faces, entrance canopy FASCIA, narrow returns, recessed walls, ALL porch columns and pillars, balcony solid balustrades, plinths and the VERTICAL fronts of cornices and decorative bands. Columns and band fronts are cladding targets even when their original colour is white. Do not leave white patches on any of these vertical surfaces. Diagonal cast shadows are lighting, not material boundaries: keep the same grey finish on both sides of every shadow. Preserve the original lighting, strong diagonal shadows, contact shadows and natural illumination differences between wall faces. Preserve exact building geometry, roof silhouette, camera, framing, window and door openings. Keep ALL windows, frames, glass, front door, garage door, vents, plants, thin branches, grass, sky, road and ground unchanged. Keep porch FLOOR, steps, paving, horizontal roof surfaces and soffits unchanged. Do not clad low garden boundary walls in the foreground. Do not add or remove anything. Neutral mid-grey panels only: no wood, marble, texture, colour tint or heavy reflections. Return a single edited photograph in the original composition and aspect ratio, no labels or collage.`;
async function renderGrey(original:Buffer,token:string){
 let response:Response;
 try{response=await fetch("https://api.meta.ai/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({model:"muse-image-1.0",store:false,stream:false,tools:[{type:"image_generation",enable_image_search:false,enable_web_search:false,enable_shell:false,reasoning_strength:"high",size:"auto",output_format:"png"}],input:[{role:"user",content:[{type:"input_image",image_url:`data:image/png;base64,${original.toString("base64")}`},{type:"input_text",text:neutralPrompt}]}]}),signal:AbortSignal.timeout(150_000)});}catch{throw new VisualizerError("Preparation took longer than expected. Please retry; your details are saved.",504);}
 if(!response.ok){if(response.status===402)throw new VisualizerError("The preview service needs billing enabled. Please contact CityBond.",503);throw new VisualizerError("The preview service is busy. Please try again shortly.",503);}
 const body=await response.json(),output=body.output?.find((o:{type:string;result?:string})=>o.type==="image_generation_call"&&typeof o.result==="string");
 if(body.status!=="completed"||!output?.result)throw new VisualizerError("No preview was returned. Please try again.",502);
 return Buffer.from(output.result,"base64");
}
async function rgba(bytes:Buffer,width:number,height:number):Promise<NeutralRaster>{const data=await sharp(bytes).resize(width,height,{fit:"fill"}).ensureAlpha().raw().toBuffer();return{width,height,data:new Uint8ClampedArray(data)};}
const globalState=globalThis as typeof globalThis & {neutralPreparationsV4?:SceneCache<NeutralBundle>};
const pending=globalState.neutralPreparationsV4 ||= new SceneCache(12,5*60_000);
const sceneKey=(hash:string)=>`visualizer/scenes/${neutralPipelineVersion}/${hash}.json`;
export async function loadPreparedPhoto(hash:string){
 const stored=await readObject<{expires:number;bundle:NeutralBundle}>(sceneKey(hash));return stored&&stored.data.expires>Date.now()?stored.data.bundle:null;
}
export async function savePreparedPhoto(hash:string,bundle:NeutralBundle){
 await writeObject(sceneKey(hash),{expires:Date.now()+24*60*60_000,bundle});
}
async function unionMask(text:string,width:number,height:number){
 const mask=new Uint8Array(width*height);
 for(const m of parseMasks(text,width,height)){const pixels=await decodeRegionRaster(m);for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(pixels[y*m.width+x])mask[(y+m.top)*width+x+m.left]=255;}
 return mask;
}
async function preparePhoto(session:VisualizerSession,original:Buffer,token:string):Promise<NeutralBundle>{
 const started=performance.now(),timings:Record<string,number>={};
 const meta=await sharp(original).metadata(),width=meta.width!,height=meta.height!;
 const decode=async(key:string)=>new Uint8Array(await sharp(await fileBytes(key)).resize(width,height,{kernel:"nearest"}).greyscale().raw().toBuffer());
 const saveMask=async(kind:"building"|"semantic"|"coarse",mask:Uint8Array)=>{const path=`visualizer/images/${session.id}-${kind}.png`;await storeFile(path,await sharp(mask,{raw:{width,height,channels:1}}).png().toBuffer(),"image/png");await patchVisualizerSession(session.id,{[kind]:path});};
 let t=performance.now(),building:Uint8Array;
 if(session.building)building=await decode(session.building);
 else{
  const gate=await sharp(original).resize({width:1024,height:1024,fit:"inside"}).png().toBuffer({resolveWithObject:true});
  const mask=await unionMask(await detect(`data:image/png;base64,${gate.data.toString("base64")}`,"building",token),gate.info.width,gate.info.height);
  if(mask.reduce((n,v)=>n+(v?1:0),0)<mask.length*.02)throw new VisualizerError("Please use an exterior building photo. Interior rooms are not supported.",422);
  building=new Uint8Array(await sharp(mask,{raw:{width:gate.info.width,height:gate.info.height,channels:1}}).resize(width,height,{kernel:"nearest"}).greyscale().raw().toBuffer());await saveMask("building",building);
 }
 timings.buildingMs=Math.round(performance.now()-t);
 // Independent original-photo wall detection runs DURING the image edit, not after it.
 const [neutralResult,semanticResult]=await Promise.allSettled([
  (async()=>{const begin=performance.now();let bytes:Buffer;if(session.base)bytes=await fileBytes(session.base);else{
   bytes=await renderGrey(original,token);const generated=await sharp(bytes,{limitInputPixels:24_000_000}).metadata();
   if(!generated.width||!generated.height||Math.abs((generated.width/generated.height)/(width/height)-1)>.04)throw new VisualizerError("The image framing changed during preparation. Please retry.",502);
   const path=`visualizer/images/${session.id}-base.png`;await storeFile(path,bytes,"image/png");await patchVisualizerSession(session.id,{base:path});
  }timings.imageMs=Math.round(performance.now()-begin);return bytes;})(),
  (async()=>{const begin=performance.now();let mask:Uint8Array;if(session.semantic)mask=await decode(session.semantic);else{
   const input=`data:image/png;base64,${original.toString("base64")}`;
   const texts=await Promise.all([detect(input,"exterior wall",token),detect(input,"column",token)]);
   const masks=await Promise.all(texts.map(text=>unionMask(text,width,height)));mask=Uint8Array.from(masks[0],(v,i)=>v||masks[1][i]);await saveMask("semantic",mask);
  }timings.sourceMasksMs=Math.round(performance.now()-begin);return mask;})()
 ] as const);
 if(neutralResult.status==="rejected")throw neutralResult.reason;
 if(semanticResult.status==="rejected")throw semanticResult.reason;
 const neutralBytes=neutralResult.value,semantic=semanticResult.value;
 t=performance.now();const neutral=await sharp(neutralBytes).resize(width,height,{fit:"fill"}).png().toBuffer();
 const coarse=session.coarse?await decode(session.coarse):await unionMask(await detect(`data:image/png;base64,${neutral.toString("base64")}`,"exterior wall",token),width,height);
 if(!session.coarse)await saveMask("coarse",coarse);timings.finalMaskMs=Math.round(performance.now()-t);
 t=performance.now();const [sourceRaster,baseRaster]=await Promise.all([rgba(original,width,height),rgba(neutral,width,height)]);
 const initial=refineNeutralMask(sourceRaster,baseRaster,coarse,building),completed=completeNeutralCoverage(sourceRaster,baseRaster,initial,semantic,building),mask=completed.mask;
 const selectedPixels=mask.reduce((n,v)=>n+(v>128?1:0),0);
 if(selectedPixels<width*height*.01)throw new VisualizerError("This photo needs a clearer view of the facade. Please choose another photo.",422);
 const [sourceWebp,baseWebp,maskPng]=await Promise.all([sharp(original).webp({quality:96}).toBuffer(),sharp(completed.base.data,{raw:{width,height,channels:4}}).webp({quality:96}).toBuffer(),sharp(mask,{raw:{width,height,channels:1}}).png().toBuffer()]);
 timings.refinementMs=Math.round(performance.now()-t);
 return{width,height,original:`data:image/webp;base64,${sourceWebp.toString("base64")}`,base:`data:image/webp;base64,${baseWebp.toString("base64")}`,mask:`data:image/png;base64,${maskPng.toString("base64")}`,preparationMs:Math.round(performance.now()-started),timings,cached:false,coverage:{recoveredPixels:completed.recoveredPixels,selectedPixels}};
}
export async function prepareVisualizerSession(id:string,token:string,beforeMiss:()=>Promise<void>=async()=>{}){
 const session=await getVisualizerSession(id);if(session.status==="ready")return;
 const started=performance.now();await patchVisualizerSession(id,{status:"preparing",error:undefined});
 try{
  const original=await fileBytes(session.source),hash=session.fingerprint||await photoFingerprint(original);
  let bundle=await loadPreparedPhoto(hash),cached=!!bundle;
  if(!bundle){const result=await pending.get(`${process.env.CMS_LOCAL_DIR||"cloud"}:${hash}`,async()=>{
   const existing=await loadPreparedPhoto(hash);if(existing)return{...existing,cached:true};
   await beforeMiss();const prepared=await preparePhoto(session,original,token);await savePreparedPhoto(hash,prepared);return prepared;
  });bundle=result.value;cached=result.cached||!!bundle.cached;}
  const response=cached?{...bundle,cached:true,preparationMs:Math.round(performance.now()-started),timings:{cacheLookupMs:Math.round(performance.now()-started)}}:bundle;
  await storeFile(`visualizer/results/${id}.json`,Buffer.from(JSON.stringify(response)),"application/json");
  await patchVisualizerSession(id,{status:"ready",fingerprint:hash,error:undefined});
 }catch(e){if(!(e instanceof VisualizerError))console.error("[neutral-prepare]",e instanceof Error?e.message:"Unknown failure");const error=e instanceof VisualizerError?e:new VisualizerError("Your preview could not be prepared. Please try again.",503);await patchVisualizerSession(id,{status:"error",error:error.message});throw error;}
}
/** Idempotent three-photo quota per submitted email. This is not email ownership verification. */
export async function claimPhoto(email:string,id:string){
 const hash=createHmac("sha256",process.env.CMS_SESSION_SECRET||"local-preview-quota").update(email.trim().toLowerCase()).digest("hex"),quotaKey=`visualizer/quotas/${hash}.json`;
 for(let n=0;n<5;n++){const prior=await readObject<{ids:string[]}>(quotaKey),ids=prior?.data.ids||[];if(ids.includes(id))return;if(ids.length>=3)throw new VisualizerError("You have used your three photo previews. Please contact CityBond for more help.",429);try{await writeObject(quotaKey,{ids:[...ids,id]},prior?.etag??null);return;}catch(e){if(!(e instanceof ConflictError))throw e;}}
 throw new VisualizerError("Your preview allowance is updating. Please retry.",409);
}
export async function saveVisualizerLead(id:string,input:unknown){
 const session=await getVisualizerSession(id);const data=enquirySchema.parse(input);
 if(data.type!=="visualiser"||data.website)throw new VisualizerError("Please check your details and try again.",400);
 if(session.reference)return{reference:session.reference};
 await claimPhoto(data.email,id);
 const reference=id.slice(0,8),leadKey=`enquiries/${session.createdAt.replaceAll(":","-")}-${id}.json`;
 try{await writeObject(leadKey,{...data,website:undefined,id,createdAt:session.createdAt,attachment:session.source,status:"new",visualizerSession:id},null);}catch(e){if(!(e instanceof ConflictError))throw e;}
 await patchVisualizerSession(id,{reference});return{reference};
}
export async function getVisualizerResult(id:string){const session=await getVisualizerSession(id);if(!session.reference)throw new VisualizerError("Please submit your details to view the preview.",403);if(session.status!=="ready")throw new VisualizerError(session.error||"Your preview is still preparing.",409);return JSON.parse((await fileBytes(`visualizer/results/${id}.json`)).toString()) as NeutralBundle;}
