#!/usr/bin/env python3
"""Use the compiled homepage's sidebar as the single source for standalone pages."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re

PREFIX = "/terravale-preview/"
OUT = Path("site")
CUSTOM = {
    "party/index.html": "party", "party.html": "party",
    "session-room/index.html": "party", "session-room.html": "party",
    "session-room-v2/index.html": "party",
    "characters/sheet-live/index.html": "characters",
    "characters/sheet-workshop/index.html": "characters",
    "session-room/encounter-library/index.html": "party",
    "session-room-v2/encounter-library/index.html": "party",
}

class Extractor(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.html = html
        self.lines = [0] + [m.end() for m in re.finditer("\n", html)]
        self.stack = []
        self.asides = []
        self.css = []
    def offset(self):
        line, col = self.getpos()
        return self.lines[line-1] + col
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "aside": self.stack.append(self.offset())
        if tag == "link" and "stylesheet" in (attrs.get("rel") or "").split():
            href = attrs.get("href")
            if href and href.startswith(PREFIX) and href not in self.css:
                self.css.append(href)
    def handle_endtag(self, tag):
        if tag == "aside" and self.stack:
            start = self.stack.pop()
            end = self.html.find(">", self.offset()) + 1
            if end > start: self.asides.append(self.html[start:end])

def make_sidebar():
    homepage = (OUT/"index.html").read_text()
    parser = Extractor(homepage)
    parser.feed(homepage)
    matches = [x for x in parser.asides if 'data-tour-nav="/party"' in x and "Session Room" in x]
    if len(matches) != 1 or len(parser.css) < 1:
        raise RuntimeError(f"Expected one real Codex sidebar, found {len(matches)} ({len(parser.asides)} asides), CSS {len(parser.css)}")
    nav = matches[0]
    if nav.count("nav-item") < 5:
        raise RuntimeError("Compiled Codex sidebar is missing its navigation links")
    links = "\n".join(f'<link rel="stylesheet" href="{escape(uri, quote=True)}">' for uri in parser.css)
    html = '''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/terravale-preview/" target="_top">
''' + links + '''
<style>
:root{color-scheme:dark}
html,body{height:100%;width:100%;margin:0;overflow:hidden}
body{background:#151e29;color:#f1e9dd}
#codex-sidebar-root{height:100%;width:100%;min-width:0;overflow:hidden}
#codex-sidebar-root>aside{
  box-sizing:border-box!important;display:flex!important;flex-direction:column!important;
  position:relative!important;inset:auto!important;transform:none!important;
  visibility:visible!important;opacity:1!important;
  width:100%!important;min-width:0!important;max-width:none!important;
  height:100dvh!important;overflow-y:auto!important;overflow-x:hidden!important;
}
#codex-sidebar-root a{cursor:pointer}
#codex-sidebar-root [data-sidebar-current="true"]{
  background:rgba(215,181,121,.10);outline:1px solid rgba(215,181,121,.32);
}
</style></head><body>
<div id="codex-sidebar-root">''' + nav + '''</div>
<script>
(function(){
 const query=new URLSearchParams(location.search);
 const page='/' + (query.get('current')||'party').replace(/^\\/+|\\/+$/g,'');
 const links=document.querySelectorAll('#codex-sidebar-root a[href]');
 for(const a of links){
  a.target='_top';
  if(a.getAttribute('data-tour-nav')===page){
   a.classList.add('active');
   a.dataset.sidebarCurrent='true';
   a.setAttribute('aria-current','page');
  }else{
   a.classList.remove('active');
   a.removeAttribute('data-sidebar-current');
   a.removeAttribute('aria-current');
  }
 }
 // This iframe shares the main website's same-origin theme preference.
 const theme=()=>{
  try{
   const choice=localStorage.getItem('terravale.unified.theme.v2')||
     localStorage.getItem('terravale.cosmetic.site.v1')||'dark';
   document.documentElement.dataset.appTheme=choice;
   document.documentElement.dataset.codexTheme=choice;
  }catch{}
 };
 theme();window.addEventListener('storage',theme);
 // Navigate to Campaigns for changing the active campaign. Other links
 // are native top-level links; no inactive Next.js controls are copied.
 for(const sel of document.querySelectorAll('#codex-sidebar-root select')){
   sel.addEventListener('change',()=>{window.top.location.href='/terravale-preview/campaigns/'});
 }
})();
</script></body></html>'''
    (OUT/"shared-sidebar").mkdir(exist_ok=True)
    (OUT/"shared-sidebar/index.html").write_text(html)
    return nav

FRAME_STYLE = """
<style id="shared-codex-sidebar-frame">
.codex-shared-sidebar-frame{
 width:100%!important;height:100vh!important;height:100dvh!important;
 min-width:0!important;max-width:none!important;display:block!important;
 align-self:start;position:sticky;top:0;
 border:0;background:#151e29;z-index:15;
}
.app{grid-template-columns:176px minmax(0,1fr)!important}
@media(max-width:1270px){.app{grid-template-columns:145px minmax(0,1fr)!important}}
@media(max-width:800px){.app{grid-template-columns:120px minmax(0,1fr)!important}}
</style>
"""

def patch(file, page):
    path = OUT/file
    if not path.exists():
        raise RuntimeError(f"Standalone page is missing: {file}")
    html = path.read_text()
    iframe = (f'<iframe class="codex-shared-sidebar-frame" '
        f'title="Terravale Codex navigation" '
        f'src="{PREFIX}shared-sidebar/?current={page}" '
        f'loading="eager" referrerpolicy="same-origin"></iframe>')
    replaced, count = re.subn(
        r'<aside\b[^>]*>[\s\S]*?</aside>', lambda _: iframe, html, count=1, flags=re.I
    )
    if count != 1:
        if "encounter-library" in file:
            return False
        raise RuntimeError(f"Could not replace unique custom sidebar in {file}")
    if "</head>" not in replaced:
        raise RuntimeError(f"No head in {file}")
    replaced = replaced.replace("</head>",FRAME_STYLE+"</head>",1)
    path.write_text(replaced)
    return True

def main():
    original = make_sidebar()
    changed = [name for name, page in CUSTOM.items() if patch(name, page)]
    print("Shared Codex sidebar derived from original compiled homepage:",len(original),"HTML bytes")
    print("Unified standalone sidebar in",len(changed),"pages:",", ".join(changed))
    if len(changed) < 7:
        raise RuntimeError("Not enough sidebar pages were patched")
    assert "data-tour-nav" in (OUT/"shared-sidebar/index.html").read_text()
    assert 'codex-shared-sidebar-frame' in (OUT/"party/index.html").read_text()

if __name__=="__main__":
    main()
