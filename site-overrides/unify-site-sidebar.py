#!/usr/bin/env python3
"""Use the compiled homepage's sidebar as the single source for standalone pages."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re

PREFIX = "/terravale-preview/"
OUT = Path("site")
NATIVE_ROUTES = {"party/index.html", "party.html", "session-room/index.html", "session-room.html"}
CUSTOM = {
    "party/index.html": "party", "party.html": "party",
    "session-room/index.html": "party", "session-room.html": "party",
    "session-room-v2/index.html": "party",
    # Character sheets are embedded by the compiled Codex. Their own
    # .sidebar is hidden in html.live-embedded; replacing it with an
    # iframe makes a giant nested navigation instead of the sheet.
    # NEVER replace their <aside>; they use the parent Codex navigation.
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
    def absolute_offset(self):
        line, col = self.getpos()
        return self.lines[line-1] + col
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "aside": self.stack.append(self.absolute_offset())
        if tag == "link" and "stylesheet" in (attrs.get("rel") or "").split():
            href = attrs.get("href")
            if href and href.startswith(PREFIX) and href not in self.css:
                self.css.append(href)
    def handle_endtag(self, tag):
        if tag == "aside" and self.stack:
            start = self.stack.pop()
            end = self.html.find(">", self.absolute_offset()) + 1
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
body{background:var(--public-nav,#151e29)!important;color:var(--text,#f1e9dd)!important}
#codex-sidebar-root{height:100%;width:100%;min-width:0;overflow:hidden}
#codex-sidebar-root>aside{
  box-sizing:border-box!important;display:flex!important;flex-direction:column!important;
  position:relative!important;inset:auto!important;transform:none!important;
  visibility:visible!important;opacity:1!important;
  width:100%!important;min-width:0!important;max-width:none!important;
  height:100dvh!important;overflow:hidden!important;
  background:var(--public-nav,#151e29)!important;color:var(--text,#f1e9dd)!important;
}
#codex-sidebar-root a{cursor:pointer}
#codex-sidebar-root{
  --codex-nav-label-size:11px;
}
#codex-sidebar-root>aside{
  font-size:11px!important;line-height:1.35!important;
  padding:0!important;
}
#codex-sidebar-root .nav-item{
  display:flex!important;align-items:center!important;gap:8px!important;
  padding:8px 8px!important;min-height:27px!important;
  font-size:11px!important;font-weight:600!important;line-height:1.22!important;
  letter-spacing:0!important;text-decoration:none!important;
  width:calc(100% - 8px)!important;margin:2px 4px!important;
  white-space:nowrap!important;box-sizing:border-box!important;
}
#codex-sidebar-root .nav-item .nav-text{
  display:inline!important;font-size:11px!important;
  font-weight:inherit!important;line-height:1.22!important;
  white-space:nowrap!important;overflow:visible!important;
  text-overflow:clip!important;min-width:0!important;
}
#codex-sidebar-root .nav-item .nav-symbol{
  font-size:12px!important;line-height:1!important;
  flex:0 0 15px!important;min-width:15px!important;
}
#codex-sidebar-root .sidebar-label{font-size:9px!important;letter-spacing:1px!important;padding:9px 10px!important}
#codex-sidebar-root .sidebar-nav{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;gap:8px!important;padding:0 3px 10px!important;scrollbar-width:thin!important}
#codex-sidebar-root .sidebar-nav-section{display:block!important;min-width:0!important}
#codex-sidebar-root .nav-section-toggle{display:flex!important;justify-content:space-between!important;align-items:center!important;min-height:29px!important;width:100%!important;padding:6px 9px!important;font-size:10px!important;text-align:left!important}
#codex-sidebar-root .nav-section-links[hidden]{display:none!important}
#codex-sidebar-root .sidebar-search{display:flex!important;flex:0 0 auto!important;min-height:39px!important}
#codex-sidebar-root .sidebar-foot{display:flex!important;margin-top:auto!important;flex:0 0 auto!important;padding:9px 4px 5px!important}
#codex-sidebar-root .sidebar-help{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important;font-size:11px!important}
#codex-sidebar-root .nav-item{max-width:calc(100% - 8px)!important}
#codex-sidebar-root .nav-item .nav-text{font-size:11px!important}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .nav-section-toggle,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-search .nav-text,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-help .nav-text,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-search-hint{display:none!important}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .nav-section-links{display:block!important}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .nav-section-links .nav-item{justify-content:center!important}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-help,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-search{justify-content:center!important}

#codex-sidebar-root>aside nav{padding:0!important;margin:0!important}
#codex-sidebar-root select{font-size:10px!important;max-width:calc(100% - 8px)!important}
#codex-sidebar-root [data-session-campaign-name]{
  font-size:10px!important;
}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .nav-text,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-label,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .logo small,
html[data-sidebar-collapsed="true"] #codex-sidebar-root select,
html[data-sidebar-collapsed="true"] #codex-sidebar-root .sidebar-campaign,
html[data-sidebar-collapsed="true"] #codex-sidebar-root [data-session-campaign-name]{display:none!important}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .nav-item{justify-content:center!important;padding:10px 0!important}
html[data-sidebar-collapsed="true"] #codex-sidebar-root .nav-item .nav-symbol{flex:0 0 22px!important;font-size:16px!important}

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
 window.addEventListener('message',function(event){
  if(event.origin!==location.origin || event.source!==window.parent)return;
  const payload=event.data;
  if(!payload||payload.type!=='terravale:sidebar-context')return;
  if(typeof payload.theme==='string' && /^[a-z0-9-]{2,35}$/.test(payload.theme)){
    document.documentElement.dataset.appTheme=payload.theme;
    document.documentElement.dataset.codexTheme=payload.theme;
  }
  document.documentElement.dataset.sidebarCollapsed=payload.collapsed?'true':'false';
  if(typeof paint==='function')paint();
  if(typeof payload.campaign==='string' && payload.campaign.trim()){
    for(const sel of document.querySelectorAll('#codex-sidebar-root select')){
      const found=Array.from(sel.options).find(o=>o.textContent===payload.campaign);
      if(found)sel.value=found.value;
      else{sel.replaceChildren(new Option(payload.campaign,payload.campaign));}
      sel.title='Campaign: '+payload.campaign;
      sel.setAttribute('aria-label','Campaign: '+payload.campaign);
    }
  }
 });
 window.parent.postMessage({type:'terravale:sidebar-ready'},location.origin);
 // The shared-sidebar document contains server-rendered native navigation.
 // It is intentionally not hydrated with the main React application, so wire its
 // accordion buttons and footer help directly without copying the old menu.
 const key='terravale.ui.sidebar.groups.v1';
 let saved={};
 try{saved=JSON.parse(localStorage.getItem(key)||'null')||{}}catch{}
 const paint=()=>{
  const collapsed=document.documentElement.dataset.sidebarCollapsed==='true';
  for(const button of document.querySelectorAll('.nav-section-toggle')){
   const id=button.closest('.sidebar-nav-section')?.dataset.section;
   const panel=document.getElementById(button.getAttribute('aria-controls')||'');
   if(!id||!panel)continue;
   const requested=typeof saved[id]==='boolean'?saved[id]:button.getAttribute('aria-expanded')==='true';
   const isActive=!!panel.querySelector('[aria-current="page"]');
   const expanded=collapsed||requested||isActive;
   panel.hidden=!expanded;
   button.setAttribute('aria-expanded',String(expanded));
   const chevron=button.querySelector('.nav-section-chevron');
   if(chevron)chevron.textContent=expanded?'⌄':'›';
  }
 };
 for(const button of document.querySelectorAll('.nav-section-toggle')){
  const id=button.closest('.sidebar-nav-section')?.dataset.section;
  if(!id)continue;
  button.addEventListener('click',()=>{
   const panel=document.getElementById(button.getAttribute('aria-controls')||'');
   saved[id]=!(panel&&!panel.hidden);
   try{localStorage.setItem(key,JSON.stringify(saved))}catch{}
   paint();
  });
 }
 document.querySelector('.sidebar-help')?.addEventListener('click',()=>{
  window.top.location.assign('/terravale-preview/?terravale-help=1');
 });
 const nativeTour=()=>{
  const help=new URLSearchParams(location.search).get('terravale-help');
  if(help==='1')window.top.location.assign('/terravale-preview/?terravale-help=1');
 };
 paint();window.addEventListener('storage',paint);
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
 border:0;background:var(--c-side,#151e29);z-index:15;
}
.app{grid-template-columns:200px minmax(0,1fr)!important}
body.sidebar-collapsed .app{grid-template-columns:48px minmax(0,1fr)!important}
body.sidebar-collapsed .codex-shared-sidebar-frame{max-width:48px!important}
@media(max-width:750px){.app{grid-template-columns:200px minmax(0,1fr)!important}}
</style>
"""

