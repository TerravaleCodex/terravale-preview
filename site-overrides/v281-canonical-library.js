/* V2.81 — canonical source-backed DM boon library.
   Archive 2 originals were migrated already. This view does NOT accept ZIP uploads.
   No unawarded source text is fetched by a player. */
(function(){
'use strict';
const api=()=>window.TerravaleVerifiedAccount?.supabase;
const auth=()=>window.TerravaleVerifiedAccount?.state;
const isDM=()=>!!auth()?.ready&&!!auth()?.profile?.is_dm&&
  typeof db!=='undefined'&&db.role==='dm';
const node=(tag,cls,text)=>{const e=document.createElement(tag);
 if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
const button=(title,handler,style='btn ghost small')=>{
 const e=node('button',style,title);e.type='button';e.addEventListener('click',handler);return e};
const labels={divine:'Major-god boons',concordant:'Concordants',
 minor_grace:'Minor Graces',minor_intercession:'Minor Intercessions',
 nyrha_revision:'Nyrha Revisions',nyrha_state:'The Unwritten State',
 tier_zero:'Tier 0 · formal bargain',nyrha_offer:'Impossible Offers'};
const kinds=['divine','concordant','minor_grace','minor_intercession',
 'nyrha_revision','nyrha_state','tier_zero','nyrha_offer'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const status={request:0};
const byCharacter=new Map();
function promptReason(message){return window.prompt(message,'')};
async function rpc(name,args){
 if(!api())throw Error('Verified account connection unavailable');
 const {data,error}=await api().rpc(name,args);
 if(error)throw Error(error.message||String(error));
 return data;
}
function chip(label,selected,onClick,group){
 const b=button(label,onClick,'tv281-chip'+(selected?' active':''));
 b.setAttribute('aria-pressed',String(selected));if(group)group.append(b);return b;
}
function statusText(host,message,error=false){
 host.textContent=message;host.classList.toggle('is-error',error);
}
function formatFamily(kind){return labels[kind]||kind}
function slotValue(source){
 const current=String(source.slot||'').toLowerCase();
 return ['passive','reaction','major'].includes(current)?current:null;
}
function renderTermsForm(host,context,entry,done){
 if(host.querySelector('[data-tv281-offer-form]'))return;
 const form=node('section','tv281-offer-form');
 form.dataset.tv281OfferForm='1';
 if(entry.kind==='tier_zero'){
  form.append(node('h4','','Offer the original Tier 0 bargain'),
   node('p','tv281-small',
    'The original benefits and costs are presented to the player verbatim. No rewritten story justification is necessary.'));
  const clarify=node('textarea','tv281-term-input');
  clarify.rows=2;clarify.maxLength=1500;
  clarify.placeholder='Optional clarification where the original source leaves a cost, person or limit unspecified';
  clarify.setAttribute('aria-label','Optional clarification');
  form.append(clarify);
  const feedback=node('p','tv281-small'),controls=node('div','tv281-actions');
  const send=button('Present original terms',async()=>{
   if(context.character!==context.currentCharacter())return;
   send.disabled=true;
   try{
    await rpc('terravale_divine_canon_dm_offer',{
     target_character:context.character,target_entry:entry.id,
     terms:{source_exact:true,clarifications:clarify.value.trim()}});
    statusText(feedback,'The original Tier 0 terms have been offered for explicit player acceptance.');
    send.remove();done?.();
   }catch(e){statusText(feedback,e.message,true);send.disabled=false}
  },'btn primary small');
  controls.append(send,button('Cancel',()=>form.remove()));form.append(controls,feedback);
  host.append(form);return;
 }
 form.append(node('h4','','Formal terms · player accepts separately'),
  node('p','tv281-small',
  'Disclose an actual benefit, certain price, affected parties, duration, reversibility and bounded uncertainty before offering. Silence or rescue is not consent.'));
 const required=[
  ['benefit','Immediate benefit'],
  ['certain_price','Certain price / maximum severity'],
  ['affected_parties','Who or what is affected'],
  ['duration','Duration'],
  ['reversibility','Reversibility'],
  ['uncertainty_boundary','Uncertainty and its severity bound']
 ];
 const values={};const grid=node('div','tv281-term-grid');
 for(const [key,label] of required){
  const row=node('label','tv281-term');
  row.append(node('span','',label));
  const input=node('textarea','tv281-term-input');
  input.rows=2;input.maxLength=key==='certain_price'||key==='benefit'?2500:1200;
  row.append(input);values[key]=input;grid.append(row);
 }
 form.append(grid);
 let fracture='Mercy';
 if(entry.kind.startsWith('nyrha_')){
  const wrap=node('div','tv281-chain-options');
  wrap.append(node('span','tv281-small','Disclosed Silver-Chain Fracture'));
  const controls=node('div','tv281-chips');
  const render=()=>{
   controls.replaceChildren();
   for(const chain of ['Mercy','Justice','Oblivion'])
    chip(chain,fracture===chain,()=>{fracture=chain;render()},controls);
  };render();wrap.append(controls);form.append(wrap);
 }
 const actions=node('div','tv281-actions');
 const info=node('p','tv281-small');
 const send=button('Present Offer to player',async()=>{
  if(context.character!==context.currentCharacter())return;
  const terms=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v.value.trim()]));
  if(Object.values(terms).some(x=>x.length<8)){
   statusText(info,'Complete all six formal terms before offering.',true);return;
  }
  if(entry.kind.startsWith('nyrha_'))terms.fracture_chain=fracture;
  send.disabled=true;
  try{
   await rpc('terravale_divine_canon_dm_offer',{
    target_character:context.character,target_entry:entry.id,terms});
   statusText(info,'Formal terms presented. The character owner must explicitly accept or decline.');
   send.remove();done?.();
  }catch(e){statusText(info,e.message,true);send.disabled=false}
 },'btn primary small');
 actions.append(send,button('Cancel',()=>form.remove()));form.append(actions,info);
 host.append(form);
}
function mountDM(host,config){
 if(!isDM()||!api()||!config?.campaign||!config?.character)return;
 if(host.querySelector('[data-tv281-canonical]'))return;
 const context={
  campaign:config.campaign,character:config.character,
  currentCharacter:()=>config.currentCharacter?.()||config.character
 };
 const section=node('section','tv281-canonical');
 let dmOffers=[];
 section.dataset.tv281Canonical='1';
 section.append(node('div','tv254-eyebrow','ORIGINAL ARCHIVE 2 · DM ONLY'),
  node('h3','','Canonical boon catalogue'),
  node('p','tv281-small','All imported source entries are searchable here. Ordinary boons can be bestowed with their exact wording. Tier 0 and Nyrha Offers require disclosed terms and player consent—not an automatic award.'));
 const message=node('p','tv281-status');
 const owned=node('div','tv281-held');
 const control=node('div','tv281-filter');
 const search=node('input','tv281-search');
 search.type='search';search.placeholder='Search boons or patrons…';
 search.setAttribute('aria-label','Search canonical boons');
 const pick=node('div','tv281-chips');
 const records=node('div','tv281-catalogue-results');
 const counter=node('small','tv281-small');
 const pager=node('div','tv281-actions');
 section.append(owned,control,records,pager,message);
 const options={kind:'all',query:'',offset:0};
 const page={request:0};
 let dmState=null;
 const same=()=>isDM()&&host.isConnected&&context.currentCharacter()===context.character;
 async function refreshAwards(){
  if(!same())return;
  try{
   const [state,offers]=await Promise.all([
    rpc('terravale_divine_canon_dm_state',{target_character:context.character}),
    rpc('terravale_divine_canon_offers_player_state',{target_character:context.character})
   ]);
   dmState=state;dmOffers=offers?.offers||[];
   byCharacter.set(context.character,dmState);
   renderHeld();
  }catch(e){statusText(message,'Could not load canonical awards: '+e.message,true)}
 }
 function renderHeld(){
  owned.replaceChildren();
  const box=node('section','tv281-state-panel');
  const awards=(dmState?.awards||[]).filter(a=>a.status!=='revoked');
  const state=dmState?.state||{};
  box.append(node('h4','','Bestowed to this adventurer'),
   node('p','tv281-small',awards.length?
     awards.length+' held canonical gift(s); suspended gifts remain recorded and do not regain charges.':
     'No canonical boons have been awarded to the selected adventurer.'));
  for(const a of awards){
   const row=node('div','tv281-held-row');
   const left=node('div','');
   left.append(node('strong','',a.name),node('small','',
    [a.patron,a.slot,a.status,a.uses_remaining===null?'':'Uses '+a.uses_remaining+' / '+a.max_uses].filter(Boolean).join(' · ')));
   row.append(left);
   const group=node('div','tv281-actions');
   if(a.status==='active')group.append(button('Make dormant',async()=>{
    const why=promptReason('Reason for suppressing / making '+a.name+' dormant');
    if(why===null)return;
    await perform('terravale_divine_canon_dm_set_status',
      {target_award:a.id,new_status:'dormant',reason:why},'Boon made dormant.');
   }));
   else group.append(button('Reactivate',async()=>{
    await perform('terravale_divine_canon_dm_set_status',
      {target_award:a.id,new_status:'active',reason:'DM reseating'},'Boon reactivated.');
   }));
   group.append(button('Revoke',async()=>{
    const why=promptReason('Revoke '+a.name+'? Its history and unsettled Burdens remain.');
    if(why===null)return;
    await perform('terravale_divine_canon_revoke',
      {target_award:a.id,reason:why},'Boon revoked.');
   },'btn ghost small tv254-danger'));
   if(a.max_uses!==null&&a.max_uses!==undefined&&a.recovery!=='none'){
    group.append(button('DM restore uses',async()=>{
     const why=promptReason('Why are the uses of '+a.name+' being restored now?');
     if(why===null)return;
     await perform('terravale_divine_canon_dm_refill',
       {target_award:a.id,reason:why},'Divine uses restored.');
    }));
   }
   if(a.kind==='nyrha_revision'&&a.status==='active'){
    group.append(button('Break the Pattern',()=>showFractureForm(row,a)));
   }
   row.append(group);box.append(row);
  }
  const standing=node('section','tv281-standing');
  const entanglement=node('div','tv281-standing-row');
  entanglement.append(node('strong','','Nyrha · Entanglement'),
   node('span','',String(state.entanglement??0)+' / 5'));
  const change=node('div','tv281-actions');
  for(const delta of [-1,1]){
   const b=button(delta>0?'Increase':'Decrease',async()=>{
    const next=Number(state.entanglement||0)+delta;
    if(next<0||next>5)return;
    const reason=promptReason('Meaningful scene / Severance behind Entanglement '+next);
    if(reason===null)return;
    await perform('terravale_divine_canon_dm_set_relation',{
     target_character:context.character,new_entanglement:next,reason
    },'Entanglement updated.');
   });
   b.disabled=Number(state.entanglement||0)+delta<0||
    Number(state.entanglement||0)+delta>5;
   change.append(b);
  }
  entanglement.append(change);standing.append(entanglement);
  standing.append(node('p','tv281-small','Divine Pressure: '+(state.divine_pressure||0)+
    ' · Minor Intercession: '+(state.minor_intercession_remaining??1)+' / 1'));
  // An existing Burden is not required before the DM can award the first stack.
  const patronsPresent=new Set((dmState?.burdens||[]).map(x=>x.patron));
  const activePatrons=new Set();
  for(const award of awards){
   if(['divine','concordant'].includes(award.kind)){
    if(award.patron)activePatrons.add(award.patron.toLowerCase());
    if(award.other_patron)activePatrons.add(award.other_patron.toLowerCase());
   }
  }
  const availableBurdens=[...activePatrons].filter(p=>!patronsPresent.has(p));
  if(availableBurdens.length){
   const choices=node('div','tv281-actions');
   choices.append(node('small','tv281-small','Start tracking a patron Burden:'));
   for(const p of availableBurdens)choices.append(button(p,async()=>{
    const reason=promptReason('First meaningful Burden for '+p+'. What triggered it?');
    if(reason===null)return;
    await perform('terravale_divine_canon_dm_adjust_burden',{
     target_character:context.character,patron:p,delta:1,reason},'Burden recorded.');
   }));
   standing.append(choices);
  }
  for(const burden of dmState?.burdens||[]){
   const row=node('div','tv281-standing-row');
   row.append(node('strong','',burden.name),
    node('span','',burden.patron+' · '+burden.stacks+' / 3'+
      (burden.overflow_pending?' · OVERFLOW: choose suppression':'')));
   const actions=node('div','tv281-actions');
   for(const change of [-1,1]){
    const btnEl=button(change<0?'Settle −1':'Gain +1',async()=>{
     const reason=promptReason('Reason / meaningful scene for '+burden.name);
     if(reason===null)return;
     await perform('terravale_divine_canon_dm_adjust_burden',{
      target_character:context.character,patron:burden.patron,
      delta:change,reason},'Divine Burden updated.');
    });
    btnEl.disabled=burden.stacks+change<0||burden.stacks+change>3;
    actions.append(btnEl);
   }
   row.append(actions);standing.append(row);
  }
  const effects=dmState?.effects||[];
  const statusOptions=['Drunk','Blackout','Rapture','Scorched','Blackout Sign'];
  const addEffects=node('div','tv281-actions');
  addEffects.append(node('small','tv281-small','Named divine effects:'));
  for(const effectName of statusOptions){
   const stored=effects.find(x=>x.key===effectName);
   if(stored&&stored.stacks>0)continue;
   addEffects.append(button('+ '+effectName,async()=>{
     const note=promptReason('Context or source justification for '+effectName);
     if(note===null)return;
     await perform('terravale_divine_canon_dm_set_effect',{
      target_character:context.character,target_effect:effectName,
      new_stacks:1,note},effectName+' recorded.');
   }));
  }
  standing.append(addEffects);
  if(effects.length){
   standing.append(node('h5','','Named effects · manual judgement where source is incomplete'));
   for(const effect of effects){
    const row=node('div','tv281-standing-row');
    row.append(node('strong','',effect.key),node('small','',effect.stacks+' stack(s)'));
    const actions=node('div','tv281-actions');
    for(const change of [-1,1])actions.append(button(change<0?'−1':'+1',async()=>{
      await perform('terravale_divine_canon_dm_set_effect',{
       target_character:context.character,target_effect:effect.key,
       new_stacks:Math.max(0,Math.min(99,Number(effect.stacks)+change)),
       note:effect.note||''},'Named effect updated.');
    }));
    row.append(actions);standing.append(row);
   }
  }
  for(const fracture of dmState?.fractures||[]){
   const row=node('div','tv281-standing-row');
   row.append(node('strong','','Nyrha · '+fracture.chain+' Fracture'),
    node('small','',fracture.consequence));
   row.append(button('Record Severance',async()=>{
    const resolution=promptReason('What meaningful act settled '+fracture.chain+'?');
    if(!resolution)return;
    await perform('terravale_divine_canon_dm_resolve_fracture',{
     target_fracture:fracture.id,resolution},'Fracture resolved.');
   }));standing.append(row);
  }
  box.append(standing);
  owned.append(box);
 }
 function showFractureForm(row,award){
  if(row.querySelector('.tv281-break-form'))return;
  const f=node('section','tv281-break-form');
  f.append(node('h5','','Explicit Nyrha Fracture and player consent'));
  let chain='Mercy';
  const buttons=node('div','tv281-chips');
  const draw=()=>{buttons.replaceChildren();
   for(const key of ['Mercy','Justice','Oblivion'])
    chip(key,key===chain,()=>{chain=key;draw()},buttons)};
  draw();f.append(buttons);
  const input=node('textarea','tv281-term-input');
  input.rows=3;input.placeholder='The exact bounded consequence the player chose';input.maxLength=1500;
  f.append(input);
  const save=button('Confirm accepted Break the Pattern',async()=>{
   if(!window.confirm('Has the player explicitly accepted this precise '+chain+' Fracture?'))return;
   await perform('terravale_divine_canon_dm_fracture',{
    target_character:context.character,target_award:award.id,target_chain:chain,
    consequence:input.value.trim(),consent_confirmed:true
   },'Revision activated and Fracture recorded.');
  },'btn primary small');
  f.append(save,button('Cancel',()=>f.remove()));row.append(f);
 }
 async function perform(name,args,success){
  if(!same())return;
  statusText(message,'Recording a verified DM action…');
  try{
   await rpc(name,args);
   statusText(message,success);
   window.TerravaleV270Divine?.refreshSheet?.(context.character);
   await refreshAwards();await showEntries();
  }catch(e){statusText(message,e.message,true)}
 }
 async function showEntries(){
  if(!same())return;
  const request=++page.request;
  statusText(message,'Searching original boon catalogue…');
  try{
   const data=await rpc('terravale_divine_dm_archive_list',{
    target_campaign:context.campaign,target_set:null,
    family:options.kind==='all'?null:options.kind,
    needle:options.query,page_size:20,page_offset:options.offset
   });
   if(!same()||request!==page.request)return;
   records.replaceChildren();pager.replaceChildren();
   const count=Number(data.total)||0;
   counter.textContent=count+' canonical source sections';
   const grantedIds=new Set((dmState?.awards||[]).map(x=>x.entry_id));
   for(const item of data.entries||[])records.append(renderEntry(item,grantedIds.has(item.id)));
   if(!data.entries?.length)
    records.append(node('p','tv281-small','No source entries match this filter.'));
   const prev=button('Previous',()=>{options.offset=Math.max(0,options.offset-20);showEntries()});
   prev.disabled=options.offset===0;
   const next=button('Next',()=>{options.offset+=20;showEntries()});
   next.disabled=options.offset+20>=count;
   pager.append(prev,counter,next);
   statusText(message,'Canonical source is already imported. No ZIP upload is needed.');
  }catch(e){statusText(message,'Cannot access private catalogue: '+e.message,true)}
 }
 function renderEntry(item,held){
  const card=node('details','tv281-entry');
  const head=node('summary','');
  const title=node('span','');
  title.append(node('strong','',item.name),
   node('small','',[item.patron,item.other_patron,formatFamily(item.kind),
    item.tier===null?'':'Tier '+item.tier].filter(Boolean).join(' · ')));
  head.append(title,node('small','',held?'Held':'Read source'));
  card.append(head);
  const body=node('div','tv281-entry-body');
  card.append(body);
  let loaded=false;
  card.addEventListener('toggle',async()=>{
   if(!card.open||loaded)return;
   body.replaceChildren(node('p','tv281-small','Reading exact private Archive 2 text…'));
   try{
    const original=await rpc('terravale_divine_dm_archive_read',{
     target_campaign:context.campaign,target_entry:item.id
    });
    if(!same()||!card.isConnected)return;
    loaded=true;body.replaceChildren();
    const renderer=window.TerravaleDivineReaderV282;
    body.append(renderer?.feature(original.original_mechanics||'',original)||
     node('p','tv281-small',original.original_mechanics||''));
    body.append(node('p','tv281-small',
      'Source: '+item.source_path+' · Exact text only. Mechanical rulings remain subject to the shared Divine Boons rules.'));
    const limited=['divine','concordant','minor_grace','minor_intercession',
      'nyrha_revision','nyrha_state'].includes(item.kind);
    if(!limited){
     body.append(node('p','tv281-story-note',item.kind==='tier_zero'?
      'Tier 0 draws its benefits and costs directly from the source. The player must accept before the DM bestows it.':
      'Nyrha’s Impossible Offers retain their separate formal requirements.'));
     if(item.kind==='tier_zero'&&!held&&dmOffers.some(o=>
       o.entry_id===item.id&&o.status==='accepted')){
      body.append(button('Bestow accepted Tier 0 bargain',async()=>{
       try{
        await rpc('terravale_divine_canon_grant',{
         target_character:context.character,target_entry:item.id,target_slot:'bargain',
         target_ability:null,reason:''});
        statusText(message,'Accepted Tier 0 bargain bestowed.');
        window.TerravaleV270Divine?.refreshSheet?.(context.character);
        await refreshAwards();await showEntries();
       }catch(e){statusText(message,e.message,true)}
      },'btn primary small'));
     }else if(held){
      body.append(node('p','tv281-small','This bargain is already bestowed.'));
     }else body.append(button(item.kind==='tier_zero'?'Offer original Tier 0 terms':'Prepare Formal Offer',
      ()=>renderTermsForm(body,context,item,refreshAwards)));
     return;
    }
    if(held){
     body.append(node('p','tv281-small','Already held by this character; manage it above.'));return;
    }
    if(item.kind.startsWith('nyrha_')){
     body.append(node('p','tv281-story-note',
      'Nyrha requires accepted Formal Offer terms before the DM can grant this Revision.'));
     body.append(button('Present Formal Offer',()=>renderTermsForm(body,context,item,refreshAwards)));
    }
    const box=node('div','tv281-grant-controls');
    let picked=slotValue(item);
    if(item.kind==='divine'||item.kind==='concordant'){
     box.append(node('small','tv281-small',
      picked?'Original source prescribes '+picked+' slot.':
       'Source does not specify a slot. DM must classify this boon before awarding.'));
     const slots=node('div','tv281-chips');
     const draw=()=>{slots.replaceChildren();
      for(const value of ['passive','reaction','major']){
       const b=chip(value[0].toUpperCase()+value.slice(1),picked===value,
         ()=>{if(slotValue(item))return;picked=value;draw()},slots);
       if(slotValue(item)&&value!==picked)b.disabled=true;
      }};draw();box.append(slots);
    }
    let ability=null;
    if(item.kind==='minor_grace'||item.kind==='minor_intercession'){
     const control=node('div','tv281-chips');
     const redraw=()=>{control.replaceChildren();
      for(const key of ['int','wis','cha'])chip(key.toUpperCase(),key===ability,
       ()=>{ability=key;redraw()},control)};
     redraw();box.append(node('p','tv281-small','Choose the fixed Minor Boon Ability'),control);
    }
    const send=button('Bestow exact source boon',async()=>{
     if(!same())return;
     if((item.kind==='divine'||item.kind==='concordant')&&!picked){
      statusText(message,'Select a legal Favour Slot for this boon.',true);return;
     }
     if(['minor_grace','minor_intercession'].includes(item.kind)&&!ability){
      statusText(message,'Choose INT, WIS or CHA as Minor Boon Ability.',true);return;
     }
     const reason=''; // No lore explanation is required for an unexplained divine gift.
     send.disabled=true;
     try{
      await rpc('terravale_divine_canon_grant',{
       target_character:context.character,target_entry:item.id,target_slot:picked,
       target_ability:ability,reason});
      statusText(message,'Canonical boon bestowed. It is now visible in the character sheet.');
      window.TerravaleV270Divine?.refreshSheet?.(context.character);
      await refreshAwards();await showEntries();
     }catch(e){statusText(message,e.message,true);send.disabled=false}
    },'btn primary small');
    if(!held)box.append(send);
    body.append(box);
   }catch(e){body.replaceChildren(node('p','tv281-status is-error',e.message))}
  });
  return card;
 }
 control.append(search,pick);
 function renderFilters(){
  pick.replaceChildren();
  chip('All',options.kind==='all',()=>{
   options.kind='all';options.offset=0;renderFilters();showEntries()},pick);
  for(const key of kinds)chip(formatFamily(key),options.kind===key,()=>{
   options.kind=key;options.offset=0;renderFilters();showEntries()},pick);
 }
 renderFilters();
 let timer=null;
 search.addEventListener('input',()=>{
  options.query=search.value.trim().slice(0,100);options.offset=0;
  clearTimeout(timer);timer=setTimeout(showEntries,180);
 });
 const anchor=host.children[3]||null;host.insertBefore(section,anchor);
 refreshAwards().then(showEntries);
}
function renderPlayerStatuses(host,data,character){
 if(!host||!data)return;
 const burdens=data.burdens||[],effects=data.statuses||[],
  fractures=data.fractures||[],state=data.divine_state||{};
 if(!burdens.length&&!effects.length&&!fractures.length&&
  !(Number(state.entanglement)>0)&&!(Number(state.divine_pressure)>0))return;
 const panel=node('section','tv281-player-effects');
 panel.append(node('h3','','Divine consequences'),
  node('p','tv281-small','Burdens and Fractures are not ordinary removable conditions. Automatic tracking is limited to explicitly defined events.'));
 const grid=node('div','tv281-effect-grid');
 for(const b of burdens){
  const card=node('div','tv281-effect');
  card.append(node('strong','',b.name),
   node('span','',b.patron+' · '+b.stacks+' / 3'+(b.overflow_pending?' · Overflow unresolved':'')));
  grid.append(card);
 }
 for(const effect of effects){
  const card=node('div','tv281-effect');
  card.append(node('strong','',effect.key),node('span','',effect.stacks+' stack(s)'));
  if(effect.note)card.append(node('small','',effect.note));
  grid.append(card);
 }
 for(const fracture of fractures){
  const card=node('div','tv281-effect');
  card.append(node('strong','','Nyrha · '+fracture.chain+' Fracture'),
   node('small','',fracture.consequence));grid.append(card);
 }
 if(state.divine_pressure>0){
  const p=node('div','tv281-effect');p.append(node('strong','','Divine Pressure'),
   node('span','',String(state.divine_pressure)));grid.append(p);
 }
 if(state.entanglement>0){
  const p=node('div','tv281-effect');p.append(node('strong','','Nyrha Entanglement'),
   node('span','',state.entanglement+' / 5'));grid.append(p);
 }
 panel.append(grid);host.append(panel);
}
function renderPlayerOffers(host,data,character,refresh){
 if(!host||!data?.offers?.length)return;
 const panel=node('section','tv281-player-offers');
 panel.append(node('h3','','Formal divine Offers'),
  node('p','tv281-small','Your own decision controls whether you accept. Review every price, affected party and uncertainty before responding.'));
 for(const item of data.offers){
  const card=node('details','tv281-entry');
  card.append(node('summary','',item.title+' · '+item.status));
  const box=node('div','tv281-entry-body');
  const renderer=window.TerravaleDivineReaderV282;
  box.append(renderer?.feature(item.source_mechanics||'',item)||
   node('p','tv281-small',item.source_mechanics||''));
  if(item.source_exact){
   box.append(node('p','tv281-story-note','The original Archive 2 source above contains the terms for this bargain.'));
   if(item.clarifications)box.append(node('p','tv281-term-summary','Additional clarification: '+item.clarifications));
  }else{
   for(const [title,key] of [
    ['Immediate benefit','benefit'],['Certain price','certain_price'],
    ['Affected parties','affected_parties'],['Duration','duration'],
    ['Reversibility','reversibility'],['Uncertainty boundary','uncertainty_boundary'],
    ['Fracture Chain','fracture_chain']]){
     if(item[key])box.append(node('p','tv281-term-summary',title+': '+item[key]));
   }
  }
  if(item.status==='offered'&&character?.owner==='You'){
   const actions=node('div','tv281-actions');
   const state=node('small','tv281-small');
   for(const accept of [true,false]){
    const b=button(accept?'Accept disclosed terms':'Decline Offer',async()=>{
     if(accept&&!window.confirm('Do you personally accept the disclosed benefit, price and uncertainty?'))return;
     b.disabled=true;
     try{
      await rpc('terravale_divine_canon_respond_offer',{
       target_offer:item.id,accepted:accept});
      statusText(state,accept?'Offer accepted. Await the DM’s decision and activation.':'Offer declined without penalty.');
      refresh?.();
     }catch(e){statusText(state,e.message,true);b.disabled=false}
    },accept?'btn primary small':'btn ghost small');
    actions.append(b);
   }
   box.append(actions,state);
  }
  card.append(box);panel.append(card);
 }
 host.append(panel);
}
// Called only by the verified native rest-completion handlers.
const lastNativeRest=new Map();
function onNativeRest(id,kind){
 if(!UUID.test(String(id||''))||!['short','long'].includes(kind)||
  !auth()?.ready||!api())return;
 const key=id+':'+kind,now=Date.now();
 if(now-(lastNativeRest.get(key)||0)<1800)return;
 lastNativeRest.set(key,now);
 rpc('terravale_divine_canon_rest',{target_character:id,rest_kind:kind})
 .then(result=>{
  window.TerravaleV270Divine?.refreshSheet?.(id);
  if(Number(result?.refreshed_awards)>0||result?.intercession_reset){
   if(typeof toast==='function')toast('Divine resources checked after '+kind+' rest.');
  }
 }).catch(err=>{
  if(typeof toast==='function')toast('Divine rest recovery was not saved: '+err.message);
  else console.warn('[Divine Rest]',err.message);
 });
}
window.TerravaleV281Canon={mountDM,renderPlayerStatuses,renderPlayerOffers,onNativeRest};
})();