import fs from 'node:fs/promises';
import sharp from 'sharp';
import {refineNeutralMask,prepareNeutralScene,renderNeutral,type NeutralRaster} from '../src/lib/visualizer/neutral-renderer';
const root='/tmp/citybond-neutral-integration-20261124',out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-mask-review';
async function main(){
 const files=(await fs.readdir(root+'/visualizer/sessions')).filter(f=>f.endsWith('.json')&&!f.includes('.meta.'));
 for(const f of files){
  const s=JSON.parse(await fs.readFile(root+'/visualizer/sessions/'+f,'utf8')),stem=s.id.slice(0,8),bundle=JSON.parse(await fs.readFile(root+'/visualizer/results/'+f,'utf8')),W=bundle.width,H=bundle.height;
  const raster=async(input:string|Buffer):Promise<NeutralRaster>=>({width:W,height:H,data:new Uint8ClampedArray(await sharp(input).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer())});
  const original=await raster(root+'/'+s.source),base=await raster(root+'/'+s.base),oldBase=await raster(Buffer.from(bundle.base.split(',')[1],'base64'));
  const oldMask=new Uint8Array(await sharp(Buffer.from(bundle.mask.split(',')[1],'base64')).greyscale().raw().toBuffer()),building=new Uint8Array(await sharp(out+'/'+stem+'-building.png').greyscale().raw().toBuffer());
  const coarse=new Uint8Array(await sharp(out+'/'+stem+'-coarse.png').greyscale().raw().toBuffer());
  const start=performance.now(),mask=refineNeutralMask(original,base,coarse,building),restored=base,before=renderNeutral(prepareNeutralScene(oldBase,oldMask),{hex:'#9c513b',scale:1,turned:false}),after=renderNeutral(prepareNeutralScene(restored,mask),{hex:'#9c513b',scale:1,turned:false});
  const png=(r:NeutralRaster)=>sharp(r.data,{raw:{width:W,height:H,channels:4}}).png().toBuffer();
  const layers=[];for(const [i,r]of [original,before,after].entries())layers.push({input:await sharp(await png(r)).resize(480,480,{fit:'contain',background:'#eeeeee'}).png().toBuffer(),left:i*480,top:0});
  await sharp({create:{width:1440,height:480,channels:3,background:'#eeeeee'}}).composite(layers).png().toFile(out+'/'+stem+'-repair-comparison.png');
  await sharp(mask,{raw:{width:W,height:H,channels:1}}).png().toFile(out+'/'+stem+'-mask-repaired.png');await fs.writeFile(out+'/'+stem+'-base-restored.png',await png(restored));await fs.writeFile(out+'/'+stem+'-preview-repaired.png',await png(after));
  const stats={oldWallPixels:oldMask.reduce((n,v)=>n+(v>128?1:0),0),newWallPixels:mask.reduce((n,v)=>n+(v>128?1:0),0),localMs:Math.round(performance.now()-start)};
  await fs.writeFile(out+'/'+stem+'-stats.json',JSON.stringify(stats,null,2));console.log(stem,stats);
 }
}
void main();
