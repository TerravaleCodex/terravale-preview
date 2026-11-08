/* Terravale V2.65 -- reversible atmosphere, no gameplay mutation. */
(()=>{
'use strict';
if(window.__tv265Atmosphere)return;
window.__tv265Atmosphere=true;
const ROOT=document.documentElement, TEXTURE_KEY='terravale.atelier.textures.v265',MOTION_KEY='terravale.atelier.motion.v265';
const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
function pref(k){try{return localStorage.getItem(k)!=='off'}catch{return true}}
const state={textures:pref(TEXTURE_KEY),motion:pref(MOTION_KEY)};
const canMove=()=>state.motion&&!media?.matches;
function route(){let p=location.hash.slice(1).split('?')[0].replace(/\/$/,'')||'/';try{p=decodeURIComponent(p)}catch{}return p}
function material(el,kind){
 if(!el)return;
 el.classList.add('tv265-surface','tv265-'+kind);
 if(!el.querySelector(':scope > .tv265-material')){
  const art=document.createElement('div');art.className='tv265-material';art.setAttribute('aria-hidden','true');el.append(art);
 }
}
function mount(){
 const root=document.getElementById('pageRoot');if(!root)return;
 const p=route();
 if(p==='/'||p==='/dashboard'){
  material(root.querySelector('.page-dashboard .hero,.hero'),'dashboard');
  material(root.querySelector('#featureArea .character-card,.page-dashboard .character-card'),'featured');
 }
 const hero=root.querySelector('.sheet20-hero');
 if(hero){
  material(hero,'character');
  const id=p.startsWith('/characters/')?p.split('/')[2]:null;
  const rec=typeof db!=='undefined'&&db.characters?.find(x=>String(x.id)===id);
  const ancestry=String(rec?.ancestry||'').toLowerCase();
  hero.dataset.tv265Ancestry=ancestry.includes('crimson')?'crimson':ancestry.includes('fl')?'fluegel':ancestry.includes('beast')?'beastfolk':ancestry.includes('dvergr')?'dvergr':ancestry.includes('oni')?'oni':ancestry.includes('elf')?'elf':'default';
 }
 if(p==='/party'||p==='/session')material(root.querySelector('.sr-encounter'),'initiative');
 const body=root.querySelector('#tv238-article-body');
 if(body){
  material(body.closest('section')?.querySelector(':scope > header'),'lore');
  for(const img of body.querySelectorAll('img')){
   if(img.dataset.tv265Checked==='1')continue;
   img.dataset.tv265Checked='1';
   const check=()=>{if(img.naturalWidth>=280||img.width>=280)img.classList.add('tv265-article-image')};
   if(img.complete)check();else img.addEventListener('load',check,{once:true});
  }
 }
 if(p==='/appearance')mountAppearance(root);
 mountCabinet();
}
function mountAppearance(page){
 if(page.querySelector('#tv265-appearance-panel'))return;
 const grid=page.querySelector('.v2-grid');if(!grid)return;
 const panel=document.createElement('section');panel.id='tv265-appearance-panel';panel.className='v2-card tv265-appearance-panel';
 panel.innerHTML='<div class="v2-overline">VISUAL ATMOSPHERE · REVERSIBLE</div><h3>Iridescence & motion</h3><p>Each area uses its own texture. These controls change only appearance, never campaign data.</p><div class="tv265-appearance-controls"></div><p class="tv265-setting-note">Saved on this device. Turn textures off independently to restore the original design, keeping all new functionality.</p>';
 const group=panel.querySelector('.tv265-appearance-controls');
 for(const [key,name,info] of [
  ['textures','Iridescent textures','Original, different textures for the Dashboard, characters, initiative, lore, and rare achievements.'],
  ['motion','Atmospheric movement','Subtle pointer parallax, article scroll depth, and rare-achievement shimmer.']
 ]){
  const row=document.createElement('div');row.className='tv265-setting';
  const copy=document.createElement('div');copy.className='tv265-setting-copy';
  const strong=document.createElement('strong');strong.textContent=name;
  const small=document.createElement('small');small.textContent=info;
  copy.append(strong,small);
  const btn=document.createElement('button');btn.className='tv265-setting-toggle';btn.type='button';btn.dataset.tv265Setting=key;btn.setAttribute('aria-label',name);
  btn.addEventListener('click',()=>set(key,!state[key]));row.append(copy,btn);group.append(row);
 }
 grid.before(panel);updateButtons();
}
function updateButtons(){for(const b of document.querySelectorAll('[data-tv265-setting]')){const on=!!state[b.dataset.tv265Setting];b.setAttribute('aria-pressed',String(on));b.classList.toggle('is-on',on);b.textContent=on?'On':'Off'}}
function cabinetCSS(){return 'html[data-tv265-textures="on"] .ach-card.is-earned:is([data-rarity="rare"],[data-rarity="epic"],[data-rarity="legendary"],[data-rarity="mythic"])::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;border-radius:inherit;background-image:linear-gradient(120deg,transparent 12%,#daeeff20 47%,transparent 76%),var(--tv265-art-achievements,none);background-size:230% 100%,cover;background-position:110% 0,center;opacity:.14;mix-blend-mode:screen;transition:opacity .3s}html[data-tv265-textures="on"] .ach-card.is-earned:hover::after{opacity:.31}html[data-tv265-textures="on"][data-tv265-motion="on"] .ach-card.is-earned:hover::after{animation:tv265-shimmer 2.4s ease-out 1}@keyframes tv265-shimmer{from{background-position:120% 0,center}to{background-position:-130% 0,center}}@media(prefers-reduced-motion:reduce){.ach-card::after{animation:none!important}}'}
function mountCabinet(){
 const frame=document.getElementById('tv-cabinet-v2-frame');if(!frame)return;
 try{
  const doc=frame.contentDocument;if(!doc?.head)return;
  if(!doc.getElementById('tv265-cabinet-style')){const css=doc.createElement('style');css.id='tv265-cabinet-style';css.textContent=cabinetCSS();doc.head.append(css)}
  doc.documentElement.dataset.tv265Textures=state.textures?'on':'off';
  doc.documentElement.dataset.tv265Motion=canMove()?'on':'off';
  doc.documentElement.style.setProperty('--tv265-art-achievements',getComputedStyle(ROOT).getPropertyValue('--tv265-art-achievements'));
  if(frame.dataset.tv265Load!=='1'){frame.dataset.tv265Load='1';frame.addEventListener('load',schedule)}
 }catch{}
}
function clearMotion(){
 for(const el of document.querySelectorAll('.tv265-surface'))for(const k of ['--tv265-x','--tv265-y','--tv265-scroll'])el.style.removeProperty(k);
 for(const el of document.querySelectorAll('.sr-encounter'))for(const k of ['--tv264-mx','--tv264-my','--tv264-mx-soft','--tv264-my-soft'])el.style.removeProperty(k);
}
function apply(){ROOT.dataset.tv265Textures=state.textures?'on':'off';ROOT.dataset.tv265Motion=canMove()?'on':'off';if(!canMove())clearMotion();updateButtons();mountCabinet()}
function set(k,v){if(!(k in state))return;state[k]=!!v;try{localStorage.setItem(k==='textures'?TEXTURE_KEY:MOTION_KEY,v?'on':'off')}catch{}apply()}
window.TerravaleAtmosphereV265={read:()=>({...state,activeMotion:canMove()}),setTextures:v=>set('textures',v),setMotion:v=>set('motion',v)};
let queued=false;function run(){queued=false;mount()}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
document.addEventListener('pointermove',e=>{
 if(!canMove()||e.pointerType==='touch'||!(e.target instanceof Element))return;
 const el=e.target.closest('.tv265-surface');if(!el)return;
 const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;
 el.style.setProperty('--tv265-x',(((e.clientX-r.left)/r.width-.5)*9).toFixed(2)+'px');
 el.style.setProperty('--tv265-y',(((e.clientY-r.top)/r.height-.5)*7).toFixed(2)+'px');
},{passive:true});
document.addEventListener('pointerout',e=>{
 const el=e.target instanceof Element?e.target.closest('.tv265-surface'):null;
 if(el&&!(e.relatedTarget instanceof Element&&el.contains(e.relatedTarget))){el.style.removeProperty('--tv265-x');el.style.removeProperty('--tv265-y')}
},{passive:true});
let scrollFrame=0;document.addEventListener('scroll',()=>{
 if(!canMove()||scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{
  scrollFrame=0;
  for(const el of document.querySelectorAll('.tv265-lore,.tv265-article-image')){
   const r=el.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;
   const depth=Math.max(-7,Math.min(7,(innerHeight/2-r.top-r.height/2)*.015));
   el.style.setProperty('--tv265-scroll',depth.toFixed(2)+'px');
  }
 });
},{passive:true,capture:true});
window.addEventListener('hashchange',()=>{clearMotion();schedule()});media?.addEventListener?.('change',apply);
new MutationObserver(schedule).observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
apply();schedule();
})();