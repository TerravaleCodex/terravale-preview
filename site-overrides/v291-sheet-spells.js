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
const scales=s=>/at higher levels|using a higher.level spell slot|using a spell slot of|higher.level slot/i.test(s.description||'');
function confirmInPage(title,fields,description,accept){
 const dialog=n('dialog','tv294-confirm');dialog.setAttribute('aria-label',title);
 const h=n('h2','',title),grid=n('div','tv291-stat-grid');
 for(const [label,value] of fields){const item=n('div','tv291-stat');item.append(n('small','',label),n('strong','',value));grid.append(item)}
 const buttons=n('div','tv294-dialog-actions'),cancel=n('button','tv292-point-action','Cancel'),ok=n('button','tv292-point-action tv294-primary','Confirm');
 cancel.type=ok.type='button';cancel.onclick=()=>dialog.close();ok.onclick=()=>{dialog.close();accept()};
 buttons.append(cancel,ok);dialog.append(h,grid,n('p','tv287-muted',description),buttons);document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();cancel.focus();
}
function render(c,records,card){
 const native=document.querySelector('#pageRoot .sheet20-content>.sheet20-resource-panel');
 if(!native)return;
 native.classList.add('tv287-native-source');
 let panel=document.getElementById('tv291-spell-sheet');
 if(!panel){panel=n('section','sheet20-panel tv291-spell-sheet');panel.id='tv291-spell-sheet';native.after(panel)}
 const key=String(c.id), demo=String(c.demoCurator||'').toLowerCase()==='aster', recommended=demo?(curated[c.name]||[]):[];
 if(!views.has(key))views.set(key,{query:'',level:'all',suggested:!!recommended.length,selected:'',favouritesOnly:false});
 const view=views.get(key);
 const account=window.TerravaleVerifiedAccount?.state?.user?.id||'browser';
 const favKey='tv291-reference-favourites:'+account+':'+key;
 let favourites=new Set();try{const saved=JSON.parse(localStorage.getItem(favKey)||'[]');if(Array.isArray(saved))favourites=new Set(saved)}catch{}
 function toggleFavourite(id){if(favourites.has(id))favourites.delete(id);else favourites.add(id);try{localStorage.setItem(favKey,JSON.stringify([...favourites]))}catch{}draw();}
 panel.replaceChildren();
 const header=n('header','tv291-header'), heading=n('div');
 heading.append(n('div','tv287-eyebrow','CHARACTER SHEET · SPELLCASTING'),n('h2','','Spells'),n('p','tv287-muted',classKey(c)+' · Level '+c.level+' · 2014 SRD reference'));
 header.append(heading);panel.append(header);
 const slotRecords=records.filter(r=>r.kind==='spell'), abilities=records.filter(r=>r.kind!=='spell');
 const costs=[0,2,3,5,6,7,9,10,11,13];
 const previewAllowed=demo&&c.name==='Aster Vaelith';
 const pointsMode=previewAllowed&&view.pointsMode;
 const standardSlots=slotRecords.filter(r=>slotLevel(r)>0&&!/pact/i.test(r.id+' '+r.name));
 const validPoints=standardSlots.length>0&&standardSlots.every(r=>Number.isInteger(r.counter.current)&&Number.isInteger(r.counter.max));
 const pointMax=standardSlots.reduce((sum,r)=>sum+r.counter.max*costs[slotLevel(r)],0);
 const convertedRemaining=standardSlots.reduce((sum,r)=>sum+r.counter.current*costs[slotLevel(r)],0);
 const snapshot=standardSlots.map(r=>r.id+':'+r.counter.label).join('|');
 if(!view.pointTrial||view.pointTrial.snapshot!==snapshot||view.pointTrial.account!==account) view.pointTrial={snapshot,account,remaining:convertedRemaining,highUsed:{},log:[],strain:0,overcasting:false};
 const trial=view.pointTrial;
 trial.strain=Math.max(0,Math.min(6,Number(trial.strain)||0));
 const effectiveMax=()=>Math.floor(pointMax*(trial.strain>=3?.75:1));
 trial.remaining=Math.min(trial.remaining,effectiveMax());
 const pointRemaining=trial.remaining;
 const missing=l=>Math.max(0,costs[l]-trial.remaining);
 const strainGain=d=>d<=2?1:d<=5?2:3;
 const ability=Math.floor((Number(c.int||10)-10)/2);
 const proficiency=2+Math.floor((Math.max(1,Number(c.level)||1)-1)/4);
 const canSpend=l=>Number.isInteger(l)&&l>=0&&l<=Math.max(0,...standardSlots.map(slotLevel))&&(l===0||trial.strain<6)&&(l<6||!trial.highUsed[l])&&(missing(l)===0||(trial.overcasting&&trial.strain<5&&missing(l)<=8));
 function refreshTrial(){const y=window.scrollY,x=window.scrollX;render(c,records,card);window.scrollTo(x,y);}
 function castLabel(l){return missing(l)>0&&canSpend(l)?'Overcast · '+costs[l]:l?'Test cast · '+costs[l]:'Test cast · Free';}
 function changePoints(l,restore=false,name='Manual adjustment'){
  if(!pointsMode||!validPoints||!Number.isInteger(l)||l<0||l>Math.max(0,...standardSlots.map(slotLevel)))return;
  if(restore){if(l===0||trial.remaining+costs[l]>effectiveMax()||(l>=6&&!trial.highUsed[l]))return;trial.remaining+=costs[l];if(l>=6)delete trial.highUsed[l];}
  else{
   if(!canSpend(l))return;
   const deficit=missing(l);
   if(deficit){
    const gain=strainGain(deficit),dc=10+l+deficit,penalty=trial.strain;
    const route=location.hash,prior=trial.remaining,priorStrain=trial.strain;
    confirmInPage('Overcast · '+name,[['Points spent',String(prior)],['Missing points',String(deficit)],['Strain after casting',Math.min(6,priorStrain+gain)+' / 6'],['Stability DC',String(dc)]],'Points and strain apply even if the check fails. Narrative backlash is determined by the DM.',()=>{
    if(location.hash!==route||!panel.isConnected||view.pointTrial!==trial||!view.pointsMode||trial.remaining!==prior||trial.strain!==priorStrain||!canSpend(l))return;
    const roll=1+Math.floor(Math.random()*20),total=roll+ability+proficiency-penalty,success=total>=dc;
    trial.remaining=0;trial.strain=Math.min(6,trial.strain+gain);
    if(l>=6)trial.highUsed[l]=true;
    trial.log.unshift('Overcast '+name+' · d20 '+roll+' + '+ability+' INT + '+proficiency+' proficiency − '+penalty+' strain = '+total+' vs DC '+dc+' · '+(success?'Success':'Failed — DM determines backlash')+' · +'+gain+' strain');
    trial.log=trial.log.slice(0,8);refreshTrial();});return;
   }
   trial.remaining-=costs[l];if(l>=6)trial.highUsed[l]=true;
  }
  trial.log.unshift((restore?'Restored ':'Test cast: ')+name+' · '+costs[l]+' points');trial.log=trial.log.slice(0,8);
  const y=window.scrollY;render(c,records,card);window.scrollTo(window.scrollX,y);
 }
 function action(text,fn,disabled=false){const b=n('button','tv292-point-action',text);b.type='button';b.disabled=disabled;b.onclick=fn;return b;}
 if(previewAllowed&&validPoints){
  const controls=n('div','tv292-system-switch');
  controls.append(n('small','','SPELLCASTING SYSTEM · PREVIEW'));
  const buttons=n('div','tv292-system-buttons');
  for(const [name,value] of [['Spell slots',false],['Spell points',true]]){
   const b=n('button','tv287-filter',name);b.type='button';b.setAttribute('aria-pressed',String(!!pointsMode===value));
   b.onclick=()=>{view.pointsMode=value;render(c,records,card)};buttons.append(b);
  }
  controls.append(buttons);header.append(controls);
 }
 if(pointsMode&&validPoints){
  const box=n('section','tv292-points');const line=n('div','tv292-points-head');
  line.append(n('strong','','Spell points'),n('strong','',pointRemaining+' / '+effectiveMax()));box.append(line);
  const track=n('div','tv287-track'),fill=n('span');fill.style.width=(effectiveMax()?100*pointRemaining/effectiveMax():0)+'%';track.append(fill);box.append(track);
  const actions=n('div','tv292-point-actions');
  actions.append(action('Restore 1 point',()=>{trial.remaining++;render(c,records,card)},trial.remaining>=effectiveMax()),action('Spend 1 point',()=>{trial.remaining--;render(c,records,card)},trial.remaining<=0),action('Reset from slots',()=>{view.pointTrial=null;render(c,records,card)}));
  box.append(actions,n('p','tv287-muted','Interactive test balance · Separate from saved slots and real rests.'));
  const strain=n('section','tv293-strain'),head=n('div','tv292-points-head');
  head.append(n('strong','','Arcane Strain'),n('strong','',trial.strain+' / 6'));strain.append(head);
  const pips=n('div','tv291-slot-pips');for(let i=0;i<6;i++){const pip=n('span','tv291-pip');pip.dataset.available=String(i<trial.strain);pips.append(pip)}strain.append(pips);
  const effects=['No penalties','−1 Stability','−2 Stability','−3 Stability · 25% reduced point maximum','−4 Stability · reduced maximum · concentration disadvantage','−5 Stability · reduced maximum · concentration disadvantage · no overcasting','−6 Stability · reduced maximum · concentration disadvantage · no levelled spells'];
  strain.append(n('p','tv287-muted',effects[trial.strain]));
  const controls=n('div','tv292-point-actions');
  const toggle=action('Overcasting '+(trial.overcasting?'on':'off'),()=>{trial.overcasting=!trial.overcasting;refreshTrial()});toggle.setAttribute('aria-pressed',String(trial.overcasting));toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(trial.overcasting));
  controls.append(toggle,action('− Strain',()=>{trial.strain--;refreshTrial()},trial.strain===0),action('+ Strain',()=>{trial.strain++;refreshTrial()},trial.strain===6),action('Test long rest',()=>{trial.strain=Math.max(0,trial.strain-1);trial.remaining=effectiveMax();trial.highUsed={};trial.log.unshift('Test long rest · points restored; strain reduced by one');refreshTrial()}));
  strain.append(controls);box.append(strain);
  if(trial.log.length)box.append(n('p','tv292-point-feedback',trial.log[0]));
  panel.append(box);
 }
 function inlineSlots(r){
  const item=card(r,true);item.classList.add('tv292-inline-slot');
  item.querySelector('.tv287-card-name')?.remove();
  item.querySelector('.tv287-track')?.remove();
  const dots=n('div','tv291-slot-pips');
  if(Number.isInteger(r.counter.max)&&r.counter.max>0&&r.counter.max<=20&&Number.isInteger(r.counter.current)){
   dots.setAttribute('aria-label',r.counter.label+' slots available');
   for(let i=0;i<r.counter.max;i++){const pip=n('span','tv291-pip');pip.dataset.available=String(i<r.counter.current);dots.append(pip)}
  }
  item.insertBefore(dots,item.firstChild);
  return item;
 }
 const pool=spells().filter(s=>s.edition==='2014'&&s.classes.includes(listClass(c)));
 const max=Math.max(0,...slotRecords.map(slotLevel));
 const book=n('section','tv291-book'),bookHead=n('div','tv291-book-head'),title=n('div');
 title.append(n('h3','','Spellbook'),n('p','tv287-muted','Reference only · Known spells and casting not yet enabled.'));
 bookHead.append(title);
 if(recommended.length){const toggle=n('button','tv287-filter','Demo suggestions');toggle.type='button';toggle.setAttribute('aria-pressed',String(view.suggested));toggle.onclick=()=>{view.suggested=!view.suggested;toggle.setAttribute('aria-pressed',String(view.suggested));draw()};bookHead.append(toggle)}
 const modes=n('div','tv291-book-modes');bookHead.append(modes);
 book.append(bookHead);
 const tools=n('div','tv291-spell-tools'),search=n('input','tv287-search');search.type='search';search.placeholder='Search spells…';search.value=view.query;search.setAttribute('aria-label','Search character spells');
 const levels=n('div','tv291-levels');tools.append(search,levels);book.append(tools);
 const workspace=n('div','tv291-full-workspace'),list=n('div','tv291-spell-list'),reader=n('div','tv291-reader');const tableHead=n('div','tv291-table-head');for(const label of ['Spell','Casting time','Range','Traits',''])tableHead.append(n('span','',label));list.append(tableHead);workspace.append(list);book.append(workspace);panel.append(book);
 if(pointsMode&&validPoints){workspace.classList.add('tv292-points-mode');tableHead.append(n('span','','Test casting'));}
 const note=n('p','tv287-muted',pointsMode?'Test casts use the experimental balance only; references are not approved spells.':'Starred references are saved in this browser. They do not grant spells or enable casting.');book.append(note);
 function detail(s){
  reader.replaceChildren();
  if(!s){reader.append(n('p','tv287-empty','No matching spell.'));return}
  const head=n('div','tv291-reader-head');head.append(n('div','tv287-eyebrow',(s.level?'Level '+s.level:'Cantrip')+' · '+s.school),n('h3','',s.name));reader.append(head);
  const stats=n('div','tv291-stat-grid');
  for(const [label,value] of [['Casting time',s.castingTime],['Range',s.range],['Duration',s.duration],['Components',(s.components||[]).join(', ')]]){const box=n('div','tv291-stat');box.append(n('small','',label),n('strong','',value||'—'));stats.append(box)}
  reader.append(stats);
  const tags=n('div','tv291-tags');if(s.ritual)tags.append(n('span','','Ritual'));if(s.concentration)tags.append(n('span','','Concentration'));if(tags.children.length)reader.append(tags);
  if(pointsMode&&validPoints&&s.level>0){const up=n('div','tv292-point-actions');up.append(n('strong','','Test casting level'));for(let l=s.level;l<=(scales(s)?max:s.level);l++)up.append(action((missing(l)>0&&canSpend(l)?'Overcast Lv ':'Lv ')+l+' · '+costs[l]+' pt',()=>changePoints(l,false,s.name+' (level '+l+')'),!canSpend(l)));reader.append(up);}
  if(!pointsMode&&s.level>0&&scales(s)){
   const up=n('div','tv292-point-actions');up.append(n('strong','','Upcast using a spell slot'));
   for(const r of slotRecords.filter(r=>slotLevel(r)>s.level)){
    const spendIndex=r.controls.findIndex(b=>/spend|use/i.test(b.textContent+' '+(b.getAttribute('aria-label')||'')));
    const available=spendIndex>=0&&!r.controls[spendIndex].disabled&&r.counter.current>0;
    up.append(action('Level '+slotLevel(r)+' · '+r.counter.label,()=>{
     const route=location.hash;
     confirmInPage('Upcast · '+s.name,[['Spell level',String(s.level)],['Slot level',String(slotLevel(r))],['Available slots',r.counter.label],['Cost','1 slot']],'This spends a real spell slot. Spell selection is still a reference; only use this for a spell your character is allowed to cast.',()=>{
      if(location.hash!==route||!panel.isConnected||view.pointsMode)return;
      const live=window.TerravaleV287Adaptive?.collect().find(x=>x.id===r.id);
      if(!live||live.counter.current<=0||live.controls[spendIndex]?.disabled)return;
      const control=card(live,true).querySelectorAll('.tv287-card-actions button')[spendIndex];control?.click();
     });
    },!available));
   }
   if(up.children.length>1)reader.append(up);
  }
  reader.append(n('p','tv291-description',s.description));
 }
 function draw(){
  const oldScroll=list.scrollTop;list.replaceChildren(tableHead);levels.replaceChildren();modes.replaceChildren();
  for(const [label,active,action] of [['All references',!view.favouritesOnly,()=>{view.favouritesOnly=false;draw()}],['Favourites',view.favouritesOnly,()=>{view.favouritesOnly=true;draw()}]]){const b=n('button','tv287-filter',label);b.type='button';b.setAttribute('aria-pressed',String(active));b.onclick=action;modes.append(b)}
  const base=pool.filter(s=>(!view.suggested||recommended.includes(s.id.split(':')[1]))&&(!max||s.level<=max)&&(!view.favouritesOnly||favourites.has(s.id))&&(!view.query||s.name.toLowerCase().includes(view.query.toLowerCase().trim())));
  const options=['all',...new Set(base.map(s=>s.level).sort((a,b)=>a-b))];
  if(!options.includes(view.level))view.level='all';
  for(const l of options){const b=n('button','tv287-filter',l==='all'?'All':l===0?'Cantrips':String(l));b.type='button';b.setAttribute('aria-pressed',String(view.level===l));b.onclick=()=>{view.level=l;view.selected='';list.scrollTop=0;draw()};levels.append(b)}
  const rows=base.filter(s=>view.level==='all'||s.level===view.level).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
  if(!rows.some(s=>s.id===view.selected))view.selected='';
  function addGroup(l){
   const group=n('div','tv291-level-heading');group.append(n('strong','',l?'Level '+l:'Cantrips'));
   const available=slotRecords.filter(r=>slotLevel(r)===l);
   if(pointsMode&&validPoints){const controls=n('div','tv292-point-actions');controls.append(n('span','tv292-cost',l?costs[l]+' points per cast':'Free'));if(l)controls.append(action(missing(l)>0&&canSpend(l)?'Overcast':'− Spend',()=>changePoints(l,false,'Level '+l),!canSpend(l)),action('+ Restore',()=>changePoints(l,true,'Level '+l),trial.remaining+costs[l]>effectiveMax()||(l>=6&&!trial.highUsed[l])));group.append(controls);}
   else for(const r of available)group.append(inlineSlots(r));
   list.append(group);
  }
  let last=-1;
  const shown=new Set();
  for(const s of rows){
   if(s.level!==last){addGroup(s.level);shown.add(s.level);last=s.level}
   const row=n('div','tv291-spell-choice');row.dataset.expanded=String(s.id===view.selected);
   const label=n('div','tv291-choice-name');label.append(n('strong','',s.name),n('small','',s.school));const traits=n('div','tv291-row-traits');if(s.ritual){const t=n('span','','R');t.title='Ritual';traits.append(t)}if(s.concentration){const t=n('span','','C');t.title='Concentration';traits.append(t)}if(!traits.children.length)traits.append(n('span','tv291-no-trait','—'));row.append(label,n('span','tv291-row-time',s.castingTime),n('span','tv291-row-range',s.range),traits);
   const open=n('button','tv291-open-spell');open.type='button';open.setAttribute('aria-expanded',String(view.selected===s.id));open.setAttribute('aria-label','Read '+s.name);open.append(...label.childNodes);label.replaceWith(open);open.onclick=()=>{view.selected=view.selected===s.id?'':s.id;draw()};const star=n('button','tv287-star',favourites.has(s.id)?'★':'☆');star.type='button';star.setAttribute('aria-label',(favourites.has(s.id)?'Unstar ':'Star ')+s.name);star.setAttribute('aria-pressed',String(favourites.has(s.id)));star.onclick=()=>toggleFavourite(s.id);row.append(star);if(pointsMode&&validPoints){const controls=n('div','tv292-row-cast');controls.append(action(castLabel(s.level),()=>changePoints(s.level,false,s.name),!canSpend(s.level)));row.append(controls);}list.append(row);if(view.selected===s.id){detail(s);list.append(reader)}
  }
  if(!pointsMode){for(const r of slotRecords){const l=slotLevel(r);if(!shown.has(l)){addGroup(l);shown.add(l);list.append(n('p','tv292-empty-level','No matching spells at this level.'));}}}
  if(!rows.length)list.append(n('p','tv287-empty',pool.length?'No matching spells.':'No verified SRD class list is mapped to this character.'));
  list.scrollTop=oldScroll;
 }
 search.addEventListener('input',()=>{view.query=search.value;view.selected='';list.scrollTop=0;draw()});draw();
}
window.TerravaleSheetSpells={eligible,render};
})();