import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.CHECK_BASE||'http://localhost:3001';
const urls=(await readFile(new URL('../content/required-urls.txt',import.meta.url),'utf8')).trim().split(/\r?\n/);
const result=[];
for(let i=0;i<urls.length;i+=6) {
  const rows=await Promise.all(urls.slice(i,i+6).map(async url=>{
    const u=new URL(url), path=u.pathname+u.search;
    const r=await fetch(base+path,{redirect:'manual'}), html=await r.text();
    const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]||'';
    const blog=u.pathname.startsWith('/blog/');
    if(!blog) {assert.equal(r.status,200,path); assert.ok(html.includes('<h1'),path);}
    assert.ok(!html.includes('Application error'),path);
    return {url,path,status:r.status,location:r.headers.get('location'),canonical,blog,title:html.match(/<title>(.*?)<\/title>/)?.[1]||'',noindex:html.includes('noindex')};
  })); result.push(...rows);
}
await writeFile(process.env.AUDIT_OUTPUT||'/tmp/citybond-coverage-20261017/after.json',JSON.stringify({base,checkedAt:new Date().toISOString(),rows:result},null,2));
console.log(JSON.stringify({total:result.length,nonBlog:result.filter(r=>!r.blog).length,nonBlog200:result.filter(r=>!r.blog&&r.status===200).length,blog200:result.filter(r=>r.blog&&r.status===200).length,blogPending:result.filter(r=>r.blog&&r.status===404).length}));
