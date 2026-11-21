

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

