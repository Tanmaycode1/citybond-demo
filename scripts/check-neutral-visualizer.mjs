import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const base=process.env.CHECK_BASE||'http://localhost:3006';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local test server required');
const out=resolve(process.env.QA_OUTPUT||'test-results/neutral-visualizer');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:out,size:{width:1440,height:1100}}}),page=await context.newPage();page.setDefaultTimeout(240000);
const result={checks:[],requests:[],errors:[],switches:[]};page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/visualizer/'))result.requests.push(new URL(r.url()).pathname);});
const region=page.getByRole('region',{name:'Exterior wall visualizer',exact:true});
async function details(){const form=region.getByRole('form',{name:'Your details'});await form.locator('[name=name]').fill('Visualizer QA');await form.locator('[name=email]').fill('neutral-live-'+Date.now()+'@example.test');await form.locator('[name=phone]').fill('1234567890');await form.locator('[name=city]').fill('Test City');await form.locator('[name=role]').selectOption({index:1});await form.locator('[name=consent]').check();return form;}
const digest=async()=>createHash('sha256').update(await region.locator('canvas').evaluate(c=>c.toDataURL())).digest('hex');
try{
 await page.goto(base+'/third-eye-view');await region.scrollIntoViewIfNeeded();
 await expect(region).toHaveAttribute('data-step','photo');await expect(region.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();
 await region.getByRole('button',{name:'Try a sample',exact:true}).click();await expect(region.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();expect(result.requests).toEqual([]);result.checks.push('Photo selection and finish selection do not start AI before Next');
 const created=page.waitForResponse(r=>r.url().endsWith('/api/visualizer/session'));const began=performance.now();await region.getByRole('button',{name:'Continue',exact:true}).click();const session=await(await created).json();result.sessionId=session.id;
 await expect(region).toHaveAttribute('data-step','form');await expect.poll(()=>result.requests.includes('/api/visualizer/prepare')).toBe(true);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(region.locator('canvas')).toHaveCount(0);result.checks.push('Preparation starts behind the form, with image-only loading and no revealed result');
 const locked=await context.request.get(base+'/api/visualizer/result?id='+session.id);expect(locked.status()).toBe(403);result.checks.push('Server refuses the preview before a saved lead');
 await page.screenshot({path:out+'/form-background.png',fullPage:true});
 const form=await details();const saved=page.waitForResponse(r=>r.url().endsWith('/api/visualizer/lead'));await form.getByRole('button',{name:'See my exterior',exact:true}).click();result.lead=await(await saved).json();expect(result.lead.reference).toBeTruthy();
 await expect(region.locator('.nv-image-loading')).toBeVisible({timeout:10000});await page.screenshot({path:out+'/loading.png'});result.checks.push('Remaining processing is covered by image-only animation after lead save');
 await expect(region).toHaveAttribute('data-step','result',{timeout:240000});result.endToEndMs=Math.round(performance.now()-began);await expect(page.getByRole('dialog')).toHaveCount(0);await page.screenshot({path:out+'/desktop.png',fullPage:true});await region.locator('.nv-stage').screenshot({path:out+'/wood.png'});
 const calls=result.requests.length;
 for(const label of ['Marble','Metallic','Wooden']){const before=await digest(),start=performance.now();await region.getByRole('button',{name:new RegExp('^'+label+' ·')}).click();await expect.poll(digest).not.toBe(before);await expect(region.getByRole('button',{name:'Download preview',exact:true})).toBeEnabled();result.switches.push({label,observedMs:Math.round(performance.now()-start),workerMs:Number(await region.getAttribute('data-render-ms'))});}
 await region.getByRole('button',{name:'Colours',exact:true}).click();const before=await digest();await region.locator('input[type=color]').fill('#416a57');await expect.poll(digest).not.toBe(before);await region.locator('.nv-stage').screenshot({path:out+'/green.png'});
 expect(result.requests.length).toBe(calls);result.checks.push('Wood, marble, metallic and custom colour switch locally, with no API requests');
 await region.getByRole('slider',{name:'Compare original and preview'}).fill('50');await expect(region.locator('canvas')).toHaveCSS('clip-path','inset(0px 0px 0px 50%)');await region.locator('.nv-stage').screenshot({path:out+'/compare.png'});result.checks.push('Comparison slider displays original and changed facade');
 const download=page.waitForEvent('download');await region.getByRole('button',{name:'Download preview',exact:true}).click();await(await download).saveAs(out+'/download.png');result.checks.push('PNG download succeeds independently of comparison slider');
 await page.setViewportSize({width:390,height:844});await region.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);result.checks.push('Mobile layout does not overflow');
 // Controlled timing and failure paths use recorded scene data, not additional provider calls.
 const fixture=await context.request.get(base+'/api/visualizer/result?id='+session.id).then(r=>r.json());await writeFile(out+'/fixture.json',JSON.stringify(fixture));
 await page.setViewportSize({width:1440,height:1100});await page.goto(base+'/visualizer-fast');
 let leadFail=true;let prepareCount=0;
 await page.route('**/api/visualizer/**',async route=>{const action=new URL(route.request().url()).pathname.split('/').at(-1);if(action==='session')return route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001'}});if(action==='prepare'){prepareCount++;return route.fulfill({json:{ready:true}});}if(action==='lead')return route.fulfill({status:leadFail?503:200,json:leadFail?{error:'Test storage temporarily unavailable'}:{reference:'qa-saved'}});if(action==='result')return route.fulfill({json:fixture});return route.continue();});
 await region.getByRole('button',{name:'Try a sample',exact:true}).click();await region.getByRole('button',{name:'Continue',exact:true}).click();await expect.poll(()=>prepareCount).toBe(1);await expect(region).toHaveAttribute('data-step','form');await expect(page.getByRole('dialog')).toHaveCount(0);result.checks.push('A finished preparation stays hidden while the user remains on the form');
 const form2=await details();await form2.getByRole('button',{name:'See my exterior',exact:true}).click();await expect(region.getByRole('alert')).toContainText('Test storage');await expect(region).toHaveAttribute('data-step','form');expect(await form2.locator('[name=name]').inputValue()).toBe('Visualizer QA');leadFail=false;
 await form2.getByRole('button',{name:'See my exterior',exact:true}).click();await expect(region).toHaveAttribute('data-step','result');expect(prepareCount).toBe(1);result.checks.push('Lead failure keeps entered values and does not unlock results; retry does not rerun AI');
 await expect(region.getByRole('button',{name:'Download preview',exact:true})).toBeEnabled();
 await region.getByRole('button',{name:'Use another photo',exact:true}).click();await expect(region).toHaveAttribute('data-step','photo');await expect(region.locator('canvas')).toHaveCount(0);result.checks.push('New photo resets the old result and comparison');
 expect(result.errors).toEqual([]);result.checks.push('No browser runtime errors');console.log(JSON.stringify({checks:result.checks.length,endToEndMs:result.endToEndMs,switches:result.switches}));
}catch(e){result.failure=String(e);await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}
finally{await writeFile(out+'/results.json',JSON.stringify(result,null,2));await context.close();await browser.close();console.log('Evidence: '+out);}
