#!/usr/bin/env python3
"""Owner-authorized import from the captured CityBond snapshot, no network writes.
Raw evidence remains in outputs/citybond-final-migration/source. All public media
is copied at its original path so image backlinks survive the eventual cutover.
"""
import json, pathlib, shutil, re, hashlib
from urllib.parse import urlsplit, unquote, quote, urljoin
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parent.parent
SOURCE=ROOT.parent/'outputs/citybond-final-migration/source'
read=lambda name:json.loads((SOURCE/name).read_text())
c=json.loads((ROOT/'src/data/site.json').read_text())
assets=read('assets.json');asset_map={}
for a in assets:
 if a['status']!=200: continue
 path=urlsplit(a['sourceUrl']).path
 # Constrain the copied source paths to the public content tree.
 relative=pathlib.Path(unquote(path).lstrip('/'))
 if '..' in relative.parts:raise ValueError(path)
 dest=ROOT/'public'/relative;dest.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(a['localPath'],dest)
 local=quote('/'+str(relative),safe='/-._~')
 asset_map[a['sourceUrl']]=local
 asset_map[a['resolvedUrl']]=local

def local(url):
 if not url:return ''
 if url in asset_map:return asset_map[url]
 u=urlsplit(url)
 if u.hostname in ['citybond.in','www.citybond.in']:return quote(unquote(u.path),safe='/-._~')+('?' +u.query if u.query else '')+('#'+u.fragment if u.fragment else '')
 return url.replace('http://','https://',1)

def body(html):
 soup=BeautifulSoup(html,'html.parser')
 for el in soup(['script','style','noscript']):el.decompose()
 for el in soup.find_all(True):
  for attr in ['src','href','poster']:
   if el.get(attr):el[attr]=local(urljoin('https://citybond.in/blog/',el[attr]))
 return str(soup)

blogs=[]
for kind,name in [('article','blogs.json'),('story','stories.json')]:
 for p in read(name):
  cats=p['categories'];cat=cats[0] if cats else {'name':'Web stories','slug':'web-stories'}
  story_pages=[{'id':x['id'],'contentHtml':body(x['contentHtml']),'image':local(x['images'][0]['url']) if x['images'] else '', 'imageAlt':x['images'][0]['alt'][:2000] if x['images'] else '', 'href':local(x['links'][0]['href']) if x.get('links') else ''} for x in p.get('storyPages',[])]
  blogs.append({'kind':kind,'sourceId':p['id'],'slug':p['slug'],'title':p['title'],'description':p['excerpt'],'metaTitle':p['metaTitle'],'metaDescription':p['metaDescription'],'image':local(p['featuredImage']),'imageAlt':p['featuredImageAlt'][:300],'author':p['author'],'authorSlug':p['authorSlug'],'category':cat['name'],'categorySlug':cat['slug'],'categories':[{'name':x['name'],'slug':x['slug']} for x in cats],'tags':[{'name':x['name'],'slug':x['slug']} for x in p['tags']],'publishedAt':p['date'][:10],'modifiedAt':p['modified'],'status':'published','example':False,'contentHtml':body(p['contentHtml']) if kind=='article' else '', 'storyPages':story_pages,'body':[],'source':p['sourceUrl']})
# Retain real editor-created posts, remove demo articles and replace known source slugs.
keys={(p['kind'],p['slug']) for p in blogs}
c['blogs']=[p for p in c['blogs'] if not p.get('example') and (p.get('kind','article'),p['slug']) not in keys]+blogs
c['blog']['postsPerPage']=8
c['blog']['title']='Blogs & Updates'
main_images={x['exactPath']:x['images'] for x in read('main-images.json')}
products={x['exactPath'].strip('/'):x for x in read('products.json') if x['exactPath']!='/hpl-series'}
for product in c['products']:
 p=products.get(product['slug'])
 if not p:continue
 imgs=main_images.get('/'+product['slug'],main_images.get('/'+product['slug']+'/',[]))
 if imgs:product['image']=local(imgs[0]['url']);product['imageAlt']=imgs[0]['alt'][:300]
 if p['shades']:
  product['finishes']=[{'name':x['name'],'image':local(x['image']),'hex':'#b3aa91'} for x in p['shades']]
# Descriptive source images for the original company/information pages.
paths=json.loads((ROOT/'src/data/canonical-paths.json').read_text())
for page in c['pages']:
 path=paths.get(page['slug'],'/'+page['slug']);imgs=main_images.get(path,[])
 if imgs and page['slug'] not in ['visualiser','contact','careers','become-a-dealer','network']:
  page['image']=local(imgs[0]['url']);page['imageAlt']=imgs[0]['alt'][:300]
for r in c['resources']:
 if r['type']=='article':r['href']=local(r['href'])
 if r['type'] in ['catalogue','magazine']:r['href']=''
 imgs=main_images.get(paths.get('resources/'+r['slug'],''),[])
 if imgs:r['image']=local(imgs[0]['url']);r['imageAlt']=imgs[0]['alt'][:300]
# Exact source testimonials and partner marks are already identified in captured main DOM.
home=next(x for x in read('original-copy.json')['records'] if x['exactPath']=='/')
blocks=home['blocks'];start=next(i for i,b in enumerate(blocks) if b['text']=='Success Stories');end=next(i for i,b in enumerate(blocks[start+1:],start+1) if b['type']=='heading')
t=blocks[start+1:end]
if len(t)>=4:
 c['testimonials']=[{'quote':t[i]['text'],'name':t[i+1]['text'].split(',')[0],'company':t[i+1]['text'],'image':'','imageAlt':'','source':'https://citybond.in/'} for i in range(0,len(t)-1,2)]
# Preserve all crawled page SEO in editable content records, keyed by exact address.
pages=read('pages.json');seo={}
for p in pages:
 if p['httpStatus']!=200:continue
 url=urlsplit(p['sourceUrl']);key=url.path+('?' +url.query if url.query else '')
 seo[key]={'path':key,'title':p['title'],'description':p['metaDescription'],'canonical':local(p['canonical']) or key,'robots':p['robots']}
c['seoPages']=list(seo.values())
copy=read('original-copy.json');copy['records']=[p for p in copy['records'] if p['exactPath']!='/blog']
(ROOT/'content/original-copy.json').write_text(json.dumps(copy,ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/data/site.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
manifest=[{k:a[k] for k in ['sourceUrl','resolvedUrl','sha256','bytes']}|{'path':asset_map[a['sourceUrl']]} for a in assets if a['status']==200]
(ROOT/'content/migration-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'content/migration-source-urls.txt').write_text('\n'.join(sorted(p['sourceUrl'] for p in pages if p['httpStatus']==200))+'\n')
print(json.dumps({'blogs':len(blogs),'mediaFiles':len(manifest),'sourcePages':len(copy['records']),'seoPages':len(seo),'shades':sum(len(p['finishes']) for p in c['products']),'serializedBytes':len(json.dumps(c).encode())}))
