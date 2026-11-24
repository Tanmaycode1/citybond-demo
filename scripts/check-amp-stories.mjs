import validator from 'amphtml-validator';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.CHECK_BASE || 'http://localhost:3008';
const c=JSON.parse(await readFile('src/data/site.json','utf8'));
const instance=await validator.getInstance();
const results=[];
for(const story of c.blogs.filter(p=>p.kind==='story')){
 const r=await fetch(base+'/blog/web-stories/'+story.slug+'/');const result=instance.validateString(await r.text());results.push({slug:story.slug,status:result.status,errors:result.errors.filter(e=>e.severity==='ERROR').map(e=>({line:e.line,message:e.message}))});
}
await writeFile('../outputs/citybond-final-migration/qa/amp-validation.json',JSON.stringify(results,null,2));
const failures=results.filter(r=>r.status!=='PASS');console.log(JSON.stringify({checked:results.length,failures},null,2));if(failures.length)process.exitCode=1;
