// Re-run only deterministic preparation against saved provider results; no paid API calls.
import fs from 'node:fs/promises';
import {prepareVisualizerSession,patchVisualizerSession,neutralPipelineVersion,getVisualizerResult,savePreparedPhoto} from '../src/lib/visualizer/neutral-server';
import {writeObject,storeFile} from '../src/lib/cms/storage';
const root='/tmp/citybond-v4-live-20261125',out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-v4-live-ui';
async function main(){process.env.CMS_LOCAL_DIR=root;delete process.env.BLOB_STORE_ID;delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.VERCEL;
 globalThis.fetch=async()=>{throw new Error('Unexpected provider call during local refinement');};
 for(const file of (await fs.readdir(root+'/visualizer/sessions')).filter(f=>f.endsWith('.json')&&!f.includes('.meta.'))){const s=JSON.parse(await fs.readFile(root+'/visualizer/sessions/'+file,'utf8'));if(!s.base||!s.semantic||!s.coarse)continue;
  const before=JSON.parse(await fs.readFile(root+'/visualizer/results/'+file,'utf8'));await writeObject(`visualizer/scenes/${neutralPipelineVersion}/${s.fingerprint}.json`,{expires:0,bundle:before});await patchVisualizerSession(s.id,{status:'queued'});await prepareVisualizerSession(s.id,'no-network');const after=await getVisualizerResult(s.id);
  const preserved={...after,preparationMs:before.preparationMs,timings:{...before.timings,edgeRefinementMs:after.preparationMs}};await storeFile('visualizer/results/'+file,Buffer.from(JSON.stringify(preserved)),'application/json');await savePreparedPhoto(s.fingerprint,preserved);
  const name=after.width===447?'fresh-house':'fresh-courtyard';await fs.writeFile(out+'/'+name+'-bundle.json',JSON.stringify(preserved));console.log(s.id.slice(0,8),after.preparationMs,'ms local refinement');
 }}void main();
