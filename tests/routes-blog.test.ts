import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import seed from "../src/data/site.json";
import { validateContent } from "../src/lib/cms/schema";
import { canonicalHref, resolveRoute, sitemapPaths } from "../src/lib/routes";
import { resolveBlog, blogPagePath } from "../src/lib/blog";
const c = validateContent(seed);
const urls = readFileSync(new URL('../content/required-urls.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);
test('all 69 supplied non-blog addresses resolve without renaming', () => {
  const pages = urls.filter(u => !new URL(u).pathname.startsWith('/blog/'));
  assert.equal(pages.length,69);
  for(const u of pages) assert.notEqual(resolveRoute(new URL(u).pathname,c),null,u);
  assert.equal(resolveRoute('not-a-city',c),null);
});
test('public links preserve legacy spellings, suffixes, queries and fragments', () => {
  for(const [from,to] of [['/products/lamio-series','/lamio-series'],['/products/metacity','/metacity/'],['/about/clientele#client','/corporate#client'],['/resources/growth-magazine','/download-our-quatarly-acp-magazine'],['/blog/page/2?post_type=web-story','/blog/page/2/?post_type=web-story'],['/thank-you','/thankyou.php']]) assert.equal(canonicalHref(from),to);
});
test('blog pagination, archives and empty legacy pages use one template', () => {
  const first=resolveBlog('blog',c), second=resolveBlog('blog/page/2',c);
  assert.ok(first?.kind==='index' && second?.kind==='index');
  assert.equal(first.total,4); assert.equal(first.posts.length,2);
  assert.equal(second.posts.length,2);
  assert.ok(!first.posts.some(a=>second.posts.some(b=>a.slug===b.slug)));
  for(const path of ['blog/page/7','blog/page/9','blog/author/b-k-narayanan/page/7','blog/2023/05','blog/web-stories/page/2']) {
    const view=resolveBlog(path,c); assert.ok(view?.kind==='index',path); assert.equal(view.posts.length,0);
  }
  const author=resolveBlog('blog/author/citybond-editorial',c);
  assert.ok(author?.kind==='index'); assert.equal(author.total,4);
  assert.equal(resolveBlog('blog/page/0',c),null);
  assert.equal(resolveBlog('blog/unprovided-legacy-article',c),null);
  assert.equal(blogPagePath('/blog/',2,'?post_type=we'),'/blog/page/2/?post_type=we');
});
test('portal-created posts route dynamically; drafts remain private and examples stay out of sitemap',()=>{
  const edited=structuredClone(c);
  edited.blogs.push({...edited.blogs[0],slug:'owner-new-article',title:'Owner title',example:false,status:'draft'});
  assert.equal(resolveBlog('blog/owner-new-article',edited),null);
  assert.equal(resolveBlog('blog/owner-new-article',edited,{},true)?.kind,'post');
  assert.ok(!sitemapPaths(edited).includes('/blog/owner-new-article/'));
  edited.blogs.at(-1)!.status='published';
  assert.equal(resolveBlog('blog/owner-new-article',validateContent(edited))?.kind,'post');
  assert.ok(sitemapPaths(edited).includes('/blog/owner-new-article/'));
  assert.ok(!sitemapPaths(edited).some(p=>p.includes('sample-')));
  edited.blogs.push(edited.blogs[0]); assert.throws(()=>validateContent(edited),/Duplicate/);
});
test('older content gains required pages and editable navigation without losing owner copy',()=>{
  const old=structuredClone(seed) as Record<string, any>;
  delete old.routeRevision; delete old.blog; delete old.blogs;
  old.pages=old.pages.slice(0,18); old.home.title='Owner headline';
  const migrated=validateContent(old);
  assert.equal(migrated.home.title,'Owner headline');
  assert.equal(migrated.pages.length,seed.pages.length);
  assert.equal(migrated.blogs.length,4);
  assert.ok(migrated.site.nav[0].children.length>10);
});
