/// <reference lib="webworker" />
import { prepareNeutralScene, renderNeutral, completeNeutralCoverage, type NeutralScene, type NeutralRaster } from "./neutral-renderer";
let scene: NeutralScene | null=null;
let initialBase:NeutralRaster|null=null,original:NeutralRaster|null=null,initialMask:Uint8Array|null=null,maskRevision=0;
const textures=new Map<string,NeutralRaster>();
self.onmessage=(event: MessageEvent)=>{
 const m=event.data;
 try {
  if(m.type==="init"){initialBase=m.base;initialMask=m.alpha;original=m.original||m.base;maskRevision=0;scene=prepareNeutralScene(m.base,m.alpha);scene.original=original!;scene.automaticMask=initialMask!;textures.clear();self.postMessage({type:"ready",generation:m.generation});}
  else if(m.type==="render"&&scene){
   if(m.texture){if(textures.size>=16){const evicted=textures.keys().next().value!;textures.delete(evicted);self.postMessage({type:"texture-evicted",generation:m.generation,textureId:evicted});}textures.set(m.textureId,m.texture);}
   if(m.textureId&&!textures.has(m.textureId))throw new Error("This texture is no longer loaded. Please choose it again.");
   if(m.coverage&&m.maskRevision!==maskRevision&&initialBase&&initialMask&&original){
    if(m.coverage.length!==initialMask.length)throw new Error("Invalid coverage dimensions");
    const additions=Uint8Array.from(m.coverage as Uint8Array,(v,i)=>v>initialMask![i]+10?v:0);
    const recovered=completeNeutralCoverage(original,initialBase,initialMask,additions,new Uint8Array(initialMask.length).fill(255));
    const alpha=m.coverage as Uint8Array;
    scene=prepareNeutralScene(recovered.base,initialMask);scene.alpha=alpha;scene.original=original;scene.automaticMask=initialMask;maskRevision=m.maskRevision;
   }
   const start=performance.now(),pixels=renderNeutral(scene,{hex:m.hex,texture:m.textureId?textures.get(m.textureId):undefined,scale:m.scale,turned:m.turned});
   self.postMessage({type:"rendered",id:m.id,generation:m.generation,pixels,renderMs:performance.now()-start},[pixels.data.buffer]);
  }
 }catch(e){self.postMessage({type:"error",generation:m.generation,message:e instanceof Error?e.message:"The preview could not be drawn."});}
};
export {};
