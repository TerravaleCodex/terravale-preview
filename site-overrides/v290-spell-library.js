/* V2 read-only SRD Spell Library. Does not alter sheets, slots or campaign state. */
(()=>{'use strict';
const raw=document.getElementById('tv-live-srd-spells');
if(!raw)return;
let data;try{data=JSON.parse(raw.textContent)}catch(e){console.error('SRD Spell Library data invalid',e);return}
if(!Array.isArray(data)||data.length<600)return;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let edition='2014',query='',level='all',school='all',spellClass='all',ritual=false,concentration=false,selected='';
const levels=[0,1,2,3,4,5,6,7,8,9];
const schools=[...new Set(data.map(x=>x.school))].filter(Boolean).sort();
const classes=[...new Set(data.flatMap(x=>x.classes))].filter(Boolean).sort();
const sourceCount=version=>data.filter(x=>x.edition===version).length;
const route=()=>/^#\/spells(?:\/|\?|$)/i.test(location.hash);
const matches=()=>data.filter(s=>s.edition===edition&&(level==='all'||s.level===Number(level))&&(school==='all'||s.school===school)&&(spellClass==='all'||s.classes.includes(spellClass))&&(!ritual||s.ritual)&&(!concentration||s.concentration)&&(!query||[s.name,s.school,...s.classes,s.description].join(' ').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
const levelName=n=>n===0?'Cantrip':'Level '+n;
function contentHTML(){
return '<section id="tv-spells-page" class="tv-spells-page" aria-label="Spell Library">'+
 '<header class="tv-spell-hero"><div><div class="tv-spell-eyebrow">TERRAVALE · PUBLIC LIBRARY</div><h1>Spell Library</h1><p>Browse fifth-edition spells by level, class and school. Edition-specific descriptions and casting details are preserved for future character-sheet integration.</p></div><span class="tv-spell-decor">✧</span></header>'+
 '<div class="tv-spell-editions" role="group" aria-label="Spell rules edition"><button type="button" data-srd-edition="2014" aria-pressed="true"><strong>5e · 2014</strong><small>SRD 5.1 · '+sourceCount('2014')+' spells</small></button><button type="button" data-srd-edition="2024" aria-pressed="false"><strong>5e · 2024</strong><small>SRD 5.2.1 · '+sourceCount('2024')+' spells</small></button></div>'+
 '<div class="tv-spell-filters"><div class="tv-spell-filter-title"><strong>Find a spell</strong><button type="button" id="tv-spell-clear">Clear filters</button></div>'+
 '<div class="tv-spell-inputs"><label>Search<input type="search" id="tv-spell-query" placeholder="Search names or spell effects" autocomplete="off"></label>'+
 '<label>School<select id="tv-spell-school"><option value="all">All schools</option>'+schools.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('')+'</select></label>'+
 '<label>Class<select id="tv-spell-class"><option value="all">All classes</option>'+classes.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('')+'</select></label></div>'+
 '<div class="tv-spell-filter-row"><div id="tv-spell-levels" role="group" aria-label="Spell level"><button type="button" data-srd-level="all" aria-pressed="true">All</button>'+levels.map(n=>'<button type="button" data-srd-level="'+n+'" aria-pressed="false">'+(n===0?'C':n)+'</button>').join('')+'</div>'+
 '<div class="tv-spell-flags"><button type="button" id="tv-spell-ritual" aria-pressed="false">✧ Ritual</button><button type="button" id="tv-spell-concentration" aria-pressed="false">◈ Concentration</button></div></div></div>'+
 '<div class="tv-spell-workspace"><aside class="tv-spell-index" aria-label="Spell index"><div class="tv-spell-index-head"><strong id="tv-spell-count"></strong><small>Level · A–Z</small></div><div id="tv-spell-list" class="tv-spell-index-scroll"></div></aside><main class="tv-spell-reader" id="tv-spell-reader" aria-live="polite"></main></div>'+
 '<p class="tv-spell-license">Includes material from the System Reference Document 5.1 and System Reference Document 5.2.1 by Wizards of the Coast LLC, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons Attribution 4.0</a>. The text has been indexed and reformatted. <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">Official SRD</a>. Transcriptions: 5e-bits/5e-database (2014), downfallx/dnd-5e-srd-markdown (2024). Only spells present in these SRDs are included.</p>'+
 '</section>';
}
// Replace browser-native select menus with compact, theme-consistent menus.
function enhanceFilterSelects(root){
 for(const id of ['tv-spell-school','tv-spell-class']){
  const select=root.querySelector('#'+id);
  const frame=document.createElement('div');frame.className='tv-spell-select';frame.dataset.open='false';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='tv-spell-select-trigger';
  trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-label',id==='tv-spell-school'?'Filter by school':'Filter by class');
  const options=document.createElement('div');options.className='tv-spell-select-menu';options.setAttribute('role','listbox');
  options.setAttribute('aria-label',id==='tv-spell-school'?'Schools':'Classes');
  const sync=()=>{
   const selectedOption=select.selectedOptions[0];trigger.textContent=selectedOption?.textContent||'All';
   options.querySelectorAll('button').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.value===select.value));});
  };
  const close=()=>{frame.dataset.open='false';trigger.setAttribute('aria-expanded','false');};
  trigger.addEventListener('click',()=>{
   const shouldOpen=frame.dataset.open!=='true';
   root.querySelectorAll('.tv-spell-select').forEach(el=>{
    el.dataset.open='false';el.querySelector('.tv-spell-select-trigger')?.setAttribute('aria-expanded','false');
   });
   if(shouldOpen){frame.dataset.open='true';trigger.setAttribute('aria-expanded','true');}
  });
  for(const option of [...select.options]){
   const button=document.createElement('button');button.type='button';button.setAttribute('role','option');
   button.dataset.value=option.value;button.textContent=option.textContent;
   button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();trigger.focus();});
   options.append(button);
  }
  select.after(frame);frame.append(select,trigger,options);select.classList.add('tv-spell-native-select');
  frame.addEventListener('keydown',event=>{
   if(event.key==='Escape'){close();trigger.focus();}
   if(event.key==='ArrowDown'&&event.target===trigger&&frame.dataset.open!=='true'){event.preventDefault();trigger.click();options.querySelector('[aria-selected="true"]')?.focus();}
  });
  select.addEventListener('change',sync);
  sync();
 }
 document.addEventListener('pointerdown',event=>{
  if(root.isConnected&&!event.target.closest('.tv-spell-select'))
   root.querySelectorAll('.tv-spell-select').forEach(el=>{el.dataset.open='false';el.querySelector('.tv-spell-select-trigger')?.setAttribute('aria-expanded','false');});
 },{signal:root._spellAbort.signal});
}
function renderList(resetScroll=false){
const root=$('#tv-spells-page');if(!root)return;
const list=matches();if(!list.some(s=>s.id===selected))selected=list[0]?.id||'';
root.querySelector('#tv-spell-count').textContent=list.length+' matching spells';
const scrollArea=root.querySelector('#tv-spell-list');const previousScroll=scrollArea.scrollTop;
scrollArea.innerHTML=list.map(s=>'<button type="button" class="tv-spell-list-item" data-spell-id="'+esc(s.id)+'" aria-current="'+(s.id===selected)+'"><span><strong>'+esc(s.name)+'</strong><small>'+levelName(s.level)+' · '+esc(s.school)+(s.ritual?' · Ritual':'')+'</small></span><b>'+(s.level||'C')+'</b></button>').join('')||'<div class="tv-spell-empty">No spells match these filters.</div>';
scrollArea.scrollTop=resetScroll?0:previousScroll;
root.querySelectorAll('[data-spell-id]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.spellId;renderList(false);}));
root.querySelectorAll('[data-srd-edition]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.srdEdition===edition)));
root.querySelectorAll('[data-srd-level]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.srdLevel===String(level))));
root.querySelector('#tv-spell-ritual').setAttribute('aria-pressed',String(ritual));
root.querySelector('#tv-spell-concentration').setAttribute('aria-pressed',String(concentration));
renderReader();
}
function renderReader(){
const root=$('#tv-spells-page');if(!root)return;const target=root.querySelector('#tv-spell-reader'),s=data.find(x=>x.id===selected);
if(!s){target.innerHTML='<div class="tv-spell-empty">No matching spell. Try clearing your filters.</div>';return;}
const fields=[['Casting time',s.castingTime],['Range',s.range],['Duration',s.duration],['Components',(s.components||[]).join(', ')||'None']];
target.innerHTML='<div class="tv-spell-reader-top"><div><div class="tv-spell-eyebrow">'+esc(s.source)+' · '+esc(s.edition)+' RULES</div><h2>'+esc(s.name)+'</h2><p>'+levelName(s.level)+' · '+esc(s.school)+(s.ritual?' · Ritual':'')+'</p></div><span class="tv-spell-level-badge">'+(s.level||'C')+'</span></div>'+
'<div class="tv-spell-stats">'+fields.map(([label,value])=>'<div><small>'+esc(label)+'</small><strong>'+esc(value||'Not listed')+'</strong></div>').join('')+'</div>'+
'<div class="tv-spell-tags"><span class="'+(s.ritual?'active':'')+'">Ritual: '+(s.ritual?'Yes':'No')+'</span><span class="'+(s.concentration?'active':'')+'">Concentration: '+(s.concentration?'Yes':'No')+'</span></div>'+
'<section class="tv-spell-description"><h3>Spell description</h3>'+String(s.description||'').split(/\n\s*\n/).filter(Boolean).map(t=>'<p>'+esc(t).replace(/\n/g,'<br>')+'</p>').join('')+'</section>'+
'<section class="tv-spell-class-list"><h3>Available to</h3><div>'+s.classes.map(c=>'<span>'+esc(c)+'</span>').join('')+'</div></section>'+
'<div class="tv-spell-integration"><strong>Ready for future character-sheet integration</strong><p>Stable reference ID <code>'+esc(s.id)+'</code>. Later versions can link known and prepared spells, slot use, upcasting and concentration to this record. Material ingredients are reference text only; inventory tracking is not planned.</p></div>';
}
function attachHandlers(root){
root._spellAbort=new AbortController();
enhanceFilterSelects(root);
root.querySelectorAll('[data-srd-edition]').forEach(b=>b.addEventListener('click',()=>{edition=b.dataset.srdEdition;selected='';renderList(true)}));
root.querySelector('#tv-spell-query').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();selected='';renderList(true)});
root.querySelector('#tv-spell-school').addEventListener('change',e=>{school=e.target.value;selected='';renderList(true)});
root.querySelector('#tv-spell-class').addEventListener('change',e=>{spellClass=e.target.value;selected='';renderList(true)});
root.querySelectorAll('[data-srd-level]').forEach(b=>b.addEventListener('click',()=>{level=b.dataset.srdLevel;selected='';renderList(true)}));
root.querySelector('#tv-spell-ritual').addEventListener('click',()=>{ritual=!ritual;selected='';renderList(true)});
root.querySelector('#tv-spell-concentration').addEventListener('click',()=>{concentration=!concentration;selected='';renderList(true)});
root.querySelector('#tv-spell-clear').addEventListener('click',()=>{query='';level='all';school='all';spellClass='all';ritual=false;concentration=false;selected='';root.querySelector('#tv-spell-query').value='';root.querySelector('#tv-spell-school').value='all';root.querySelector('#tv-spell-class').value='all';renderList(true)});
}
function navigation(){
// Existing native V2 sidebars render buttons rather than regular anchors.
const candidates=[...document.querySelectorAll('aside a,aside button,.sidebar a,.sidebar button')];
const classes=candidates.find(el=>{const text=(el.textContent||'').trim();return !el.closest('#tv-spells-page')&&(text==='Classes'||/^(?:[^a-zA-Z]{0,6}\s*)?Classes$/.test(text)||el.dataset?.tourNav==='/classes'||el.getAttribute('href')?.includes('/classes'));});
if(!classes)return;
let link=document.getElementById('tv-spells-sidebar-link');
if(!link){
 link=classes.cloneNode(true);link.id='tv-spells-sidebar-link';
 link.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 if(link.tagName==='A'){link.href='#/spells';}
 else{link.removeAttribute('onclick');link.removeAttribute('data-route');link.removeAttribute('data-page');link.type='button';}
 link.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();location.hash='#/spells';mount()});
 const spans=link.querySelectorAll('span');
 if(spans.length){const label=spans[spans.length-1];label.textContent='Spells';}
 else link.textContent='✧  Spells';
 classes.insertAdjacentElement('afterend',link);
}
if(link.tagName==='A')link.href='#/spells';
link.classList.toggle('active',route());
}
function mount(){
navigation();
if(!route())return;
const root=$('#pageRoot');if(!root)return;
if(root.querySelector('#tv-spells-page'))return;
root.innerHTML=contentHTML();
const page=root.querySelector('#tv-spells-page');
attachHandlers(page);renderList(true);
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount()});}
window.addEventListener('hashchange',()=>{setTimeout(schedule,20);setTimeout(schedule,170);});
const observer=new MutationObserver(schedule);
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
schedule();
})();