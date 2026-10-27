/* Terravale public appearance bridge v0.12.4.
 * Enhances the previous compiled release without changing game state or authentication.
 * Superseded automatically when the next fully compiled build is promoted.
 */
(()=>{
'use strict';
const SITE_KEY='terravale.cosmetic.site.v1';
const BRIDGE_KEY='terravale.unified.theme.v2';
const ADDITIONAL=[
 {id:'shotxo',name:'Shotxo · Demon Slayer',description:'VTuber-inspired violet-black, lilac and subtle gold.',swatches:['#090713','#241834','#c1a3ff']},
 {id:'shady',name:'Shady · Obsidian & Ivory',description:'Near-black with soft, weathered-bone highlights.',swatches:['#050506','#171518','#c5b8a4']},
 {id:'absolute-zero',name:'Absolute Zero · OLED',description:'True black, near-invisible panels, no decorative effects.',swatches:['#000000','#030303','#ababab']},
 {id:'sanguine',name:'Sanguine Court',description:'Vampiric burgundy, velvet-black and muted antique gold.',swatches:['#13080c','#301820','#d6a48c']},
 {id:'verdant',name:'Verdant Court',description:'Moss, emerald and dark woodland green.',swatches:['#07150e','#20372a','#bad098']},
 {id:'dragonforge',name:'Dragonforge',description:'Smoked iron, copper and ember.',swatches:['#15110e','#362921','#e6ab78']},
 {id:'astral',name:'Astral Archive',description:'Midnight ink, star charts and brass.',swatches:['#0b1020','#202e47','#d8bd84']},
 {id:'null-meridian',name:'Null Meridian',description:'Industrial graphite, amber and precise lines.',swatches:['#0b0d0d','#232829','#c3b07b']}
];
const THEMES=new Set(['dark','night-sky',...ADDITIONAL.map(t=>t.id)]);
function getPreference(){
 try{
  const selected=localStorage.getItem(BRIDGE_KEY)||localStorage.getItem(SITE_KEY)||'dark';
  return THEMES.has(selected)?selected:'dark';
 }catch{return 'dark';}
}
let current=getPreference(),scheduled=false;
function applyTheme(id,persist=true){
 if(!THEMES.has(id))return;
 current=id;
 if(document.documentElement.dataset.appTheme!==id)document.documentElement.dataset.appTheme=id;
 if(persist)try{localStorage.setItem(BRIDGE_KEY,id);localStorage.setItem(SITE_KEY,id);}catch{}
 for(const select of document.querySelectorAll('select[aria-label="Website theme"],select[aria-label="Website and character-sheet theme"]')){
  if(select.value!==id&&select.querySelector('option[value="'+id+'"]'))select.value=id;
 }
 for(const tile of document.querySelectorAll('.theme-gallery[aria-label="Website theme choices"] .theme-tile')){
  const selected=tile.getAttribute('data-theme-id')===id;
  tile.classList.toggle('selected',selected);
  tile.setAttribute('aria-pressed',String(selected));
  const label=tile.querySelector('.theme-tile-active');
  if(label){const message=selected?'✓ Active everywhere':'Apply to site & sheets →';if(label.textContent!==message)label.textContent=message;}
 }
}
function makeTile(t){
 const button=document.createElement('button');button.type='button';
 button.className='theme-tile';button.dataset.themeId=t.id;button.dataset.publicTheme='true';
 const art=document.createElement('span');art.className='theme-tile-art';art.style.background=t.swatches[0];
 const side=document.createElement('span');side.className='theme-tile-sidebar';side.style.background=t.swatches[1];
 const screen=document.createElement('span');screen.className='theme-tile-screen';screen.style.background=t.swatches[1];screen.style.borderColor=t.swatches[2];
 const line1=document.createElement('i'),line2=document.createElement('i');
 line1.style.background=t.swatches[2];line2.style.background=t.swatches[2];line2.style.opacity='.45';
 screen.append(line1,line2);art.append(side,screen);
 const title=document.createElement('strong');title.textContent=t.name;
 const description=document.createElement('small');description.textContent=t.description;
 const active=document.createElement('span');active.className='theme-tile-active';
 button.append(art,title,description,active);
 button.addEventListener('click',()=>{
  // The compiled React provider can accept the new value from its own select.
  const select=document.querySelector('select[aria-label="Website theme"],select[aria-label="Website and character-sheet theme"]');
  if(select){select.value=t.id;select.dispatchEvent(new Event('change',{bubbles:true}));}
  applyTheme(t.id,true);
 });
 return button;
}
function enhance(){
 for(const select of document.querySelectorAll('select[aria-label="Website theme"],select[aria-label="Website and character-sheet theme"]')){
  select.setAttribute('aria-label','Website and character-sheet theme');
  for(const t of ADDITIONAL)if(!Array.from(select.options).some(o=>o.value===t.id)){
   const option=document.createElement('option');option.value=t.id;option.textContent=t.name;select.append(option);
  }
  if(!select.dataset.unifiedListener){
   select.dataset.unifiedListener='true';
   select.addEventListener('change',()=>applyTheme(select.value,true));
  }
 }
 const gallery=document.querySelector('.theme-gallery[aria-label="Website theme choices"]');
 if(gallery){
  for(const t of ADDITIONAL)if(!gallery.querySelector('[data-theme-id="'+t.id+'"]'))gallery.append(makeTile(t));
  const panel=gallery.closest('.panel');const title=panel?.querySelector('.panel-head h2');
  if(title&&title.textContent!=='Website & character-sheet themes')title.textContent='Website & character-sheet themes';
  const panelTag=panel?.querySelector('.counter');if(panelTag&&panelTag.textContent!=='One shared preference · this device')panelTag.textContent='One shared preference · this device';
 }
 const intro=document.querySelector('.section-heading p');
 if(intro&&document.querySelector('.theme-gallery[aria-label="Website theme choices"]')&&intro.textContent?.includes('Only Classic Dark'))
  intro.textContent='Choose one of ten dark themes. Your choice automatically colours every character sheet and the website.';
 for(const panel of document.querySelectorAll('.panel')){
  const h=panel.querySelector(':scope > h2');
  if(!h)continue;
  if(h.textContent==='Character sheet themes')panel.style.display='none';
  if(h.textContent==='Visual style rebuild'){
   h.textContent='One theme, everywhere';
   const p=panel.querySelector('p');
   if(p)p.textContent='Character sheets now inherit your website theme. Class-specific layouts and all game mechanics remain unchanged.';
  }
 }
 for(const bar of document.querySelectorAll('.sheet-appearance-toolbar')){
  const title=bar.querySelector('strong');
  if(title&&title.textContent?.startsWith('Sheet appearance'))title.textContent='Theme follows website';
  const eyebrow=bar.querySelector('.eyebrow');
  if(eyebrow&&eyebrow.textContent!=='UNIFIED APPEARANCE')eyebrow.textContent='UNIFIED APPEARANCE';
  const label=bar.querySelector('label');if(label)label.style.display='none';
  const link=bar.querySelector('a[href$="/appearance"]');
  if(link&&link.textContent!=='Change site & sheet theme ↗')link.textContent='Change site & sheet theme ↗';
 }
 applyTheme(current,false);
}
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;enhance();});
}
const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-app-theme']});
document.addEventListener('change',e=>{
 const t=e.target;if(!(t instanceof HTMLSelectElement))return;
 if(t.matches('select[aria-label="Website theme"],select[aria-label="Website and character-sheet theme"]'))applyTheme(t.value,true);
},true);
window.addEventListener('storage',e=>{if(e.key===BRIDGE_KEY||e.key===SITE_KEY){const next=getPreference();if(next!==current)applyTheme(next,false);}});
applyTheme(current,false);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
