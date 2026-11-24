import { detectSegments } from "./geometry";
import { guidedFilter, windowTest } from "./masks";
export type NeutralRaster = { width: number; height: number; data: Uint8ClampedArray };
export type NeutralBundle = { original: string; base: string; mask: string; width: number; height: number; preparationMs: number; cached?: boolean; timings?: Record<string,number>; coverage?: { recoveredPixels:number; selectedPixels:number }; };
export type NeutralScene = { base: NeutralRaster; original?: NeutralRaster; automaticMask?: Uint8Array; alpha: Uint8Array; shade: Float32Array; u: Float32Array; v: Float32Array };
export type NeutralOptions = { hex: string; texture?: NeutralRaster; scale: number; turned: boolean };
const linear=Float32Array.from({length:256},(_,i)=>i/255<=.04045?i/3294.6:((i/255+.055)/1.055)**2.4);
const srgb=Uint8ClampedArray.from({length:8193},(_,i)=>{const v=i/8192;return 255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);});
/** Recover changed facade pixels throughout the building, not just near SAM's first wall selection. */
export function refineNeutralMask(original: NeutralRaster, base: NeutralRaster, coarse: Uint8Array, building?: Uint8Array) {
 const {width:W,height:H}=base,N=W*H;
 if(original.width!==W||original.height!==H||coarse.length!==N||(building&&building.length!==N))throw new Error("Mismatched scene dimensions");
 // The already-required exterior gate supplies the whole building silhouette. A narrow
 // dilation around wall instances alone loses complete recessed / disconnected faces.
 // Close holes in the broad guard only. Branches/windows are still excluded by
 // pixel differences below; their coarse SAM cutouts must not hide the wall between leaves.
 const radius=Math.max(4,Math.round(W*.04));
 const silhouette=building?windowTest(windowTest(Uint8Array.from(building,v=>v?1:0),W,H,radius,false),W,H,radius,true):null;
 const guard=silhouette?windowTest(silhouette,W,H,Math.max(2,Math.round(W*.008)),false):windowTest(Uint8Array.from(coarse,v=>v?1:0),W,H,Math.max(6,Math.round(W*.03)),false);
 const mask=new Float32Array(N),gray=new Float32Array(N);
 for(let i=0;i<N;i++) {
  const p=i*4,r=base.data[p],g=base.data[p+1],b=base.data[p+2];gray[i]=(.2126*r+.7152*g+.0722*b)/255;
  // RGB distance handles lightening and equal-luminance colour changes as well as darkening.
  const dr=original.data[p]-r,dg=original.data[p+1]-g,db=original.data[p+2]-b;
  const delta=Math.sqrt((dr*dr+dg*dg+db*db)/3);
  // Outside the wall instances, only recover the neutral finish requested from the AI.
  // This prevents a changed tree or colourful window from becoming a new wall.
  const neutral=coarse[i]>0||Math.max(r,g,b)-Math.min(r,g,b)<40;
  const a=Math.max(0,Math.min(1,(delta-5)/12));mask[i]=guard[i]&&neutral?a*a*(3-2*a):0;
 }
 const refined=guidedFilter(mask,gray,W,H,2,.0002);
 return Uint8Array.from(refined,(v,i)=>!guard[i]||v<.025?0:v>.975?255:Math.round(v*255));
}
/** Fill independently detected wall/column interiors even when the AI left their colour unchanged. */
export function completeNeutralCoverage(original:NeutralRaster,base:NeutralRaster,mask:Uint8Array,semantic:Uint8Array,building:Uint8Array){
 const {width:W,height:H}=base,N=W*H;
 if(semantic.length!==N||building.length!==N||mask.length!==N||original.width!==W||original.height!==H)throw new Error("Mismatched scene dimensions");
 const interior=windowTest(Uint8Array.from(semantic,v=>v?1:0),W,H,Math.max(1,Math.round(W/1000)),true);
 const data=new Uint8ClampedArray(base.data),alpha=mask.slice();
 // Estimate the neutral finish's illumination relative to the source from existing confident walls.
 const ratios:number[]=[];
 for(let i=0;i<N;i+=3)if(mask[i]>240){const p=i*4,src=.2126*linear[original.data[p]]+.7152*linear[original.data[p+1]]+.0722*linear[original.data[p+2]],dst=.2126*linear[data[p]]+.7152*linear[data[p+1]]+.0722*linear[data[p+2]];if(src>.04&&dst>.015)ratios.push(dst/src);}
 ratios.sort((a,b)=>a-b);const gain=Math.max(.08,Math.min(2,ratios.length?ratios[Math.floor(ratios.length/2)]:.45));
 let recoveredPixels=0;
 for(let i=0;i<N;i++)if(interior[i]&&building[i]&&mask[i]<240){
  const p=i*4,delta=Math.sqrt(((original.data[p]-data[p])**2+(original.data[p+1]-data[p+1])**2+(original.data[p+2]-data[p+2])**2)/3);
  // Unprepared white/coloured walls need neutral shading too, otherwise additions look overexposed.
  if(delta<18){const light=(.2126*linear[original.data[p]]+.7152*linear[original.data[p+1]]+.0722*linear[original.data[p+2]])*gain;const gray=srgb[Math.round(Math.max(0,Math.min(1,light))*8192)];for(let c=0;c<3;c++)data[p+c]=gray;}
  if(mask[i]<128)recoveredPixels++;alpha[i]=255;
 }
 return{base:{width:W,height:H,data},mask:alpha,recoveredPixels};
}
/** Map pointer positions through object-fit:contain; clicks in letterboxing cannot paint the photo. */
export function previewPoint(x:number,y:number,frameWidth:number,frameHeight:number,imageWidth:number,imageHeight:number){
 const scale=Math.min(frameWidth/imageWidth,frameHeight/imageHeight),left=(frameWidth-imageWidth*scale)/2,top=(frameHeight-imageHeight*scale)/2;
 if(x<left||y<top||x>=left+imageWidth*scale||y>=top+imageHeight*scale)return null;
 return{x:(x-left)/scale,y:(y-top)/scale,scale};
}
/** A soft brush stroke; interpolation prevents gaps when a pointer moves quickly. */
export function paintNeutralMask(mask:Uint8Array,W:number,H:number,from:{x:number;y:number},to:{x:number;y:number},radius:number,erase:boolean){
 radius=Math.max(1,Math.min(200,radius));const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/(radius*.3)));
 for(let n=0;n<=steps;n++){const x=from.x+(to.x-from.x)*n/steps,y=from.y+(to.y-from.y)*n/steps;
  for(let yy=Math.max(0,Math.floor(y-radius));yy<=Math.min(H-1,Math.ceil(y+radius));yy++)for(let xx=Math.max(0,Math.floor(x-radius));xx<=Math.min(W-1,Math.ceil(x+radius));xx++){
   const d=Math.hypot(xx-x,yy-y)/radius;if(d>=1)continue;const strength=Math.min(1,(1-d)/.18),i=yy*W+xx;
   mask[i]=erase?Math.min(mask[i],Math.round(255*(1-strength))):Math.max(mask[i],Math.round(255*strength));
  }
 }
}
/** Estimate a dominant frontal projection. Side-wall UVs and reflective materials remain approximate. */
export function prepareNeutralScene(base: NeutralRaster, alpha: Uint8Array): NeutralScene {
 const {width:W,height:H}=base,N=W*H;if(alpha.length!==N)throw new Error("Invalid wall mask");
 const shade=new Float32Array(N),hist=new Uint32Array(256);let count=0;
 for(let i=0;i<N;i++){const p=i*4;shade[i]=.2126*linear[base.data[p]]+.7152*linear[base.data[p+1]]+.0722*linear[base.data[p+2]];if(alpha[i]>200){hist[Math.round(.2126*base.data[p]+.7152*base.data[p+1]+.0722*base.data[p+2])]++;count++;}}
 if(count<1)throw new Error("No usable facade was found. Please try a clearer exterior photo.");
 let sum=0,reference=linear[150];for(let c=0;c<256;c++){sum+=hist[c];if(sum>=count*.85){reference=Math.max(.04,linear[c]);break;}}
 for(let i=0;i<N;i++)shade[i]/=reference;
 const ratio=Math.max(1,W/800,H/800),sw=Math.round(W/ratio),sh=Math.round(H/ratio),gray=new Float32Array(sw*sh);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const p=(Math.min(H-1,Math.floor(y*ratio))*W+Math.min(W-1,Math.floor(x*ratio)))*4;gray[y*sw+x]=.2126*base.data[p]+.7152*base.data[p+1]+.0722*base.data[p+2];}
 const lines=detectSegments(gray,sw,sh).filter(s=>{const x=Math.max(0,Math.min(W-1,Math.round((s.x1+s.x2)/2*ratio))),y=Math.max(0,Math.min(H-1,Math.round((s.y1+s.y2)/2*ratio)));return alpha[y*W+x]>128&&s.len>30;});
 const verticals=lines.filter(s=>Math.abs(s.x2-s.x1)<.1*Math.abs(s.y2-s.y1)),horizontals=lines.filter(s=>Math.abs(s.y2-s.y1)<.1*Math.abs(s.x2-s.x1));
 const vw=verticals.reduce((a,s)=>a+s.len,0),hw=horizontals.reduce((a,s)=>a+s.len,0);
 const vx=vw?verticals.reduce((a,s)=>a+(s.x2-s.x1)/(s.y2-s.y1)*s.len,0)/vw:0,hy=hw?horizontals.reduce((a,s)=>a+(s.y2-s.y1)/(s.x2-s.x1)*s.len,0)/hw:0;
 const peaks=new Map<number,number>();for(const s of verticals){const x=Math.round((s.x1+s.x2)/2*ratio/8)*8;peaks.set(x,(peaks.get(x)||0)+s.len);}
 const xs=[...peaks].filter(([,weight])=>weight>45).map(([x])=>x).sort((a,b)=>a-b),spacing=xs.slice(1).map((x,i)=>x-xs[i]).filter(d=>d>=W*.0375&&d<=W*.1375).sort((a,b)=>a-b);
 const panelWidth=spacing.length?spacing[Math.floor(spacing.length/2)]:W*.075,u=new Float32Array(N),v=new Float32Array(N),d=1-vx*hy;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;u[i]=(x-vx*y)/d/panelWidth;v[i]=(y-hy*x)/d/(panelWidth*2);}
 return {base,alpha,shade,u,v};
}
export function renderNeutral(scene: NeutralScene, options: NeutralOptions): NeutralRaster {
 const {base,alpha,shade,u,v}=scene,result=new Uint8ClampedArray(base.data),texture=options.texture;
 const color=[0,2,4].map(k=>linear[parseInt(options.hex.replace("#","").slice(k,k+2),16)||0]);
 const scale=Math.max(.3,Math.min(4,options.scale)),TW=texture?.width||1,TH=texture?.height||1,tex=texture?.data;
 for(let i=0;i<alpha.length;i++) {const a=alpha[i]/255,p=i*4;
  // Normal previews keep the prepared scene at fine occlusion boundaries. Only an
  // explicit erase restores source pixels; otherwise small AI shifts expose white halos.
  if(scene.original&&scene.automaticMask){const old=scene.automaticMask[i],erase=old?Math.max(0,(old-alpha[i])/old):0;if(erase)for(let c=0;c<3;c++)result[p+c]=Math.round(base.data[p+c]*(1-erase)+scene.original.data[p+c]*erase);}
  if(!a)continue;
  let uu=u[i]/scale,vv=v[i]/scale;if(options.turned)[uu,vv]=[vv*2,-uu/2];
  uu%=2;vv=(vv*2*TW/TH)%2;if(uu<0)uu+=2;if(vv<0)vv+=2;if(uu>1)uu=2-uu;if(vv>1)vv=2-vv;
  const tx=uu*(TW-1),ty=vv*(TH-1),x=Math.floor(tx),y=Math.floor(ty),fx=tx-x,fy=ty-y;
  const p00=(y*TW+x)*4,p10=(y*TW+Math.min(x+1,TW-1))*4,p01=(Math.min(y+1,TH-1)*TW+x)*4,p11=(Math.min(y+1,TH-1)*TW+Math.min(x+1,TW-1))*4;
  for(let c=0;c<3;c++){
   const sample=tex?(linear[tex[p00+c]]*(1-fx)+linear[tex[p10+c]]*fx)*(1-fy)+(linear[tex[p01+c]]*(1-fx)+linear[tex[p11+c]]*fx)*fy:color[c];
   const value=Math.max(0,Math.min(1,sample*shade[i]));result[p+c]=Math.round(result[p+c]*(1-a)+srgb[Math.round(value*8192)]*a);
  }
 }
 return {width:base.width,height:base.height,data:result};
}
