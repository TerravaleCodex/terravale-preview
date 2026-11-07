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
  const card=node('article','tv255-feat-card');
  const meta=node('div','tv254-eyebrow',
   f.state==='draft'?'PRIVATE DRAFT':'PUBLISHED CUSTOM FEAT');
  card.append(meta,node('h3','',f.name),
   node('p','',f.short_description||'No summary provided.'),
   node('div','tv255-feat-meta','Level '+f.minimum_level+'+ · '+
    f.action_type+' · '+f.uses_per_rest+' use(s) · '+count+' active grants'));
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
 form.append(name.wrap,summary.wrap,req.wrap,rules.wrap);
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
 form.append(type,row,recovery,status);
 const buttons=node('div','tv254-actions');
 const save=node('button','btn primary small','Save custom feat');save.type='submit';
 buttons.append(save,btn('Cancel',()=>{state.mode='library';draw(host,campaign,chars)}));
 form.append(buttons);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const data={
   name:name.input.value.trim(),
   short_description:summary.input.value.trim(),
   prerequisites:req.input.value.trim(),
   rules_text:rules.input.value.trim(),
   action_type:values.action_type,
   uses_per_rest:Number(uses.input.value),minimum_level:Number(level.input.value),
   rarity:rarity.input.value.trim()||'Custom',
   recovery:values.recovery,state:values.state
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
async function mountCharacterFeats(){
 const m=location.hash.match(/^#\/characters\/([^/?#]+)/);
 const root=document.querySelector('#pageRoot .sheet20-content');
 const selected=document.querySelector('.sheet20-tabs [data-value="features"][aria-selected="true"]');
 if(!m||!root||!selected||root.querySelector('#tv255-player-feats'))return;
 const c=(typeof db!=='undefined'?db.characters:[]).find(c=>c.id===m[1]);
 if(!c||!auth()?.state?.ready)return;
 const sec=node('section','tv254-proficiency-card tv255-player-feats');
 sec.id='tv255-player-feats';
 sec.append(node('div','tv254-eyebrow','DM-AWARDED POWERS'),
  node('h3','','Custom Feats'),
  node('p','tv254-muted','Custom feats approved and granted by your campaign DM. Written mechanics are shown here, not secretly added to your numerical sheet statistics.'));
 root.append(sec);
 const [grants,feats]=await Promise.all([
  api().from('terravale_character_custom_feats').select('feat_id,grant_note')
   .eq('character_id',c.id).eq('status','active').limit(200),
  api().from('terravale_dm_custom_feats').select('id,name,short_description,prerequisites,rules_text,action_type,uses_per_rest,recovery,rarity')
   .eq('campaign_id',c.campaign).limit(500)
 ]);
 if(!sec.isConnected)return;
 if(grants.error||feats.error){
  sec.append(node('p','tv254-muted','Custom feats unavailable: '+(grants.error||feats.error).message));return}
 const assigned=new Set((grants.data||[]).map(x=>x.feat_id));
 const held=(feats.data||[]).filter(f=>assigned.has(f.id));
 if(!held.length){sec.append(node('p','tv254-muted','No custom feats have been granted to this character.'));return}
 for(const feat of held){
  const card=node('details','tv255-player-feat');
  card.append(node('summary','',feat.name));
  const body=node('div','tv255-player-feat-body');
  body.append(node('p','',feat.short_description||''),
   node('p','tv254-muted','Activation: '+feat.action_type+
    ' · Uses: '+feat.uses_per_rest+' · Recovery: '+feat.recovery));
  if(feat.prerequisites)body.append(node('p','tv254-muted','Prerequisites: '+feat.prerequisites));
  if(feat.rules_text)body.append(node('p','tv255-preserve',feat.rules_text));
  card.append(body);sec.append(card);
 }
}
let queued=false;
const observer=new MutationObserver(()=>{
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;mountCharacterFeats()});
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mountCharacterFeats,100));
window.addEventListener('terravale-characters-synced',()=>setTimeout(mountCharacterFeats,100));
window.TerravaleV255Feats={renderForge};
mountCharacterFeats();
})();