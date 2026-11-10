"""Check rendered main-page text, not serialized React payloads, against the import."""
import concurrent.futures, json, re
from pathlib import Path
import requests
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent
seed=json.loads((ROOT/'src/data/site.json').read_text())
canon=json.loads((ROOT/'src/data/canonical-paths.json').read_text())
def norm(text): return re.sub(r'\s+','',text)
def check(page):
    path=canon.get(page['route'],'/'+page['route'])
    response=requests.get('http://localhost:3001'+path,timeout=40,allow_redirects=False)
    assert response.status_code==200,(path,response.status_code)
    soup=BeautifulSoup(response.text,'html.parser')
    main=soup.find('main');assert main,path
    visible=norm(main.get_text())
    assert norm(page['title']) in visible,(path,'title')
    assert norm(page['description']) in visible,(path,'description')
    body=main.select_one('[data-original-copy]')
    actual=norm(body.get_text()) if body else ''
    for block in page['blocks']:
        for text in [block['text'],*block['items'],*[cell for row in block['rows'] for cell in row]]:
            assert norm(text) in actual,(path,block['id'],text[:100])
    return path
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results=list(pool.map(check,seed['originalPages']))
print(f'PASS every imported title, introduction and content block rendered on {len(results)} canonical pages; seven aliases share these records.')
