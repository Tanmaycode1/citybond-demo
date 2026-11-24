import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {prepareNeutralScene,renderNeutral} from '../src/lib/visualizer/neutral-renderer.ts';
const base=process.env.CHECK_BASE||'http://localhost:3007';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local server required');
const out=process.env.QA_OUTPUT||'/Users/tanmayarora/Desktop/freelance work/outputs/citybond-v4-live-ui';await mkdir(out,{recursive:true});
const photoRoot='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-mask-review';
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:out,size:{width:1440,height:1100}}}),page=await context.newPage();page.setDefaultTimeout(20000);
const report={runs:[],checks:[],errors:[],requests:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/visualizer/'))report.requests.push(new URL(r.url()).pathname);});
const region=page.locator('.nv'),canvas=region.locator('.nv-stage>canvas:not(.nv-coverage-canvas)');
const digest=async()=>createHash('sha256').update(await canvas.evaluate(c=>c.toDataURL())).digest('hex');
async function download(name){const event=page.waitForEvent('download');await region.getByRole('button',{name:'Download preview',exact:true}).click();await(await event).saveAs(out+'/'+name+'.png');}
async function fill(){const f=region.getByRole('form',{name:'Your details'});for(const[name,value]of Object.entries({name:'Live Quality QA',email:'v4-quality@example.test',phone:'1234567890',city:'Test City'}))await f.locator(`[name=${name}]`).fill(value);await f.locator('[name=role]').selectOption({index:1});await f.locator('[name=consent]').check();await f.getByRole('button',{name:'See my exterior',exact:true}).click();}
async function parity(bundle,name){
 const data=await page.evaluate(async b=>{const decode=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/png');};return{base:await decode(b.base),original:await decode(b.original)};},bundle);
 const raster=async url=>({width:bundle.width,height:bundle.height,data:new Uint8ClampedArray(await sharp(Buffer.from(url.split(',')[1],'base64')).ensureAlpha().raw().toBuffer())});
 const mask=new Uint8Array(await sharp(Buffer.from(bundle.mask.split(',')[1],'base64')).greyscale().raw().toBuffer()),scene=prepareNeutralScene(await raster(data.base),mask);scene.original=await raster(data.original);
 const expected=renderNeutral(scene,{hex:'#9c513b',scale:1,turned:false});const actual=await sharp(out+'/'+name+'.png').ensureAlpha().raw().toBuffer();let different=0,max=0;for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-expected.data[i]);if(d)different++;max=Math.max(max,d);}expect(actual.length).toBe(expected.data.length);expect(max).toBe(0);
 await sharp(expected.data,{raw:{width:bundle.width,height:bundle.height,channels:4}}).png().toFile(out+'/'+name+'-reference.png');return{differentChannels:different,maxChannelDifference:max};
}
try{
 await page.goto(base+'/third-eye-view');let firstBundle;
 for(let i=0;i<3;i++){
  const name=['fresh-house','renamed-house','fresh-courtyard'][i],file=i===2?'a8bad545-original.png':'cf987a0e-original.png';
  await region.getByRole('button',{name:/^Wooden ·/}).click();
  await region.locator('input[type=file]').setInputFiles({name:i===1?'completely-different-name.png':file,mimeType:'image/png',buffer:await readFile(photoRoot+'/'+file)});
  const created=page.waitForResponse(r=>r.url().endsWith('/api/visualizer/session')),returned=page.waitForResponse(r=>r.url().includes('/api/visualizer/result?')&&r.status()===200,{timeout:240000});const started=performance.now();await region.getByRole('button',{name:'Continue',exact:true}).click();const session=await(await created).json();if(!session.id)throw new Error('Session failed: '+JSON.stringify(session));
  expect((await context.request.get(base+'/api/visualizer/result?id='+session.id)).status()).toBe(403);await fill();
  await region.locator('.nv-workspace').evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-60,behavior:'instant'}));
  const response=await returned,bundle=await response.json();await writeFile(out+'/'+name+'-bundle.json',JSON.stringify(bundle));await expect(region).toHaveAttribute('data-step','result',{timeout:30000});await expect(region.getByRole('button',{name:'Download preview',exact:true})).toBeEnabled();
  const run={name,sessionId:session.id,observedMs:Math.round(performance.now()-started),preparationMs:bundle.preparationMs,cached:bundle.cached,timings:bundle.timings,coverage:bundle.coverage};report.runs.push(run);console.log(JSON.stringify(run));
  if(i===1){expect(bundle.cached).toBe(true);expect(bundle.base).toBe(firstBundle.base);expect(bundle.mask).toBe(firstBundle.mask);expect(bundle.preparationMs).toBeLessThan(2000);report.checks.push('Renamed identical photo reuses exactly the same base and mask');}
  else{
   expect(bundle.cached).toBe(process.env.EXPECT_PREPARED==='1');if(i===0)firstBundle=bundle;await download(name+'-wood');await region.locator('.nv-workspace').screenshot({path:out+'/'+name+'-wood-ui.png'});
   const calls=report.requests.length;await region.getByRole('button',{name:'Colours',exact:true}).click();await region.locator('input[type=color]').fill('#9c513b');await expect(region.getByRole('button',{name:'Download preview',exact:true})).toBeEnabled();await page.waitForTimeout(200);await download(name+'-colour');run.parity=await parity(bundle,name+'-colour');report.checks.push(name+': downloaded UI colour matches the reference pixel-for-pixel');
   if(i===0){
    const before=await digest();await region.locator('.nv-adjustments summary').click();await region.getByRole('button',{name:'Adjust wall coverage',exact:true}).click();await region.getByRole('button',{name:'Remove area',exact:true}).click();await region.getByRole('slider',{name:'Brush size',exact:true}).fill('8');
    const editor=region.locator('.nv-coverage-canvas');await editor.scrollIntoViewIfNeeded();const box=await editor.boundingBox(),scale=Math.min(box.width/bundle.width,box.height/bundle.height),x=box.x+(box.width-bundle.width*scale)/2+300*scale,y=box.y+(box.height-bundle.height*scale)/2+240*scale;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+10,y,{steps:6});await page.mouse.up();await expect.poll(digest).not.toBe(before);await expect(region.getByRole('button',{name:'Download preview',exact:true})).toBeEnabled();await region.getByRole('button',{name:'Undo stroke',exact:true}).click();await expect.poll(digest).toBe(before);report.checks.push('Coverage brush edits the real preview and Undo restores identical pixels');
    await region.getByRole('button',{name:'Add wall',exact:true}).click();await page.mouse.move(x,y+30);await page.mouse.down();await page.mouse.move(x+10,y+30,{steps:6});await page.mouse.up();await expect(region.getByRole('button',{name:'Reset coverage',exact:true})).toBeEnabled();await region.getByRole('button',{name:'Reset coverage',exact:true}).click();await expect.poll(digest).toBe(before);await region.getByRole('button',{name:'Done adjusting',exact:true}).click();
   }
   await region.getByRole('slider',{name:'Compare original and preview'}).fill('50');await expect(canvas).toHaveCSS('clip-path','inset(0px 0px 0px 50%)');await region.locator('.nv-stage').screenshot({path:out+'/'+name+'-compare.png'});await region.getByRole('slider',{name:'Compare original and preview'}).fill('0');
   await region.getByRole('button',{name:'Materials',exact:true}).click();await region.getByRole('button',{name:/^Marble ·/}).click();await expect(region.getByRole('button',{name:'Download preview',exact:true})).toBeEnabled();await page.waitForTimeout(200);await download(name+'-marble');expect(report.requests.length).toBe(calls);report.checks.push(name+': material, colour and coverage changes make no API calls');
  }
  if(i<2)await region.getByRole('button',{name:'Use another photo',exact:true}).click();
 }
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await region.locator('.nv-workspace').screenshot({path:out+'/mobile.png'});expect(report.errors).toEqual([]);report.checks.push('Mobile layout and browser runtime checks passed');
}catch(e){report.failure=String(e);await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}
finally{await writeFile(out+'/results.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
