/* V2.55: DM-owned proficiency removals and language ability modes.
   Inherited source grants stay intact; per-character suppressions are reversible. */
(function(){
'use strict';
const auth=()=>window.TerravaleVerifiedAccount;
const api=()=>auth()?.supabase;
const rules=()=>window.TerravaleRulesV4||{tools:[],languages:[],classes:{}};
const node=(tag,cls,text)=>{
 const x=document.createElement(tag);
 if(cls)x.className=cls;
 if(text!==undefined)x.textContent=String(text);
 return x;
};
const button=(label,callback,cls='btn ghost small')=>{
 const b=node('button',cls,label);b.type='button';b.addEventListener('click',callback);return b;
};
const state={campaign:null,char:null,cache:new Map(),loading:new Set(),search:'',addKind:'language',bonusKind:'tool',bonusPool:'any',bonusCount:1,busy:false,message:''};
function labelFor(kind,id){
 const rec=(kind==='tool'?rules().tools:rules().languages).find(x=>x.id===id);
 return rec?.name||id.replace(/-/g,' ');
}
function ensureAncestry(c,kind){
 if(kind==='tool')return [];
 const name=(c.ancestry||'').toLowerCase();
 const base=['common'];
 if(name==='daemon')base.push('daemonic');
 if(name==='flügel'||name==='flugel')base.push('fl-gel');
 return base;
}
function effective(c,rec,over,kind){
 const list=[];
 const seen=new Set();
 const put=(id,source)=>{
  if(!id||seen.has(id))return;
  seen.add(id);list.push({id,source});
 };
 for(const id of ensureAncestry(c,kind))put(id,'Ancestry');
 const cls=rules().classes[c.className]||{};
 for(const id of kind==='tool'?(cls.fixed||[]):(cls.languages||[]))put(id,'Class');
 for(const x of rec?.[kind==='tool'?'tools':'languages']||[])put(x.id,'Starting training');
 for(const x of rec?.dm_bonus||[])if((kind==='tool'?rules().tools:rules().languages).some(t=>t.id===x.id))put(x.id,'DM choice');
 for(const id of over?.[kind==='tool'?'extra_tools':'extra_languages']||[])put(id,'DM direct grant');
 for(const id of over?.[kind==='tool'?'hidden_tools':'hidden_languages']||[])put(id,'Suppressed');
 if(kind==='language'&&Array.isArray(c.languages)){
  for(const name of c.languages){
   const id=rules().languages.find(x=>x.name.toLowerCase()===String(name).toLowerCase())?.id||
     rules().aliases?.[name]||
     String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-');
   if(id)put(id,'Existing character record');
  }
 }
 const hidden=new Set(over?.[kind==='tool'?'hidden_tools':'hidden_languages']||[]);
 return list.map(x=>({...x,hidden:hidden.has(x.id),modes:over?.language_modes?.[x.id]||['speak','read','write']}));
}
async function load(c,force=false){
 const id=c.id;
 if(!force&&state.cache.has(id))return state.cache.get(id);
 if(state.loading.has(id))return null;
 state.loading.add(id);
 try{
  const [a,b,d]=await Promise.all([
   api().from('terravale_character_proficiencies').select('*')
    .eq('character_id',id).maybeSingle(),
   api().from('terravale_character_training_overrides').select('*')
    .eq('character_id',id).maybeSingle(),
   api().from('terravale_proficiency_bonus_choices').select('*')
    .eq('character_id',id).order('created_at',{ascending:true}).limit(60)
  ]);
  if(a.error||b.error||d.error)throw a.error||b.error||d.error;
  const value={record:a.data||{tools:[],languages:[],dm_bonus:[],pending_languages:[],submitted:false},
   overrides:b.data||{hidden_tools:[],hidden_languages:[],extra_tools:[],extra_languages:[],language_modes:{}},
   requests:d.data||[]};
  state.cache.set(id,value);return value;
 }finally{state.loading.delete(id)}
}
function alert(host,msg,error=false){
 const target=host.querySelector('.tv255-inline-message');
 if(target){target.textContent=msg;target.classList.toggle('is-error',error)}
}
async function change(c,kind,id,operation,modes,host,done){
 if(state.busy)return;
 state.busy=true;alert(host,'Saving '+labelFor(kind,id)+'…');
 const {data,error}=await api().rpc('terravale_dm_set_character_training',{
  target_character:c.id,training_kind:kind,proficiency_id:id,
  operation,selected_modes:modes||[]
 });
 state.busy=false;
 if(error){alert(host,'Could not save: '+error.message,true);return}
 await load(c,true);alert(host,'Saved. The player sheet will respect this character-specific change.');
 done?.();
}
function modesControl(c,entry,host,refresh){
 const wrapper=node('div','tv255-language-modes');
 const enabled=new Set(entry.modes||[]);
 for(const [mode,title] of [['speak','Speak'],['read','Read'],['write','Write']]){
  const item=node('label','tv255-language-mode');
  const check=node('input');check.type='checkbox';check.checked=enabled.has(mode);
  check.disabled=entry.hidden;
  check.addEventListener('change',()=>{
   const next=['speak','read','write'].filter(m=>
     m===mode?check.checked:enabled.has(m));
   if(!next.length){
    check.checked=true;alert(host,'A known language needs at least one ability. Use Remove to suppress it entirely.',true);
    return;
   }
   change(c,'language',entry.id,'set_modes',next,host,refresh);
  });
  item.append(check,node('span','',title));wrapper.append(item);
 }
 return wrapper;
}
function entryPanel(c,kind,entries,host,refresh,editable){
 const section=node('section','tv255-training-group');
 section.append(node('h3','',kind==='tool'?'Tool and instrument proficiency':'Spoken, read and written languages'));
 if(!entries.length)section.append(node('p','tv254-muted','No recorded proficiency in this category.'));
 for(const entry of entries){
  const row=node('div','tv255-training-row'+(entry.hidden?' suppressed':''));
  const copy=node('div','tv255-training-name');
  copy.append(node('strong','',labelFor(kind,entry.id)),
   node('small','',entry.source+(entry.hidden?' · suppressed for this character':'')));
  row.append(copy);
  if(kind==='language'&&!entry.hidden){
   if(editable)row.append(modesControl(c,entry,host,refresh));
   else row.append(node('small','tv255-mode-badge',
    (entry.modes||[]).map(m=>m[0].toUpperCase()+m.slice(1)).join(' · ')));
  }
  if(editable){
   const action=entry.hidden?'Restore':'Remove';
   row.append(button(action,()=>change(c,kind,entry.id,entry.hidden?'restore':'hide',[],host,refresh),
    entry.hidden?'btn primary small':'btn ghost small tv255-remove'));
  }
  section.append(row);
 }
 return section;
}
function kindChips(values,selected,callback){
 const group=node('div','tv255-tile-options');
 for(const [id,text] of values){
  const b=button(text,()=>callback(id),'tv255-option'+(selected===id?' selected':''));
  b.setAttribute('aria-pressed',String(selected===id));
  group.append(b);
 }
 return group;
}
function trainerPickList(host,c,loaded,refresh){
 const sec=node('section','tv254-panel tv255-training-picks');
 sec.append(node('div','tv254-eyebrow','ADD TRAINING MANUALLY'),
  node('h2','','Grant a particular proficiency'),
  node('p','tv254-muted','This gives the selected proficiency directly to this character. To let the player choose, use the separate bonus-choice panel below.'));
 const header=node('div','tv255-training-add-header');
 const kind=node('div','tv255-tile-options');
 const area=node('div','tv255-training-catalog');
 const search=node('input','tv255-input');
 search.type='search';search.placeholder='Search known proficiencies…';
 search.value=state.search;
 search.addEventListener('input',()=>{state.search=search.value;fill()});
 const drawKind=()=>{
  kind.replaceChildren(...Array.from(kindChips([['language','Languages'],['tool','Tools & instruments']],
   state.addKind,id=>{state.addKind=id;drawKind();fill()}).children));
 };
 drawKind();header.append(kind,search);sec.append(header,area);
 const done=()=>refresh();
 function fill(){
  area.replaceChildren();
  const available=state.addKind==='language'?rules().languages.filter(x=>x.enabled):rules().tools;
  const filtered=available.filter(x=>
   (x.name+' '+(x.category||'')).toLowerCase().includes(state.search.toLowerCase()));
  const current=effective(c,loaded.record,loaded.overrides,state.addKind);
  for(const item of filtered.slice(0,80)){
   const granted=current.some(x=>x.id===item.id&&!x.hidden);
   const hidden=current.some(x=>x.id===item.id&&x.hidden);
   const tile=button(item.name+(granted?' · learned':hidden?' · suppressed':''),
    ()=>change(c,state.addKind,item.id,'grant',[],host,done),
    'tv255-catalog-tile'+(granted?' is-granted':''));
   tile.disabled=granted;area.append(tile);
  }
  if(filtered.length>80)area.append(node('small','tv254-muted','Narrow your search to see additional options.'));
 }
 fill();return sec;
}
function bonusChoices(host,c,loaded,refresh){
 const section=node('section','tv254-panel tv255-bonus-section');
 section.append(node('div','tv254-eyebrow','LEVEL-UP-STYLE BONUS CHOICE'),
  node('h2','','Grant a player a choice'),
  node('p','tv254-muted','The recipient decides which qualifying tool or language to learn on their own sheet. This is not an automatic grant.'));
 let kind=state.bonusKind,pool=state.bonusPool,count=state.bonusCount;
 const modeGroup=node('div','tv255-bonus-mode');
 const categoryGroup=node('div','tv255-bonus-category');
 const quantity=node('div','tv255-count-control');
 const renderControls=()=>{
  modeGroup.replaceChildren(kindChips([['tool','Tool proficiency'],['language','Language proficiency']],kind,k=>{
   kind=k;if(k==='language')pool='any';renderControls();
  }));
  categoryGroup.replaceChildren();
  if(kind==='tool')categoryGroup.append(
   kindChips([['any','Any approved tool'],['artisan','Artisan tools'],
    ['instrument','Instruments'],['game','Gaming sets'],['artisan-instrument','Artisan or instrument']],pool,k=>{
     pool=k;renderControls();
   }));
  quantity.replaceChildren();
  quantity.append(node('span','','Number of choices'),
   button('−',()=>{count=Math.max(1,count-1);renderControls()},'tv255-counter'),
   node('strong','',count),
   button('+',()=>{count=Math.min(5,count+1);renderControls()},'tv255-counter'));
 };
 renderControls();
 const reason=node('input','tv255-input');reason.placeholder='Reason (optional, e.g. training reward)';reason.maxLength=240;
 const submit=button('Grant these choices',async()=>{
  const {error}=await api().rpc('terravale_dm_grant_proficiency_choice',{
   target_character:c.id,proficiency_kind:kind,choice_pool:pool,
   number_of_choices:count,purpose:reason.value||''
  });
  if(error)alert(host,'Could not grant choice: '+error.message,true);
  else{state.bonusKind=kind;state.bonusPool=pool;state.bonusCount=count;
   alert(host,'Choice granted to '+c.name+'.');refresh()}
 },'btn primary small');
 section.append(modeGroup,categoryGroup,quantity,reason,submit);
 const outstanding=(loaded.requests||[]).filter(x=>x.status==='pending');
 if(outstanding.length){
  const panel=node('div','tv255-pending-choices');
  panel.append(node('h3','','Unclaimed bonus choices'));
  for(const request of outstanding)panel.append(node('p','tv254-muted',
   request.choice_count+' '+request.kind+' choice(s) · '+(request.note||'Awaiting player')));
  section.append(panel);
 }
 return section;
}
function pendingLanguages(host,c,loaded,refresh){
 const pending=loaded.record?.pending_languages||[];
 if(!pending.length)return null;
 const section=node('section','tv254-panel tv255-training-approvals');
 section.append(node('div','tv254-eyebrow','RESTRICTED REQUESTS'),
  node('h2','','Pending language approvals'));
 for(const language of pending){
  const row=node('div','tv255-training-row');
  row.append(node('strong','',labelFor('language',language.id)),
   button('Approve',async()=>{
    const {error}=await api().rpc('terravale_dm_approve_language',{
     target_character:c.id,language_id:language.id
    });
    if(error)alert(host,error.message,true);
    else{alert(host,'Language approved.');refresh()}
   },'btn primary small'));
  section.append(row);
 }
 return section;
}
function displayDM(host,c,loaded,chars){
 const refresh=async()=>{
  state.cache.delete(c.id);
  const result=await load(c,true);
  if(host.isConnected&&result)displayDM(host,c,result,chars);
 };
 host.replaceChildren();
 const hero=node('div','tv255-section-heading');
 const label=node('div','');
 label.append(node('div','tv254-eyebrow','CHARACTER-SPECIFIC TRAINING'),
  node('h2','',c.name+' · Training record'),
  node('p','tv254-muted','Ancestry and class source rules stay unchanged. Removing an inherited proficiency suppresses it for this one character. You can restore it later.'));
 hero.append(label);host.append(hero);
 const status=node('p','tv255-inline-message');status.setAttribute('role','status');
 host.append(status);
 host.append(entryPanel(c,'language',effective(c,loaded.record,loaded.overrides,'language'),host,refresh,true));
 host.append(entryPanel(c,'tool',effective(c,loaded.record,loaded.overrides,'tool'),host,refresh,true));
 const approve=pendingLanguages(host,c,loaded,refresh);
 if(approve)host.append(approve);
 host.append(trainerPickList(host,c,loaded,refresh));
 host.append(bonusChoices(host,c,loaded,refresh));
}
function renderDM(host,campaign,chars){
 if(!campaign||!auth()?.state?.ready)return;
 if(state.campaign!==campaign.id){state.campaign=campaign.id;state.char=null;state.cache.clear()}
 host.replaceChildren();
 if(!chars.length){host.append(node('p','tv254-muted','Your campaign has no characters yet.'));return}
 const available=chars.filter(c=>c.ownerName||c.owner==='You'||c.owner==='Party member'||c.demoCurator);
 if(!available.length){host.append(node('p','tv254-muted','No eligible characters.'));return}
 const chosen=available.find(c=>c.id===state.char)||available[0];
 state.char=chosen.id;
 const selector=node('div','tv255-character-selector');
 selector.append(node('div','tv254-eyebrow','SELECT A CHARACTER'));
 const grid=node('div','tv255-chip-row');
 for(const c of available){
  const b=button(c.name,()=>{state.char=c.id;renderDM(host,campaign,chars)},
    'tv255-choice-chip'+(state.char===c.id?' chosen':''));
  b.setAttribute('aria-pressed',String(state.char===c.id));grid.append(b);
 }
 selector.append(grid);host.append(selector);
 const details=node('div','tv255-training-details');
 host.append(details);
 const cached=state.cache.get(chosen.id);
 if(cached)displayDM(details,chosen,cached,chars);
 else{
  details.append(node('p','tv254-muted','Loading '+chosen.name+'’s recorded training…'));
  load(chosen).then(value=>{
   if(details.isConnected&&state.char===chosen.id&&value)displayDM(details,chosen,value,chars)
  }).catch(e=>{
   if(details.isConnected)details.textContent='Could not load character training: '+(e.message||e);
  });
 }
}
async function bonusRequestUI(section,c,requests,refresh){
 const active=requests.filter(x=>x.status==='pending'&&c.owner==='You');
 for(const request of active){
  const box=node('div','tv255-player-bonus');
  box.append(node('h4','',request.choice_count+' additional '+request.kind+
   (request.choice_count===1?' proficiency':' proficiencies')),
   node('p','tv254-muted',request.note||'Granted by your Dungeon Master.'));
  const options=request.kind==='language'?
   rules().languages.filter(x=>x.enabled&&!x.dmApproval):
   rules().tools.filter(x=>request.choice_pool==='any'||
    (request.choice_pool==='artisan'&&x.category==="Artisan's Tools")||
    (request.choice_pool==='instrument'&&x.category==='Musical Instruments')||
    (request.choice_pool==='game'&&x.category==='Gaming Sets')||
    (request.choice_pool==='artisan-instrument'&&["Artisan's Tools",'Musical Instruments'].includes(x.category)));
  let selected=[];
  const count=node('p','tv254-muted','Selected: 0 / '+request.choice_count);
  const list=node('div','tv255-catalog-grid tv255-creator-options');
  const update=()=>{
   count.textContent='Selected: '+selected.length+' / '+request.choice_count;
   for(const b of list.children){
    const picked=selected.includes(b.dataset.id);
    b.classList.toggle('selected',picked);
    b.setAttribute('aria-pressed',String(picked));
   }
  };
  for(const entry of options){
   const b=button(entry.name,()=>{
    selected=selected.includes(entry.id)?selected.filter(x=>x!==entry.id):
      selected.length<request.choice_count?[...selected,entry.id]:[...selected.slice(1),entry.id];
    update();
   },'tv255-catalog-tile');
   b.dataset.id=entry.id;list.append(b);
  }
  box.append(count,list);
  box.append(button('Confirm selected proficiencies',async()=>{
   if(selected.length!==request.choice_count){
    count.textContent='Choose exactly '+request.choice_count+' different options.';return}
   const {error}=await api().rpc('terravale_claim_proficiency_choice',{
    request_id:request.id,chosen_ids:selected
   });
   if(error)count.textContent='Could not save: '+error.message;
   else refresh();
  },'btn primary small'));
  section.append(box);
 }
}
function displaySheet(section,c,loaded){
 section.replaceChildren();
 section.append(node('div','tv254-eyebrow','LANGUAGES, TOOLS & PROFICIENCY CHOICES'),
  node('h3','','Training and languages'));
 section.append(entryPanel(c,'language',
  effective(c,loaded.record,loaded.overrides,'language'),section,()=>{},false));
 section.append(entryPanel(c,'tool',
  effective(c,loaded.record,loaded.overrides,'tool'),section,()=>{},false));
 if((loaded.record?.pending_languages||[]).length)
 section.append(node('p','tv255-warning','Awaiting DM language approval: '+
  loaded.record.pending_languages.map(x=>labelFor('language',x.id)).join(', ')));
 if(!loaded.record?.submitted){
  section.append(node('p','tv254-muted',
   'Starting tool/language choices have not yet been confirmed for this character. Ask the DM to review the character creator record if missing.'));
 }
 const refresh=()=>{
  state.cache.delete(c.id);section.dataset.tv255Loaded='';
  renderSheet(section,c);
 };
 bonusRequestUI(section,c,loaded.requests||[],refresh);
}
function renderSheet(section,c){
 if(!auth()?.state?.ready||!section||!c)return;
 if(section.dataset.tv255Loaded==='1'&&section.dataset.character===c.id)return;
 section.dataset.tv255Loaded='1';section.dataset.character=c.id;
 section.replaceChildren(node('p','tv254-muted','Loading training for '+c.name+'…'));
 load(c).then(value=>{
  if(section.isConnected&&section.dataset.character===c.id&&value)displaySheet(section,c,value)
 }).catch(e=>{
  if(section.isConnected)section.textContent='Training unavailable: '+(e.message||String(e));
 });
}
window.TerravaleV255Training={renderDM,renderSheet};
})();
