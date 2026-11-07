/* V2.54 character creator proficiencies + permanent account-backed wallet.
  Approved tool, instrument and gaming-set training is separate from equipment;
  displayed foreign-currency equivalents are never newly spendable coins. */
(function(){
'use strict';
const rules=()=>window.TerravaleRulesV4;
const auth=()=>window.TerravaleVerifiedAccount;
const bridge=()=>window.TerravaleV2Bridge;
const api=()=>auth()?.supabase;
const ready=()=>!!auth()?.state?.ready;
const node=(tag,cls,content)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(content!==undefined)n.textContent=String(content);
 return n;
};
const btn=(text,fn,cls='btn ghost small')=>{
 const b=node('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;
};
const notify=s=>typeof toast==='function'?toast(s):console.info('[Terravale proficiency]',s);
const idOfRoute=()=>{
 const m=location.hash.match(/^#\/characters\/([^/?#]+)/);if(!m)return null;
 try{return decodeURIComponent(m[1])}catch{return m[1]}
};
const charOfRoute=()=>typeof db==='undefined'?null:db.characters.find(c=>c.id===idOfRoute());
const isOwner=c=>!!(ready()&&c?.owner==='You');
const isDm=c=>!!(ready()&&c&&auth()?.state?.profile?.is_dm&&db.campaigns.some(k=>k.id===c.campaign&&k.role==='dm'));
const canRead=c=>isOwner(c)||isDm(c);
const toolById=id=>rules().tools.find(t=>t.id===id);
const languageById=id=>rules().languages.find(t=>t.id===id);
const currencyById=id=>rules().currencies.find(c=>c.denominations.some(x=>x.id===id));
const pickNames=(items,find)=>items.map(x=>find(x.id)?.name||x.id).join(', ');
const cacheProfs=new Map(),cacheWallet=new Map(),bonusCache=new Map();
const displayByChar=new Map();
const field=(caption,choices,selected)=>{
 const label=node('label','tv254-proficiency-label');
 label.append(node('span','',caption));
 const s=node('select','tv254-proficiency-select');
 s.append(node('option','','Choose…'));s.firstChild.value='';
 for(const x of choices){
  const o=node('option','',x.name+(x.note?' · '+x.note:''));
  o.value=x.id;if(x.id===selected)o.selected=true;s.append(o);
 }
 label.append(s);return {label,select:s};
};
const categorised=pool=>{
 const tokens=Array.isArray(pool)?pool:[pool];
 return rules().tools.filter(t=>tokens.some(a=>
  a===t.id||
  (a==='artisan'&&t.category==="Artisan's Tools")||
  (a==='instrument'&&t.category==='Musical Instruments')||
  (a==='game'&&t.category==='Gaming Sets')||
  (a==='artisan-instrument'&&["Artisan's Tools",'Musical Instruments'].includes(t.category))
 ));
};
function needs(className,ancestry){
 const cfg=rules().classes[className]||{};
 const slots=cfg.slots||[];
 const lang=String(ancestry||'').toLowerCase();
 return {slots,needed:slots.reduce((s,x)=>s+x.count,0),
  langNeeded:['flügel','flugel'].includes(lang)?2:0,
  fixedTools:cfg.fixed||[],fixedLanguages:cfg.languages||[],
  ancestryFixed:['flügel','flugel'].includes(lang)?['common','fl-gel']:
    lang==='daemon'?['common','daemonic']:['common'],
  review:cfg.review||''};
}
function storeDraft(){
 if(typeof db==='undefined')return null;
 db.creatorDraft??={};
 const d=db.creatorDraft;
 d.tv254ProficiencyChoices??={tools:[],languages:[],className:d.className,ancestry:d.ancestry};
 const record=d.tv254ProficiencyChoices;
 if(record.className!==d.className||record.ancestry!==d.ancestry){
  d.tv254ProficiencyChoices={tools:[],languages:[],className:d.className,ancestry:d.ancestry};
 }
 return d.tv254ProficiencyChoices;
}
function choosePanel(className,ancestry,existing,onChange){
 const req=needs(className,ancestry);
 const block=node('div','tv254-choose-fields');
 const toolsSelected=[...(existing?.tools||[])];
 const languagesSelected=[...(existing?.languages||[])];
 block.append(node('p','tv254-muted',
  'Tool and instrument proficiency means training; it does not add an item to your backpack. Gaming sets are proficiencies only. No games are playable here yet.'));
 if(req.fixedTools.length)block.append(node('p','tv254-small',
  'Class grants: '+req.fixedTools.map(x=>toolById(x)?.name||x).join(', ')));
 if(req.fixedLanguages.length||req.ancestryFixed.length){
  const names=[...req.ancestryFixed,...req.fixedLanguages].map(x=>languageById(x)?.name||x);
  block.append(node('p','tv254-small','Automatic languages: '+[...new Set(names)].join(', ')));
 }
 if(req.review)block.append(node('p','tv254-warning',req.review+' Ask the DM before adding an unconfirmed tool.'));
 const form=node('div','tv254-proficiency-fields');
 let cursor=0;
 for(const slot of req.slots){
  const options=categorised(slot.pool).map(t=>({id:t.id,name:t.name,category:t.category}));
  for(let i=0;i<slot.count;i++){
   const idx=cursor++;
   const fieldNode=field(slot.label+(slot.count>1?' '+(i+1):''),options,toolsSelected[idx]||'');
   fieldNode.select.addEventListener('change',()=>{
    toolsSelected[idx]=fieldNode.select.value;
    onChange({tools:[...toolsSelected],languages:[...languagesSelected]});
   });form.append(fieldNode.label);
  }
 }
 if(!req.needed)form.append(node('p','tv254-small',
  'This class has no confirmed mandatory starting tool choices.'));
 const choices=rules().languages.filter(x=>x.enabled&&
  !req.ancestryFixed.includes(x.id)).map(x=>({
  id:x.id,name:x.name,note:x.dmApproval?'DM approval required':x.kind==='written-script'?'script':''
 }));
 for(let i=0;i<req.langNeeded;i++){
  const idx=i,option=field('Additional Flügel language '+(i+1),choices,languagesSelected[idx]||'');
  option.select.addEventListener('change',()=>{
   languagesSelected[idx]=option.select.value;
   onChange({tools:[...toolsSelected],languages:[...languagesSelected]});
  });form.append(option.label);
 }
 block.append(form);
 return {block,requirements:req,getValues:()=>({tools:toolsSelected,languages:languagesSelected})};
}
function validSelections(className,ancestry,choices){
 const req=needs(className,ancestry);
 const t=choices?.tools||[],l=choices?.languages||[];
 if(req.needed!==t.length||t.some(x=>!x))return 'Choose all '+req.needed+' required class tool proficiencies.';
 if(new Set(t).size!==t.length)return 'Choose different tool proficiencies for each slot.';
 for(const tool of t)if(!req.slots.some(slot=>categorised(slot.pool).some(x=>x.id===tool)))
  return 'A tool choice is not eligible for this class.';
 if(req.langNeeded!==l.length||l.some(x=>!x))return 'Choose '+req.langNeeded+' additional ancestry languages.';
 if(new Set(l).size!==l.length)return 'Choose two different additional languages.';
 return null;
}
function creatorPanel(){
 if(location.hash.replace(/^#/,'')!=='/characters/create')return;
 const studio=document.getElementById('creatorStudio');
 if(!studio||typeof db==='undefined'||!rules())return;
 const draft=db.creatorDraft||{},d=storeDraft();
 const target=studio.querySelector('#creatorStageBody');
 const active=studio.querySelector('[data-creator-action="finish"]');
 if(!target||!draft.className||!draft.ancestry||!active)return;
 if(target.querySelector('#tv254-creator-proficiency'))return;
 const panel=node('section','tv254-creator-proficiency');
 panel.id='tv254-creator-proficiency';
 panel.append(node('span','tv254-eyebrow','NEW · STARTING TRAINING'),
  node('h3','','Languages and tool proficiencies'));
 const selector=choosePanel(draft.className,draft.ancestry,d,value=>{
  db.creatorDraft.tv254ProficiencyChoices={
   tools:value.tools,languages:value.languages,
   className:draft.className,ancestry:draft.ancestry
  };
  if(typeof persist==='function')persist();
 });
 panel.append(selector.block);
 target.append(panel);
}
function installCreatorBridge(){
 const object=bridge();
 if(!object?.createCharacter||object.createCharacter.__tv254)return;
 const original=object.createCharacter;
 const wrapped=async character=>{
  const draft=typeof db!=='undefined'?db.creatorDraft||{}:{};
  const fromCreator=character?.name&&draft.name?.trim()===character.name?.trim()&&
   draft.ancestry===character.ancestry&&draft.className===character.className;
  const chosen=fromCreator?storeDraft():character?.tv254ProficiencyChoices;
  if(fromCreator){
   const error=validSelections(character.className,character.ancestry,chosen);
   if(error)return {error};
  }
  const result=await original(character);
  if(result?.id&&chosen){
   const {error}=await api().rpc('terravale_save_starting_proficiencies',{
    target_character:result.id,chosen_tools:chosen.tools||[],
    chosen_languages:chosen.languages||[]
   });
   if(error)notify('Character saved, but proficiency choices need confirmation: '+error.message);
  }
  return result;
 };
 wrapped.__tv254=true;
 object.createCharacter=wrapped;
}
function softSection(name){
 const section=node('section','tv254-proficiency-card');
 section.append(node('div','tv254-eyebrow','TRAINING & SPEECH'),
  node('h3','',name));return section;
}
async function loadProficiencies(c){
 if(!ready())return;
 const [{data,error},{data:requests,error:reqError}]=await Promise.all([
  api().from('terravale_character_proficiencies').select('*').eq('character_id',c.id).maybeSingle(),
  api().from('terravale_proficiency_bonus_choices').select('*')
   .eq('character_id',c.id).order('created_at',{ascending:true}).limit(30)
 ]);
 if(!error)cacheProfs.set(c.id,data||{tools:[],languages:[],pending_languages:[],dm_bonus:[],submitted:false});
 if(!reqError)bonusCache.set(c.id,requests||[]);
 const view=document.getElementById('tv254-sheet-proficiencies');
 if(view?.dataset.character===c.id)fillProficiencies(view,c);
}
async function submitStarting(c,values,output){
 const error=validSelections(c.className,c.ancestry,values);
 if(error){output.textContent=error;return}
 output.textContent='Saving starting training…';
 const {error:server}=await api().rpc('terravale_save_starting_proficiencies',{
  target_character:c.id,chosen_tools:values.tools,chosen_languages:values.languages
 });
 if(server){output.textContent='Cannot save: '+server.message;return}
 output.textContent='Starting proficiencies saved.';
 await loadProficiencies(c);
}
function bonusField(request){
 const source=request.kind==='tool'?rules().tools:rules().languages.filter(x=>x.enabled&&!x.dmApproval);
 const choices=request.kind==='tool'&&request.choice_pool!=='any'?
  categorised(request.choice_pool):source;
 const slot=node('div','tv254-bonus-request');
 slot.append(node('strong','',request.choice_count+' bonus '+(request.kind==='tool'?'tool':'language')+
  (request.choice_count===1?' proficiency':' proficiencies')+' · DM granted'));
 if(request.note)slot.append(node('p','tv254-muted',request.note));
 const sels=[];
 const group=node('div','tv254-proficiency-fields');
 for(let i=0;i<request.choice_count;i++){
  const picked=field('Bonus choice '+(i+1),choices.map(x=>({id:x.id,name:x.name})));
  group.append(picked.label);sels.push(picked.select);
 }
 slot.append(group);
 const status=node('p','tv254-small','');
 const submit=btn('Confirm my choices',async()=>{
  const chosen=sels.map(x=>x.value);
  if(chosen.some(x=>!x)||new Set(chosen).size!==chosen.length){
   status.textContent='Please choose different proficiencies in every slot.';return}
  const {data,error}=await api().rpc('terravale_claim_proficiency_choice',{
   request_id:request.id,chosen_ids:chosen
  });
  if(error){status.textContent=error.message;return}
  status.textContent='DM bonus proficiency granted.';
  const c=charOfRoute();if(c)await loadProficiencies(c);
 },'btn primary small');
 slot.append(submit,status);return slot;
}
function fillProficiencies(section,c){
 section.replaceChildren();
 section.append(node('div','tv254-eyebrow','LANGUAGES, TOOLS & SPECIAL TRAINING'),
  node('h3','','Your proficiencies'));
 const state=cacheProfs.get(c.id);
 if(!state){section.append(node('p','tv254-muted','Loading saved proficiencies…'));return}
 const allTools=[...(state.tools||[]),...(state.dm_bonus||[]).filter(x=>toolById(x.id))];
 const allLanguages=[...(state.languages||[]),...(state.dm_bonus||[]).filter(x=>languageById(x.id))];
 const group=(heading,list,get)=>{
  const box=node('div','tv254-proficiency-group');
  box.append(node('strong','',heading));
  if(list.length){
   const pills=node('div','tv254-proficiency-pills');
   for(const rec of list){
    const p=node('span','tv254-proficiency-pill',get(rec.id)?.name||rec.id);
    p.title=(rec.source||'Granted')+(get(rec.id)?.kind?', '+get(rec.id)?.kind:'');
    pills.append(p);
   }box.append(pills);
  }else box.append(node('p','tv254-small','No recorded selections yet.'));
  return box;
 };
 section.append(group('Tool & equipment proficiencies',allTools,toolById));
 section.append(group('Languages, scripts and cants',allLanguages,languageById));
 if((state.pending_languages||[]).length){
  section.append(node('p','tv254-warning',
   'Awaiting DM approval: '+pickNames(state.pending_languages,languageById)+'. These are not active language grants yet.'));
 }
 if(Array.isArray(c.languages)&&c.languages.length)
  section.append(node('p','tv254-small','Legacy/house languages preserved: '+c.languages.join(', ')+'.'));
 if(!state.submitted&&(isOwner(c)||isDm(c))){
  const picker=choosePanel(c.className,c.ancestry,{tools:[],languages:[]},()=>{});
  const form=node('div','tv254-starting-choice');
  form.append(node('h4','','Complete starting language and tool choices'),picker.block);
  const status=node('p','tv254-small','');
  form.append(btn('Save starting proficiencies',()=>submitStarting(c,picker.getValues(),status),'btn primary small'),status);
  section.append(form);
 }
 const requests=bonusCache.get(c.id)||[];
 if(isOwner(c)){
  for(const request of requests.filter(x=>x.status==='pending'))section.append(bonusField(request));
 }
}
function mountProficiencies(c){
 const area=document.querySelector('#pageRoot .sheet20-content');
 if(!area||!document.querySelector('#pageRoot .sheet20-tabs [data-value="abilities"][aria-selected="true"]'))return;
 if(area.querySelector('#tv254-sheet-proficiencies'))return;
 const section=softSection('Proficiencies');
 section.id='tv254-sheet-proficiencies';section.dataset.character=c.id;
 area.append(section);
 fillProficiencies(section,c);
 loadProficiencies(c);
}
async function loadWallet(c){
 if(!canRead(c))return;
 const [{data:hold,error},{data:history,error:ledError}]=await Promise.all([
  api().from('terravale_character_wallet').select('denomination_id,quantity')
   .eq('character_id',c.id),
  api().from('terravale_wallet_ledger').select('id,denomination_id,delta,note,operation,created_at')
   .eq('character_id',c.id).order('created_at',{ascending:false}).limit(7)
 ]);
 if(!error)cacheWallet.set(c.id,{holdings:hold||[],ledger:ledError?[]:history||[]});
 const section=document.getElementById('tv254-sheet-wallet');
 if(section?.dataset.character===c.id)fillWallet(section,c);
}
function fillWallet(section,c){
 section.replaceChildren();
 section.append(node('div','tv254-eyebrow','WALLET · NATIVE PHYSICAL CURRENCY'),
  node('h3','','Coin purse & treasury'));
 const result=cacheWallet.get(c.id);
 if(!canRead(c)){
  section.append(node('p','tv254-muted','Wallet values are only visible to the owner and campaign DM.'));
  return;
 }
 if(!result){section.append(node('p','tv254-muted','Loading your wallet from the campaign…'));return}
 const systems=rules().currencies;
 const denominations=new Map(systems.flatMap(c=>c.denominations.map(d=>[d.id,{...d,system:c.name}])));
 const holdings=(result.holdings||[]).filter(x=>Number(x.quantity)>0);
 const gc=holdings.reduce((s,x)=>s+Number(x.quantity)*(denominations.get(x.denomination_id)?.valueGC||0),0);
 section.append(node('strong','tv254-wallet-total',gc.toLocaleString()+' Guild Copper (GC) reference value'));
 const current=displayByChar.get(c.id)||'guild-seals';
 const toggle=node('select','tv254-proficiency-select');
 for(const system of systems){
  const o=node('option','',system.name+' · display value only');o.value=system.id;
  if(o.value===current)o.selected=true;toggle.append(o);
 }
 toggle.addEventListener('change',()=>{displayByChar.set(c.id,toggle.value);fillWallet(section,c)});
 section.append(node('label','tv254-proficiency-label',
  'View equivalent value in'));
 section.lastChild.append(toggle);
 const selected=systems.find(x=>x.id===current)||systems[0];
 const reference=Math.min(...selected.denominations.map(d=>d.valueGC));
 section.append(node('p','tv254-wallet-equivalent',
  Math.floor(gc/reference).toLocaleString()+' '+(selected.name)+
  (gc%reference?' + '+(gc%reference)+' GC remainder':'')+
  ' · read-only valuation'));
 const detail=node('div','tv254-wallet-holdings');
 if(holdings.length){
  for(const row of holdings){
   const d=denominations.get(row.denomination_id);
   detail.append(node('div','tv254-wallet-line',
    Number(row.quantity).toLocaleString()+' × '+(d?.name||row.denomination_id)+
    ' · '+(d?.system||'')+' · '+(d?.valueGC||0)+' GC each'));
  }
 }else detail.append(node('p','tv254-small','No currency has been issued or received.'));
 section.append(detail);
 section.append(node('p','tv254-small','Switching the displayed currency does not exchange, create or spend a single physical coin. Only an actual recorded transaction changes balances.'));
 if(result.ledger?.length){
  const log=node('details','tv254-wallet-ledger');log.append(node('summary','','Recent wallet transactions'));
  for(const item of result.ledger){
   const d=denominations.get(item.denomination_id);
   log.append(node('p','tv254-small',
    new Date(item.created_at).toLocaleDateString()+' · '+
    (item.delta>0?'+':'')+item.delta+' '+(d?.name||item.denomination_id)+
    ' · '+(item.note||item.operation)));
  }section.append(log);
 }
 section.append(btn('Refresh wallet',()=>loadWallet(c)));
}
function mountWallet(c){
 if(!rules())return;
 const backpack=document.querySelector('#pageRoot .sheet20-content .sheet21-backpack-zone');
 if(!backpack)return;
 const host=backpack.closest('.sheet20-panel')||backpack.parentElement;
 if(host.querySelector('#tv254-sheet-wallet'))return;
 const sec=softSection('Wallet');
 sec.id='tv254-sheet-wallet';sec.dataset.character=c.id;
 host.append(sec);
 fillWallet(sec,c);
 loadWallet(c);
}
function mount(){
 if(!ready()||!rules())return;
 installCreatorBridge();
 creatorPanel();
 const c=charOfRoute();
 if(!c)return;
 mountProficiencies(c);
 mountWallet(c);
}
let queued=false;
const observer=new MutationObserver(()=>{
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;mount()});
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,75));
window.addEventListener('terravale-auth-ready',()=>setTimeout(mount,175));
window.addEventListener('terravale-characters-synced',()=>setTimeout(mount,85));
mount();
})();
