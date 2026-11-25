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
function render(c,records,card){
 const native=document.querySelector('#pageRoot .sheet20-content>.sheet20-resource-panel');
 if(!native)return;
 native.classList.add('tv287-native-source');
 let panel=document.getElementById('tv291-spell-sheet');
 if(!panel){panel=n('section','sheet20-panel tv291-spell-sheet');panel.id='tv291-spell-sheet';native.after(panel)}
 panel.replaceChildren();
 panel.append(n('div','tv287-eyebrow','CHARACTER SHEET · SPELLCASTING'),n('h2','','Spells'));
 const slots=n('div','tv287-catalog-grid');
 for(const record of records)slots.append(card(record,false));
 if(records.length)panel.append(n('h3','','Slots & spellcasting abilities'),slots);
 const source=spells().filter(s=>s.edition==='2014');
 const key=listClass(c);
 const pool=source.filter(s=>s.classes.includes(key));
 const max=Math.max(0,...records.filter(r=>r.kind==='spell').map(r=>Number((r.id.match(/(?:spell|pact)-slot-([1-9])/i)||r.name.match(/(?:level|slot)\s*([1-9])/i)||[])[1])||0));
 const demo=String(c.demoCurator||'').toLowerCase()==='aster';
 const recommended=demo?(curated[c.name]||[]):[];
 panel.append(n('h3','','Spellbook reference'),n('p','tv287-muted','2014 SRD reference · Spell selections below are suggestions, not approved known or prepared spells. Casting and permanent selection are not enabled yet.'));
 const tools=n('div','tv291-spell-tools');const search=n('input','tv287-search');search.type='search';search.placeholder='Search spells…';tools.append(search);
 const list=n('div','tv291-spell-list');panel.append(tools,list);
 let onlySuggested=!!recommended.length;
 if(recommended.length){const toggle=n('button','tv287-filter','Demo suggestions');toggle.type='button';toggle.setAttribute('aria-pressed','true');toggle.onclick=()=>{onlySuggested=!onlySuggested;toggle.setAttribute('aria-pressed',String(onlySuggested));draw()};tools.append(toggle)}
 function draw(){
  list.replaceChildren();
  const query=search.value.toLowerCase().trim();
  const rows=pool.filter(s=>(!onlySuggested||recommended.includes(s.id.split(':')[1]))&&(!max||s.level<=max)&&(!query||s.name.toLowerCase().includes(query))).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
  for(const s of rows){const row=n('details','tv291-spell-row');const head=n('summary','');head.append(n('strong','',s.name),n('span','tv287-muted',(s.level?'Level '+s.level:'Cantrip')+' · '+s.school));row.append(head,n('p','tv287-muted',[s.castingTime,s.range,s.duration].join(' · ')),n('p','tv291-description',s.description));list.append(row)}
  if(!rows.length)list.append(n('p','tv287-empty',pool.length?'No matching spells.':'No verified SRD class list is mapped to this character. Custom or granted spells require approved rules.'));
 }
 search.addEventListener('input',draw);draw();
}
window.TerravaleSheetSpells={eligible,render};
})();