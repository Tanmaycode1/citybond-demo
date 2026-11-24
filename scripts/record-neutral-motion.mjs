// Recorded fixture keeps this UI walkthrough deterministic and makes no paid model calls.
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const out='/Users/tanmayarora/Desktop/freelance work/outputs/citybond-compact-flow-demo';await mkdir(out,{recursive:true});
const fixture=JSON.parse(await readFile('/Users/tanmayarora/Desktop/freelance work/outputs/citybond-v4-final-ui/fresh-courtyard-bundle.json','utf8'));
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:out,size:{width:1440,height:1100}}});const page=await context.newPage();
let finish;
await page.route('**/api/visualizer/**',async r=>{const action=new URL(r.request().url()).pathname.split('/').at(-1);if(action==='session')return r.fulfill({json:{id:'demo'}});if(action==='prepare'){await new Promise(resolve=>{finish=resolve});return r.fulfill({json:{ready:true}});}if(action==='lead')return r.fulfill({json:{reference:'demo-preview'}});if(action==='result')return r.fulfill({json:fixture});return r.abort();});
try{
 await page.goto('http://localhost:3006/visualizer-fast');const region=page.locator('.nv');await region.getByRole('button',{name:'Try a sample',exact:true}).click();await region.locator('.nv-workspace').evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-120,behavior:'instant'}));await page.waitForTimeout(1200);
 await region.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForTimeout(4500);
 const form=region.getByRole('form',{name:'Your details'});
 for(const[name,value]of Object.entries({name:'Aarav Sharma',email:'preview@example.test',phone:'9876543210',city:'Mumbai'})){await form.locator(`[name=${name}]`).pressSequentially(value,{delay:55});await page.waitForTimeout(250);}
 await form.locator('[name=role]').selectOption({index:1});await form.locator('[name=consent]').check();await page.screenshot({path:out+'/loading.png'});await form.getByRole('button',{name:'See my exterior',exact:true}).click();await region.getByRole('button',{name:'Colours',exact:true}).click();await region.locator('input[type=color]').fill('#416a57');await page.waitForTimeout(3500);finish();await expect(region).toHaveAttribute('data-step','result');await page.waitForTimeout(2400);await page.screenshot({path:out+'/revealed.png'});
 await region.getByRole('button',{name:'Colours',exact:true}).click();await region.locator('input[type=color]').fill('#416a57');await page.waitForTimeout(1500);await region.getByRole('slider',{name:'Compare original and preview'}).fill('50');await page.waitForTimeout(1800);
}finally{await context.close();await browser.close();}
