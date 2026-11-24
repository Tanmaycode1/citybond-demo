import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=process.env.CHECK_BASE||'http://localhost:3006';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use local review only');
const out=resolve(process.env.QA_OUTPUT||'test-results/quality-visualizer'); await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:out,size:{width:1440,height:1100}}});
const page=await context.newPage();page.setDefaultTimeout(210000);
const errors=[], calls=[], results={checks:[],renders:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/visualizer/render'))calls.push(Date.now());});
const region=page.getByRole('region',{name:'Exterior wall visualizer',exact:true});
async function render(action,name){
 const pending=page.waitForResponse(r=>r.url().endsWith('/api/visualizer/render'));
 const start=performance.now();await action();const response=await pending;const body=await response.json();
 if(!response.ok())throw new Error(JSON.stringify({status:response.status(),...body}));
 await expect(region).toHaveAttribute('data-status','ready');
 await page.locator('.qv-result').evaluate(img=>img.decode());
 await writeFile(out+'/'+name+'.png',Buffer.from(body.image.split(',')[1],'base64'));
 const original=await page.locator('.qv-image>img').first().getAttribute('src');await writeFile(out+'/'+name+'-original.jpg',Buffer.from(original.split(',')[1],'base64'));
 await page.locator('.qv-stage').screenshot({path:out+'/'+name+'-stage.png'});
 results.renders.push({name,wallMs:Math.round(performance.now()-start),renderMs:body.renderMs,width:body.width,height:body.height,cached:body.cached});console.log(JSON.stringify(results.renders.at(-1)));
}
try{
 await page.goto(base+'/visualizer-fast');
 await expect(page.getByRole('button',{name:'Realistic render',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Download render',exact:true})).toBeDisabled();
 await render(()=>page.getByRole('button',{name:'House front',exact:true}).click(),'modern-wood');
 results.checks.push('Default mode uses real server-rendered material, not the flat texture overlay');
 await page.screenshot({path:out+'/desktop.png',fullPage:true});
 await page.getByRole('slider',{name:'Compare original and render'}).fill('100');
 await expect(page.locator('.qv-result')).toHaveCSS('clip-path','inset(0px 0px 0px 100%)');
 await page.getByRole('slider',{name:'Compare original and render'}).fill('0');results.checks.push('Original/render comparison works');
 const pendingDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download render',exact:true}).click();await(await pendingDownload).saveAs(out+'/download.png');results.checks.push('PNG export works');
 const before=calls.length;
 await page.getByRole('button',{name:/^Marble ·/}).click();
 await expect(page.locator('.qv-result')).toHaveCount(0);await expect(page.getByRole('button',{name:'Download render',exact:true})).toBeDisabled();
 expect(calls.length).toBe(before);results.checks.push('Changing finish hides stale render and does not spend automatically');
 await render(()=>page.getByRole('button',{name:'Render this finish',exact:true}).click(),'modern-marble');
 const after=calls.length;await page.getByRole('button',{name:/^Wooden ·/}).click();await expect(region).toHaveAttribute('data-status','ready');expect(calls.length).toBe(after);results.checks.push('Reopening a rendered finish needs no AI request');
 await render(()=>page.getByRole('button',{name:'Hillside house',exact:true}).click(),'hillside-wood');
 results.checks.push('A second exterior photograph renders');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);results.checks.push('Mobile viewport has no horizontal overflow');
 await page.setViewportSize({width:1440,height:1100});
 await page.route('**/api/visualizer/render',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Rendering service unavailable. Please retry.'})}));
 await page.getByRole('button',{name:/^Marble ·/}).click();await page.getByRole('button',{name:'Render this finish',exact:true}).click();
 await expect(region.getByRole('alert')).toContainText('Please retry');await expect(page.getByRole('button',{name:'Download render',exact:true})).toBeDisabled();
 await page.unroute('**/api/visualizer/render');await page.getByRole('button',{name:/^Wooden ·/}).click();await expect(region).toHaveAttribute('data-status','ready');results.checks.push('Provider failure exposes retry; no stale download; saved finish recovers');
 await page.getByRole('button',{name:'Quick material study',exact:true}).click();await expect(page.getByRole('region',{name:'Fast exterior wall visualizer',exact:true})).toBeVisible();results.checks.push('Quick study remains available separately');
 expect(errors).toEqual([]);
 results.calls=calls.length;results.checks.push('No browser runtime errors');
}catch(e){results.failure=String(e);await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}
finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));await context.close();await browser.close();console.log('Results: '+out);}
