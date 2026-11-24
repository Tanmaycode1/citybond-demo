import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { parseMasks, decodeRegionRaster } from '../src/lib/visualizer/fast-server';
import { guidedFilter, windowTest } from '../src/lib/visualizer/masks';
const out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-neutral-colour-test';
const token=process.env.MODEL_API_KEY||'';if(!token&&!process.argv.includes('--reuse'))throw new Error('MODEL_API_KEY missing');
const prompt=`Edit the supplied ORIGINAL photograph into a photorealistic neutral material preparation for an exterior cladding colour visualizer. Replace only ALL exterior facade wall surfaces with smooth MATTE NEUTRAL MID-GREY aluminium composite panels, base colour approximately RGB 128,128,128 under neutral light. No texture or grain. Use broad flush panels with subtle narrow hairline joints that follow each wall plane's perspective; no battens, no raised slats, no thick grooves. Cover sunlit and shaded parts of each wall consistently, including the left garage surround, rear upper parapet faces, entrance canopy FASCIA, narrow returns, recessed walls and all visible vertical architectural wall faces. Diagonal cast shadows are lighting, not material boundaries: keep the same grey finish on both sides of every shadow. Preserve the original lighting, strong diagonal shadows, contact shadows and natural illumination differences between wall faces. Preserve exact building geometry, roof silhouette, camera, framing, window and door openings. Keep ALL windows, frames, glass, front door, garage door, vents, plants, thin branches, grass, sky, road and ground unchanged. Keep porch FLOOR, steps, paving, horizontal roof surfaces and soffits unchanged. Do not clad the low curved garden boundary wall in the foreground. Do not add or remove anything. Neutral mid-grey panels only: no wood, marble, texture, colour tint or heavy reflections. Return a single edited photograph in the original composition and aspect ratio, no labels or collage.`;
async function api(body:unknown){const response=await fetch('https://api.meta.ai/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});if(!response.ok)throw new Error(`Provider HTTP ${response.status}`);const result=await response.json();if(result.status!=='completed')throw new Error('Incomplete model result');return result;}
async function main(){
await mkdir(out,{recursive:true});await writeFile(out+'/prompt.txt',prompt);
const original=await sharp(await readFile('/Users/tanmayarora/Desktop/freelance work/outputs/citybond-meta-test-20261124-043232/original.webp')).resize(1600,1600,{fit:'inside'}).png().toBuffer();await writeFile(out+'/original.png',original);
const report: {model:string;segmentationModel:string;method:string;variants:Record<string,string|number>[];aiRenderMs:number;segmentationMs:number;initialEmptyMaskMs?:number;width?:number;height?:number;wallRegions?:number;maskPreparationMs?:number;oneTimeTotalMs?:number;aiImageCalls?:number;segmentationCalls?:number;additionalAiCallsForColours?:number;hardware?:string}={aiRenderMs:0,segmentationMs:0,model:'muse-image-1.0',segmentationModel:'sam-3.1',method:'One neutral-grey AI render; SAM wall regions plus source-to-grey pixel differences; then deterministic local recolouring. No hand-painted masks. One empty segmentation attempt preceded the successful mask.',variants:[]};
const start=performance.now();
let neutral:Buffer;
if(process.argv.includes('--reuse') || process.argv.includes('--reuse-render')){neutral=await readFile(out+'/neutral-grey.png');const prior=JSON.parse(await readFile(out+'/timings.json','utf8'));report.aiRenderMs=prior.aiRenderMs;report.segmentationMs=prior.segmentationMs;report.initialEmptyMaskMs=prior.initialEmptyMaskMs??prior.segmentationMs;}
else{
const response=await api({model:'muse-image-1.0',store:false,stream:false,tools:[{type:'image_generation',enable_image_search:false,enable_web_search:false,enable_shell:false,reasoning_strength:'high',size:'auto',output_format:'png'}],input:[{role:'user',content:[{type:'input_image',image_url:'data:image/png;base64,'+original.toString('base64')},{type:'input_text',text:prompt}]}]});report.aiRenderMs=Math.round(performance.now()-start);const item=response.output.find((o:{type:string})=>o.type==='image_generation_call');if(!item?.result)throw new Error('No rendered image');neutral=Buffer.from(item.result,'base64');await writeFile(out+'/neutral-grey.png',neutral);console.log('Neutral render:',report.aiRenderMs,'ms');await writeFile(out+'/timings.json',JSON.stringify(report,null,2));
}
const {data:rgb,info}=await sharp(neutral).removeAlpha().raw().toBuffer({resolveWithObject:true});const {width:W,height:H}=info;report.width=W;report.height=H;
let text:string;
if(process.argv.includes('--reuse'))text=await readFile(out+'/segmentation.txt','utf8');else{
 const segStart=performance.now();const response=await api({model:'sam-3.1',store:false,stream:false,input:[{role:'user',content:[{type:'input_text',text:'exterior wall'},{type:'input_image',image_url:'data:image/png;base64,'+neutral.toString('base64')}]}]});report.segmentationMs=Math.round(performance.now()-segStart);text=response.output.flatMap((m:{content?:{type:string;text:string}[]})=>m.content||[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('');await writeFile(out+'/segmentation.txt',text);console.log('Wall segmentation:',report.segmentationMs,'ms');await writeFile(out+'/timings.json',JSON.stringify(report,null,2));
}
const prepStart=performance.now();const regions=parseMasks(text,W,H),mask=new Float32Array(W*H);report.wallRegions=regions.length;
for(const region of regions){const pixels=await decodeRegionRaster(region);for(let y=0;y<region.height;y++)for(let x=0;x<region.width;x++)if(pixels[y*region.width+x])mask[(y+region.top)*W+x+region.left]=1;}
if(!regions.length)throw new Error('No grey wall regions');
const lin=Float32Array.from({length:256},(_,i)=>i/255<=.04045?i/3294.6:((i/255+.055)/1.055)**2.4),gray=new Float32Array(W*H),illumination=new Float32Array(W*H),hist=new Uint32Array(256);let count=0;
for(let i=0;i<mask.length;i++){const p=i*3;gray[i]=(.2126*rgb[p]+.7152*rgb[p+1]+.0722*rgb[p+2])/255;illumination[i]=.2126*lin[rgb[p]]+.7152*lin[rgb[p+1]]+.0722*lin[rgb[p+2]];if(mask[i]){hist[Math.round(gray[i]*255)]++;count++;}}
let cumulative=0,reference=lin[128];for(let i=0;i<256;i++){cumulative+=hist[i];if(cumulative>=count*.85){reference=Math.max(.04,lin[i]);break;}}
// The neutral edit is aligned with the source. Its deliberate darkening identifies
// changed wall pixels, including fine plant boundaries that the coarse SAM mask misses.
// SAM supplies a broad spatial guard; source differences preserve doors and windows.
const source = await sharp(original).resize(W,H).removeAlpha().raw().toBuffer();
const guard = windowTest(Uint8Array.from(mask,v=>v?1:0),W,H,48,false);
for(let i=0;i<mask.length;i++) {
 const p=i*3;
 const difference = .2126*(source[p]-rgb[p]) + .7152*(source[p+1]-rgb[p+1]) + .0722*(source[p+2]-rgb[p+2]);
 const v=Math.max(0,Math.min(1,(difference-5)/12));
 mask[i]=guard[i]?v*v*(3-2*v):0;
}
const soft=guidedFilter(mask,gray,W,H,2,.0002);for(let i=0;i<soft.length;i++){soft[i]=soft[i]<.025?0:soft[i]>.975?1:soft[i];illumination[i]/=reference;}
await writeFile(out+'/mask.png',await sharp(Uint8Array.from(soft,v=>Math.round(v*255)),{raw:{width:W,height:H,channels:1}}).png().toBuffer());
report.maskPreparationMs=Math.round(performance.now()-prepStart);report.oneTimeTotalMs=report.aiRenderMs+report.segmentationMs+report.maskPreparationMs+(report.initialEmptyMaskMs||0);
const srgb=Uint8ClampedArray.from({length:8193},(_,i)=>{const v=i/8192;return 255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);});
function recolour(hex:string){const c=[0,2,4].map(k=>lin[parseInt(hex.slice(k,k+2),16)]);const result=Buffer.from(rgb);for(let i=0;i<soft.length;i++){const a=soft[i];if(!a)continue;const p=i*3;for(let j=0;j<3;j++){const value=Math.max(0,Math.min(1,c[j]*illumination[i]));result[p+j]=Math.round(rgb[p+j]*(1-a)+srgb[Math.round(value*8192)]*a);}}return result;}
for(const [name,hex]of[['terracotta','A55B48'],['sage-green','607C67'],['champagne','C8B99A']]){
 const t=performance.now(),pixels=recolour(hex),colourMs=performance.now()-t;
 let outside=0,changed=0;for(let i=0;i<soft.length;i++)if(soft[i]===0){outside++;if(rgb[i*3]!==pixels[i*3]||rgb[i*3+1]!==pixels[i*3+1]||rgb[i*3+2]!==pixels[i*3+2])changed++;}
 const e=performance.now();await writeFile(out+'/'+name+'.png',await sharp(pixels,{raw:{width:W,height:H,channels:3}}).png().toBuffer());
 const pngWriteMs=Math.round(performance.now()-e);
 const samples=[];for(let n=0;n<10;n++){const b=performance.now();recolour(hex);samples.push(performance.now()-b);}samples.sort((a,b)=>a-b);
 report.variants.push({name,hex:'#'+hex,firstColourMs:+colourMs.toFixed(2),warmMedianMs:+samples[5].toFixed(2),pngWriteMs,unchangedOutsidePixels:outside,changedOutsidePixels:changed});console.log(name,colourMs.toFixed(1)+'ms');
}
report.aiImageCalls=1;report.segmentationCalls=report.initialEmptyMaskMs?2:1;report.additionalAiCallsForColours=0;report.hardware='Local Mac CPU; Node '+process.version;await writeFile(out+'/timings.json',JSON.stringify(report,null,2));console.log('DONE',out);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