def patch(file, page, native_sidebar):
    path = OUT/file
    if not path.exists():
        raise RuntimeError(f"Standalone page is missing: {file}")
    html = path.read_text()
    native = file in NATIVE_ROUTES
    if native:
        replacement, aside_count = re.subn(r'<aside\b', '<aside id="room-native-nav"', native_sidebar, count=1)
        assert aside_count == 1, "Source-built navigation must contain an aside"
        assert 'id="room-native-nav"' in replacement, "Source nav must contain one real sidebar"
        # The source sidebar was extracted from the Dashboard (active="/").
        # Mark the Room route in HTML, BEFORE scripts, to prevent an active-link flash.
        def select_active(match):
            tag=match.group(0)
            route=re.search(r'data-tour-nav="([^"]+)"',tag).group(1)
            class_match=re.search(r'class="([^"]+)"',tag)
            if class_match:
                names=[x for x in class_match.group(1).split() if x!='active']
                if route=='/party': names.append('active')
                tag=tag.replace(class_match.group(0),'class="'+' '.join(names)+'"',1)
            if route=='/party':
                tag=tag[:-1]+' aria-current="page">'
            else:
                tag=tag.replace(' aria-current="page"','')
            return tag
        replacement=re.sub(r'<a\b[^>]*data-tour-nav="[^"]+"[^>]*>',select_active,replacement)

    else:
        replacement = (f'<iframe class="codex-shared-sidebar-frame" '
            f'title="Terravale Codex navigation" '
            f'src="{PREFIX}shared-sidebar/?current={page}&v=native-20261101" '
            f'loading="eager" referrerpolicy="same-origin"></iframe>')
    replaced, count = re.subn(
        r'<aside\b[^>]*>[\s\S]*?</aside>', lambda _: replacement, html, count=1, flags=re.I
    )
    if count != 1:
        if "encounter-library" in file:
            return False
        raise RuntimeError(f"Could not replace unique custom sidebar in {file}")
    if "</head>" not in replaced:
        raise RuntimeError(f"No head in {file}")
    if native:
        # This is the exact source-built sidebar markup. Only its styling/interaction
        # is scoped, so global Next styles cannot collide with the Session Room.
        stylesheet='<link rel="stylesheet" href="/terravale-preview/session-room/room-nav-inline.css?v=stable-20261101">'
        script='<script src="/terravale-preview/session-room/room-nav-inline.js?v=stable-20261101" defer></script>'
        replaced=replaced.replace("</head>",stylesheet+"</head>",1)
        replaced=replaced.replace("</body>",script+"</body>",1)
    else:
        replaced = replaced.replace("</head>",FRAME_STYLE+"</head>",1)
    path.write_text(replaced)
    return True

