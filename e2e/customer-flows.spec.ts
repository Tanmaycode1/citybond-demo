import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import seed from '../src/data/site.json';
import { canonicalHref } from '../src/lib/routes';
const base = process.env.CHECK_BASE || 'http://localhost:3002';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a disposable local content store for mutating QA.');
async function login(page: Page) {
  const password = process.env.QA_PASSWORD || (await readFile('.owner-access.txt', 'utf8')).match(/(?:Owner password|Password):\s*(\S+)/i)![1];
  await page.goto('/studio-7c9e');
  await page.getByLabel('Owner password').fill(password);
  await page.getByRole('button', { name: 'Enter the studio' }).click();
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
}
async function api(page: Page, action: string, data?: unknown) {
  const r = data === undefined ? await page.request.get(`/api/studio/${action}`) : await page.request.post(`/api/studio/${action}`, { data, headers: { origin: base } });
  expect(r.status(), action).toBe(200);
  return r.json();
}
async function fillForm(page: Page, marker: string) {
  await page.getByLabel('Full name', { exact: true }).fill(marker);
  await page.getByLabel('Email address', { exact: true }).fill('qa@example.test');
  await page.getByLabel('Phone number', { exact: true }).fill('9000000000');
  await page.getByLabel('City', { exact: true }).fill('Delhi');
  await page.getByLabel('Tell us about your project', { exact: true }).fill('Recorded local QA; no customer enquiry.');
  await page.getByRole('checkbox').check();
}
test.beforeEach(async ({ context }, info) => {
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `local-qa-${Date.now()}-${info.testId}` });
});

