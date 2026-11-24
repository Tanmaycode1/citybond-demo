import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {detect,parseMasks,decodeRegionRaster} from '../src/lib/visualizer/fast-server';
const walls=process.argv.includes('--walls'),kind=walls?'coarse':'building';
const root='/tmp/citybond-neutral-integration-20261124';
const out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-mask-review';
async function main(){
 const files=(await fs.readdir(path.join(root,'visualizer/sessions'))).filter(f=>f.endsWith('.json')&&!f.includes('.meta.'));
 const results=await Promise.allSettled(files.map(async file=>{
  const session=JSON.parse(await fs.readFile(path.join(root,'visualizer/sessions',file),'utf8')),stem=session.id.slice(0,8),target=path.join(out,stem+'-'+kind+'.png');
  try{await fs.access(target);return;}catch{}
  const sourceMeta=await sharp(path.join(root,session.source)).metadata();
  const src=await sharp(path.join(root,walls?session.base:session.source)).resize(walls?{width:sourceMeta.width,height:sourceMeta.height,fit:'fill'}:{width:1024,height:1024,fit:'inside'}).png().toBuffer({resolveWithObject:true}),{width,height}=src.info;
  const start=performance.now(),text=await detect('data:image/png;base64,'+src.data.toString('base64'),walls?'exterior wall':'building',process.env.MODEL_API_KEY!);
  await fs.writeFile(path.join(out,stem+'-'+kind+'-sam.txt'),text);
  const mask=new Uint8Array(width*height);
  for(const m of parseMasks(text,width,height)){const data=await decodeRegionRaster(m);for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(data[y*m.width+x])mask[(m.top+y)*width+m.left+x]=255;}
  const meta=await sharp(path.join(root,session.source)).metadata();await sharp(mask,{raw:{width,height,channels:1}}).resize(meta.width,meta.height,{kernel:'nearest'}).png().toFile(target);
  console.log(stem,kind+' mask',Math.round(performance.now()-start),'ms');
 }));for(const r of results)if(r.status==='rejected')console.error(r.reason instanceof Error?r.reason.message:'Mask detection failed');
}
void main();
