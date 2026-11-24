import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import seed from "../src/data/site.json";
import {validateContent,enquirySchema} from "../src/lib/cms/schema";
import {cleanArticleHtml} from "../src/lib/cms/rich-text";
import {resolveRoute,sitemapPaths} from "../src/lib/routes";
import {resolveBlog,blogPath} from "../src/lib/blog";
import {renderWebStory} from "../src/lib/blog-story";
const c=validateContent(seed);
test('every successful source address, including all taxonomy URLs, resolves',()=>{
  const urls=readFileSync('content/migration-source-urls.txt','utf8').trim().split(/\n/);
  assert.ok(urls.length>=292);
  for(const url of urls){const u=new URL(url);const path=u.pathname.replace(/^\/+|\/+$/g,'');assert.ok(resolveRoute(path,c)!==null || resolveBlog(path,c,Object.fromEntries(u.searchParams)),url);}
});
test('73 full articles, 29 editable stories and 130 source finishes replace placeholders',()=>{
  assert.equal(c.blogs.filter(p=>p.kind==='article').length,73);assert.equal(c.blogs.filter(p=>p.kind==='story').length,29);
  assert.ok(c.blogs.every(p=>!p.example && p.status==='published'));
  for(const p of c.blogs){assert.ok(p.metaTitle);assert.ok(p.source);assert.ok(p.kind==='story' ? p.storyPages.length>0 : p.contentHtml.length>100);assert.ok(sitemapPaths(c).includes(blogPath(p.slug,p.kind)));}
  assert.equal(c.products.reduce((sum,p)=>sum+p.finishes.length,0),130);
});
test('all migrated images are present at their original public address',()=>{
  const assets=JSON.parse(readFileSync('content/migration-assets.json','utf8')) as {path:string}[];
  assert.equal(assets.length,558);
  for(const asset of assets)assert.ok(existsSync('public'+decodeURIComponent(asset.path)),asset.path);
});
test('rich article markup keeps tables and links while removing active content',()=>{
  const result=cleanArticleHtml('<h1>Title</h1><p onclick="bad()">Body <strong>bold</strong><a href="https://citybond.in/lamio-series">Product</a></p><table><tr><td>Cell</td></tr></table><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><iframe src="https://evil.example"></iframe>');
  assert.ok(result.includes('<h2>Title</h2>'));assert.ok(result.includes('href="/lamio-series"'));assert.ok(result.includes('<td>Cell</td>'));
  assert.ok(!/onclick|onerror|javascript:|<script|<iframe|alert\(1\)/.test(result));
  assert.equal(cleanArticleHtml(result),result);
});
test('known original product and article addresses cannot be accidentally removed',()=>{
  const edited=structuredClone(c);edited.blogs=edited.blogs.slice(1);assert.throws(()=>validateContent(edited),/Required original article URL/);
  const product=structuredClone(c);product.products=product.products.slice(1);assert.throws(()=>validateContent(product),/Required product URL/);
});
test('web story renderer preserves editable slides and escapes unsafe titles',()=>{
  const story=c.blogs.find(p=>p.kind==='story')!;
  const html=renderWebStory({...story,title:'Unsafe <script>alert(1)</script>'},c.site,'https://citybond.in');
  assert.ok(html.includes('<html amp lang="en">'));assert.equal((html.match(/<amp-story-page id=/g)||[]).length,story.storyPages.length);
  assert.ok(html.includes(blogPath(story.slug,'story')));assert.ok(!html.includes('<script>alert(1)</script>'));
});
test('structured enquiry context survives an independently edited message',()=>{
  const value=enquirySchema.parse({name:'Test User',email:'test@example.com',phone:'9999999999',city:'Delhi',role:'Architect',type:'quiz',consent:true,message:'Please call tomorrow',context:{segment:'commercial',application:'exterior',finish:'wood'}});
  assert.equal(value.context.application,'exterior');assert.equal(value.message,'Please call tomorrow');
});
test('older deployed content upgrades once and later owner edits survive subsequent reads',()=>{
  const old=structuredClone(seed) as Record<string,unknown>;
  delete old.sourceRevision;old.blogs=[];old.seoPages=[];old.originalPages=[];
  old.home={...seed.home,title:'Owner-designed homepage'};
  const upgraded=validateContent(old);assert.equal(upgraded.blogs.length,102);assert.equal(upgraded.originalPages.length,62);assert.equal(upgraded.home.title,'Owner-designed homepage');
  upgraded.blogs[0].contentHtml='<p>Owner revised article.</p>';upgraded.products[0].name='Owner product name';
  const reread=validateContent(upgraded);assert.equal(reread.blogs[0].contentHtml,'<p>Owner revised article.</p>');assert.equal(reread.products[0].name,'Owner product name');
});
