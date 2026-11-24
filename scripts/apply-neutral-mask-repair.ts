// Explicit local migration: keep originals, lead records, quotas and expiry unchanged.
import fs from 'node:fs/promises';
import {storeFile} from '../src/lib/cms/storage';
import {patchVisualizerSession} from '../src/lib/visualizer/neutral-server';
const root='/tmp/citybond-neutral-integration-20261124',out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-mask-review';
async function main(){if(!process.argv.includes('--apply'))throw new Error('Pass --apply for this local migration');process.env.CMS_LOCAL_DIR=root;delete process.env.BLOB_STORE_ID;delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.VERCEL;
 await fs.mkdir(out+'/original-bundles',{recursive:true});
 for(const f of (await fs.readdir(root+'/visualizer/results')).filter(f=>f.endsWith('.json')&&!f.includes('.meta.'))){const stem=f.slice(0,8),bytes=await fs.readFile(root+'/visualizer/results/'+f),bundle=JSON.parse(bytes.toString()),repaired=JSON.parse(await fs.readFile(out+'/'+stem+'-repaired-fixture.json','utf8'));
  try{await fs.writeFile(out+'/original-bundles/'+f,bytes,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  await storeFile('visualizer/results/'+f,Buffer.from(JSON.stringify({...bundle,mask:repaired.mask})),'application/json');
  const building='visualizer/images/'+f.replace('.json','-building.png');await storeFile(building,await fs.readFile(out+'/'+stem+'-building.png'),'image/png');await patchVisualizerSession(f.replace('.json',''),{building});console.log(stem,'cached coverage updated');
 }}
void main();
