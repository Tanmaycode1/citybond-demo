#!/usr/bin/env python3
"""Audit official CityBond source pages and import explicitly curated assets.
Requires requests, beautifulsoup4 and Pillow. Run from project root.
No credentials or third-party images are used.
"""
import concurrent.futures, json, re, sys, io
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
BASE='https://citybond.in/'
OUT=Path('content'); CACHE=Path('/tmp/citybond-source-cache')
CACHE.mkdir(exist_ok=True)
def fetch(path):
    url=urljoin(BASE,path); r=requests.get(url,timeout=40);r.raise_for_status()
    soup=BeautifulSoup(r.text,'html.parser')
    images=[]
    for img in soup.find_all('img'):
        src=urljoin(url,img.get('data-src') or img.get('src',''))
        if src.startswith(BASE) and src not in [i['url'] for i in images]:images.append({'url':src,'alt':img.get('alt','')})
    downloads=[{'title':a.get_text(' ',strip=True),'url':urljoin(url,a['href'])} for a in soup.find_all('a',href=True) if '.pdf' in a['href'].lower()]
    for t in soup(['script','style','header','footer','nav']):t.decompose()
    text=soup.get_text(' ',strip=True)
    text=re.sub(r'\s+',' ',text)
    CACHE.joinpath((path.strip('/').replace('/','_') or 'home')+'.txt').write_text(text)
    CACHE.joinpath((path.strip('/').replace('/','_') or 'home')+'.html').write_text(r.text)
    return {'url':url,'title':soup.title.get_text(strip=True) if soup.title else path,'images':images,'downloads':downloads,'summary':'','keyFacts':[]}
PATHS=['','about','vision','our-management','network','infrastructure','lamio-series','exclusive-series','marble-series','wooden-series','3d-panels-series','sparkle-series','mirror-series','gloss-series','hpl-sheet','satin-series','solid-series','metallic-series','3mm-acp-sheet','4mm-acp-sheet','6mm-acp-sheet','fire-retardent','low-density-poly-ethylene','exterior-facade','interior-design','brand-identity','metacity/','soffit-panels/','architects','dealership','corporate','contact','projects','catalogue-download','download-our-quatarly-acp-magazine','awards','third-eye-view','career','terms','privacy-policy','blog/']
if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    dest=OUT/'source-audit.json'
    existing=json.loads(dest.read_text()) if dest.exists() else {}
    old={p['url']:p for p in existing.get('pages',[])}
    paths=list(dict.fromkeys(PATHS+[u.removeprefix(BASE) for u in old]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        pages=list(pool.map(fetch,paths))
    for p in pages:
        for key in ['summary','keyFacts','notes']:
            if key in old.get(p['url'],{}):p[key]=old[p['url']][key]
    existing.update({'source':BASE,'retrievedAt':'2026-10-16','pages':pages})
    dest.write_text(json.dumps(existing,indent=2))
    print(f'Audited {len(pages)} official pages. Extracted texts in {CACHE}.')
    if '--assets' in sys.argv:
        from PIL import Image
        manifest=OUT/'assets.json'
        assets=json.loads(manifest.read_text())
        for a in assets['assets']:
            response=requests.get(a['sourceUrl'],timeout=40)
            response.raise_for_status()
            im=Image.open(io.BytesIO(response.content))
            a['originalWidth'],a['originalHeight']=im.size
            im.thumbnail((2200,2200))
            target=Path('public'+a['path'])
            target.parent.mkdir(exist_ok=True,parents=True)
            im.save(target,'WEBP',quality=88)
            a.update(width=im.width,height=im.height,bytes=target.stat().st_size)
        manifest.write_text(json.dumps(assets,indent=2))
        print(f"Refreshed {len(assets['assets'])} official assets.")
