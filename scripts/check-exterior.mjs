import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.env.QA_OUTPUT || 'test-results/exterior');
const base=process.env.CHECK_BASE || 'http://localhost:3004';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use a local review server.');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,slowMo:250});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}});
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const events=[];Object.defineProperty(window,'qaEvents',{value:events});const NativeWorker=window.Worker;
 window.Worker=class extends NativeWorker{constructor(url,opt){super(url,opt);this.addEventListener('message',({data:m})=>{
 const e={type:m.type,failed:m.failed,code:m.code,exterior:m.exterior};
 if(m.type==='scene'){window.qaKind={W:m.W,H:m.H,kind:Array.from(m.kind),suggestion:m.suggestion};}
 if(m.type==='region'&&m.mask){let n=0;for(let i=0;i<m.mask.length;i++)if(m.mask[i]&&window.qaKind.kind[i]!==2)n++;e.outsideFacade=n;}
 events.push(e);
 });}};
});
const results={checks:[],errors};
try {
 await page.goto(base+'/third-eye-view?role=architect');
 const v=page.getByRole('region',{name:'Exterior wall visualizer'});await v.scrollIntoViewIfNeeded();
 await expect(v.getByRole('button',{name:'Living room'})).toHaveCount(0);
 await expect(v).toContainText('Interior rooms are not supported');
 await v.getByRole('button',{name:'House front'}).click();
 const began=Date.now();const timer=setInterval(()=>v.locator('.wv-progress').innerText().then(t=>console.log(t.split('\n')[0])).catch(()=>{}),15000);
 try{await expect(v.getByRole('button',{name:'Download the picture'})).toBeEnabled({timeout:240000});}finally{clearInterval(timer)}
 results.secondsToFacade=(Date.now()-began)/1000;
 results.checks.push('Exterior sample accepted and facade automatically selected');
 const canvas=v.locator('canvas');const hash=async()=>createHash('sha256').update(await canvas.screenshot()).digest('hex');
 const before=await hash();await v.getByRole('option',{name:'Wooden',exact:true}).click();await expect.poll(hash).not.toBe(before);
 await canvas.screenshot({path:out+'/exterior-preview.png'});results.checks.push('Material switch visibly changes facade');
 await v.getByRole('slider',{name:'Compare before and after'}).fill('50');await page.screenshot({path:out+'/exterior-comparison.png'});await v.getByRole('slider',{name:'Compare before and after'}).fill('0');
 const pending=page.waitForEvent('download');await v.getByRole('button',{name:'Download the picture'}).click();await(await pending).saveAs(out+'/exterior-preview.jpg');results.checks.push('Comparison and JPEG export');
 const box=await canvas.boundingBox();await canvas.click({position:{x:box.width*.2,y:box.height*.05}});await expect(v.locator('.wv-hint')).toContainText('Choose an exterior');results.checks.push('Sky click cannot add material');
 await expect.poll(()=>page.evaluate(()=>window.qaEvents.some(e=>e.type==='tap-ready')),{timeout:180000}).toBe(true);
 await v.getByRole('button',{name:'Add part',exact:true}).click();
 const pt=await page.evaluate(()=>{const s=window.qaKind;return {x:s.suggestion[0]/s.W,y:s.suggestion[1]/s.H}});
 await canvas.click({position:{x:box.width*pt.x,y:box.height*pt.y}});
 await expect(v.locator('.wv-busy')).toHaveCount(0,{timeout:60000});
 const events=await page.evaluate(()=>window.qaEvents);expect(events.filter(e=>e.type==='region'&&e.outsideFacade>0)).toEqual([]);results.checks.push('Worker additive masks contain no pixels outside the detected facade');
 await v.locator('input[type=file]').setInputFiles(resolve('public/images/interior.jpg'));
 await expect(v.getByRole('alert')).toContainText('Interior rooms are not supported',{timeout:90000});await expect(v.getByRole('button',{name:'Download the picture'})).toBeDisabled();await page.screenshot({path:out+'/interior-rejected.png'});results.checks.push('Interior photo rejected; download disabled');
 await v.getByRole('button',{name:'House front'}).click();await expect(v.getByRole('button',{name:'Download the picture'})).toBeEnabled({timeout:90000});results.checks.push('Exterior retry after rejection works');
 results.pass=true;expect(errors).toEqual([]);
} catch(e){results.pass=false;results.failure=String(e);throw e;}
finally{results.events=await page.evaluate(()=>window.qaEvents).catch(()=>[]);await page.screenshot({path:out+'/final.png'});await context.close();await browser.close();await writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({...results,events:undefined}));}
