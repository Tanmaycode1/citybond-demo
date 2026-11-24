import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { detectSegments } from '../src/lib/visualizer/geometry';
const input='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-neutral-colour-test';
const out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-neutral-texture-test';
const round=(n:number)=>Math.round(n*100)/100;
async function main(){
 await mkdir(out,{recursive:true});
 const prepStart=performance.now();
 const {data:base,info}=await sharp(await readFile(input+'/neutral-grey.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,N=W*H;
 const alpha=await sharp(await readFile(input+'/mask.png')).greyscale().raw().toBuffer();
 const linear=Float32Array.from({length:256},(_,i)=>i/255<=.04045?i/3294.6:((i/255+.055)/1.055)**2.4);
 const shade=new Float32Array(N),hist=new Uint32Array(256);let count=0;
 for(let i=0;i<N;i++){
  const p=i*3;shade[i]=.2126*linear[base[p]]+.7152*linear[base[p+1]]+.0722*linear[base[p+2]];
  if(alpha[i]>200){hist[Math.round(.2126*base[p]+.7152*base[p+1]+.0722*base[p+2])]++;count++;}
 }
 let cumulative=0,reference=linear[150];for(let c=0;c<256;c++){cumulative+=hist[c];if(cumulative>=count*.85){reference=Math.max(.04,linear[c]);break;}}
 for(let i=0;i<N;i++)shade[i]/=reference;
 // Estimate the dominant facade axes and typical joint spacing from the prepared photo.
 // This is a front-plane approximation, NOT recovered 3D geometry or per-wall UVs.
 const small=await sharp(base,{raw:{width:W,height:H,channels:3}}).resize(800,800,{fit:'inside'}).greyscale().raw().toBuffer({resolveWithObject:true});
 const sw=small.info.width,sh=small.info.height,ratio=W/sw;
 const lines=detectSegments(Float32Array.from(small.data),sw,sh).filter(s=>{
  const x=Math.max(0,Math.min(W-1,Math.round((s.x1+s.x2)/2*ratio))),y=Math.max(0,Math.min(H-1,Math.round((s.y1+s.y2)/2*ratio)));
  return alpha[y*W+x]>128&&s.len>30;
 });
 const verticals=lines.filter(s=>Math.abs(s.x2-s.x1)<.1*Math.abs(s.y2-s.y1));
 const horizontals=lines.filter(s=>Math.abs(s.y2-s.y1)<.1*Math.abs(s.x2-s.x1));
 const vWeight=verticals.reduce((sum,s)=>sum+s.len,0),hWeight=horizontals.reduce((sum,s)=>sum+s.len,0);
 const vx=vWeight?verticals.reduce((sum,s)=>sum+(s.x2-s.x1)/(s.y2-s.y1)*s.len,0)/vWeight:0;
 const hy=hWeight?horizontals.reduce((sum,s)=>sum+(s.y2-s.y1)/(s.x2-s.x1)*s.len,0)/hWeight:0;
 const peaks=new Map<number,number>();
 for(const s of verticals){const x=Math.round((s.x1+s.x2)/2*ratio/8)*8;peaks.set(x,(peaks.get(x)||0)+s.len);}
 const xs=[...peaks].filter(([,weight])=>weight>45).map(([x])=>x).sort((a,b)=>a-b);
 const spacing=xs.slice(1).map((x,i)=>x-xs[i]).filter(d=>d>=60&&d<=220).sort((a,b)=>a-b);
 const panelWidth=spacing.length?spacing[Math.floor(spacing.length/2)]:W*.075;
 const u=new Float32Array(N),v=new Float32Array(N);const d=1-vx*hy;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x;if(!alpha[i])continue;
  u[i]=(x-vx*y)/d/panelWidth;
  v[i]=(y-hy*x)/d/(panelWidth*2);
 }
 const lut=Uint8ClampedArray.from({length:8193},(_,i)=>{const c=i/8192;return 255*(c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055);});
 const prepMs=performance.now()-prepStart;
 const report={width:W,height:H,additionalAiCalls:0,newSegmentationCalls:0,preparationMs:round(prepMs),mapping:{method:'Automatic dominant facade axes, approximate joint spacing, mirrored repeat. No per-plane depth or manual anchors.',panelWidthPixels:panelWidth,verticalShear:vx,horizontalShear:hy,verticalLines:verticals.length,horizontalLines:horizontals.length},referenceGrey:reference,variants:[] as object[],limitations:['One nearly front-facing photo only','Existing mask edge spill is inherited','Side walls use the front-plane projection; exact wall perspective is not established','Reflectance/gloss and 3D relief are not physically simulated; broad photographic highlights were removed from the metallic swatch to avoid repeated light patches'],timingScope:'Local Node CPU; first render excludes texture loading, preparation, PNG encoding and display.'};
 for(const [name,file]of[['wood','wooden'],['marble','marble'],['silver-metallic','metallic']]){
  const loadStart=performance.now();
  const source=await sharp(await readFile(`public/citybond/${file}-swatch.webp`)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  // Remove the photographic swatch card's rounded border from the metallic sample.
  const texture=await sharp(source.data,{raw:{width:source.info.width,height:source.info.height,channels:3}})
    .extract({left:Math.round(source.info.width*.06),top:Math.round(source.info.height*.06),width:Math.floor(source.info.width*.88),height:Math.floor(source.info.height*.88)})
    .resize({width:512,height:1024,fit:'inside'}).raw().toBuffer({resolveWithObject:true});
  const TW=texture.info.width,TH=texture.info.height,tex=texture.data;
  const texLinear=Float32Array.from(tex,c=>linear[c]);
  if(name==='silver-metallic') {
   // The catalog photograph has broad highlights. Remove those baked-in lighting
   // gradients before tiling; preserve the grain and average colour, not reflections.
   const blurred=await sharp(tex,{raw:{width:TW,height:TH,channels:3}}).blur(32).raw().toBuffer();
   let average=0;for(let p=0;p<texLinear.length;p+=3)average+=.2126*texLinear[p]+.7152*texLinear[p+1]+.0722*texLinear[p+2];average/=TW*TH;
   for(let p=0;p<texLinear.length;p+=3){const light=.2126*linear[blurred[p]]+.7152*linear[blurred[p+1]]+.0722*linear[blurred[p+2]];const gain=average/Math.max(.08,light);for(let c=0;c<3;c++)texLinear[p+c]=Math.min(1,texLinear[p+c]*gain);}
  }
  const loadMs=performance.now()-loadStart;
  await writeFile(out+'/'+name+'-swatch.png',await sharp(tex,{raw:{width:TW,height:TH,channels:3}}).png().toBuffer());
  function render(){
   const result=Buffer.from(base);
   for(let i=0;i<N;i++){
    const a=alpha[i]/255;if(!a)continue;
    let uu=u[i]%2,vv=(v[i]*2*TW/TH)%2;if(uu<0)uu+=2;if(vv<0)vv+=2;if(uu>1)uu=2-uu;if(vv>1)vv=2-vv;
    const tx=uu*(TW-1),ty=vv*(TH-1),x=Math.floor(tx),y=Math.floor(ty),fx=tx-x,fy=ty-y;
    const p00=(y*TW+x)*3,p10=(y*TW+Math.min(x+1,TW-1))*3,p01=(Math.min(y+1,TH-1)*TW+x)*3,p11=(Math.min(y+1,TH-1)*TW+Math.min(x+1,TW-1))*3;
    const p=i*3;
    for(let c=0;c<3;c++){
     const sample=(texLinear[p00+c]*(1-fx)+texLinear[p10+c]*fx)*(1-fy)+(texLinear[p01+c]*(1-fx)+texLinear[p11+c]*fx)*fy;
     const value=Math.max(0,Math.min(1,sample*shade[i]));
     result[p+c]=Math.round(base[p+c]*(1-a)+lut[Math.round(value*8192)]*a);
    }
   }return result;
  }
  const first=performance.now(),pixels=render(),firstMs=performance.now()-first;
  let outside=0,changed=0;for(let i=0;i<N;i++)if(!alpha[i]){outside++;for(let c=0;c<3;c++)if(base[i*3+c]!==pixels[i*3+c]){changed++;break;}}
  if(changed)throw new Error('Pixels outside selection changed');
  const saveStart=performance.now();await writeFile(out+'/'+name+'.png',await sharp(pixels,{raw:{width:W,height:H,channels:3}}).png().toBuffer());const pngMs=performance.now()-saveStart;
  const samples=[];for(let k=0;k<12;k++){const t=performance.now();render();samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);
  const timing={name,firstRenderMs:round(firstMs),warmMedianMs:round((samples[5]+samples[6])/2),warmMinMs:round(samples[0]),warmMaxMs:round(samples[11]),textureLoadMs:round(loadMs),pngWriteMs:round(pngMs),outsidePixels:outside,changedOutsidePixels:changed};
  report.variants.push(timing);console.log(JSON.stringify(timing));
 }
 await writeFile(out+'/timings.json',JSON.stringify(report,null,2));console.log('Saved',out);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
