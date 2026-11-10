#!/usr/bin/env python3
"""Import owner-authorized original CityBond copy, with no rewriting.

Requires requests, beautifulsoup4, html5lib. Run from the project root.
Usage: python scripts/import-original-copy.py [--cached]
Raw source HTML stays in ignored content/raw/original-copy/. Output is data only.
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urljoin
import requests
from bs4 import BeautifulSoup, Tag, NavigableString, Comment

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'content/raw/original-copy'
NORMAL_BLOCK={'id':'','type':'paragraph','level':2,'text':'','ordered':False,'items':[],'rows':[],'headerRows':0,'href':'','sourceHref':''}
BLOCK_TAGS={'address','article','aside','blockquote','dd','details','div','dl','dt','fieldset','figcaption','figure','h1','h2','h3','h4','h5','h6','hr','li','main','ol','p','section','summary','table','ul'}
EXCLUDE='footer, .footerinfo, script, style, noscript, template, iframe, svg, canvas, form, input, select, textarea, label, .modal, [role="dialog"], .enq-modal-overlay, #enquiryModal, #hello, #sidebar, .sidebar, .side_list, .breadcrumb, .breadcrumbs, .breadcrumbs-font, .stickyBtn, .whatsapp-button, .dmtop, .img-btn, #scrollToTopBtn'


def norm(s):return re.sub(r'\s+',' ',s).strip()
def visible_text(node):
    if isinstance(node,Comment):return ''
    if isinstance(node,NavigableString):return str(node)
    if not isinstance(node,Tag):return ''
    if node.name in ['br','hr']:return ' '
    return ''.join(visible_text(c)+(' ' if isinstance(c,Tag) and c.name in BLOCK_TAGS else '') for c in node.children)
def text(node):return norm(visible_text(node))
def href(raw,url):
    absolute=urljoin(url,raw)
    parts=urlsplit(absolute)
    if parts.hostname in ['citybond.in','www.citybond.in']:
        return parts.path+('?' +parts.query if parts.query else '')+('#'+parts.fragment if parts.fragment else '')
    return absolute

def extract(html,url):
    soup=BeautifulSoup(html,'html5lib')
    title=text(soup.title) if soup.title else ''
    meta=soup.find('meta',attrs={'name':re.compile('^description$',re.I)})
    canonical=soup.find('link',rel='canonical')
    source_meta=norm(meta.get('content','')) if meta else ''
    source_canonical=canonical.get('href','') if canonical else ''
    exclusions=EXCLUDE
    if urlsplit(url).path!='/sitemap.html':exclusions+=', nav'
    if urlsplit(url).path!='/metacity/':exclusions+=', header'
    for el in list(soup.select(exclusions)):
        if el.parent is not None:el.decompose()
    # Bootstrap breadcrumbs are also emitted as a custom list on the older pages.
    for el in list(soup.select('.breadcrum, .bread-crumb, .breadcrumb-list, .breads')):
        el.decompose()
    for el in list(soup.find_all(['button'])):
        # FAQ accordions sometimes use a button as the actual question.
        if any(t in ' '.join(el.get('class',[])).lower() for t in ['faq','accordion']):continue
        el.decompose()
    for el in list(soup.select('[aria-hidden="true"]')):
        # Icon-only decorations are not copy. Do not discard collapsible answers.
        if el.name in ['i','span'] and len(text(el))<3:el.decompose()
    body=soup.body or soup
    # Common floating phone / WhatsApp links live directly after the footer.
    for el in list(body.find_all('a',recursive=False)):
        if el.get('href','').startswith(('tel:','https://api.whatsapp','https://wa.me')):el.decompose()
    blocks=[]
    def emit(kind,**fields):
        b={**NORMAL_BLOCK,**fields,'type':kind}
        if kind in ['heading','paragraph','link'] and not b['text']:return
        if kind=='list' and not b['items']:return
        if kind=='table' and not b['rows']:return
        blocks.append(b)
    def walk(el):
        if isinstance(el,Comment):return
        if isinstance(el,NavigableString):
            if norm(str(el)):emit('paragraph',text=norm(str(el)))
            return
        if not isinstance(el,Tag) or el.name in ['img','picture','source','video','audio','head','meta','link','hr','br']:return
        name=el.name;classes=' '.join(el.get('class',[])).lower()
        if re.match('^h[1-6]$',name):emit('heading',level=int(name[1]),text=text(el));return
        if name=='summary' or 'accordion-header' in classes or 'sp-faq-question' in classes or 'faq-question' in classes:
            emit('heading',level=3,text=text(el));return
        if name=='table':
            rows=[];headers=0;still_headers=True
            for tr in el.find_all('tr'):
                if tr.find_parent('table') is not el:continue
                cells=tr.find_all(['th','td'],recursive=False)
                values=[text(c) for c in cells]
                if not values:continue
                rows.append(values)
                if still_headers and all(c.name=='th' for c in cells):headers+=1
                else:still_headers=False
            emit('table',rows=rows,headerRows=headers);return
        if name in ['ul','ol']:
            # The original HTML sitemap is a nested link tree, rather than prose.
            if urlsplit(url).path=='/sitemap.html':
                for child in el.children:walk(child)
                return
            # Several original pages use UL as a layout wrapper with DIV/P children.
            # Treat that markup as normal content instead of silently losing it.
            direct_tags=[c for c in el.children if isinstance(c,Tag)]
            if not el.find('li',recursive=False) or any(c.name not in ['li','br'] for c in direct_tags):
                for child in el.children:walk(child)
                return
            items=[text(li) for li in el.find_all('li',recursive=False) if text(li)]
            emit('list',ordered=name=='ol',items=items);return
        if name in ['p','blockquote','figcaption','address','dt','dd']:
            # html5lib repairs the site's malformed nested paragraphs before here.
            if el.find(['p','ul','ol','table'],recursive=False):
                for child in el.children:walk(child)
            else:emit('paragraph',text=text(el))
            return
        if name=='a':
            value=text(el)
            if value:emit('link',text=value,href=href(el.get('href',''),url),sourceHref=el.get('href',''))
            return
        # Buffer inline fragments together so punctuation/word spacing stays intact.
        inline=[]
        def flush():
            value=norm(''.join(visible_text(x) for x in inline));inline.clear()
            if value:emit('paragraph',text=value)
        for child in el.children:
            if isinstance(child,Comment):continue
            if isinstance(child,Tag) and (child.name in BLOCK_TAGS or child.find(list(BLOCK_TAGS)) is not None or child.name=='a' or (child.name=='button' and text(child))):
                flush();walk(child)
            else:inline.append(child)
        flush()
    walk(body)
    before_hero=[]
    for b in blocks:before_hero.extend([b['text'],*b['items'],*[cell for row in b['rows'] for cell in row]])
    source_characters=re.sub(r'\s+','',text(body))
    extracted_characters=re.sub(r'\s+','',''.join(before_hero))
    parity=source_characters==extracted_characters
    # Breadcrumb list is not main copy; remove its original three-label structure.
    # Restrict to the leading block before the first real page heading.
    while blocks and blocks[0]['type']=='list' and blocks[0]['items'] and blocks[0]['items'][0].lower()=='home':blocks.pop(0)
    warnings=[]
    if not parity:warnings.append('DOM text parity differs; inspect extraction before publication.')
    h1=next((i for i,b in enumerate(blocks) if b['type']=='heading' and b['level']==1),None)
    if h1 is None:
        warnings.append('No H1 in source main content; first source heading used for hero when available.')
        h1=next((i for i,b in enumerate(blocks) if b['type']=='heading'),None)
    hero={'title':'','description':''}
    if h1 is not None:
        hero['title']=blocks[h1]['text'];blocks.pop(h1)
        # Only an immediately following paragraph is a potential source hero intro.
        if h1<len(blocks) and blocks[h1]['type']=='paragraph':
            hero['description']=blocks.pop(h1)['text']
    else:warnings.append('No heading found; no invented hero title was added.')
    # Original inline markup produces no image-only link text: do not substitute alt text.
    for i,b in enumerate(blocks):b['id']=f'original-{i+1:04d}'
    if not blocks:warnings.append('No main-content blocks were extracted.')
    normalized_nodes=[hero['title'],hero['description']]
    for b in blocks:
        normalized_nodes.extend([b['text'],*b['items'],*[cell for row in b['rows'] for cell in row]])
    normalized='\n'.join(s for s in normalized_nodes if s)
    return {'sourceUrl':url,'exactPath':urlsplit(url).path,'title':title,'metaDescription':source_meta,'canonical':source_canonical,'hero':hero,'blocks':blocks,'contentHash':hashlib.sha256(normalized.encode()).hexdigest(),'sourceTextHash':hashlib.sha256(source_characters.encode()).hexdigest(),'extractedTextHash':hashlib.sha256(extracted_characters.encode()).hexdigest(),'textParityVerified':parity,'extractionWarnings':warnings,'wordCount':len(normalized.split())}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--cached',action='store_true');args=parser.parse_args()
    urls=[s.strip() for s in (ROOT/'content/required-urls.txt').read_text().splitlines() if s.strip()]
    urls=list(dict.fromkeys(u for u in urls if not urlsplit(u).path.startswith('/blog')))
    RAW.mkdir(exist_ok=True,parents=True);now=datetime.now(timezone.utc).isoformat()
    def one(url):
        filename=(urlsplit(url).path.strip('/').replace('/','__') or 'home')+'.html';file=RAW/filename
        if args.cached and file.exists():html=file.read_text();status=200;final=url
        else:
            response=requests.get(url,timeout=45);response.raise_for_status();html=response.text;status=response.status_code;final=response.url;file.write_text(html)
        actual_fetch=datetime.fromtimestamp(file.stat().st_mtime,timezone.utc).isoformat()
        rec=extract(html,url);rec.update(fetchedAt=actual_fetch,httpStatus=status,finalUrl=final,rawHtmlHash=hashlib.sha256(html.encode()).hexdigest(),rawHtmlPath=str(file.relative_to(ROOT)))
        return rec
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:records=list(pool.map(one,urls))
    if not all(r['textParityVerified'] for r in records):
        raise RuntimeError('Main DOM copy parity failed; output not replaced.')
    seen={}
    for r in records:
        if r['contentHash'] in seen:r['sharedWith']=seen[r['contentHash']]
        else:seen[r['contentHash']]=r['exactPath']
    output={'version':1,'fetchedAt':max(r['fetchedAt'] for r in records),'extractedAt':now,'sourceList':'content/required-urls.txt','normalization':'Source wording and punctuation preserved; whitespace normalized. Common chrome, forms, controls and scripts excluded. Links on citybond.in normalized origin-relative; sourceHref retains their original attribute.','parityMethod':'Compare every non-whitespace character in the cleaned source main DOM against ordered extracted text, before moving hero text into hero fields. Both SHA-256 hashes must match; failures stop the import.','records':records}
    (ROOT/'content/original-copy.json').write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'records':len(records),'blocks':sum(len(r['blocks']) for r in records),'words':sum(r['wordCount'] for r in records),'warnings':sum(len(r['extractionWarnings']) for r in records)},indent=2))
if __name__=='__main__':main()
