/* V2.55 identity, release label and role-aware layout repairs.
   Build marker is injected by the release workflow, never forged by a client. */
(function(){
'use strict';
const label=()=>window.TerravaleV255Build||{version:'2.55',build:'preview'};
function helpBadge(){
 const nav=document.getElementById('nav');
 if(!nav)return;
 let link=nav.querySelector('[data-path="/help"]');
 if(!link)link=Array.from(nav.querySelectorAll('a,button')).find(
   x=>(x.textContent||'').trim().includes('Help & Tutorial')
 );
 if(!link||link.closest('.tv255-help-footer'))return;
 const wrap=document.createElement('div');wrap.className='tv255-help-footer';
 const parent=link.parentElement;
 parent.insertBefore(wrap,link);wrap.append(link);
 link.classList.add('tv255-help-compact');
 const badge=document.createElement('span');
 badge.className='tv255-version-tag';
 badge.textContent='V'+label().version;
 badge.title='Currently loaded Terravale build '+label().build+
  ' · refresh to load a newer deployed version';
 badge.setAttribute('aria-label','Terravale version '+label().version+
  ', build '+label().build);
 wrap.append(badge);
}
function role(){
 if(typeof db==='undefined')return;
 const r=db.role==='dm'?'dm':'player';
 if(document.body.dataset.tv255Role!==r)document.body.dataset.tv255Role=r;
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