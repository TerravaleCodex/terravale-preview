/* Read-only spellbook foundation. Native resource buttons remain authoritative. */
(function(){
'use strict';
const n=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
const read=id=>{try{return JSON.parse(document.getElementById(id)?.textContent||'[]')}catch{return[]}};
const spells=()=>read('tv-live-srd-spells');
const schedules=()=>read('v234-spell-tables');
const classKey=c=>String(c.className||c.class||'');
const subclass=c=>String(c.subclassName||c.subclass||'');
const rule=c=>schedules()[classKey(c)+'|'+subclass(c)]||schedules()[classKey(c)];
const listClass=c=>['Eldritch Knight','Arcane Trickster'].includes(subclass(c))?'Wizard':classKey(c);
const curated={
 'Aster Vaelith':['mending','mage-hand','light','minor-illusion','shield','mage-armor','detect-magic','comprehend-languages','feather-fall','magic-missile','identify','find-familiar','misty-step','mirror-image','invisibility','see-invisibility','counterspell','dispel-magic','fly','tongues'],
 'Elira Wren':['vicious-mockery','minor-illusion','mage-hand','healing-word','heroism','dissonant-whispers','faerie-fire','suggestion','lesser-restoration','invisibility'],
 'Pip Thornwhistle':['hunters-mark','cure-wounds','goodberry']
};
const eligible=(c,records)=>!!(records.length||rule(c)||c.spells?.length);
const views=new Map();
const slotLevel=r=>Number((r.id.match(/(?:spell|pact)-slot-([1-9])/i)||r.name.match(/([1-9])(?:st|nd|rd|th)[ -]level/i)||r.name.match(/(?:level|slot)\s*([1-9])/i)||[])[1])||0;
function render(c,records,card){
 const native=document.querySelector('#pageRoot .sheet20-content>.sheet20-resource-panel');
 if(!native)return;
 native.classList.add('tv287-native-source');
 let panel=document.getElementById('tv291-spell-sheet');
 if(!panel){panel=n('section','sheet20-panel tv291-spell-sheet');panel.id='tv291-spell-sheet';native.after(panel)}
 const key=String(c.id), demo=String(c.demoCurator||'').toLowerCase()==='aster', recommended=demo?(curated[c.name]||[]):[];
 if(!views.has(key))views.set(key,{query:'',level:'all',suggested:!!recommended.length,selected:''});
 const view=views.get(key);
 panel.replaceChildren();
 const header=n('header','tv291-header'), heading=n('div');
 heading.append(n('div','tv287-eyebrow','CHARACTER SHEET · SPELLCASTING'),n('h2','','Spells'),n('p','tv287-muted',classKey(c)+' · Level '+c.level+' · 2014 SRD reference'));
 header.append(heading);panel.append(header);
 const slotRecords=records.filter(r=>r.kind==='spell'), abilities=records.filter(r=>r.kind!=='spell');
 const top=n('div','tv291-top');
 if(slotRecords.length){
  const block=n('section','tv291-block');block.append(n('h3','','Spell slots'));
  const grid=n('div','tv291-slot-grid');
  for(const r of slotRecords){
   const item=card(r,false);item.classList.add('tv291-slot-card');
   const track=item.querySelector('.tv287-track');
   if(track&&Number.isInteger(r.counter.max)&&r.counter.max>0&&r.counter.max<=20&&Number.isInteger(r.counter.current)){
    const dots=n('div','tv291-slot-pips');dots.setAttribute('aria-label',r.counter.label+' slots available');
    for(let i=0;i<r.counter.max;i++){const pip=n('span','tv291-pip');pip.dataset.available=String(i<r.counter.current);dots.append(pip)}
    track.replaceWith(dots);
   }
   grid.append(item);
  }
  block.append(grid);top.append(block);
 }
 if(abilities.length){const block=n('section','tv291-block');block.append(n('h3','','Spellcasting abilities'));const grid=n('div','tv291-ability-grid');for(const r of abilities)grid.append(card(r,false));block.append(grid);top.append(block)}
 if(top.children.length)panel.append(top);
 const pool=spells().filter(s=>s.edition==='2014'&&s.classes.includes(listClass(c)));
 const max=Math.max(0,...slotRecords.map(slotLevel));
 const book=n('section','tv291-book'),bookHead=n('div','tv291-book-head'),title=n('div');
 title.append(n('h3','','Spellbook'),n('p','tv287-muted','Reference only · Known spells and casting not yet enabled.'));
 bookHead.append(title);
 if(recommended.length){const toggle=n('button','tv287-filter','Demo suggestions');toggle.type='button';toggle.setAttribute('aria-pressed',String(view.suggested));toggle.onclick=()=>{view.suggested=!view.suggested;toggle.setAttribute('aria-pressed',String(view.suggested));draw()};bookHead.append(toggle)}
 book.append(bookHead);
 const tools=n('div','tv291-spell-tools'),search=n('input','tv287-search');search.type='search';search.placeholder='Search spells…';search.value=view.query;search.setAttribute('aria-label','Search character spells');
 const levels=n('div','tv291-levels');tools.append(search,levels);book.append(tools);
 const workspace=n('div','tv291-workspace'),list=n('div','tv291-spell-list'),reader=n('div','tv291-reader');workspace.append(list,reader);book.append(workspace);panel.append(book);
 function detail(s){
  reader.replaceChildren();
  if(!s){reader.append(n('p','tv287-empty','No matching spell.'));return}
  const head=n('div','tv291-reader-head');head.append(n('div','tv287-eyebrow',(s.level?'Level '+s.level:'Cantrip')+' · '+s.school),n('h3','',s.name));reader.append(head);
  const stats=n('div','tv291-stat-grid');
  for(const [label,value] of [['Casting time',s.castingTime],['Range',s.range],['Duration',s.duration],['Components',(s.components||[]).join(', ')]]){const box=n('div','tv291-stat');box.append(n('small','',label),n('strong','',value||'—'));stats.append(box)}
  reader.append(stats);
  const tags=n('div','tv291-tags');if(s.ritual)tags.append(n('span','','Ritual'));if(s.concentration)tags.append(n('span','','Concentration'));if(tags.children.length)reader.append(tags);
  reader.append(n('p','tv291-description',s.description));
 }
 function draw(){
  const oldScroll=list.scrollTop;list.replaceChildren();levels.replaceChildren();
  const base=pool.filter(s=>(!view.suggested||recommended.includes(s.id.split(':')[1]))&&(!max||s.level<=max)&&(!view.query||s.name.toLowerCase().includes(view.query.toLowerCase().trim())));
  const options=['all',...new Set(base.map(s=>s.level).sort((a,b)=>a-b))];
  if(!options.includes(view.level))view.level='all';
  for(const l of options){const b=n('button','tv287-filter',l==='all'?'All':l===0?'Cantrips':String(l));b.type='button';b.setAttribute('aria-pressed',String(view.level===l));b.onclick=()=>{view.level=l;view.selected='';list.scrollTop=0;draw()};levels.append(b)}
  const rows=base.filter(s=>view.level==='all'||s.level===view.level).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
  if(!rows.some(s=>s.id===view.selected))view.selected=rows[0]?.id||'';
  let last=-1;
  for(const s of rows){
   if(s.level!==last){list.append(n('div','tv291-level-heading',s.level?'Level '+s.level:'Cantrips'));last=s.level}
   const row=n('button','tv291-spell-choice');row.type='button';row.setAttribute('aria-pressed',String(s.id===view.selected));
   const label=n('div');label.append(n('strong','',s.name),n('small','',s.school+(s.ritual?' · Ritual':'')+(s.concentration?' · Concentration':'')));row.append(label,n('span','tv291-choice-level',s.level?String(s.level):'C'));
   row.onclick=()=>{view.selected=s.id;list.querySelectorAll('.tv291-spell-choice').forEach(x=>x.setAttribute('aria-pressed',String(x===row)));detail(s)};list.append(row)
  }
  if(!rows.length)list.append(n('p','tv287-empty',pool.length?'No matching spells.':'No verified SRD class list is mapped to this character.'));
  list.scrollTop=oldScroll;detail(rows.find(s=>s.id===view.selected));
 }
 search.addEventListener('input',()=>{view.query=search.value;view.selected='';list.scrollTop=0;draw()});draw();
}
window.TerravaleSheetSpells={eligible,render};
})();