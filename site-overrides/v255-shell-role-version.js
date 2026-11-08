/* V2.55 identity, release label and role-aware layout repairs.
   Build marker is injected by the release workflow, never forged by a client. */
(function(){
'use strict';
const label=()=>window.TerravaleV255Build||{version:'2.57',build:'preview'};
function helpBadge(){
 const nav=document.getElementById('nav')||
  document.querySelector('#sidebar,aside[aria-label="Navigation"]');
 if(!nav)return;
 let footer=nav.querySelector('.tv255-help-footer');
 const link=nav.querySelector('[data-path="/help"]')||
  Array.from(nav.querySelectorAll('a,button')).find(x=>
   /help|tutorial/i.test((x.textContent||'').trim())&&
   !x.closest('.tv255-help-footer'));
 if(!footer){
  footer=document.createElement('div');footer.className='tv255-help-footer';
  if(link&&link.parentNode)link.parentNode.insertBefore(footer,link);
  else nav.append(footer);
 }
 if(link&&!footer.contains(link)){footer.append(link);link.classList.add('tv255-help-compact')}
 let badge=footer.querySelector('.tv255-version-tag');
 if(!badge){badge=document.createElement('span');badge.className='tv255-version-tag';footer.append(badge)}
 const v='V'+label().version;
 if(badge.textContent!==v)badge.textContent=v;
 badge.title='Loaded Terravale '+v+' · build '+label().build+
  ' · reload to check for a newer deployment';
 badge.setAttribute('aria-label','Terravale version '+label().version+
  ', build '+label().build);
}
function role(){
 if(typeof db==='undefined')return;
 const r=db.role==='dm'?'dm':'player';
 if(document.body.dataset.tv255Role!==r)document.body.dataset.tv255Role=r;
 // A player-mode switch must never leave the previously rendered DM workspace
 // visible in the same SPA DOM, even before the native route repaints.
 if(r==='player'&&/^#\/dm(?:\/|$)/.test(location.hash))location.hash='#/';
 const nav=document.getElementById('nav');
 if(!nav)return;
 for(const link of nav.querySelectorAll('[data-path="/dm"]')){
  link.hidden=r!=='dm'||!window.TerravaleVerifiedAccount?.state?.profile?.is_dm;
  link.setAttribute('aria-hidden',String(link.hidden));
 }
}
function mount(){
 role();helpBadge();
}
let queued=false;
const observer=new MutationObserver(()=>{
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;mount()});
});
observer.observe(document.getElementById('nav')||document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{
 if(!e.target.closest('[data-role]'))return;
 queueMicrotask(mount);
},true);
window.addEventListener('hashchange',mount);
window.addEventListener('terravale-auth-ready',mount);
window.addEventListener('terravale-characters-synced',mount);
mount();
})();