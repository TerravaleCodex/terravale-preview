
/* V2.35: Approved recovery conventions and conservative counter release.
   Source-based, offline only. Does not modify live characters or grant unchosen options. */
(function(){'use strict';
 const E=x=>safe(String(x==null?'':x));
 const src=JSON.parse(document.getElementById('v226-full-source').textContent);
 const graph=JSON.parse(document.getElementById('v231-bloodforger-source').textContent);
 const full=Object.fromEntries((src.classes||[]).map(c=>[c.name,c]));
 const clampLvl=c=>Math.min(20,Math.max(1,Number(c.level)||1));
 const PB=c=>sheetV220Prof(c);
 const own=c=>sheetV220State(c).resources;
 const selectedPath=c=>String(c.progression?.subclass||c.progression?.tradition||c.subclass||v226SpecName(c)||'').trim().toLowerCase();
 const tempIds=new Set(['v235:ashheir:temporary-ash','v235:dream-eater:temporary-fragments']);
 const shortIds=new Set(['v235:ashheir:stable-ash','v235:dream-eater:stable-fragments']);
 const bloodRestId='blood-reserve';
 const sourceValue=c=>{const v=full[c.className]?.progression?.levels?.[clampLvl(c)-1]?.cells?.[3];const n=Number(v);return Number.isFinite(n)&&n>0?n:0;};
 const normaliseRecovery=r=>{
  const k=String(r.recovery||'').trim().toLowerCase();
  if(r.id===bloodRestId)return {type:'half-short',label:'Short rest: recover half maximum (round up); long rest: recover all'};
  if(tempIds.has(r.id))return {type:'temporary',label:'Expires on any rest; gain only when the class rules allow'};
  if(shortIds.has(r.id))return {type:'short-long',label:'Short or long rest: restore all spent points'};
  if(String(r.id||'').startsWith('pact-slot-'))return {type:'long-default',label:'Long rest by default · Pact class-source recovery cadence has no explicit duration'};
  if(String(r.id||'').startsWith('spell-slot-'))return {type:'long',label:'Long rest: standard spell-slot recovery'};
  if(k==='short or long rest'||k.includes('short or long rest'))return {type:'short-long',label:'Short or long rest: restore use'};
  if(k==='long rest'||k.includes('long rest (default'))return {type:'long',label:k.includes('default')?'Long rest: default DM ruling':'Long rest: explicit feature rule'};
  if(k.includes('per published')||k.includes('published class'))return {type:'long-default',label:'Long rest if unspecified; preserve any explicit class exception'};
  if(k.includes('recovery')||!k)return {type:'long-default',label:'Long rest by default unless the feature says otherwise'};
  return {type:'long-default',label:r.recovery||'Long rest by default'};
 };
 const previousResources=sheetV220Resources;
 sheetV220Resources=function(c){
  const result=previousResources(c);
  function add(r){if(!result.some(x=>x.id===r.id))result.push(r)}
  const state=own(c),n=sourceValue(c);
  if(c.className==='Ashheir'&&n){
   const t='v235:ashheir:temporary-ash';if(state[t]===undefined)state[t]=0;
   add({id:'v235:ashheir:stable-ash',name:'Stable Ash',max:n,unit:'Ash',recovery:'short or long rest',source:'Ashheir · Ash Inheritance · class progression'});
   add({id:t,name:'Temporary Ash',max:PB(c),unit:'Ash',recovery:'expires on rest',source:'Gain from meaningful Taken Burdens; spent before stable Ash; expires when danger ends or on rest'});
  }
  if(c.className==='Dream-Eater'&&n){
   const t='v235:dream-eater:temporary-fragments';if(state[t]===undefined)state[t]=0;
   add({id:'v235:dream-eater:stable-fragments',name:'Stable Dream Fragments',max:n,unit:'fragments',recovery:'short or long rest',source:'Dream-Eater · Dream Reserve · class progression'});
   add({id:t,name:'Temporary Dream Fragments',max:PB(c),unit:'fragments',recovery:'expires on rest',source:'Gained by written features only; track separately; expire on short/long rest'});
  }
  if(c.className==='Barbarian'&&clampLvl(c)>=6&&selectedPath(c).includes('wild magic')){
    add({id:'v235:barbarian:bolstering-magic',name:'Bolstering Magic',max:PB(c),unit:'uses',recovery:'long rest (default DM ruling)',source:'Wild Magic path · Level 6 · Bolstering Magic',targetNote:'A creature can benefit from the spell-slot restoration option only once per recovery cycle (long rest by default). Track uses on the Barbarian; observe the target limit in play.'});
  }
  if(c.className==='Bloodforger'){
    const purchased=c.v231BloodPurchases||{};
    const selected=[['Fortification','Stay Upright','long rest'],['Fortification','Refuse the End','long rest'],['Hunger','Hold the Line','long rest'],['Hunger','The Last Restraint','long rest'],['Hunger','Redline Return','long rest'],['Regeneration','Red Restitch','long rest'],['Regeneration','False Death','short or long rest'],['Regeneration','Silent Reboot','long rest'],['Regeneration','You Should Have Killed Me Properly','long rest']];
    for(const [tree,title,recovery] of selected){const node=graph.disciplines?.[tree]?.nodes?.find(n=>n.name===title);if(!node||!Object.prototype.hasOwnProperty.call(purchased,tree+':'+node.id))continue;
     add({id:'v235:bloodforger:'+tree.toLowerCase()+':'+node.id,name:node.name,max:1,unit:'use',kind:'ability',recovery,source:`Offline selected ${tree} node ${node.id} · ${recovery}; additional Reserve/Exertion costs still apply as written; selection is not a live approved purchase`});
    }
  }
  for(const r of result){const rec=normaliseRecovery(r);r.v235Recovery=rec.type;r.v235RecoveryLabel=rec.label;}
  return result;
 };
 const priorPanel=sheetV220ResourcesPanel;
 sheetV220ResourcesPanel=function(c){
  const html=priorPanel(c);const template=document.createElement('template');template.innerHTML=html;
  const list=sheetV220Resources(c);const recs=new Map(list.map(r=>[r.id,r]));
  for(const e of template.content.querySelectorAll('[data-v234-resource]')){
   const id=e.getAttribute('data-v234-resource');const r=recs.get(id);if(!r)continue;
   const note=document.createElement('small');note.className='v235-cadence';note.textContent='Recovery: '+r.v235RecoveryLabel;e.appendChild(note);
   if(r.targetNote){const target=document.createElement('small');target.className='v235-target-limit';target.textContent='Target rule: '+r.targetNote;e.appendChild(target);}
   if(tempIds.has(id)){const btn=e.querySelector('[data-delta="1"]');if(btn){btn.textContent='+ Gain';btn.setAttribute('aria-label','Gain one '+r.name+' when earned by the written rules');}}
  }
  const can=sheetV220CanEdit(c);
  if(can&&list.some(r=>Number.isFinite(Number(r.max))&&Number(r.max)>0)){
   const controls=document.createElement('div');controls.className='v235-rest-actions';
   const hasShort=list.some(r=>r.v235Recovery==='short-long'||r.v235Recovery==='half-short'||r.v235Recovery==='temporary');
   controls.innerHTML=(hasShort?`<button type="button" data-v235-rest="short" data-id="${E(c.id)}">Apply short-rest resources</button>`:'')+`<button type="button" data-v235-rest="long" data-id="${E(c.id)}">Apply long-rest resources</button>`;
   const hint=document.createElement('small');hint.className='v235-rest-hint';hint.textContent='Only resource counters are updated here. HP, Hit Dice and special effects are handled separately.';
   controls.appendChild(hint);
   template.content.querySelector('.v234-resources')?.appendChild(controls);
  }
  return template.innerHTML;
 };
 function rest(c,kind){const resources=sheetV220Resources(c),state=own(c);let changed=0;
  for(const r of resources){if(r.max==null||!Number.isFinite(Number(r.max))||r.max<1)continue;
   const orig=state[r.id]===undefined?(tempIds.has(r.id)?0:r.max):Number(state[r.id]);
   let next=orig;
   if(r.v235Recovery==='temporary')next=0;
   else if(kind==='long')next=r.max;
   else if(kind==='short'&&r.v235Recovery==='short-long')next=r.max;
   else if(kind==='short'&&r.v235Recovery==='half-short')next=Math.min(r.max,orig+Math.ceil(r.max/2));
   // Only exact, documented short-rest replenishment is applied; other complex cadences stay manual.
   if(next!==orig){state[r.id]=next;changed++;}
  }
  persist();renderPage(false);if(typeof toast==='function')toast(`${kind==='long'?'Long':'Short'} rest: updated ${changed} resource counter${changed===1?'':'s'}.`);
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-v235-rest]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();const c=db.characters.find(x=>String(x.id)===String(b.dataset.id));if(!c||!sheetV220CanEdit(c))return;rest(c,b.dataset.v235Rest);
 },true);
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action="sheetResource"]');if(!b||b.dataset.value!=='v235:ashheir:stable-ash'||Number(b.dataset.delta)>=0)return;
  const c=db.characters.find(x=>String(x.id)===String(b.dataset.id));if(!c||!sheetV220CanEdit(c))return;
  const s=own(c),temp='v235:ashheir:temporary-ash';if(Number(s[temp]||0)<=0)return;
  e.preventDefault();e.stopImmediatePropagation();s[temp]=Math.max(0,Number(s[temp])-1);persist();renderPage(false);
  if(typeof toast==='function')toast('Spent Temporary Ash first, as required by Ash Inheritance.');
 },true);
 window.TERRAVALE_V235_RULINGS={effectiveDate:'2026-11-06',defaultRecovery:'long rest',explicitOverrides:true,approvedOneThirdCaster:['Fighter|Eldritch Knight','Rogue|Arcane Trickster'],targetTracking:'character uses; individual target restrictions in feature text',automatedLimitedUses:'wild-magic bolstering + 9 locally selected Bloodforger nodes',classCount:33};
 renderPage(false);
})();
