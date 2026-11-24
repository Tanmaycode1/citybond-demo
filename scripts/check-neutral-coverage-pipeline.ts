// Exercise the full preparation pipeline with recorded provider responses, without paid calls.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import os from 'node:os';import path from 'node:path';
import {createVisualizerSession,prepareVisualizerSession,saveVisualizerLead,getVisualizerResult,getVisualizerSession} from '../src/lib/visualizer/neutral-server';
const root='/tmp/citybond-neutral-integration-20261124',out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-mask-review';
async function main(){const local=await fs.mkdtemp(path.join(os.tmpdir(),'citybond-coverage-pipeline-'));process.env.CMS_LOCAL_DIR=local;delete process.env.BLOB_STORE_ID;delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.VERCEL;
 const originalFetch=globalThis.fetch;const checks=[];
 try{for(const file of (await fs.readdir(root+'/visualizer/sessions')).filter(f=>f.endsWith('.json')&&!f.includes('.meta.'))){const old=JSON.parse(await fs.readFile(root+'/visualizer/sessions/'+file,'utf8')),stem=old.id.slice(0,8);let calls=0;
  globalThis.fetch=async(_input,init)=>{calls++;const body=JSON.parse(init!.body as string);if(body.model==='muse-image-1.0')return Response.json({status:'completed',output:[{type:'image_generation_call',result:(await fs.readFile(root+'/'+old.base)).toString('base64')}]});const concept=body.input[0].content[0].text,kind=concept==='building'?'building':'coarse';return Response.json({status:'completed',output:[{content:[{type:'output_text',text:await fs.readFile(out+'/'+stem+'-'+kind+'-sam.txt','utf8')}]}]});};
  const {id}=await createVisualizerSession(await fs.readFile(root+'/'+old.source));await prepareVisualizerSession(id,'fixture');assert.equal(calls,3);assert.ok((await getVisualizerSession(id)).building);
  await assert.rejects(getVisualizerResult(id),/submit your details/);await saveVisualizerLead(id,{name:'Coverage QA',email:'coverage@example.test',phone:'1234567890',city:'Test City',role:'Architect',type:'visualiser',product:'wooden-series',message:'Recorded-response coverage test',consent:true,website:''});
  const bundle=await getVisualizerResult(id),actual=Buffer.from(bundle.mask.split(',')[1],'base64'),expected=await fs.readFile(out+'/'+stem+'-mask-repaired.png');assert.deepEqual(actual,expected);
  await prepareVisualizerSession(id,'fixture');assert.equal(calls,3);await fs.writeFile(out+'/'+stem+'-repaired-fixture.json',JSON.stringify(bundle));checks.push({photo:stem,providerCalls:calls,maskMatches:true,leadGate:true,cached:true});
 }await fs.writeFile(out+'/pipeline-checks.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));}finally{globalThis.fetch=originalFetch;await fs.rm(local,{recursive:true,force:true});}}
void main();
