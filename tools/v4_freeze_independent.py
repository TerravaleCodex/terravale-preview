#!/usr/bin/env python3
"""Freeze finished V2.87 into independent editable V4 source. No legacy build."""
import argparse
import hashlib
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from export_v4_offline_first_pass import port

SCRIPT = re.compile(r'<script\b(?P<attrs>[^>]*)>(?P<body>[\s\S]*?)</script\s*>',re.I)
STYLE = re.compile(r'<style\b(?P<attrs>[^>]*)>(?P<body>[\s\S]*?)</style\s*>',re.I)
SRC = re.compile(r'\bsrc\s*=',re.I)
TYPE = re.compile(r'\btype\s*=\s*["\x27]([^"\x27]+)["\x27]',re.I)
SOURCE = re.compile(r'\bdata-source\s*=\s*["\x27]([^"\x27]+)["\x27]',re.I)
ID = re.compile(r'\bid\s*=\s*["\x27]([^"\x27]+)["\x27]',re.I)
TERMS = ("Frostvale","Terravale","Kalma","Eshael","Crimsonborn","Dvergr",
         "Thalassari","Flügel","Null Meridian","The Wayfarers")

def sha(data):return hashlib.sha256(data).hexdigest()
def name(s):return re.sub(r'[^a-zA-Z0-9_.-]+','-',str(s)).strip('-')[:90] or "native"
def blank_check(html):
    p=r'<script\b(?=[^>]*\bid=["\x27]tv238-v14-content["\x27])[^>]*>([\s\S]*?)</script>'
    m=re.search(p,html,re.I)
    if not m:raise RuntimeError("V14 data slot missing")
    data=json.loads(m.group(1))
    for k in ("articles","heritageArticles","events"):
        if data.get(k)!=[]:raise RuntimeError("Unredacted world data "+k)
    for f in ("v247-demo-party-admin.js","v248-curated-demo-sheets.js"):
        if ('data-source="'+f+'"') in html:raise RuntimeError("Demo data remains")
    if 'data-source="v4-offline-database.js"' not in html:
        raise RuntimeError("Offline database missing")
    return True

def split_html(html,out):
    assets=[]
    def extract_script(m):
        attrs=m.group('attrs');content=m.group('body')
        typ=TYPE.search(attrs)
        if SRC.search(attrs) or not content.strip() or (typ and typ.group(1).lower()
           not in ('module','text/javascript','application/javascript')):
            return m.group(0)
        source=SOURCE.search(attrs);ident=ID.search(attrs)
        n=len([r for r in assets if r['type']=='js'])+1
        label=name(source.group(1) if source else ident.group(1) if ident else 'native-v2')
        filename=f"js/{n:03d}-{label}.js"
        path=out/filename;path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(content,encoding='utf-8')
        assets.append({'type':'js','file':filename,'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size})
        return '<script'+attrs+' src="./'+filename+'"></script>'
    html=SCRIPT.sub(extract_script,html)
    def extract_style(m):
        attrs=m.group('attrs');content=m.group('body')
        if not content.strip():return m.group(0)
        ident=ID.search(attrs)
        n=len([r for r in assets if r['type']=='css'])+1
        filename=f"css/{n:03d}-{name(ident.group(1) if ident else 'native-v2')}.css"
        path=out/filename;path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(content,encoding='utf-8')
        assets.append({'type':'css','file':filename,'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size})
        return '<link rel="stylesheet" href="./'+filename+'">'
    html=STYLE.sub(extract_style,html)
    (out/'index.html').write_text(html,encoding='utf-8')
    return assets

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',required=True,help="Full deployed V2.87 HTML snapshot")
    ap.add_argument('--output',default=str(ROOT/'v4-independent-site'))
    args=ap.parse_args()
    raw=Path(args.input).read_bytes()
    if len(raw)<7_000_000:raise RuntimeError("Input is not the 7+ MB live V2.87 site")
    live=raw.decode('utf-8')
    for t in ('Terravale Codex V2.87','data-source="v287-adaptive-resources.js"',
              'data-source="v254-dm-vault.js"','id="tv238-v14-content"'):
        if t not in live:raise RuntimeError("Incomplete live V2.87 source: "+t)
    html=port(live)
    blank_check(html)
    out=Path(args.output).resolve()
    # A one-time fork must never overwrite edited V4 modules on rerun.
    # Refuse instead of removing the existing directory.
    if out.exists():
        raise RuntimeError("Independent V4 source already exists at "+str(out)+
                           ". Never regenerate it from live; edit V4 directly.")
    out.mkdir(parents=True)
    assets=split_html(html,out)
    if (out/'index.html').stat().st_size<5_000 or len(assets)<10:
        raise RuntimeError("Incomplete source extraction; original UI missing")
    js_bytes=sum(x['bytes'] for x in assets if x['type']=='js')
    if js_bytes<500_000:
        raise RuntimeError("Native V2 JavaScript was not fully extracted")
    manifest={
        'source':'one-time finished V2.87 live HTML snapshot',
        'original_sha256':sha(raw),'original_bytes':len(raw),
        'v4_sha256':sha(html.encode('utf-8')),
        'layout':'original native live V2.87',
        'world_data':'bulk lore and preset content removed',
        'storage':'IndexedDB offline adapter',
        'independent_of_live_build':True,
        'assets':assets,
        'remaining_setting_terminology':{
            t:len(re.findall(re.escape(t),html,re.I)) for t in TERMS if t.lower() in html.lower()
        },
        'caution':'Advanced offline mechanics and native creator content provider need further migration'
    }
    (out/'V4_SOURCE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'README.md').write_text(
        '# Independent Living Codex V4 source\n\n'
        'This is a one-time frozen copy of the actual live V2.87 application, '
        'not a redesigned interface or an automatic rebuild from V2.\n\n'
        'The V4 source is in index.html, css/ and js/. Edit those files directly. '
        'No original archive or historical patch tooling is required.\n\n'
        'Run a local static web server in this folder: python -m http.server 8765 '
        '--bind 127.0.0.1 and open http://127.0.0.1:8765/ .\n\n'
        'Original lore, calendar and curated demo content were removed. Some '
        'setting-specific UI strings remain and need to be audited. '
        'Remaining offline RPCs and the campaign-specific native creator '
        'are not fully implemented yet.\n',encoding='utf-8')
    archive=out.parent/(out.name+'.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for path in out.rglob('*'):
            if path.is_file():z.write(path,arcname=out.name+'/'+path.relative_to(out).as_posix())
    print('Independent V4 source:',out)
    print('Original layout, scripts and styles retained:',len(assets),'assets')
    print('Editable V4 zip:',archive)

if __name__=='__main__':main()
