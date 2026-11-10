import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base='http://localhost:3001';
const password=(await readFile(new URL('../.owner-access.txt',import.meta.url),'utf8')).match(/(?:Owner password|Password):\s*(\S+)/i)?.[1];
const login=await fetch(base+'/api/studio/login',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({password})});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(action,data){ const r=await fetch(base+'/api/studio/'+action,{method:data?'POST':'GET',headers:{cookie,origin:base,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});assert.equal(r.status,200,await r.clone().text());return r.json(); }
const original=await api('content');
try {
  const content=structuredClone(original.content);
  content.blogs.push({...content.blogs[0],slug:'local-qa-dynamic-article',title:'Private QA article marker',status:'draft',example:false});
  let state=await api('save',{content,draftEtag:original.draftEtag});
  await api('publish',{draftEtag:state.draftEtag,publishedEtag:original.publishedEtag});
  assert.equal((await fetch(base+'/blog/local-qa-dynamic-article/')).status,404);
  assert.ok(!(await (await fetch(base+'/blog/')).text()).includes('Private QA article marker'));
  assert.ok((await (await fetch(base+'/blog/local-qa-dynamic-article/?preview=1',{headers:{cookie}})).text()).includes('Private QA article marker'));
  state=await api('content'); content.blogs.at(-1).status='published';content.blogs.at(-1).title='Published QA article marker';
  const saved=await api('save',{content,draftEtag:state.draftEtag});
  await api('publish',{draftEtag:saved.draftEtag,publishedEtag:state.publishedEtag});
  const article=await fetch(base+'/blog/local-qa-dynamic-article/',{redirect:'manual'});
  assert.equal(article.status,200);assert.ok((await article.text()).includes('Published QA article marker'));
  assert.ok((await (await fetch(base+'/sitemap.xml')).text()).includes('/blog/local-qa-dynamic-article/'));
  console.log('PASS portal blog create, save, draft privacy, private preview, edit, publish, dynamic URL and sitemap');
} finally {
  const latest=await api('content');
  const restored=await api('save',{content:original.content,draftEtag:latest.draftEtag});
  await api('publish',{draftEtag:restored.draftEtag,publishedEtag:latest.publishedEtag});
}
assert.equal((await fetch(base+'/blog/local-qa-dynamic-article/')).status,404);
console.log('PASS restored original content and removed temporary article');