def main():
    original = make_sidebar()
    changed = [name for name, page in CUSTOM.items() if patch(name, page, original)]
    print("Shared Codex sidebar derived from original compiled homepage:",len(original),"HTML bytes")
    print("Unified standalone sidebar in",len(changed),"pages:",", ".join(changed))
    if len(changed) < 5:
        raise RuntimeError("Not enough sidebar pages were patched")
    assert "data-tour-nav" in (OUT/"shared-sidebar/index.html").read_text()
    party=(OUT/"party/index.html").read_text()
    assert 'id="room-native-nav"' in party, "Production navigation must be inlined"
    assert 'codex-shared-sidebar-frame' not in party, "An iframe would cause a layout flash"
    assert "room-nav-inline.css" in party and "room-nav-inline.js" in party
    for sheet_name in ("characters/sheet-live/index.html",
                       "characters/sheet-workshop/index.html"):
        sheet=(OUT/sheet_name).read_text()
        if 'codex-shared-sidebar-frame' in sheet:
            raise RuntimeError(f"Nested sidebar detected in embedded sheet: {sheet_name}")
        if '<aside class="sidebar"' not in sheet:
            raise RuntimeError(f"Original embedded sidebar was removed: {sheet_name}")
    live=(OUT/"characters/sheet-live/index.html").read_text()
    assert 'html.live-embedded .sidebar' in live, "Embedded sidebar hiding CSS missing"
    assert 'loadApprovedCharacter' in live, "Approved sheet renderer missing"


if __name__=="__main__":
    main()
