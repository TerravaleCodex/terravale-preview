/* Terravale V2.55: creator training belongs to ancestry and class choices.
   6 native stages stay canonical. No dropdowns or detached review-stage form. */
(function(){
'use strict';
const registry=()=>window.TerravaleRulesV4||{classes:{},tools:[],languages:[]};
const node=(tag,cls,text)=>{const x=document.createElement(tag);
 if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x};
const button=(label,fn,cls='tv255-choice-tile')=>{
 const x=node('button',cls,label);x.type='button';x.addEventListener('click',fn);return x;
};
const draft=()=>typeof db!=='undefined'?db.creatorDraft:null;
const kind=(klass)=>registry().classes[klass]||{};
const state={slot:0,search:'',message:'',viewKey:''};
function selected(){
 const d=draft();if(!d)return null;
 let v=d.tv254ProficiencyChoices;
 if(!v||typeof v!=='object')v=d.tv254ProficiencyChoices={
  className:d.className,ancestry:d.ancestry,tools:[],languages:[]
 };
 if(v.ancestry!==d.ancestry){
  v.ancestry=d.ancestry;v.className=d.className;v.languages=[];v.tools=[];
 }
 if(v.className!==d.className){v.className=d.className;v.tools=[];}
 v.tools??=[];v.languages??=[];
 return v;
}
const save=()=>{if(typeof persist==='function')persist()};
function required(className,ancestry){
 const cls=kind(className);
 const slots=(cls.slots||[]).flatMap(x=>Array.from({length:Number(x.count)||0},(_,i)=>({
  label:x.label+(Number(x.count)>1?' '+(i+1):''),pool:x.pool
 })));
 const extraLanguages=/^(flügel|flugel)$/i.test(ancestry||'')?2:0;
 return {slots,extraLanguages,fixedTools:cls.fixed||[],fixedLanguages:cls.languages||[]};
}
function eligible(pool){
 const patterns=Array.isArray(pool)?pool:[pool];
 return registry().tools.filter(t=>patterns.some(p=>
  p===t.id||(p==='artisan'&&t.category==="Artisan's Tools")||
  (p==='instrument'&&t.category==='Musical Instruments')||
  (p==='game'&&t.category==='Gaming Sets')||
  (p==='artisan-instrument'&&["Artisan's Tools",'Musical Instruments'].includes(t.category))
 ));
}
function stage(){
 const current=document.querySelector('#creatorStudio .creator-step.current');
 return current?Number(current.dataset.value):-1;
}
function panel(stageId){
 const host=document.getElementById('creatorStageBody');
 if(!host)return null;
 const active=host.querySelector('#tv255-creator-training');
 if(active&&active.dataset.stage===String(stageId))return active;
 if(active)active.remove();
 const el=node('section','tv255-creator-training');
 el.id='tv255-creator-training';el.dataset.stage=String(stageId);host.append(el);
 return el;
}
function change(index,value,type){
 const d=selected();if(!d)return;
 if(type==='language'){
  if(d.languages.includes(value))d.languages=d.languages.filter(x=>x!==value);
  else if(d.languages.length<2)d.languages.push(value);
  else d.languages=[d.languages[1],value];
 }else{
  const slots=required(d.className,d.ancestry).slots;
  d.tools[index]=d.tools[index]===value?'':value;
  if(value&&d.tools[index]===value&&d.tools.filter(x=>x===value).length>1){
   d.tools[index]='';state.message='A proficiency cannot fill two class training slots.';
  }else state.message='';
  const next=slots.findIndex((slot,i)=>!d.tools[i]);
  if(next>=0)state.slot=next;
 }
 save();
 const target=document.getElementById('tv255-creator-training');
 if(target)render(target);
}
function languageChoices(host,d,v,requiredCount){
 const title=node('div','tv255-creator-head');
 title.append(node('div','tv254-eyebrow','ANCESTRY · YOUR LANGUAGES'),
  node('h3','','Languages learned at creation'),
  node('p','tv254-muted',
   requiredCount===2?'Flügel automatically speak Common and Flügel, then choose two additional distinct languages. Restricted choices require DM approval.':
   'Your ancestry determines its starting languages. The DM can still customise what an individual character speaks, reads or writes.'));
 host.append(title);
 const list=node('div','tv255-creator-fixed');
 const base=['Common'];
 if(/^flügel|flugel$/i.test(d.ancestry))base.push('Flügel');
 if(d.ancestry==='Daemon')base.push('Daemonic');
 for(const x of base)list.append(node('span','tv255-proficiency-fixed','✓ '+x));
 host.append(list);
 if(!requiredCount)return;
 host.append(node('div','tv255-pick-progress',
  'Additional languages: '+v.languages.filter(Boolean).length+' / '+requiredCount+' chosen'));
 const catalog=node('div','tv255-creator-options tv255-language-grid');
 for(const l of registry().languages.filter(l=>l.enabled&&
 !['common','fl-gel','daemonic'].includes(l.id))){
  const selected=l.id&&v.languages.includes(l.id);
  const b=button(l.name+(l.dmApproval?' · DM review':''),
   ()=>change(0,l.id,'language'),
   'tv255-choice-tile'+(selected?' selected':''));
  b.setAttribute('aria-pressed',String(selected));catalog.append(b);
 }
 host.append(catalog);
}
function toolChoices(host,d,v,req){
 const head=node('div','tv255-creator-head');
 head.append(node('div','tv254-eyebrow','CLASS · TRAINING & CRAFT'),
  node('h3','','Starting tool proficiencies'),
  node('p','tv254-muted',
   'These are things your character knows how to use, not physical items added to the backpack. Select each required slot using the cards below.'));
 host.append(head);
 if(req.fixedTools.length){
  const fixed=node('div','tv255-creator-fixed');
  fixed.append(node('span','tv255-fixed-label','Automatically trained:'));
  for(const id of req.fixedTools){
   const t=registry().tools.find(x=>x.id===id);
   fixed.append(node('span','tv255-proficiency-fixed','✓ '+(t?.name||id)));
  }
  host.append(fixed);
 }
 if(!req.slots.length){
  host.append(node('p','tv254-muted','This class has no confirmed required starting tool choice. You can still earn extra tool training during play.'));
  return;
 }
 const chosen=v.tools.filter(Boolean).length;
 host.append(node('div','tv255-pick-progress','Class tools: '+chosen+' / '+req.slots.length+' chosen'));
 const slots=node('div','tv255-class-tool-slots');
 if(state.slot>=req.slots.length)state.slot=0;
 const options=node('div','tv255-tool-picker');
 const drawOptions=()=>{
  options.replaceChildren();
  const index=state.slot;
  const slot=req.slots[index];
  if(!slot)return;
  options.append(node('div','tv255-tool-context','Select '+slot.label));
  const search=node('input','tv255-input');
  search.type='search';search.placeholder='Find a tool, instrument or gaming set…';
  search.value=state.search;
  const result=node('div','tv255-creator-options tv255-tool-grid');
  const fill=()=>{
   result.replaceChildren();
   const entries=eligible(slot.pool)
    .filter(t=>t.name.toLowerCase().includes(search.value.trim().toLowerCase()));
   const disabled=state.message?state.message:'';
   for(const t of entries){
    const used=v.tools.some((tId,i)=>i!==index&&tId===t.id);
    const selected=v.tools[index]===t.id;
    const b=button(t.name,()=>change(index,t.id,'tool'),
     'tv255-choice-tile'+(selected?' selected':''));
    b.disabled=used;b.title=used?'Already selected in another slot':t.category;
    b.setAttribute('aria-pressed',String(selected));result.append(b);
   }
   if(!entries.length)result.append(node('p','tv254-muted','No matching tool in this class slot.'));
  };
  search.addEventListener('input',()=>{state.search=search.value;fill()});
  fill();options.append(search,result);
 };
 const renderSlots=()=>{
  slots.replaceChildren();
  req.slots.forEach((slot,i)=>{
   const chosenId=v.tools[i];
   const selected=registry().tools.find(x=>x.id===chosenId);
   const label=slot.label+' · '+(selected?.name||'Choose…');
   const b=button(label,()=>{state.slot=i;state.search='';renderSlots();drawOptions()},
    'tv255-slot-chip'+(i===state.slot?' current':'')+(chosenId?' complete':''));
   b.setAttribute('aria-pressed',String(i===state.slot));slots.append(b);
  });
 };
 renderSlots();drawOptions();host.append(slots,options);
 if(state.message)host.append(node('p','tv255-warning',state.message));
}
function render(host){
 const d=draft();const v=selected();
 if(!d||!v)return;
 const current=stage();
 if(current!==1&&current!==3){host.remove();return}
 host.replaceChildren();
 const req=required(d.className,d.ancestry);
 if(current===1){
  host.append(node('div','tv255-creator-banner','02 · ANCESTRY TRAINING'));
  languageChoices(host,d,v,req.extraLanguages);
 }else if(current===3){
  if(!d.className)return;
  host.append(node('div','tv255-creator-banner','04 · CLASS TRAINING'));
  toolChoices(host,d,v,req);
 }
}
function validate(index){
 const d=draft(),v=selected();
 if(!d||!v)return null;
 const req=required(d.className,d.ancestry);
 if(index===1&&req.extraLanguages){
  if(v.languages.length!==req.extraLanguages||
   v.languages.some(x=>!x)||new Set(v.languages).size!==v.languages.length){
   return 'Choose '+req.extraLanguages+' additional ancestry languages before continuing.';}
 }
 if(index===3&&req.slots.length){
  if(v.tools.length!==req.slots.length||
   v.tools.some(x=>!x)||new Set(v.tools).size!==v.tools.length){
   return 'Complete all '+req.slots.length+' class tool proficiency slots before continuing.';}
  for(let i=0;i<req.slots.length;i++){
   if(!eligible(req.slots[i].pool).some(x=>x.id===v.tools[i]))
    return 'One of your class tool selections is outside the eligible slot.';
  }
 }
 return null;
}
function mount(){
 if(!window.TerravaleRulesV4||location.hash.split('?')[0]!=='#/characters/create')return;
 const studio=document.getElementById('creatorStudio');
 if(!studio)return;
 const previous=studio.querySelector('#tv254-creator-proficiency');
 if(previous)previous.remove();
 const current=stage();
 if(current!==1&&current!==3)return;
 const d=draft();if(!d)return;
 if(current===3&&!d.className)return;
 const target=panel(current);
 if(!target)return;
 render(target);
}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-creator-action]');
 if(!b||!b.closest('#creatorStudio'))return;
 const current=stage(),action=b.dataset.creatorAction;
 const to=action==='goto'?Number(b.dataset.value):action==='next'?current+1:action==='finish'?5:
  action==='back'?current-1:current;
 const goingAhead=to>current||action==='finish';
 if(!goingAhead)return;
 let err=validate(current);
 if(!err&&action==='finish'){err=validate(1)||validate(3)}
 if(!err)return;
 event.preventDefault();event.stopImmediatePropagation();
 const warning=document.getElementById('tv255-creator-error')||node('div','tv255-creator-error');
 warning.id='tv255-creator-error';warning.textContent=err;
 const footer=studio.querySelector('.creator-stage-footer');
 if(footer)footer.parentElement.insertBefore(warning,footer);
 if(current===5&&action==='finish'){
  if(validate(1)){b.closest('#creatorStudio')?.querySelector('[data-creator-action="goto"][data-value="1"]')?.click()}
  else if(validate(3))b.closest('#creatorStudio')?.querySelector('[data-creator-action="goto"][data-value="3"]')?.click();
 }
},true);
let pending=false;
const observer=new MutationObserver(()=>{
 if(pending)return;pending=true;
 requestAnimationFrame(()=>{pending=false;const studio=document.getElementById('creatorStudio');
 if(!studio)return;
 const curr=stage(),d=draft();
 const fingerprint=curr+'|'+d?.ancestry+'|'+d?.className;
 if(studio.dataset.tv255CreatorKey===fingerprint&&studio.querySelector('#tv255-creator-training'))return;
 studio.dataset.tv255CreatorKey=fingerprint;mount();
 });
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,70));
window.TerravaleV255Creator={validate,mount};
mount();
})();