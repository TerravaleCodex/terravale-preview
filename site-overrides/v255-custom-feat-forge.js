/* Terravale V2.55 — DM Feat Forge and live character-sheet grants.
   Written rules remain DM-authored descriptions, not fabricated automatic powers. */
(function(){
'use strict';
const auth=()=>window.TerravaleVerifiedAccount;
const api=()=>auth()?.supabase;
const registry=()=>window.TerravaleRulesV4;
const node=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);
 return el;
};
const btn=(text,fn,cls='btn ghost small')=>{
 const el=node('button',cls,text);el.type='button';el.addEventListener('click',fn);return el;
};
const state={campaign:null,loaded:false,loading:false,feats:[],grants:[],
 mode:'library',selected:null,busy:false,message:''};
const message=text=>{
 state.message=text;
 const el=document.querySelector('#tv255-feat-status');if(el)el.textContent=text;
};
const field=(label,value,options={})=>{
 const wrap=node('label','tv255-field');
 wrap.append(node('span','',label));
 const input=node(options.multiline?'textarea':'input','tv255-input');
 if(!options.multiline)input.type=options.type||'text';
 if(options.multiline)input.rows=options.rows||4;
 input.value=value??'';
 if(options.maxlength)input.maxLength=options.maxlength;
 if(options.min!==undefined)input.min=options.min;
 if(options.max!==undefined)input.max=options.max;
 wrap.append(input);return {wrap,input};
};
const specOf=(f={})=>({
 name:f.name||'',short_description:f.short_description||'',
 prerequisites:f.prerequisites||'',rules_text:f.rules_text||'',
 action_type:f.action_type||'passive',uses_per_rest:Number(f.uses_per_rest)||0,
 recovery:f.recovery||'manual',minimum_level:Number(f.minimum_level)||1,
 rarity:f.rarity||'Custom',state:f.state==='draft'?'draft':'ready'
});
const choose=(name,values,value,update)=>{
 const group=node('div','tv255-tile-options');
 group.setAttribute('role','group');group.setAttribute('aria-label',name);
 for(const [id,title] of values){
  const option=btn(title,()=>update(id),'tv255-option'+(id===value?' selected':''));
  option.setAttribute('aria-pressed',String(id===value));
  group.append(option);
 }
 return group;
};
async function refresh(host,campaign,chars){
 if(state.loading)return;
 state.loading=true;message('Refreshing the feat library…');
 try{
  const [feats,grants]=await Promise.all([
   api().from('terravale_dm_custom_feats').select('*').eq('campaign_id',campaign.id)
    .order('created_at',{ascending:false}).limit(500),
   api().from('terravale_character_custom_feats').select('*').eq('campaign_id',campaign.id)
    .order('granted_at',{ascending:false}).limit(1500)
  ]);
  if(feats.error)throw feats.error;
  if(grants.error)throw grants.error;
  state.feats=feats.data||[];state.grants=grants.data||[];
  state.loaded=true;message('');
 }catch(err){message('Could not read custom feats: '+(err.message||String(err)))}
 finally{state.loading=false;draw(host,campaign,chars)}
}
function renderList(host,campaign,chars){
 const head=node('div','tv255-section-heading');
 const label=node('div','');
 label.append(node('div','tv254-eyebrow','YOUR PREPARED FEATS'),
  node('h2','','Custom Feat Library'),
  node('p','tv254-muted','Keep up to 500 reusable custom feats. You can edit them before or after granting; archived feats remain recorded on characters who received them.'));
 head.append(label,btn('+ Create custom feat',()=>{
  state.mode='edit';state.selected=null;draw(host,campaign,chars);
 },'btn primary small'));host.append(head);
 const list=node('div','tv255-feat-grid');
 const records=state.feats.filter(f=>f.state!=='archived');
 if(!records.length)list.append(node('p','tv254-muted',
  'No custom feats prepared. Create one now; you can grant it to any eligible character later.'));
 for(const f of records){
  const count=state.grants.filter(g=>g.feat_id===f.id&&g.status==='active').length;
  const card=node('article','tv255-feat-card tv257-feat-library-row');
  const info=node('div','tv257-feat-library-copy');
  const meta=node('div','tv254-eyebrow',
   f.state==='draft'?'PRIVATE DRAFT':'PUBLISHED CUSTOM FEAT');
  info.append(meta,node('h3','',f.name),
   node('p','',f.short_description||'No summary provided.'),
   node('div','tv255-feat-meta','Level '+f.minimum_level+'+ · '+
    f.action_type+(f.uses_per_rest?' · '+f.uses_per_rest+' use(s)':' · No use limit')+
    ' · '+count+' active grants'));
  card.append(info);
  const actions=node('div','tv254-actions');
  actions.append(btn('Edit feat',()=>{
    state.mode='edit';state.selected=f.id;draw(host,campaign,chars);
  }),btn('Assign / revoke',()=>{
    state.mode='assign';state.selected=f.id;draw(host,campaign,chars);
  },'btn primary small'));
  actions.append(btn('Archive',async()=>{
   if(!confirm('Archive '+f.name+'? Existing grants remain, but new ones stop until restored by editing.'))return;
   await mutate(api().rpc('terravale_dm_save_custom_feat',{
    target_campaign:campaign.id,existing_feat:f.id,feat_spec:{},delete_feat:true
   }),host,campaign,chars,'Feat archived.');
  },'btn ghost small tv254-danger'));
  card.append(actions);list.append(card);
 }
 host.append(list);
}
function renderEditor(host,campaign,chars){
 const existing=state.feats.find(f=>f.id===state.selected);
 const values=specOf(existing);
 const enabled={
  prerequisites:!!values.prerequisites,
  level:values.minimum_level>1,
  activation:values.action_type!=='passive',
  uses:values.uses_per_rest>0,
  recovery:values.uses_per_rest>0&&values.recovery!=='manual'
 };
 host.append(btn('← Back to feat library',()=>{
  state.mode='library';state.selected=null;draw(host,campaign,chars);
 },'tv255-back-link'));
 const sec=node('section','tv254-panel tv255-focused-form');
 sec.append(node('div','tv254-eyebrow','DM-AUTHORED FEATURE'),
  node('h2','',existing?'Edit '+existing.name:'Create a custom feat'),
  node('p','tv254-muted','Describe the actual rules, conditions and limitations before granting the feat. This is a real saved feature on the character sheet, but numerical effects are not silently applied to AC, HP or attacks.'));
 const form=node('form','tv255-feat-form');
 const name=field('Feat name',values.name,{maxlength:120});
 const summary=field('Short description',values.short_description,{maxlength:600,multiline:true,rows:2});
 const req=field('Prerequisites',values.prerequisites,{maxlength:1200,multiline:true,rows:2});
 const rules=field('Full rules, effects and limitations',values.rules_text,{maxlength:7000,multiline:true,rows:8});
 form.append(name.wrap,summary.wrap,rules.wrap);
 const type=node('div','tv255-creator-choice-group');
 type.append(node('strong','','Activation type'));
 const drawType=()=>{if(type.lastChild?.classList?.contains('tv255-tile-options'))type.lastChild.remove();
  type.append(choose('Activation type',[
   ['passive','Passive'],['action','Action'],['bonus action','Bonus action'],
   ['reaction','Reaction'],['special','Special']],values.action_type,id=>{
    values.action_type=id;drawType();
   }));};drawType();
 const row=node('div','tv255-form-grid');
 const level=field('Minimum character level',values.minimum_level,{type:'number',min:1,max:20});
 const uses=field('Maximum uses per recovery',values.uses_per_rest,{type:'number',min:0,max:100});
 const rarity=field('Rarity or category',values.rarity,{maxlength:60});
 row.append(level.wrap,uses.wrap,rarity.wrap);
 const recovery=node('div','tv255-creator-choice-group');
 recovery.append(node('strong','','Use recovery'));
 const drawRecovery=()=>{
  if(recovery.lastChild?.classList?.contains('tv255-tile-options'))recovery.lastChild.remove();
  recovery.append(choose('Recovery',[
   ['manual','DM-controlled'],['short','Short rest'],['long','Long rest'],
   ['dawn','Dawn'],['none','No recharge']],values.recovery,id=>{values.recovery=id;drawRecovery()}));
 };drawRecovery();
 const status=node('div','tv255-creator-choice-group');
 status.append(node('strong','','Availability'));
 const drawStatus=()=>{
  if(status.lastChild?.classList?.contains('tv255-tile-options'))status.lastChild.remove();
  status.append(choose('Publication status',[['draft','Save draft'],['ready','Ready to grant']],values.state,id=>{
   values.state=id;drawStatus();
  }));
 };drawStatus();
 const layout=node('div','tv256-feat-layout');
 const switches=node('aside','tv256-feature-switchboard');
 switches.append(node('strong','','Feat elements'),
  node('p','tv254-muted','Only enable the parts this feat actually needs.'));
 const specifics=node('div','tv256-feat-specifics');
 specifics.append(req.wrap,type,row,recovery);
 const makeSwitch=(key,title,description)=>{
  const label=node('label','tv256-mechanic-switch');
  const input=node('input');input.type='checkbox';input.checked=enabled[key];
  const copy=node('span','');copy.append(node('strong','',title),
   node('small','',description));
  label.append(input,copy);
  input.addEventListener('change',()=>{enabled[key]=input.checked;updateVisible()});
  switches.append(label);
 };
 makeSwitch('prerequisites','Prerequisites','Requirements or restrictions');
 makeSwitch('level','Level requirement','Limit to level 2 or higher');
 makeSwitch('activation','Activation','Action, bonus action, reaction or special');
 makeSwitch('uses','Limited uses','Display a maximum-uses counter');
 makeSwitch('recovery','Recovery','Configure when limited uses return');
 function updateVisible(){
  if(!enabled.uses)enabled.recovery=false;
  req.wrap.hidden=!enabled.prerequisites;
  level.wrap.hidden=!enabled.level;
  type.hidden=!enabled.activation;
  uses.wrap.hidden=!enabled.uses;
  recovery.hidden=!enabled.uses||!enabled.recovery;
  const recharge=switches.querySelector('[data-tv256-switch="recovery"]');
  if(recharge){
   const check=recharge.querySelector('input');
   check.disabled=!enabled.uses;
   check.checked=enabled.recovery;
  }
 }
 switches.lastChild.dataset.tv256Switch='recovery';
 layout.append(switches,specifics);
 form.append(layout,status);
 updateVisible();
 const buttons=node('div','tv254-actions');
 const save=node('button','btn primary small','Save custom feat');save.type='submit';
 buttons.append(save,btn('Cancel',()=>{state.mode='library';draw(host,campaign,chars)}));
 form.append(buttons);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const data={
   name:name.input.value.trim(),
   short_description:summary.input.value.trim(),
   prerequisites:enabled.prerequisites?req.input.value.trim():'',
   rules_text:rules.input.value.trim(),
   action_type:enabled.activation?values.action_type:'passive',
   uses_per_rest:enabled.uses?Number(uses.input.value):0,
   minimum_level:enabled.level?Number(level.input.value):1,
   rarity:rarity.input.value.trim()||'Custom',
   recovery:enabled.uses&&enabled.recovery?values.recovery:'manual',state:values.state
  };
  if(!data.name)return message('Enter a feat name.');
  const result=await mutate(api().rpc('terravale_dm_save_custom_feat',{
   target_campaign:campaign.id,existing_feat:existing?.id||null,
   feat_spec:data,delete_feat:false
  }),host,campaign,chars,'Custom feat saved.');
  if(result){state.mode='library';state.selected=null;draw(host,campaign,chars);}
 });
 sec.append(form);host.append(sec);
}
function renderAssignment(host,campaign,chars){
 const feat=state.feats.find(f=>f.id===state.selected);
 if(!feat){state.mode='library';renderList(host,campaign,chars);return}
 host.append(btn('← Back to feat library',()=>{
  state.mode='library';state.selected=null;draw(host,campaign,chars);
 },'tv255-back-link'));
 const sec=node('section','tv254-panel tv255-focused-form');
 sec.append(node('div','tv254-eyebrow','APPLY A PREPARED FEAT'),
  node('h2','',feat.name),
  node('p','tv254-muted',feat.rules_text||feat.short_description||'No mechanics provided.'));
 if(feat.state!=='ready')sec.append(node('p','tv255-warning',
  'This feat is currently '+feat.state+'. Publish it as Ready before granting new copies.'));
 const roster=node('div','tv255-character-grant-list');
 for(const c of chars){
  const isActive=state.grants.some(g=>g.feat_id===feat.id&&g.character_id===c.id&&g.status==='active');
  const row=node('div','tv255-grant-row');
  const who=node('div','');
  who.append(node('strong','',c.name),node('small','',
   c.ancestry+' · '+c.className+' · level '+(c.level||1)));
  const status=node('span','tv255-grant-status'+(isActive?' active':''),
   isActive?'Granted':'Not granted');
  const action=btn(isActive?'Revoke feat':'Grant feat',async()=>{
   const reason=isActive?'Revoked by DM':'Granted by DM';
   await mutate(api().rpc('terravale_dm_assign_custom_feat',{
    target_feat:feat.id,target_character:c.id,grant_feat:!isActive,reason
   }),host,campaign,chars,(isActive?'Revoked ':'Granted ')+feat.name+' '+(isActive?'from':'to')+' '+c.name+'.');
  },isActive?'btn ghost small tv254-danger':'btn primary small');
  if(!isActive&&(feat.state!=='ready'||(Number(c.level)||1)<feat.minimum_level)){
   action.disabled=true;action.title='Publish feat and meet minimum level first';
  }
  row.append(who,status,action);roster.append(row);
 }
 if(!chars.length)roster.append(node('p','tv254-muted','No campaign characters yet.'));
 sec.append(roster);host.append(sec);
}
async function mutate(req,host,campaign,chars,success){
 if(state.busy)return false;
 state.busy=true;message('Saving to your campaign…');
 try{
  const {data,error}=await req;
  if(error)throw error;
  await refreshSilent(campaign);
  message(success);state.busy=false;
  draw(host,campaign,chars);
  return data||true;
 }catch(e){state.busy=false;message('Could not save: '+(e.message||String(e)));return false}
}
async function refreshSilent(campaign){
 const [feats,grants]=await Promise.all([
  api().from('terravale_dm_custom_feats').select('*').eq('campaign_id',campaign.id)
   .order('created_at',{ascending:false}).limit(500),
  api().from('terravale_character_custom_feats').select('*').eq('campaign_id',campaign.id)
   .order('granted_at',{ascending:false}).limit(1500)
 ]);
 if(feats.error||grants.error)throw feats.error||grants.error;
 state.feats=feats.data||[];state.grants=grants.data||[];
 state.loaded=true;
}
function draw(host,campaign,chars){
 if(!host?.isConnected)return;
 host.replaceChildren();
 const messageEl=node('p','tv255-workspace-status',state.message);
 messageEl.id='tv255-feat-status';messageEl.setAttribute('role','status');
 host.append(messageEl);
 if(!state.loaded)host.append(node('p','tv254-muted',
  'Loading your custom feat library…'));
 else if(state.mode==='edit')renderEditor(host,campaign,chars);
 else if(state.mode==='assign')renderAssignment(host,campaign,chars);
 else renderList(host,campaign,chars);
}
function renderForge(host,campaign,chars){
 if(!campaign||!auth()?.state?.ready)return;
 if(state.campaign!==campaign.id){
  state.campaign=campaign.id;state.loaded=false;state.loading=false;
  state.mode='library';state.selected=null;state.feats=[];state.grants=[];
 }
 // Keep the native page's root (host) alive while loading the async library.
 draw(host,campaign,chars);
 if(!state.loaded&&!state.loading)refresh(host,campaign,chars);
}
// V2.57: DM-awarded feats become ordinary entries in the native feat reader.
// No second panel, no second feat list, and no changes to the authoritative rules.
const sheetFeatCache=new Map();
const sheetFeatLoading=new Set();
const selectedSheetFeat=new Map();
const currentSheetCharacter=()=>{
 const m=location.hash.match(/^#\/characters\/([^/?#]+)/);
 if(!m)return null;
 let id=m[1];try{id=decodeURIComponent(id)}catch{}
 return (typeof db!=='undefined'?db.characters:[]).find(c=>c.id===id)||null;
};
async function fetchSheetFeats(c){
 if(!auth()?.state?.ready||sheetFeatLoading.has(c.id))return;
 sheetFeatLoading.add(c.id);
 try{
  const [grants,feats]=await Promise.all([
   api().from('terravale_character_custom_feats').select('feat_id')
    .eq('character_id',c.id).eq('status','active').limit(200),
   api().from('terravale_dm_custom_feats')
    .select('id,name,short_description,prerequisites,rules_text,action_type,uses_per_rest,recovery,rarity')
    .eq('campaign_id',c.campaign).limit(500)
  ]);
  if(grants.error||feats.error)throw grants.error||feats.error;
  const assigned=new Set((grants.data||[]).map(g=>g.feat_id));
  sheetFeatCache.set(c.id,{updated:Date.now(),feats:(feats.data||[]).filter(x=>assigned.has(x.id))});
 }catch(err){
  console.warn('[Terravale feats] Could not load awarded feat records:',err);
  sheetFeatCache.set(c.id,{updated:Date.now(),feats:[]});
 }finally{sheetFeatLoading.delete(c.id);mountCharacterFeats()}
}
function displayCustomInReader(panel,c,feat){
 const target=panel.querySelector('.sheet227-reader-detail');
 if(!target)return;
 const heading=node('div','sheet227-rule-heading');
 heading.append(node('span','v2-overline','DM-GRANTED FEAT · '+(feat.rarity||'Custom')),
  node('h3','',feat.name));
 target.replaceChildren(heading);
 if(feat.short_description)target.append(node('p','tv257-feat-description',feat.short_description));
 if(feat.prerequisites)target.append(node('p','tv254-muted','Prerequisites: '+feat.prerequisites));
 if(feat.rules_text)target.append(node('div','tv257-feat-full-rules',feat.rules_text));
 const details=['Activation: '+(feat.action_type||'passive')];
 if(Number(feat.uses_per_rest)>0){
  details.push('Uses: '+feat.uses_per_rest);
  if(feat.recovery&&feat.recovery!=='manual')details.push('Recovery: '+feat.recovery);
 }
 target.append(node('p','tv257-feat-metadata',details.join(' · ')));
 for(const btn of panel.querySelectorAll('.sheet227-entry')){
  const active=btn.dataset.tv257FeatId===feat.id;
  btn.classList.toggle('is-active',active);
  btn.setAttribute('aria-pressed',String(active));
 }
}
function mountCharacterFeats(){
 const c=currentSheetCharacter();
 const panel=document.querySelector('#pageRoot .sheet227-reader');
 if(!c||!panel||!auth()?.state?.ready)return;
 document.querySelector('#tv255-player-feats')?.remove();
 const tab=panel.querySelector('[data-v227-reader-tab="feats"]');
 if(!tab)return;
 const cache=sheetFeatCache.get(c.id);
 if(!cache||Date.now()-cache.updated>90000){
  if(!sheetFeatLoading.has(c.id))fetchSheetFeats(c);
 }
 const items=cache?.feats||[];
 const tabCount=tab.querySelector('span');
 const nativeCount=Number(tab.dataset.tv257NativeCount||tabCount?.textContent||0);
 tab.dataset.tv257NativeCount=String(nativeCount);
 if(tab.firstChild?.nodeType===3&&tab.firstChild.textContent!=='Feats ')
  tab.firstChild.textContent='Feats ';
 if(tabCount)tabCount.textContent=String(nativeCount+items.length);
 const note=panel.querySelector('.sheet20-note');
 if(note)note.textContent='Class abilities, ancestry feats and DM-granted custom feats appear together in the reader.';
 const featsSelected=tab.getAttribute('aria-selected')==='true';
 if(!featsSelected)return;
 const index=panel.querySelector('.sheet227-reader-entries');
 if(!index)return;
 const search=panel.querySelector('#sheet227-search');
 const q=(search?.value||'').trim().toLowerCase();
 const fingerprint=[c.id,cache?.updated||'loading',q,items.map(f=>f.id).join(',')].join(':');
 if(panel.dataset.tv257FeatFingerprint===fingerprint)return;
 panel.dataset.tv257FeatFingerprint=fingerprint;
 const searchLabel=panel.querySelector('.sheet227-reader-index .v2-overline');
 if(searchLabel)searchLabel.textContent='FIND A FEAT';
 if(search)search.placeholder='Search all your feats…';
 index.querySelectorAll('[data-tv257-feat-id]').forEach(b=>b.remove());
 const matching=items.filter(f=>!q||
  [f.name,f.short_description,f.rules_text,f.prerequisites].some(v=>String(v||'').toLowerCase().includes(q)));
 for(const feat of matching){
  const option=node('button','sheet227-entry tv257-custom-reader-entry');
  option.type='button';option.dataset.tv257FeatId=feat.id;
  option.setAttribute('aria-pressed','false');
  option.append(node('strong','',feat.name),node('small','','DM-granted custom feat'),
   node('span','','›'));
  option.addEventListener('click',event=>{
   event.preventDefault();
   selectedSheetFeat.set(c.id,feat.id);
   displayCustomInReader(panel,c,feat);
  });
  index.append(option);
 }
 if(matching.length){
  const empty=index.querySelector('.v2-dim');
  if(empty?.textContent?.includes('No matches'))empty.remove();
 }
 const count=panel.querySelector('.sheet227-reader-count');
 if(count)count.textContent=(index.querySelectorAll('.sheet227-entry').length)+
  ' of '+(nativeCount+items.length)+' displayed';
 const selected=items.find(x=>x.id===selectedSheetFeat.get(c.id));
 if(selected&&matching.some(x=>x.id===selected.id))displayCustomInReader(panel,c,selected);
}
let queued=false;
const observer=new MutationObserver(()=>{
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;mountCharacterFeats()});
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{sheetFeatCache.clear();setTimeout(mountCharacterFeats,100)});
window.addEventListener('terravale-characters-synced',()=>{
 sheetFeatCache.clear();setTimeout(mountCharacterFeats,100);
});
document.addEventListener('click',event=>{
 if(event.target.closest('[data-v227-reader-tab],[data-v227-entry]')){
  const c=currentSheetCharacter();if(c)selectedSheetFeat.delete(c.id);
 }
},true);
window.TerravaleV255Feats={renderForge};
mountCharacterFeats();
})();