test('Portal: edit text and image, private preview, publish, history, restore, logout', async ({ page }, info) => {
  await login(page);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  await page.getByRole('button',{name:'Publish changes'}).click();
  await expect(page.getByRole('status')).toContainText('Published.');
  const original = await api(page, 'content');
  let changed = false;
  try {
    const homeRecord=original.content.originalPages.find((p: {route: string})=>p.route==='');
    await page.locator('.collection-rows button').filter({hasText:homeRecord.title}).click();
    await page.getByLabel('Title', {exact: true}).fill('CityBond recorded portal test');
    await page.getByRole('button', {name: 'Save draft', exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Draft saved'); changed = true;
    const [preview] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', {name: 'Open draft preview'}).click()]);
    await expect(preview.getByRole('heading', {level:1})).toHaveText('CityBond recorded portal test');
    await expect(preview.locator('.entry-roles a').last()).toHaveCSS('opacity','1');
    await preview.screenshot({path: info.outputPath('private-preview.png')}); await preview.close();
    const publicBefore = await page.request.get('/'); expect(await publicBefore.text()).not.toContain('<h1>CityBond recorded portal test</h1>');
    await page.getByLabel('Content section',{exact:true}).selectOption('home');
    const image = page.locator('label.image-field').filter({has:page.getByText('Image',{exact:true})}).first();
    const upload = page.waitForResponse(r=>r.url().endsWith('/api/studio/upload') && r.request().method()==='POST');
    await image.locator('input[type=file]').setInputFiles('public/citybond/logo.webp');
    expect((await upload).status()).toBe(200);
    await page.getByRole('button', {name:'Save draft',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Draft saved');
    await page.getByRole('button', {name:'Publish changes'}).click();
    await expect(page.getByRole('status')).toContainText('Published.');
    const live = await page.context().newPage(); await live.goto('/');
    await expect(live.getByRole('heading',{level:1})).toHaveText('CityBond recorded portal test');
    await expect(live.locator('.entry-visual > img')).toHaveAttribute('src', /^\/api\/media\//);
    await live.close();
    await page.locator('.portal-sidebar').getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByLabel('Content section',{exact:true}).selectOption('history');
    await expect(page.getByRole('button',{name:'Restore to draft'}).first()).toBeVisible();
    await page.screenshot({path:info.outputPath('publish-history.png')});
    page.once('dialog', d=>d.accept());
    await page.getByRole('button',{name:'Restore to draft'}).nth(1).click();
    await expect(page.getByRole('status')).toContainText('Revision restored');
  } finally {
    if(changed) {
      const state=await api(page,'content'); const draft=await api(page,'save',{content:original.content,draftEtag:state.draftEtag});
      await api(page,'publish',{draftEtag:draft.draftEtag,publishedEtag:state.publishedEtag});
    }
  }
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByLabel('Owner password')).toBeVisible();
  expect((await page.request.get('/api/studio/content')).status()).toBe(401);
});

test('Blog: add draft, publish a dynamic article, then restore', async ({page},info)=>{
  await login(page); const original=await api(page,'content'); let changed=false;
  try {
    await page.locator('.portal-sidebar').getByRole('button',{name:'Journal',exact:true}).click();
    await page.getByRole('button',{name:'Add article',exact:true}).click();
    const article=page.locator('.collection-detail');
    await article.getByLabel('Slug',{exact:true}).fill('recorded-qa-article');
    await article.getByLabel('Title',{exact:true}).first().fill('Recorded QA article');
    await article.getByLabel('Description',{exact:true}).fill('A temporary local article to verify dynamic routing.');
    await page.getByRole('button',{name:'Save draft',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Draft saved'); changed=true;
    expect((await page.request.get('/blog/recorded-qa-article/')).status()).toBe(404);
    await article.getByRole('combobox',{name:'Status',exact:true}).selectOption('published');
    await page.getByRole('button',{name:'Publish changes'}).click();
    await expect(page.getByRole('status')).toContainText('Published.');
    const live=await page.context().newPage();await live.goto('/blog/recorded-qa-article/');
    await expect(live.getByRole('heading',{level:1})).toHaveText('Recorded QA article');
    await live.screenshot({path:info.outputPath('published-blog.png')});await live.close();
  }finally{if(changed){const s=await api(page,'content');const d=await api(page,'save',{content:original.content,draftEtag:s.draftEtag});await api(page,'publish',{draftEtag:d.draftEtag,publishedEtag:s.publishedEtag});}}
  expect((await page.request.get('/blog/recorded-qa-article/')).status()).toBe(404);
});

for(const item of [
  {name:'contact',path:'/contact?role=contractor',role:'Contractor'},
  {name:'dealer',path:'/dealership',role:'Dealer / distributor'},
  {name:'sample',path:'/samples?product=metallic-series&role=architect',role:'Architect'},
  {name:'career',path:'/career',role:''},
]) test(`Form: ${item.name} submission reaches the private inbox`,async({page},info)=>{
  await page.goto(item.path); const marker=`QA ${item.name} ${Date.now()}`;
  await fillForm(page,marker);
  if(item.role)await expect(page.getByRole('combobox',{name:'I am a',exact:true})).toHaveValue(item.role);
  else await expect(page.getByRole('combobox',{name:'I am a',exact:true})).toHaveCount(0);
  if(item.name==='sample')await expect(page.getByRole('combobox',{name:'Preferred collection',exact:true})).toHaveValue('metallic-series');
  if(item.name==='career')await page.locator('input[type=file]').setInputFiles({name:'qa-cv.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% Local QA CV attachment only\n%%EOF')});
  await page.getByRole('button',{name:'Send your request'}).click();
  await expect(page.getByRole('status')).toContainText('Your request has been received');
  await page.screenshot({path:info.outputPath('submission-confirmation.png')});
  await login(page);await page.locator('.portal-sidebar').getByRole('button',{name:'Enquiries',exact:true}).click();
  await page.locator('.enquiry-item summary').filter({hasText:marker}).click();
  await expect(page.locator('.enquiry-item[open]')).toContainText(item.name);
  const enquiries=(await api(page,'enquiries')).enquiries; const saved=enquiries.find((e:{name:string})=>e.name===marker);
  expect(saved.type).toBe(item.name);expect(saved.source).toBe(new URL(item.path,base).pathname);expect(saved.reference).toMatch(/^[a-f0-9]{8}$/);
  if(item.name==='sample')expect(saved.product).toBe('metallic-series');
  if(['career','visualiser'].includes(item.name)){
    const download=await page.request.get(`/api/studio/attachment?key=${saved.attachment}`);expect(download.status()).toBe(200);
    expect((await page.request.get('/api/media/'+saved.attachment.split('/').at(-1))).status()).toBe(404);
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    expect((await page.request.get(`/api/studio/attachment?key=${saved.attachment}`)).status()).toBe(401);
  }else await page.screenshot({path:info.outputPath('private-inbox.png')});
});

test('Quiz: use-case and role are saved before a clickable shortlist is revealed',async({page},info)=>{
  await page.goto('/product-finder?role=homeowner');
  await page.getByRole('button',{name:'Commercial',exact:false}).click();
  await page.getByRole('button',{name:'Continue',exact:false}).click();
  await page.getByRole('button',{name:'Signage & brand identity',exact:false}).click();
  await page.getByRole('button',{name:'Continue',exact:false}).click();
  await page.getByRole('button',{name:'Refined & metallic',exact:false}).click();
  await page.getByRole('button',{name:'Continue',exact:false}).click();
  await expect(page.getByRole('heading',{name:'See your product shortlist'})).toBeVisible();
  const marker=`QA quiz ${Date.now()}`;await fillForm(page,marker);
  await expect(page.getByRole('combobox',{name:'Preferred collection',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Send your request'}).click();
  await expect(page.getByRole('heading',{name:'Your material starting point.'})).toBeVisible();
  await page.screenshot({path:info.outputPath('quiz-results.png')});
  await page.locator('.product-grid a').first().click();await expect(page).toHaveURL(/metallic-series.*role=homeowner/);
  await login(page);const e=(await api(page,'enquiries')).enquiries.find((e:{name:string})=>e.name===marker);
  expect(e.role).toBe('Homeowner');expect(e.useCase).toBe('Commercial / Signage & brand identity / Refined & metallic');
});

test('Form: invalid phone and failed network retain input and allow retry',async({page},info)=>{
  await page.goto('/contact?role=contractor');await fillForm(page,'QA retry');
  await page.getByLabel('Phone number',{exact:true}).fill('-------');
  await page.getByRole('button',{name:'Send your request'}).click();
  await expect(page.locator('.enquiry-form').getByRole('alert')).toContainText('highlighted');
  await expect(page.getByLabel('Phone number',{exact:true})).toBeFocused();
  await expect(page.getByText('Enter a valid phone number with at least 7 digits.')).toBeVisible();
  await page.getByLabel('Phone number',{exact:true}).fill('9000000000');
  await page.route('**/api/enquiries',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test failure. Please retry.'})}));
  await page.getByRole('button',{name:'Send your request'}).click();
  await expect(page.locator('.enquiry-form').getByRole('alert')).toContainText('Please retry');
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('QA retry');
  await page.screenshot({path:info.outputPath('retry-with-values-preserved.png')});
  await page.unroute('**/api/enquiries');await page.getByRole('button',{name:'Send your request'}).click();
  await expect(page.getByRole('status')).toContainText('Your request has been received');
});

for(const role of seed.roles)test(`Customer journey: ${role.label}`,async({page},info)=>{
  await page.goto('/');await page.locator('.entry-roles').getByRole('link').filter({hasText:role.label}).click();
  const expected=role.id==='architect'?'/architects':`/for/${role.id}`;await expect(page).toHaveURL(new RegExp(expected+'$'));
  await expect(page.locator('.audience-hero')).toContainText(role.label);
  const sections=await page.locator('[data-journey-section]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-journey-section')));
  expect(sections).toEqual(role.sections.filter(s=>s!=='contact'));
  await page.screenshot({path:info.outputPath(`${role.id}-entry.png`)});
  for(const section of role.sections.filter(s=>!['contact','testimonials'].includes(s))){await page.locator(`[data-journey-section="${section}"]`).scrollIntoViewIfNeeded();}
  await page.locator('.audience-hero').getByRole('link',{name:role.cta.label,exact:false}).click();
  await expect(page).toHaveURL(url => url.pathname === canonicalHref(role.cta.href));
  expect(new URL(page.url()).searchParams.get('role')).toBe(role.id);
  if(await page.locator('select[name=role]').count())await expect(page.locator('select[name=role]')).toHaveValue(role.label);
  await page.screenshot({path:info.outputPath(`${role.id}-next-step.png`)});
});

test('Mobile: Explore, role entry and contact form fit a narrow screen',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Explore CityBond'}).click();
  await expect(page.locator('#home-discovery')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(100);
  await page.screenshot({path:info.outputPath('mobile-explore.png')});
  await page.goto('/contact?role=contractor');await fillForm(page,'QA mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Send your request'}).click();await expect(page.getByRole('status')).toContainText('Your request has been received');
  await page.screenshot({path:info.outputPath('mobile-form.png')});
});

test('Palette categories expose every product across customer journeys', async ({page}) => {
  await login(page);
  const {content} = await api(page, 'content');
  const productsInPortal: typeof seed.products = content.products;
  const categories = [...new Set(productsInPortal.map(product => product.category))];
  for (const role of seed.roles) {
    await page.goto(`/for/${role.id}`);
    const palette = page.locator('.audience-products');
    await palette.scrollIntoViewIfNeeded();
    for (const category of categories) {
      const filter = palette.getByRole('button', {name: new RegExp(`^${category}`)});
      await filter.click();
      await expect(filter).toHaveAttribute('aria-pressed', 'true');
      const products = productsInPortal.filter(product => product.category === category);
      await expect(palette.locator('.palette-card')).toHaveCount(products.length);
      for (const product of products) {
        const href = await palette.locator('.palette-card').filter({has: page.getByRole('heading', {name: product.name, exact: true})}).getAttribute('href');
        const destination = new URL(href!, base);
        expect(destination.pathname).toBe(canonicalHref(`/products/${product.slug}`));
        expect(destination.searchParams.get('role')).toBe(role.id);
      }
    }
    // A one-product category uses the full gallery width, rather than an empty grid.
    const gallery = await palette.locator('.palette-gallery').boundingBox();
    const card = await palette.locator('.palette-card').first().boundingBox();
    expect(card!.width).toBeGreaterThan(gallery!.width * .95);
  }
});

test('Enquiry and palette layouts adapt to mobile and reduced motion', async ({page}, info) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({width, height: 1000});
    await page.goto('/for/dealer');
    const form = page.locator('.audience-enquiry .enquiry-form');
    await form.scrollIntoViewIfNeeded();
    const section = await page.locator('.audience-enquiry').boundingBox();
    const formBox = await form.boundingBox();
    expect(formBox!.width).toBeGreaterThan(section!.width * .95);
    for (const control of await form.locator('input:not([name="website"]), select, textarea, button').all()) {
      const box = await control.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    await expect(form.locator('.surface-wave').first()).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await form.screenshot({path:info.outputPath(`enquiry-${width}.png`)});
    await page.locator('.audience-products').scrollIntoViewIfNeeded();
    await page.locator('.audience-products').screenshot({path:info.outputPath(`palette-${width}.png`)});
  }
});
