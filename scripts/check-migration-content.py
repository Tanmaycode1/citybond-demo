"""Verify actual server-rendered editorial text and SEO, not React's JSON payload."""
import os,json,re,concurrent.futures
from pathlib import Path
import requests
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT.parent/'outputs/citybond-final-migration/qa'
BASE=os.environ.get('CHECK_BASE','http://localhost:3008')
c=json.loads((ROOT/'src/data/site.json').read_text());paths=json.loads((ROOT/'src/data/canonical-paths.json').read_text())
norm=lambda s:re.sub(r'\s+','',s).replace('/td>','')
boilerplate=['Have a Message For Us?','Use this form to send your message. We will get back within 24 hours.']

def one(item):
 kind,p=item
 route=('/blog/'+p['slug']+'/') if kind=='blog' else paths.get(p['route'],'/'+p['route'])
 r=requests.get(BASE+route,timeout=45);s=BeautifulSoup(r.text,'html.parser')
 for el in s(['script','style']):el.decompose()
 main=s.find('main') or s;actual=norm(main.get_text());missing=[]
 if kind=='blog':
  expected=norm(BeautifulSoup(p['contentHtml'],'html.parser').get_text());body=main.select_one('.article-rich-content')
  if not body or expected!=norm(body.get_text()):missing.append('Article body differs from imported editorial HTML')
 else:
  for text in [p['title'],p['description']]+[t for b in p['blocks'] for t in [b['text'],*b['items'],*[cell for row in b['rows'] for cell in row]]]:
   if text.strip() in boilerplate:continue
   stat=re.match(r'^(\d[\d,.]*\s*\+?)\s+(.+)$',text)
   reordered=stat and norm(stat[2]+stat[1]) in actual
   if norm(text) and norm(text) not in actual and not reordered:missing.append(text[:180])
 title=s.title.get_text() if s.title else ''
 expected_title=p.get('metaTitle','')
 if expected_title and title!=expected_title:missing.append('SEO title mismatch: '+title)
 description=s.find('meta',attrs={'name':'description'})
 if p.get('metaDescription') and (not description or description.get('content')!=p['metaDescription']):missing.append('SEO description mismatch')
 return {'path':route,'status':r.status_code,'kind':kind,'missing':missing,'textPass':not missing}
items=[('page',p) for p in c['originalPages']]+[('blog',p) for p in c['blogs'] if p['kind']=='article']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(one,items))
OUT.mkdir(parents=True,exist_ok=True);(OUT/'content-parity.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
print(json.dumps({'checked':len(results),'passed':sum(p['textPass'] for p in results),'failures':[p for p in results if not p['textPass']]},ensure_ascii=False,indent=2))
if any(not p['textPass'] for p in results):raise SystemExit(1)
