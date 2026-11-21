#!/usr/bin/env python3
"""V4 source snapshot transformer: no download, no old patches, no build scripts.

Converts the completed, already-deployed V2.87 HTML into a blank-data V4
application. Does not call or import the legacy V2 build pipeline.
"""
from __future__ import annotations
import re
from pathlib import Path
from v4_blank_content_patch import blank_platform
ROOT=Path(__file__).resolve().parents[1]

CSS = r"""
/* V4 first pass: colours and fixed sidebar ONLY. The original V2.87
   markup, page handlers, sheets, spacing, cards and room remain unmodified. */
html[data-v4-theme="classic"],html[data-v4-theme="classic"] body{
  --bg:#0c0912;--surface:#1b1424;--raised:#24192b;
  --panel:#1b1424;--panel2:#24192b;--line:#46364b;
  --ink:#ede5f0;--text:#ede5f0;--soft:#c0b3c7;--muted:#94879d;
  --dim:#94879d;--accent:#b68cdb;--gold:#c5a66b;
  --gold2:#f0d5a1;--edge:#46364b;--public-nav:#100c16;
  --public-card:#1b1424;--public-ink:#150f1c;
}
html[data-v4-theme="midnight"],html[data-v4-theme="midnight"] body{
  --bg:#06050a;--surface:#15121d;--raised:#1c1725;
  --panel:#15121d;--panel2:#1c1725;--line:#363145;
  --ink:#eeeaf5;--text:#eeeaf5;--soft:#b5b1c5;--muted:#8c879f;
  --dim:#8c879f;--accent:#a6a4dc;--gold:#b4adc8;
  --gold2:#e0d9eb;--edge:#363145;--public-nav:#0d0a12;
  --public-card:#15121d;--public-ink:#0d0a12;
}
html[data-v4-theme] body{background:var(--bg)!important;color:var(--text)}
html[data-v4-theme] .sidebar,
html[data-v4-theme] .app-frame .topbar,
html[data-v4-theme] .topbar{background:var(--public-nav)!important;border-color:var(--edge)!important}
html[data-v4-theme] .app-frame,
html[data-v4-theme] .main-wrap,
html[data-v4-theme] .page-content{background:var(--bg);color:var(--text)}
html[data-v4-theme] .panel,
html[data-v4-theme] .v2-card,
html[data-v4-theme] .character-card,
html[data-v4-theme] .campaign-card{border-color:var(--edge);color:var(--text)}
/* Desktop: keep the original expanded nav permanently. No resizing animation. */
@media(min-width:761px){
  .sidebar-desktop-toggle,button[aria-label="Collapse sidebar"],
  button[aria-label="Expand sidebar"]{display:none!important}
  .sidebar,.app-frame .sidebar,.main-wrap,.app-frame .main-wrap,
  .sidebar-nav-section,.nav-section-links{transition:none!important;animation:none!important}
  .app-frame.sidebar-is-collapsed{--sidebar-width:208px!important}
  .app-frame.sidebar-is-collapsed .sidebar{width:208px!important;min-width:208px!important}
  .app-frame.sidebar-is-collapsed .nav-text,
  .app-frame.sidebar-is-collapsed .brand-words{display:initial!important}
}
.v4-theme-controls{display:inline-flex;gap:3px;border:1px solid var(--edge);
  padding:3px;border-radius:7px;background:var(--surface);align-items:center}
.v4-theme-controls button{border:0;background:transparent;color:var(--soft);
  padding:5px 9px;border-radius:5px;font-size:11px;cursor:pointer}
.v4-theme-controls button[aria-pressed="true"]{color:var(--text);
  background:var(--raised);outline:1px solid var(--edge)}
"""

JS = r"""
/* V4 local visual preview: only theme/expanded navigation.
   Do not emulate a signed-in Discord account or touch real backend state. */
(function(){
  'use strict';
  const KEY='living-codex-v4.offline.theme';
  const html=document.documentElement;
  const allowed=['classic','midnight'];
  const initial=(()=>{try{return localStorage.getItem(KEY)}catch{return null}})();
  function setTheme(which){
    const theme=allowed.includes(which)?which:'classic';
    html.setAttribute('data-v4-theme',theme);
    try{localStorage.setItem(KEY,theme)}catch{}
    document.querySelectorAll('.v4-theme-controls button').forEach(b=>
      b.setAttribute('aria-pressed',String(b.dataset.v4Theme===theme)));
  }
  setTheme(initial);
  function updateNav(){
    const frame=document.querySelector('.app-frame');
    if(frame?.classList.contains('sidebar-is-collapsed'))
      frame.classList.remove('sidebar-is-collapsed');
    if(html.dataset.sidebarCollapsed==='true')
      html.dataset.sidebarCollapsed='false';
    try{localStorage.setItem('terravale.ui.sidebar.collapsed.v1','false')}catch{}
  }
  function mount(){
    updateNav();
    if(document.querySelector('.v4-theme-controls'))return;
    const target=document.querySelector('.topbar-right,.topbar .tools,.topbar');
    if(!target)return;
    const root=document.createElement('div');root.className='v4-theme-controls';
    root.setAttribute('role','group');root.setAttribute('aria-label','Appearance');
    for(const [id,label] of [['classic','Classic'],['midnight','Midnight']]){
      const b=document.createElement('button');b.type='button';b.dataset.v4Theme=id;
      b.textContent=label;b.addEventListener('click',()=>setTheme(id));
      root.appendChild(b);
    }
    target.appendChild(root);setTheme(html.dataset.v4Theme);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  // The V2 SPA remounts the topbar after route updates. Keep controls in its
  // *original* header without replacing any route content.
  let queued=false;
  new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;mount()});
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:false});
})();
"""


def remove_one(html: str, marker: str) -> str:
    pattern = (r'<script\s+type="module"\s+data-source="' +
               re.escape(marker) + r'">[\s\S]*?</script>')
    result, n = re.subn(pattern, '', html, count=1)
    if n != 1:
        raise RuntimeError(f"Expected one real V2 module {marker}, got {n}")
    return result


def port(original: str) -> str:
    # Hosted authentication blocks file:// with a full-screen modal. It is
    # deliberately NOT replaced by a fake 'verified' identity. V2 demo
    # controls remain as shipped in the original, where supported.
    html = remove_one(original, 'v2-discord-auth.mjs')
    # The hosted advertising module requires network and adds nothing to a
    # local preview. All original V2 appearance and content is still present.
    html = remove_one(html, 'v2-ads-atelier.mjs')
    # Do not ship the live world's campaigns, gods, lore, class progression,
    # races, currencies or preconfigured demo characters in a generic V4.
    # The UNTOUCHED live source reference is generated separately first.
    html, blank_report = blank_platform(html)
    port.last_blank_report = blank_report
    # The production V2 screens remain byte-identical; this is their local
    # account/data compatibility gateway, NOT a recreated application.
    adapter = (ROOT / 'v4/offline-database.js').read_text(encoding='utf-8')
    assert 'TerravaleOfflineDatabase' in adapter
    assert '</script>' not in adapter.lower()
    adapter_script = '<script data-source="v4-offline-database.js">\n' + adapter + '\n</script>'
    if html.count('</head>') != 1 or html.count('</body>') != 1:
        raise RuntimeError("Unexpected live HTML structure; abort safely")
    html = html.replace('</head>', '<style id="v4-offline-theme">\n'+CSS+'\n</style>\n</head>',1)
    html = html.replace('</body>',adapter_script+'\n'+'<script id="v4-offline-controls">\n'+JS+'\n</script>\n</body>',1)
    return html


