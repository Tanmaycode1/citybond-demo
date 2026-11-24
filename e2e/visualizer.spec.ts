import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const base=process.env.VISUALIZER_BASE;
if(!base || !['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Set VISUALIZER_BASE to the isolated visualizer review server.');

test('Visualizer: invalid uploads, product choices and sample-request routing',async({page},info)=>{
  await page.goto('/third-eye-view?role=architect');
  const visualizer=page.getByRole('region',{name:'Wall visualizer'});
  await expect(visualizer).toBeVisible();
  await expect(visualizer.getByRole('option')).toHaveCount(11);
  await visualizer.locator('input[type=file]').setInputFiles({name:'not-a-photo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA only')});
  await expect(visualizer.getByRole('alert')).toContainText('Please choose a photo');
  await visualizer.locator('input[type=file]').setInputFiles({name:'too-large.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(26*1024*1024)});
  await expect(visualizer.getByRole('alert')).toContainText('larger than 25 MB');
  await visualizer.getByRole('option',{name:'Wooden',exact:true}).click();
  await expect(visualizer.getByRole('option',{name:'Wooden',exact:true})).toHaveAttribute('aria-selected','true');
  await page.screenshot({path:info.outputPath('upload-validation.png')});
  await visualizer.getByRole('link',{name:'Request a sample'}).click();
  await expect(page).toHaveURL(/samples\?product=wooden-series&role=architect/);
  await expect(page.locator('select[name=product]')).toHaveValue('wooden-series');
});

test('Visualizer: real photo, real models, material change, comparison and download',async({page},info)=>{
  test.setTimeout(360_000);
  const network:{method:string;url:string;status?:number;error?:string}[]=[];
  const errors:string[]=[];
  const address=(url:string)=>{const u=new URL(url);return u.origin+u.pathname};
  page.on('request',r=>{if(new URL(r.url()).origin!==base)network.push({method:r.method(),url:address(r.url())})});
  page.on('requestfailed',r=>network.push({method:r.method(),url:address(r.url()),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)network.push({method:r.request().method(),url:address(r.url()),status:r.status()})});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,1200))});
  page.on('pageerror',e=>errors.push(e.message));
  let timer:ReturnType<typeof setInterval>|undefined;
  try{
    await page.addInitScript(() => {
      const events: {type:string;refines?:boolean;failed?:string}[]=[];
      Object.defineProperty(window,'qaVisualizerEvents',{value:events});
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker {
        constructor(url:string|URL, options?:WorkerOptions){super(url,options);this.addEventListener('message',event=>{
          const {type,refines,failed}=event.data;events.push({type,refines,failed});
        });}
      };
    });
    await page.goto('/third-eye-view?role=homeowner');
    const v=page.getByRole('region',{name:'Wall visualizer'});await v.scrollIntoViewIfNeeded();
    await v.locator('input[type=file]').setInputFiles('../citybond-visualizer-review/public/images/interior.jpg');
    const began=Date.now();
    timer=setInterval(()=>{void v.locator('.wv-progress').innerText().then(text=>console.log(`Visualizer ${Math.round((Date.now()-began)/1000)}s: ${text.split('\n')[0]}`)).catch(()=>{})},15000);
    const result=await Promise.race([
      v.locator('.wv-canvas').waitFor({state:'visible',timeout:300000}).then(()=> 'ready'),
      v.locator('.wv-error').waitFor({state:'visible',timeout:300000}).then(()=> 'error'),
    ]);
    if(result==='error')throw new Error(`Real model run failed: ${await v.locator('.wv-error').innerText()} | ${errors.join(' | ')}`);
    console.log(`Visualizer scene ready in ${Math.round((Date.now()-began)/1000)} seconds`);
    await expect(v.getByRole('button',{name:'Download the picture'})).toBeEnabled({timeout:60000});
    const workerEvents=()=>page.evaluate(()=>(window as unknown as {qaVisualizerEvents:{type:string;refines?:boolean;failed?:string}[]}).qaVisualizerEvents);
    await expect.poll(async()=>(await workerEvents()).some(e=>e.type==='tap-ready'),{timeout:180000,intervals:[1000]}).toBe(true);
    await expect.poll(async()=>(await workerEvents()).some(e=>e.type==='region' && e.refines && !e.failed),{timeout:60000,intervals:[1000]}).toBe(true);
    console.log(`Visualizer exact wall refinement completed in ${Math.round((Date.now()-began)/1000)} seconds`);
    await expect(v.locator('.wv-hint')).toContainText('wall edges are exact');
    const canvas=v.locator('canvas');
    const hash=async()=>createHash('sha256').update(await canvas.screenshot()).digest('hex');
    const before=await hash();await v.getByRole('option',{name:'Wooden',exact:true}).click();
    await expect.poll(hash).not.toBe(before);
    await canvas.screenshot({path:info.outputPath('wooden-wall.png')});
    await v.getByRole('slider',{name:'Compare before and after'}).fill('50');
    await page.screenshot({path:info.outputPath('before-after.png')});
    await v.getByRole('slider',{name:'Compare before and after'}).fill('0');
    const pending=page.waitForEvent('download');await v.getByRole('button',{name:'Download the picture'}).click();
    const download=await pending;expect(download.suggestedFilename()).toBe('citybond-wooden-series.jpg');await download.saveAs(info.outputPath('downloaded-preview.jpg'));
    await v.getByRole('button',{name:'Reset',exact:true}).click();await expect(v.getByRole('button',{name:'Download the picture'})).toBeDisabled();
    await v.getByRole('button',{name:'Undo',exact:true}).click();await expect(v.getByRole('button',{name:'Download the picture'})).toBeEnabled();
    await v.getByRole('button',{name:'Reset',exact:true}).click();
    await v.getByRole('button',{name:'Add part',exact:true}).click();
    const box=await canvas.boundingBox();expect(box).toBeTruthy();
    await canvas.click({position:{x:box!.width*.1,y:box!.height*.1}});
    await expect(v.getByRole('button',{name:'Download the picture'})).toBeEnabled({timeout:30000});
    await canvas.screenshot({path:info.outputPath('tap-selected-part.png')});
    expect(network.filter(r=>r.method==='POST')).toEqual([]);
    await writeFile(info.outputPath('worker-events.json'),JSON.stringify(await workerEvents(),null,2));
  }finally{
    if(timer)clearInterval(timer);
    await page.screenshot({path:info.outputPath('final-state.png')}).catch(()=>{});
    await writeFile(info.outputPath('network-and-errors.json'),JSON.stringify({network,errors},null,2));
    await info.attach('Model network and errors',{path:info.outputPath('network-and-errors.json'),contentType:'application/json'});
  }
});
