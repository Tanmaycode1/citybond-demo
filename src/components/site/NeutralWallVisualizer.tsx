"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import { fastMaterials } from "@/lib/visualizer/fast-types";
import { paintNeutralMask, previewPoint, type NeutralBundle, type NeutralRaster } from "@/lib/visualizer/neutral-renderer";
import Link from "./SiteLink";
import { useJourneyRole } from "./JourneyContext";
type Step="photo"|"form"|"waiting"|"result"|"failure";
async function pixels(url:string,max=1600):Promise<NeutralRaster>{
 const img=new Image();img.crossOrigin="anonymous";img.src=url;await img.decode();
 const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),width=Math.round(img.naturalWidth*ratio),height=Math.round(img.naturalHeight*ratio),canvas=document.createElement("canvas");
 canvas.width=width;canvas.height=height;canvas.getContext("2d")!.drawImage(img,0,0,width,height);
 return{width,height,data:canvas.getContext("2d")!.getImageData(0,0,width,height).data};
}
async function texturePixels(url:string,metallic:boolean):Promise<NeutralRaster>{
 const source=await pixels(url,1024),canvas=document.createElement("canvas");canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext("2d")!;ctx.putImageData(new ImageData(new Uint8ClampedArray(source.data),source.width,source.height),0,0);
 const target=document.createElement("canvas"),ratio=Math.min(1,512/(source.width*.88),1024/(source.height*.88));target.width=Math.round(source.width*.88*ratio);target.height=Math.round(source.height*.88*ratio);
 const t=target.getContext("2d",{willReadFrequently:true})!;t.drawImage(canvas,source.width*.06,source.height*.06,source.width*.88,source.height*.88,0,0,target.width,target.height);
 const data=t.getImageData(0,0,target.width,target.height).data;
 if(metallic){
  const blur=document.createElement("canvas");blur.width=target.width+128;blur.height=target.height+128;const b=blur.getContext("2d")!;b.filter="blur(32px)";
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)b.drawImage(target,64+x*target.width,64+y*target.height);
  const low=b.getImageData(64,64,target.width,target.height).data;
  const lin=(v:number)=>v/255<=.04045?v/3294.6:((v/255+.055)/1.055)**2.4;
  let avg=0;for(let p=0;p<data.length;p+=4)avg+=.2126*lin(data[p])+.7152*lin(data[p+1])+.0722*lin(data[p+2]);avg/=target.width*target.height;
  for(let p=0;p<data.length;p+=4){const light=.2126*lin(low[p])+.7152*lin(low[p+1])+.0722*lin(low[p+2]),gain=avg/Math.max(.08,light);for(let c=0;c<3;c++){const v=Math.min(1,lin(data[p+c])*gain);data[p+c]=255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);}}
 }
 return{width:target.width,height:target.height,data};
}
async function json(response:Response){const body=await response.json();if(!response.ok)throw new Error(body.error||"Please try again.");return body;}
export function NeutralWallVisualizer({content:c,heading=true}:{content:SiteContent;heading?:boolean}){
 const u=c.ui,materials=useMemo(()=>fastMaterials(c.products),[c.products]),role=useJourneyRole();
 const [chosen,setChosen]=useState(()=>materials.find(m=>m.id.startsWith("wooden"))?.id||materials[0]?.id||""),[step,setStep]=useState<Step>("photo");
 const [collection,setCollection]=useState("wooden-series"),[finishPage,setFinishPage]=useState(0);
 const filteredMaterials=materials.filter(m=>!collection||m.id.startsWith(collection+":"));
 const pageCount=Math.max(1,Math.ceil(filteredMaterials.length/6)),visibleMaterials=filteredMaterials.slice(finishPage*6,finishPage*6+6);
 const material=materials.find(m=>m.id===chosen)||materials[0];
 const [photoRatio,setPhotoRatio]=useState(1),[photo,setPhoto]=useState(""),[blob,setBlob]=useState<Blob|null>(null),[loadingPhoto,setLoadingPhoto]=useState(false),[error,setError]=useState("");
 const [submitting,setSubmitting]=useState(false),[reference,setReference]=useState(""),[bundle,setBundle]=useState<NeutralBundle|null>(null),[workerReady,setWorkerReady]=useState(false);
 const [appearance,setAppearance]=useState("texture"),[hex,setHex]=useState("#A55B48"),[scale,setScale]=useState(1),[turned,setTurned]=useState(false),[split,setSplit]=useState(0),[updating,setUpdating]=useState(false),[renderMs,setRenderMs]=useState(0);
 const [editing,setEditing]=useState(false),[brushMode,setBrushMode]=useState<"add"|"remove">("add"),[brushSize,setBrushSize]=useState(12),[maskRevision,setMaskRevision]=useState(0),[undoCount,setUndoCount]=useState(0);
 const maskCanvas=useRef<HTMLCanvasElement>(null),maskData=useRef<Uint8Array|null>(null),initialMask=useRef<Uint8Array|null>(null),undo=useRef<Uint8Array[]>([]),stroke=useRef<{x:number;y:number}|null>(null),overlayFrame=useRef<number|null>(null);
 const upload=useRef<HTMLInputElement>(null),canvas=useRef<HTMLCanvasElement>(null),section=useRef<HTMLElement>(null),formHeading=useRef<HTMLHeadingElement>(null),resultHeading=useRef<HTMLHeadingElement>(null);
 const generation=useRef(0),drawId=useRef(0),worker=useRef<Worker|null>(null),session=useRef<Promise<string>|null>(null),sessionId=useRef("");
 const preparation=useRef<Promise<{error?:string}>|null>(null),controllers=useRef<AbortController[]>([]),textureCache=useRef(new Map<string,Promise<NeutralRaster>>()),sent=useRef(new Set<string>());
 const lastLead=useRef<Record<string,unknown>|null>(null);
 const [elapsed,setElapsed]=useState(0);
 const request=(url:string,init:RequestInit={})=>{const controller=new AbortController();controllers.current.push(controller);return fetch(url,{...init,signal:controller.signal});};
 useEffect(()=>{const current=generation,active=controllers;return()=>{current.current++;worker.current?.terminate();active.current.forEach(a=>a.abort());if(overlayFrame.current!==null)cancelAnimationFrame(overlayFrame.current);};},[]);
 useEffect(()=>{if(step!=="waiting")return;const start=Date.now(),timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[step]);
 useEffect(()=>{if(step==="form")formHeading.current?.focus({preventScroll:true});if(step==="result")resultHeading.current?.focus({preventScroll:true});},[step]);
 useEffect(()=>{
  if(!bundle)return;
  const id=generation.current,w=new Worker(new URL("../../lib/visualizer/neutral.worker.ts",import.meta.url),{type:"module"});worker.current=w;sent.current.clear();
  w.onmessage=e=>{if(id!==generation.current||e.data.generation!==id)return;
   if(e.data.type==="texture-evicted")sent.current.delete(e.data.textureId);
   else if(e.data.type==="ready")setWorkerReady(true);
   else if(e.data.type==="rendered"&&e.data.id===drawId.current&&canvas.current){const p=e.data.pixels;canvas.current.width=p.width;canvas.current.height=p.height;canvas.current.getContext("2d")!.putImageData(new ImageData(p.data,p.width,p.height),0,0);setRenderMs(e.data.renderMs);setUpdating(false);setStep("result");}
   else if(e.data.type==="error"){setError(e.data.message);setUpdating(false);setStep("failure");}
  };
  w.onerror=()=>{if(id===generation.current){setError("The preview renderer could not start. Please reload and try again.");setStep("failure");}};
  void Promise.all([pixels(bundle.base),pixels(bundle.mask),pixels(bundle.original)]).then(([base,mask,original])=>{if(id!==generation.current)return;const alpha=Uint8Array.from({length:base.width*base.height},(_,i)=>mask.data[i*4]);maskData.current=alpha.slice();initialMask.current=alpha.slice();undo.current=[];w.postMessage({type:"init",generation:id,base,alpha,original},[base.data.buffer,alpha.buffer,original.data.buffer]);}).catch(()=>{if(id===generation.current){setError("The prepared image could not be opened. Please retry.");setStep("failure");}});
  return()=>{w.terminate();};
 },[bundle]);
 useEffect(()=>{
  if(!workerReady||!worker.current||!material)return;
  const id=++drawId.current,g=generation.current;setUpdating(true);setError("");
  const textureId=appearance==="texture"?material.texture:"";
  void(async()=>{
   let texture:NeutralRaster|undefined;
   if(textureId&&!sent.current.has(textureId)){
    let pending=textureCache.current.get(textureId);if(!pending){pending=texturePixels(textureId,material.id.startsWith("metallic"));textureCache.current.set(textureId,pending);pending.catch(()=>textureCache.current.delete(textureId));}texture=await pending;
   }
   if(id!==drawId.current||g!==generation.current||!worker.current)return;
   worker.current.postMessage({type:"render",id,generation:g,hex:appearance==="colour"?hex:material.hex,textureId,texture,scale,turned,maskRevision,coverage:maskRevision?maskData.current:undefined});if(textureId)sent.current.add(textureId);
  })().catch(()=>{if(id===drawId.current){setUpdating(false);setError("This swatch could not be loaded. Choose another finish or update its image in the content portal.");}});
 },[appearance,hex,material,scale,turned,workerReady,maskRevision]);
 const loadPhoto=async(source:File|string)=>{
  if(loadingPhoto)return;setLoadingPhoto(true);setError("");let objectUrl="";
  try{
   if(source instanceof File&&(!/^image\/(jpeg|png|webp)$/.test(source.type)||source.size>25*1024*1024))throw new Error("Choose a JPG, PNG or WebP photo smaller than 25 MB.");
   const url=typeof source==="string"?source:(objectUrl=URL.createObjectURL(source)),img=new Image();img.src=url;await img.decode();
   if(img.naturalWidth<200||img.naturalHeight<200||img.naturalWidth*img.naturalHeight>24_000_000)throw new Error("Choose a photo between 200 × 200 pixels and 24 megapixels.");
   const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),stage=document.createElement("canvas");stage.width=Math.round(img.naturalWidth*ratio);stage.height=Math.round(img.naturalHeight*ratio);stage.getContext("2d")!.drawImage(img,0,0,stage.width,stage.height);
   const data=await new Promise<Blob>((resolve,reject)=>stage.toBlob(b=>b?resolve(b):reject(new Error("Photo could not be prepared.")),"image/jpeg",.96));
   if(data.size>3_500_000)throw new Error("Choose a smaller photo.");setPhotoRatio(stage.width/stage.height);setPhoto(stage.toDataURL("image/jpeg",.96));setBlob(data);
  }catch(e){setError(e instanceof Error?e.message:"The photo could not be loaded.");}finally{if(objectUrl)URL.revokeObjectURL(objectUrl);setLoadingPhoto(false);}
 };
 const start=()=>{
  if(!blob||!material)return;
  const g=++generation.current;setError("");setStep("form");setBundle(null);setWorkerReady(false);setReference("");sessionId.current="";
  session.current=request("/api/visualizer/session",{method:"POST",headers:{"Content-Type":blob.type},body:blob}).then(json).then(data=>{if(g===generation.current)sessionId.current=data.id;return data.id as string;});
  preparation.current=session.current.then(id=>request("/api/visualizer/prepare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})})).then(json).then(()=>({})).catch(e=>({error:e instanceof Error?e.message:"Preparation failed."}));
 };
 const showResult=async(g:number)=>{const prepared=await preparation.current;if(g!==generation.current)return;if(prepared?.error)throw new Error(prepared.error);const data=await request(`/api/visualizer/result?id=${sessionId.current}`).then(json);if(g!==generation.current)return;setWorkerReady(false);setBundle(data);};
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(submitting)return;const values=new FormData(event.currentTarget),g=generation.current;setSubmitting(true);setError("");
  const data={name:values.get("name"),email:values.get("email"),phone:values.get("phone"),city:values.get("city"),role:values.get("role")||"",type:"visualiser",product:material?.id.split(":")[0]||"",message:values.get("message")||"",consent:values.get("consent")==="on",website:values.get("website")||""};lastLead.current=data;let savedLead=false;
  try{const id=await session.current;if(!id)throw new Error("Please choose a photo first.");const saved=await request("/api/visualizer/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,data})}).then(json);if(g!==generation.current)return;setReference(saved.reference);savedLead=true;setStep("waiting");setElapsed(0);await showResult(g);}
  catch(e){if(g===generation.current){setError(e instanceof Error?e.message:"Please try again.");if(savedLead)setStep("failure");}}
  finally{if(g===generation.current)setSubmitting(false);}
 };
 const retry=async()=>{const g=generation.current;setError("");setStep("waiting");setElapsed(0);try{const id=sessionId.current;if(!id)throw new Error("Please upload your photo again.");
  if(!reference&&lastLead.current){const saved=await request("/api/visualizer/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,data:lastLead.current})}).then(json);setReference(saved.reference);}
  preparation.current=request("/api/visualizer/prepare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}).then(json).then(()=>({})).catch(e=>({error:e.message}));await showResult(g);
 }catch(e){if(g===generation.current){setError(e instanceof Error?e.message:"Please try again.");setStep("failure");}}};
 const reset=()=>{generation.current++;controllers.current.forEach(a=>a.abort());controllers.current=[];worker.current?.terminate();worker.current=null;session.current=null;preparation.current=null;setBundle(null);setWorkerReady(false);setPhoto("");setPhotoRatio(1);setBlob(null);setSubmitting(false);setUpdating(false);setError("");setStep("photo");setSplit(0);setReference("");setEditing(false);setMaskRevision(0);setUndoCount(0);undo.current=[];maskData.current=null;initialMask.current=null;stroke.current=null;};
 const drawCoverage=()=>{
  const el=maskCanvas.current,mask=maskData.current;if(!el||!mask||!bundle)return;
  el.width=bundle.width;el.height=bundle.height;const data=new Uint8ClampedArray(mask.length*4);
  for(let i=0;i<mask.length;i++){data[i*4]=121;data[i*4+1]=231;data[i*4+2]=186;data[i*4+3]=Math.round(mask[i]*.36);}
  el.getContext("2d")!.putImageData(new ImageData(data,bundle.width,bundle.height),0,0);
 };
 useEffect(()=>{if(editing)drawCoverage();});
 const paint=(event:PointerEvent<HTMLCanvasElement>,begin=false)=>{
  if(!bundle||!maskData.current||!editing||(!begin&&!stroke.current))return;
  const box=event.currentTarget.getBoundingClientRect(),point=previewPoint(event.clientX-box.left,event.clientY-box.top,box.width,box.height,bundle.width,bundle.height);if(!point)return;
  if(begin){if(updating)return;event.currentTarget.setPointerCapture(event.pointerId);undo.current.push(maskData.current.slice());if(undo.current.length>10)undo.current.shift();setUndoCount(undo.current.length);stroke.current=point;}
  paintNeutralMask(maskData.current,bundle.width,bundle.height,stroke.current||point,point,brushSize/point.scale,brushMode==="remove");stroke.current=point;
  if(overlayFrame.current===null)overlayFrame.current=requestAnimationFrame(()=>{overlayFrame.current=null;drawCoverage();});
 };
 const endStroke=()=>{if(!stroke.current)return;stroke.current=null;setMaskRevision(v=>v+1);};
 const undoCoverage=()=>{const previous=undo.current.pop();if(!previous)return;maskData.current=previous;setUndoCount(undo.current.length);setMaskRevision(v=>v+1);drawCoverage();};
 const resetCoverage=()=>{if(!initialMask.current)return;maskData.current=initialMask.current.slice();undo.current=[];setUndoCount(0);setMaskRevision(v=>v+1);drawCoverage();};
 const choose=(id:string)=>{setChosen(id);setAppearance("texture");};
 const download=()=>{if(!canvas.current||updating||error)return;canvas.current.toBlob(b=>{if(!b)return;const url=URL.createObjectURL(b),a=document.createElement("a");a.href=url;a.download="citybond-exterior-preview.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},"image/png");};
 const catalogueControls=<div className="nv-catalogue-tools"><select aria-label={u.visualizerCollection} value={collection} onChange={e=>{setCollection(e.target.value);setFinishPage(0);}}><option value="">{u.all}</option>{c.products.filter(p=>materials.some(m=>m.id.startsWith(p.slug+":"))).map(p=><option key={p.slug} value={p.slug}>{p.name}</option>)}</select>{pageCount>1&&<div><button type="button" aria-label="Previous finishes" disabled={finishPage===0} onClick={()=>setFinishPage(p=>p-1)}>‹</button><small>{finishPage+1}/{pageCount}</small><button type="button" aria-label="Next finishes" disabled={finishPage>=pageCount-1} onClick={()=>setFinishPage(p=>p+1)}>›</button></div>}</div>;
 const swatches=<>{catalogueControls}<div className="nv-swatches" role="group" aria-label={u.visualizerFinish}>{visibleMaterials.map(m=><button type="button" key={m.id} aria-label={`${m.name} · ${m.finish}`} aria-pressed={chosen===m.id&&appearance==="texture"} onClick={()=>choose(m.id)}><span style={{backgroundColor:m.hex,...(m.texture?{backgroundImage:`url(${m.texture})`}:{})}}/><small>{m.finish}</small></button>)}</div></>;
 return <section ref={section} className="nv" id="visualizer" aria-label="Exterior wall visualizer" data-step={step} data-render-ms={renderMs.toFixed(1)}>
  {heading&&<header className="nv-heading"><p className="nv-kicker">{u.visualizerEyebrow}</p><h2>{u.visualizerTitle}</h2><p>{u.visualizerDescription}</p></header>}
  <ol className="nv-steps" aria-label="Preview steps">{[u.visualizerPhotoStep,u.visualizerDetailsStep,u.visualizerResultStep].map((label,i)=><li key={i} aria-current={(step==="photo"?0:step==="form"?1:2)===i?"step":undefined}><span>0{i+1}</span>{label}</li>)}</ol>
  <div className="nv-workspace">
   <div className="nv-preview-column">
    <div className={`nv-stage nv-preview${photo&&step!=="result"?" nv-preview-blurred":""}${step==="form"||step==="waiting"?" nv-preview-processing":""}`} style={{aspectRatio:photoRatio}} aria-busy={step==="form"||step==="waiting"}>
     <img src={bundle?.original||photo||u.visualizerSampleImage} alt={photo?u.uploadPreview:u.visualizerPhotoStep}/>
     {bundle&&<canvas ref={canvas} aria-label="Interactive exterior material preview" style={{clipPath:`inset(0 0 0 ${split}%)`}}/>}
     {step==="result"&&editing&&<canvas className="nv-coverage-canvas" ref={maskCanvas} aria-label={u.visualizerCoverageCanvas} onPointerDown={e=>paint(e,true)} onPointerMove={e=>paint(e)} onPointerUp={endStroke} onPointerCancel={endStroke} onLostPointerCapture={endStroke}/>}
     {step==="result"&&<><div className="nv-compare-line" style={{left:`${split}%`}} hidden={split===0||split===100}><span aria-hidden="true">↔</span></div><span className="nv-stage-label">{split===100?u.visualizerOriginal:appearance==="colour"?hex:material?.finish}</span></>}
     {((step==="photo"&&photo)||step==="form"||step==="waiting"||step==="result")&&<div className={`nv-image-loading${step==="result"?" nv-loading-complete":""}${step==="photo"||step==="form"?" nv-image-gate":""}`} role="status" aria-hidden={step==="result"}>
      {(step==="waiting"||step==="result")&&<><div className="nv-light-drift" aria-hidden="true"/><div className="nv-loading-frame" aria-hidden="true"><svg viewBox="0 0 120 120" fill="none"><path className="nv-frame-guide" d="M26 96V24H67V96H26ZM53 96V42H94V96H53"/><path className="nv-frame-trace" pathLength="100" d="M26 96V24H67V96H26ZM53 96V42H94V96H53"/></svg></div></>}
      <div className="nv-loading-copy" key={step==="result"?"waiting":step}><span className="nv-loading-eyebrow">{step==="photo"?u.visualizerPhotoStep:step==="form"?u.visualizerDetailsStep:u.visualizerSavedShort}</span><p>{step==="photo"?u.visualizerContinuePrompt:step==="form"?u.visualizerDetailsPrompt:u.visualizerProcessingTitle}</p><small>{step==="photo"?u.visualizerContinueHint:step==="form"?u.visualizerDetailsHint:elapsed>45?u.visualizerTakingLong:u.visualizerProcessingHint}</small></div>
     </div>}
     {step==="photo"&&<div className={`nv-upload-caption${photo?" nv-upload-caption-selected":""}`}>{!photo&&<p>{u.visualizerUploadHint}</p>}<button type="button" className="nv-primary" disabled={loadingPhoto} onClick={()=>upload.current?.click()}>{loadingPhoto?u.visualizerOpening:u.visualizerUpload}</button>{!photo&&<button type="button" className="nv-quiet" disabled={loadingPhoto} onClick={()=>void loadPhoto(u.visualizerSampleImage)}>{u.visualizerTrySample}</button>}</div>}
    </div>
    {step==="result"&&<><label className="nv-compare">{u.visualizerCompare}<input disabled={editing} type="range" min="0" max="100" value={split} aria-label="Compare original and preview" onChange={e=>setSplit(Number(e.target.value))}/></label><p className="nv-note">{u.visualizerCaveat}</p></>}
   </div>
   <aside className="nv-panel nv-controls" data-phase={step}>
    {step==="photo"&&<div className="nv-panel-page" key="photo"><header className="nv-panel-header"><p className="nv-kicker">{u.visualizerFinish}</p><h3>{u.visualizerSelectFinish}</h3></header><div className="nv-panel-body"><p className="nv-finish-name">{material?.finish}</p>{swatches}</div><footer className="nv-panel-footer"><button type="button" className="nv-primary nv-wide" disabled={!blob||loadingPhoto} onClick={start}>{u.visualizerContinue}<span aria-hidden="true">↗</span></button><p className="nv-note">{u.visualizerProcessingNotice}</p></footer></div>}
    {step==="form"&&<div className="nv-panel-page" key="form"><header className="nv-panel-header"><p className="nv-kicker">{u.visualizerDetailsStep}</p><h3 ref={formHeading} tabIndex={-1}>{u.visualizerCompactFormTitle}</h3><p className={error?"nv-form-error":"nv-note"} role={error?"alert":undefined}>{error||u.visualizerCompactFormHint}</p></header><form onSubmit={submit} className="nv-form" aria-label="Your details"><fieldset disabled={submitting}>
     <div className="nv-fields">{(["name","phone","email","city"] as const).map(name=><label className={name==="email"?"nv-field-full":undefined} key={name}>{u[name]}<input name={name} type={name==="email"?"email":name==="phone"?"tel":"text"} autoComplete={name==="phone"?"tel":name==="city"?"address-level2":name} required minLength={name==="name"||name==="city"?2:undefined} maxLength={name==="phone"?25:120}/></label>)}
     <label>{u.role}<select name="role" required defaultValue={c.roles.find(r=>r.id===role)?.label||""}><option value="" disabled>{u.select}</option>{c.roles.map(r=><option key={r.id}>{r.label}</option>)}</select></label></div>
     <label className="nv-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
     <label className="nv-consent"><input type="checkbox" name="consent" required/><span>{u.visualizerCompactConsent} <Link href="/privacy">{c.site.footerLinks.find(l=>l.href==="/privacy")?.label||"Privacy"}</Link></span></label>
     <button className="nv-primary nv-wide" type="submit" disabled={submitting}>{submitting?u.sending:u.visualizerShow}<span aria-hidden="true">↗</span></button>
    </fieldset></form><button type="button" className="nv-quiet nv-panel-back" disabled={submitting} onClick={reset}>{u.visualizerAnother}</button></div>}
    {(step==="waiting"||step==="result")&&<div className="nv-panel-page" key="customize"><header className="nv-panel-header"><p className="nv-kicker">{u.visualizerResultStep}</p><h3 ref={resultHeading} tabIndex={-1}>{appearance==="colour"?u.visualizerPickColour:material?.finish}</h3></header><div className="nv-modes" role="group" aria-label="Surface appearance"><button type="button" aria-pressed={appearance==="texture"} onClick={()=>setAppearance("texture")}>{u.visualizerMaterials}</button><button type="button" aria-pressed={appearance==="colour"} onClick={()=>setAppearance("colour")}>{u.visualizerColours}</button></div>
     <div className="nv-panel-body">
      {appearance==="texture"?<>{swatches}</>:<>{catalogueControls}<div className="nv-colours">{visibleMaterials.map(m=><button type="button" key={m.id} aria-label={`${m.finish} colour`} aria-pressed={hex===m.hex} style={{background:m.hex}} onClick={()=>setHex(m.hex)}/>)}</div><label className="nv-custom-colour">{u.visualizerCustomColour}<input aria-label="Custom facade colour" type="color" value={hex} onChange={e=>setHex(e.target.value)}/><span>{hex.toUpperCase()}</span></label></>}
      <details className="nv-adjustments"><summary>{u.visualizerFineTune}</summary><div className="nv-adjustments-content">
       {appearance==="texture"&&<><label className="nv-scale">{u.visualizerScale}<input type="range" min="0.4" max="2.5" step="0.1" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label><label className="nv-consent"><input type="checkbox" checked={turned} onChange={e=>setTurned(e.target.checked)}/>{u.visualizerRotate}</label></>}
       <div className="nv-coverage-tools"><button type="button" className="nv-secondary nv-wide" disabled={step!=="result"} aria-expanded={editing} onClick={()=>{setEditing(v=>!v);setSplit(0);}}>{editing?u.visualizerCoverageDone:u.visualizerCoverageEdit}</button>
        {editing&&<div className="nv-coverage-options"><p>{u.visualizerCoverageHint}</p><div className="nv-modes" role="group" aria-label={u.visualizerCoverageEdit}><button type="button" aria-pressed={brushMode==="add"} onClick={()=>setBrushMode("add")}>{u.visualizerCoverageAdd}</button><button type="button" aria-pressed={brushMode==="remove"} onClick={()=>setBrushMode("remove")}>{u.visualizerCoverageRemove}</button></div><label>{u.visualizerBrushSize}<input aria-label={u.visualizerBrushSize} type="range" min="3" max="36" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))}/></label><div className="nv-coverage-actions"><button type="button" disabled={!undoCount||updating} onClick={undoCoverage}>{u.visualizerCoverageUndo}</button><button type="button" disabled={updating||!maskRevision} onClick={resetCoverage}>{u.visualizerCoverageReset}</button></div></div>}
       </div>
      </div></details>
      {error&&<p className="nv-error" role="alert">{error}</p>}
     </div>
     <footer className="nv-panel-footer"><p className={`nv-inline-status${step==="waiting"?" nv-inline-status-pending":""}`} role="status"><span aria-hidden="true"/>{step==="waiting"?u.visualizerProcessingShort:u.visualizerReadyShort}</p><button type="button" className="nv-primary nv-wide" disabled={step!=="result"||updating||!!error} onClick={download}>{step==="waiting"?u.visualizerPreviewPreparing:updating?u.visualizerUpdating:u.visualizerDownload}<span aria-hidden="true">↓</span></button><button type="button" className="nv-quiet nv-panel-back" onClick={reset}>{u.visualizerAnother}</button></footer>
    </div>}
    {step==="failure"&&<div className="nv-panel-page nv-failure" key="failure"><p className="nv-kicker">{u.visualizerRetryTitle}</p><h3>{u.visualizerRetryDescription}</h3><p className="nv-error" role="alert">{error}</p><button className="nv-primary nv-wide" type="button" onClick={()=>void retry()}>{u.visualizerRetry}</button><button type="button" className="nv-quiet" onClick={reset}>{u.visualizerAnother}</button></div>}
    {step==="photo"&&error&&<p className="nv-error nv-upload-error" role="alert">{error}</p>}
   </aside>
  </div>
  <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload exterior photo" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void loadPhoto(f);e.target.value="";}}/>
 </section>;
}
