/* Terravale V2.70 — Divine Chronicle and character-sheet Divine tab.
   The only source of private boons is the verified DM RPC. The player tab calls
   only the deliberately redacted player RPC; no secrets are embedded in HTML. */
(function(){
'use strict';
const account=()=>window.TerravaleVerifiedAccount;
const api=()=>account()?.supabase;
const ready=()=>!!account()?.state?.ready;
const isDM=()=>ready()&&!!account().state.profile?.is_dm&&typeof db!=='undefined'&&db.role==='dm';
const node=(tag,cls,label)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(label!==undefined)x.textContent=String(label);return x};
const button=(label,fn,cls='btn ghost small')=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b};
const notice=(label)=>typeof toast==='function'?toast(label):console.info('[Divine]',label);
const families={divine:'Divine',minor:'Minor God',concordant:'Concordant'};
const colourFor=score=>score>=7?'high':score>=1?'positive':score<0?'strained':'neutral';
const clamp=n=>Math.max(-10,Math.min(10,Number(n)||0));
function input(label,value,options={}){
 const wrap=node('label','tv270-field'),head=node('span','',label);
 const el=node(options.long?'textarea':'input','tv270-input');
 if(options.long)el.rows=options.rows||3;
 else el.type=options.type||'text';
 el.value=value??'';if(options.min!==undefined)el.min=options.min;
 if(options.max!==undefined)el.max=options.max;
 if(options.maxlength)el.maxLength=options.maxlength;
 wrap.append(head,el);return {wrap,el};
}
function chips(host,values,selected,onPick){
 const group=node('div','tv270-chips');
 for(const [id,label] of values){
  const b=button(label,()=>onPick(id),'tv270-chip'+(String(id)===String(selected)?' active':''));
  b.setAttribute('aria-pressed',String(String(id)===String(selected)));
  group.append(b);
 }
 host.append(group);
}
const dm={campaign:null,character:null,host:null,chars:[],data:null,mode:'favour',edit:null,
 reason:'',busy:false,loading:false,error:'',boonQuery:'',boonFamily:'all',boonStatus:'all',favPending:new Set()};
function activeCharacter(){return dm.chars.find(c=>c.id===dm.character)||null}
async function loadDM(){
 if(!isDM()||!dm.character||dm.loading)return;
 const target=dm.character,campaign=dm.campaign;
 dm.loading=true;dm.error='';drawDM();
 try{
  const {data,error}=await api().rpc('terravale_divine_dm_state',{target_character:target});
  if(error)throw error;
  if(dm.campaign===campaign&&dm.character===target)dm.data=data;
 }catch(e){if(dm.character===target)dm.error=e.message||String(e)}
 finally{dm.loading=false;drawDM()}
}
async function mutate(rpc,args,success){
 if(dm.busy||!isDM()||!dm.character)return;
 dm.busy=true;dm.error='';drawDM();
 try{
  const {error}=await api().rpc(rpc,args);
  if(error)throw error;
  dm.data=null;dm.busy=false;dm.reason='';
  if(success)notice(success);
  await loadDM();
 }catch(e){dm.error=e.message||String(e);dm.busy=false;drawDM()}
}
function dateLabel(value){
 try{return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}
 catch{return String(value||'')}
}
function drawDM(){
 const host=dm.host;
 if(!host?.isConnected||!isDM()||!dm.campaign)return;
 host.replaceChildren();
 const intro=node('div','tv270-header');
 intro.append(node('div','tv254-eyebrow','DM CHRONICLE · DIVINE RELATIONSHIPS'),
  node('h2','','Divine Favour & Boons'),
  node('p','tv254-muted','Record divine attention, prepare private boons, and grant them only when the story calls for it. Reaching a threshold never grants anything automatically.'));
 host.append(intro);
 if(!dm.chars.length){host.append(node('p','tv254-muted','There are no characters in this campaign yet.'));return}
 const roster=node('section','tv270-panel');
 roster.append(node('h3','','Choose an adventurer'));
 chips(roster,dm.chars.map(c=>[c.id,c.name]),dm.character,id=>{
  dm.character=id;dm.data=null;dm.edit=null;dm.error='';drawDM();loadDM();
 });
 host.append(roster);
 const switcher=node('section','tv270-panel');
 chips(switcher,[['favour','Favour ledger'],['boons','Private boon forge'],['patrons','Patron register']],dm.mode,id=>{
  dm.mode=id;dm.edit=null;drawDM();
 });
 host.append(switcher);
 const status=node('p','tv270-status',dm.error||(dm.loading?'Reading the private divine ledger…':dm.busy?'Saving in the campaign…':''));
 status.setAttribute('role','status');host.append(status);
 if(!dm.data){if(!dm.loading&&!dm.busy&&!dm.error)loadDM();return}
 if(dm.mode==='favour')drawFavour(host);
 else if(dm.mode==='boons')drawBoons(host);
 else drawPatrons(host);
}
async function adjustFavour(patron,delta,card){
 if(!isDM()||!dm.character||dm.busy||dm.favPending.has(patron))return;
 const score=card.querySelector('.tv270-score');
 const prior=Number(score?.dataset.value??0);
 const next=clamp(prior+delta);
 if(next===prior)return;
 dm.favPending.add(patron);
 const controls=card.querySelectorAll('button');
 controls.forEach(b=>{b.disabled=true});
 const target=dm.character,reason=dm.reason;
 try{
  const {data,error}=await api().rpc('terravale_divine_dm_set_favour',{
   target_character:target,target_patron:patron,new_score:next,reason
  });
  if(error)throw error;
  if(target!==dm.character)return;
  const accepted=Number(data?.score??next);
  score.dataset.value=String(accepted);
  score.textContent=(accepted>0?'+':'')+accepted;
  score.className='tv270-score '+colourFor(accepted);
  const old=dm.data.favour.find(f=>f.patron_id===patron);
  if(old)old.score=accepted;else dm.data.favour.push({patron_id:patron,score:accepted});
  const list=dm.host?.querySelector('[data-tv270-favour-history]');
  if(list){
   const record=node('div','tv270-activity');
   const name=dm.data.patrons.find(p=>p.id===patron)?.name||'Patron';
   record.append(node('strong','','Favour: '+name),
    node('small','',dateLabel(new Date().toISOString())),
    node('span','',prior+' → '+accepted));
   if(reason)record.append(node('p','',reason));
   list.prepend(record);
  }
  notice('Favour adjusted.');
 }catch(e){notice('Favour update failed: '+(e.message||String(e)));}
 finally{
  dm.favPending.delete(patron);
  const now=Number(score?.dataset.value??prior);
  if(card.isConnected&&target===dm.character){
   controls[0].disabled=now<=-10;
   controls[1].disabled=now>=10;
  }
 }
}
function drawFavour(host){
 const d=dm.data,p=d.patrons||[],f=d.favour||[];
 const scores=new Map(f.map(x=>[x.patron_id,Number(x.score)]));
 const body=node('section','tv270-panel');
 body.append(node('h3','',activeCharacter()?.name+' · Divine Favour'),
  node('p','tv254-muted','DM-owned counters range from −10 to +10. Each change is recorded; changes never issue or revoke boons automatically.'));
 const why=input('Reason for the next adjustment (DM-only)',dm.reason,{maxlength:500});
 why.el.addEventListener('input',()=>{dm.reason=why.el.value});body.append(why.wrap);
 for(const patron of p){
  const value=scores.get(patron.id)??0;
  const card=node('div','tv270-favour-row');
  const info=node('div','tv270-favour-label');
  info.append(node('strong','',patron.name),
   node('small','',patron.rank==='minor'?'Minor god':'Major / greater god'));
  const control=node('div','tv270-favour-controls');
  control.append(button('−',()=>adjustFavour(patron.id,-1,card),'tv270-counter-button'));
  const score=node('strong','tv270-score '+colourFor(value),(value>0?'+':'')+value);
  score.dataset.value=String(value);
  control.append(score);
  control.append(button('+',()=>adjustFavour(patron.id,1,card),'tv270-counter-button'));
  control.querySelectorAll('button').forEach(b=>{b.disabled=dm.busy||dm.loading||(b.textContent==='−'&&value<=-10)||(b.textContent==='+'&&value>=10)});
  card.append(info,control);body.append(card);
 }
 if(!p.length)body.append(node('p','tv254-muted','No patrons registered. Add the relevant gods in the Patron register.'));
 host.append(body);
 const history=node('section','tv270-panel');
 history.append(node('h3','','Divine activity'),node('p','tv254-muted','Private campaign history of adjustments, grants and withdrawals.'));
 const names=new Map(p.map(x=>[x.id,x.name]));
 const catalog=new Map((d.catalog||[]).map(x=>[x.id,x.name]));
 const events=d.activity||[];
 const activityList=node('div','');activityList.dataset.tv270FavourHistory='1';
 for(const e of events.slice(0,30)){
  const row=node('div','tv270-activity');
  const title=e.action==='favour'?'Favour: '+(names.get(e.patron_id)||'Patron'):
   (e.action==='grant'?'Boon granted: ':'Boon withdrawn: ')+(catalog.get(e.boon_id)||'Recorded boon');
  row.append(node('strong','',title),node('small','',dateLabel(e.created_at)));
  if(e.action==='favour')row.append(node('span','',String(e.old_score??0)+' → '+String(e.new_score)));
  if(e.reason)row.append(node('p','',e.reason));
  activityList.append(row);
 }
 history.append(activityList);
 if(!events.length)history.append(node('p','tv254-muted','No divine activity has been recorded for this character.'));
 host.append(history);
}
function drawPatrons(host){
 const d=dm.data;
 const section=node('section','tv270-panel');
 section.append(node('h3','','Patron register'),
  node('p','tv254-muted','Major and greater gods have public thematic previews. Minor gods remain private to the DM unless a boon is awarded.'));
 for(const p of d.patrons||[]){
  const card=node('div','tv270-patron-row');
  card.append(node('strong','',p.name),node('small','',p.rank),
   node('p','',p.public_hint||'No player-safe hint recorded.'));
  section.append(card);
 }
 host.append(section);
 const f=node('form','tv270-panel tv270-form');
 f.append(node('h3','','Register a patron'));
 const name=input('Patron name','',{maxlength:100});
 const key=input('Stable key (lowercase, letters, numbers, hyphens)','',{maxlength:60});
 const hint=input('Public thematic description (no secret boon details)','',{long:true,rows:2,maxlength:500});
 let rank='major';
 f.append(name.wrap,key.wrap);
 const rankSection=node('div','tv270-field');rankSection.append(node('span','','Divine rank'));
 const rankArea=node('div');rankSection.append(rankArea);
 const showRank=()=>{rankArea.replaceChildren();chips(rankArea,[['major','Major'],['greater','Greater'],['minor','Minor']],rank,x=>{rank=x;showRank()})};
 showRank();f.append(rankSection,hint.wrap);
 f.append(button('Save patron',async()=>{
  if(dm.busy)return;
  const spec={name:name.el.value.trim(),key:key.el.value.trim().toLowerCase(),rank,public_hint:hint.el.value.trim()};
  await mutate('terravale_divine_dm_save_patron',{target_campaign:dm.campaign,patron_spec:spec,existing_patron:null},'Patron registered.');
 },'btn primary small'));
 host.append(f);
}
function blankBoon(){
 return {id:null,kind:'divine',name:'',summary:'',mechanics:'',required_favour:1,
 patron_id:'',second_patron_id:'',state:'draft',max_charges:0,recovery:'long'};
}
function namesFor(b){
 const patrons=dm.data.patrons||[];
 const names=new Map(patrons.map(x=>[x.id,x.name]));
 return (names.get(b.patron_id)||'Unknown patron')+(b.second_patron_id?' + '+(names.get(b.second_patron_id)||'Unknown patron'):'');
}
function eligible(b){
 const scores=new Map((dm.data.favour||[]).map(f=>[f.patron_id,Number(f.score)]));
 return (scores.get(b.patron_id)||0)>=b.required_favour&&
  (b.kind!=='concordant'||(scores.get(b.second_patron_id)||0)>=b.required_favour);
}
function drawBoons(host){
 const section=node('section','tv270-panel');
 section.append(node('h3','','Private boon forge'),
  node('p','tv254-muted','Divine / Minor God / Concordant are separate families. A character may hold three conventional boons and one Concordant boon. Drafts and unearned boons never appear on player sheets.'));
 if(dm.edit){drawBoonEditor(section);host.append(section);return}
 section.append(button('+ Prepare a boon',()=>{dm.edit=blankBoon();drawDM()},'btn primary small'));
 const controlsBar=node('div','tv271-boon-filters');
 const search=input('Find prepared boons',dm.boonQuery,{maxlength:120});
 search.el.placeholder='Search titles, patrons or effects';
 controlsBar.append(search.wrap);
 const family=node('div','tv271-filter-chips');
 const list=node('div','tv271-boon-list');
 const filter=()=>{
  let count=0;
  for(const el of list.children){
   const familyOk=dm.boonFamily==='all'||el.dataset.kind===dm.boonFamily;
   const match=!dm.boonQuery||el.dataset.search.includes(dm.boonQuery.toLocaleLowerCase());
   const statusOk=dm.boonStatus==='all'||el.dataset.status===dm.boonStatus;
   el.hidden=!(familyOk&&match&&statusOk);if(!el.hidden)count++;
  }
  result.textContent=count+' of '+list.children.length+' prepared boons';
 };
 const result=node('small','tv271-filter-count');
 const pickFamily=(value)=>{
  dm.boonFamily=value;
  family.querySelectorAll('button').forEach(b=>{
   b.classList.toggle('active',b.dataset.kind===value);
   b.setAttribute('aria-pressed',String(b.dataset.kind===value));
  });
  filter();
 };
 for(const [key,label] of [['all','All families'],...Object.entries(families)]){
  const b=button(label,()=>pickFamily(key),'tv270-chip'+(dm.boonFamily===key?' active':''));
  b.dataset.kind=key;b.setAttribute('aria-pressed',String(dm.boonFamily===key));family.append(b);
 }
 const stateBar=node('div','tv271-filter-chips');
 for(const [key,label] of [['all','All states'],['ready','Ready'],['draft','Draft']]){
  const b=button(label,()=>{
   dm.boonStatus=key;
   stateBar.querySelectorAll('button').forEach(el=>{
    el.classList.toggle('active',el.dataset.status===key);
    el.setAttribute('aria-pressed',String(el.dataset.status===key));
   });
   filter();
  },'tv270-chip'+(dm.boonStatus===key?' active':''));
  b.dataset.status=key;b.setAttribute('aria-pressed',String(dm.boonStatus===key));stateBar.append(b);
 }
 search.el.addEventListener('input',()=>{dm.boonQuery=search.el.value;filter()});
 controlsBar.append(family,stateBar,result);
 section.append(controlsBar);
 const grants=(dm.data.grants||[]).filter(g=>g.status==='active');
 for(const boon of dm.data.catalog||[]){
  const has=grants.some(g=>g.boon_id===boon.id);
  const can=eligible(boon);
  const card=node('article','tv270-boon-row');
  card.dataset.kind=boon.kind;card.dataset.status=boon.state;
  card.dataset.search=[boon.name,boon.summary,boon.mechanics,namesFor(boon)].join(' ').toLocaleLowerCase();
  const detail=node('div','tv270-boon-detail');
  detail.append(node('div','tv254-eyebrow',families[boon.kind]||boon.kind),
   node('h4','',boon.name),node('small','',namesFor(boon)+' · Required favour: +'+boon.required_favour+(Number(boon.max_charges)>0?' · '+boon.max_charges+' charges':'')));
  if(boon.summary)detail.append(node('p','',boon.summary));
  detail.append(node('small','',has?'Granted to selected character':boon.state!=='ready'?'Private draft':
   can?'Threshold met · DM may grant':'Not yet eligible'));
  const controls=node('div','tv270-actions');
  controls.append(button('Edit',()=>{dm.edit={...boon};drawDM()}));
  if(has)controls.append(button('Revoke',()=>{
   const reason=window.prompt('Why is this boon being withdrawn? (Recorded in private history)','');
   if(reason===null)return;
   mutate('terravale_divine_dm_grant_boon',{target_character:dm.character,target_boon:boon.id,give_boon:false,reason},'Boon withdrawn.');
  },'btn ghost small tv254-danger'));
  else controls.append(button('Grant boon',()=>{
   const reason=window.prompt('Reason for granting '+boon.name+' (recorded privately)','');
   if(reason===null)return;
   mutate('terravale_divine_dm_grant_boon',{target_character:dm.character,target_boon:boon.id,give_boon:true,reason},'Boon bestowed.');
  },'btn primary small'));
  controls.lastChild.disabled=dm.busy||dm.loading||(!has&&(boon.state!=='ready'||!can));
  card.append(detail,controls);list.append(card);
 }
 if(!(dm.data.catalog||[]).length)section.append(node('p','tv254-muted','No boons yet. Prepare their actual effects before granting them.'));
 section.append(list);filter();
 host.append(section);
}
function drawBoonEditor(host){
 const b=dm.edit,editing=Boolean(b.id),patrons=dm.data.patrons||[];
 host.append(button('← Return to boon forge',()=>{dm.edit=null;drawDM()},'tv255-back-link'),
  node('h3','',editing?'Edit prepared boon':'Prepare a new boon'));
 const form=node('form','tv270-form');
 const family=node('div','tv270-field');family.append(node('span','','Boon family'));
 const familyChips=node('div');family.append(familyChips);
 const pickFamily=x=>{b.kind=x;b.patron_id='';b.second_patron_id='';drawDM()};
 chips(familyChips,Object.entries(families),b.kind,pickFamily);
 form.append(family);
 const primary=node('div','tv270-field');primary.append(node('span','','Patron'));
 const pNames=patrons.filter(p=>b.kind==='divine'?p.rank!=='minor':
  b.kind==='minor'?p.rank==='minor':true).map(p=>[p.id,p.name]);
 chips(primary,pNames,b.patron_id,x=>{b.patron_id=x;drawDM()});form.append(primary);
 if(b.kind==='concordant'){
  const second=node('div','tv270-field');second.append(node('span','','Other patron'));
  chips(second,patrons.filter(p=>p.id!==b.patron_id).map(p=>[p.id,p.name]),
   b.second_patron_id,x=>{b.second_patron_id=x;drawDM()});form.append(second);
 }
 const title=input('Boon name',b.name,{maxlength:130});
 const summary=input('Player-visible description after award',b.summary,{long:true,rows:3,maxlength:1200});
 const rules=input('Exact rules and any Divine Burden (revealed only after award)',b.mechanics,{long:true,rows:7,maxlength:10000});
 const threshold=input('Required favour (1–10)',b.required_favour,{type:'number',min:1,max:10});
 const charges=input('Maximum charges (0 = passive/unlimited)',b.max_charges??0,{type:'number',min:0,max:99});
 for(const [field,key] of [[title,'name'],[summary,'summary'],[rules,'mechanics'],[threshold,'required_favour'],[charges,'max_charges']]){
  field.el.addEventListener('input',()=>{b[key]=field.el.value});form.append(field.wrap);
 }
 const recharge=node('div','tv270-field');recharge.append(node('span','','Charge recovery'));
 chips(recharge,[['short','Short rest'],['long','Long rest'],['dawn','Dawn'],['manual','DM only'],['none','Never']],b.recovery||'long',x=>{b.recovery=x;drawDM()});
 form.append(recharge);
 const status=node('div','tv270-field');status.append(node('span','','Release state'));
 chips(status,[['draft','Private draft'],['ready','Ready to grant']],b.state,x=>{b.state=x;drawDM()});form.append(status);
 const actions=node('div','tv270-actions');
 actions.append(button('Save boon',async()=>{
  const spec={kind:b.kind,name:String(b.name).trim(),summary:String(b.summary).trim(),
   mechanics:String(b.mechanics).trim(),required_favour:Number(b.required_favour),
   patron_id:b.patron_id,second_patron_id:b.kind==='concordant'?b.second_patron_id:null,state:b.state,
   max_charges:Number(b.max_charges)||0,recovery:b.recovery||'long'};
  if(!spec.patron_id){dm.error='Choose a patron before saving.';drawDM();return}
  await mutate('terravale_divine_dm_save_boon',{
   target_campaign:dm.campaign,boon_spec:spec,existing_boon:b.id||null,archive_boon:false
  },'Boon saved.');
  if(!dm.error)dm.edit=null;
  drawDM();
 },'btn primary small'));
 if(editing)actions.append(button('Archive',()=>{
  if(!window.confirm('Archive '+b.name+'? Existing awards remain recorded.'))return;
  mutate('terravale_divine_dm_save_boon',{
   target_campaign:dm.campaign,boon_spec:{},existing_boon:b.id,archive_boon:true
  },'Boon archived.').then(()=>{if(!dm.error)dm.edit=null;drawDM()});
 },'btn ghost small tv254-danger'));
 form.append(actions);host.append(form);
}
function renderDM(host,campaign,chars){
 if(!isDM()||!campaign||campaign.role!=='dm')return;
 const campaignChanged=dm.campaign!==campaign.id;
 dm.host=host;dm.chars=chars||[];dm.campaign=campaign.id;
 if(campaignChanged||!dm.chars.some(c=>c.id===dm.character)){
  dm.character=dm.chars[0]?.id||null;dm.data=null;dm.edit=null;dm.error='';
 }
 drawDM();
 if(!dm.data&&!dm.loading&&dm.character)loadDM();
}
const sheet={character:null,open:false,cache:new Map(),loading:new Set(),lastContent:null,pending:new Set()};
const wiredTabs=new WeakSet();
function routeCharacter(){
 const m=location.hash.match(/^#\/characters\/([^/?#]+)/);
 if(!m||typeof db==='undefined')return null;
 let id=m[1];try{id=decodeURIComponent(id)}catch{}
 return (db.characters||[]).find(c=>String(c.id)===id)||null;
}
async function fetchSheet(id,force=false){
 if(!ready()||!id||sheet.loading.has(id))return;
 const prior=sheet.cache.get(id);
 if(!force&&prior&&Date.now()-prior.at<45000)return;
 sheet.loading.add(id);
 try{
  const {data,error}=await api().rpc('terravale_divine_player_state',{target_character:id});
  if(error)throw error;
  sheet.cache.set(id,{at:Date.now(),data});
 }catch(e){sheet.cache.set(id,{at:Date.now(),error:e.message||String(e)})}
 finally{sheet.loading.delete(id);renderSheet()}
}
function restoreSheet(){
 if(sheet.lastContent?.isConnected&&sheet.lastContent.style.display==='none')
  sheet.lastContent.style.display='';
 sheet.lastContent=null;
}
function renderBoonResources(c,data){
 const holder=document.querySelector('#pageRoot .sheet20-resource-panel');
 if(!holder)return;
 const granted=(data?.granted||[]).filter(g=>Number(g.max_charges)>0);
 let panel=holder.querySelector('[data-tv271-boon-resources]');
 if(!granted.length){panel?.remove();return}
 const fingerprint=JSON.stringify([c.id,granted.map(g=>[g.id,g.name,g.max_charges,g.charges_remaining,g.recovery])]);
 if(panel?.dataset.fingerprint===fingerprint)return;
 panel?.remove();panel=node('section','tv271-resource-panel');
 panel.dataset.tv271BoonResources='1';panel.dataset.fingerprint=fingerprint;
 panel.append(node('h3','','Divine boons'));
 for(const b of granted){
  const card=node('div','tv271-resource-row');
  const max=Number(b.max_charges),remaining=Math.max(0,Math.min(max,Number(b.charges_remaining)));
  const info=node('div','');info.append(node('strong','',b.name),
   node('small','',remaining+' / '+max+' charges · '+(b.recovery||'long')+' recovery'));
  const actions=node('div','tv271-resource-actions');
  const use=button('Use · 1',async()=>{
   if(sheet.pending.has(b.id))return;
   sheet.pending.add(b.id);use.disabled=true;
   try{
    const {error}=await api().rpc('terravale_divine_use_boon',{target_grant:b.id});
    if(error)throw error;
    await fetchSheet(c.id,true);
   }catch(e){notice('Could not use boon: '+(e.message||String(e)));}
   finally{sheet.pending.delete(b.id);use.disabled=false}
  },'btn ghost small');
  use.disabled=remaining<1||sheet.pending.has(b.id);
  actions.append(use);
  if(isDM()){
   const refill=button('DM restore',async()=>{
    if(sheet.pending.has(b.id))return;
    sheet.pending.add(b.id);refill.disabled=true;
    try{
     const {error}=await api().rpc('terravale_divine_refill_boon',{target_grant:b.id});
     if(error)throw error;
     await fetchSheet(c.id,true);
    }catch(e){notice('Could not restore boon: '+(e.message||String(e)));}
    finally{sheet.pending.delete(b.id);refill.disabled=false}
   },'btn ghost small');
   actions.append(refill);
  }
  card.append(info,actions);panel.append(card);
 }
 holder.append(panel);
}
function renderSheet(){
 const c=routeCharacter(),root=document.getElementById('pageRoot');
 if(!c||!root){restoreSheet();sheet.character=null;sheet.open=false;return}
 if(sheet.character!==c.id){restoreSheet();sheet.character=c.id;sheet.open=false}
 const tabs=root.querySelector('.sheet20-tabs');
 const content=root.querySelector('.sheet20-content:not(.tv270-divine-sheet)');
 if(!tabs||!content)return;
 sheet.lastContent=content;
 if(ready()&&!sheet.cache.has(c.id)&&!sheet.loading.has(c.id))fetchSheet(c.id);
 renderBoonResources(c,sheet.cache.get(c.id)?.data);
 let tab=tabs.querySelector('[data-tv270-divine-tab]');
 if(!tab){
  const native=tabs.querySelector('[data-value]');
  tab=native?native.cloneNode(false):node('button','sheet20-tab');
  for(const attribute of ['data-value','data-action','id','aria-controls','title','onclick'])tab.removeAttribute(attribute);
  tab.className='sheet20-tab';tab.dataset.tv270DivineTab='1';tab.type='button';tab.textContent='Divine';
  tab.setAttribute('aria-label','Divine');tab.setAttribute('role','tab');
  tab.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();sheet.open=true;renderSheet();fetchSheet(c.id,true)});
  tabs.append(tab);
 }
 if(!wiredTabs.has(tabs)){
  wiredTabs.add(tabs);
  tabs.addEventListener('click',e=>{
   if(e.target.closest('[data-value]')){
    sheet.open=false;restoreSheet();
    const pane=root.querySelector('.tv270-divine-sheet');if(pane)pane.hidden=true;
    const custom=tabs.querySelector('[data-tv270-divine-tab]');
    if(custom){custom.classList.remove('active','selected');custom.setAttribute('aria-selected','false')}
   }
  },true);
 }
 let pane=root.querySelector('.tv270-divine-sheet');
 if(!pane){
  pane=node('section','tv270-divine-sheet sheet20-panel');
  pane.setAttribute('aria-label','Divine relationship');
  content.insertAdjacentElement('afterend',pane);
 }
 if(!sheet.open){
  content.style.display='';pane.hidden=true;
  tab.classList.remove('active','selected');tab.setAttribute('aria-selected','false');return;
 }
 content.style.display='none';pane.hidden=false;tab.classList.add('active');tab.setAttribute('aria-selected','true');
 for(const native of tabs.querySelectorAll('[data-value]')){native.classList.remove('active','selected');native.setAttribute('aria-selected','false')}
 // Native SPA mutation observers must not repaint this pane in a loop.
 const cached=sheet.cache.get(c.id);
 const paintKey=c.id+'|'+(cached?.at||'new')+'|'+(sheet.loading.has(c.id)?'loading':'settled');
 if(pane.dataset.tv270PaintKey===paintKey)return;
 pane.dataset.tv270PaintKey=paintKey;
 pane.replaceChildren();
 pane.append(node('div','tv254-eyebrow','CHARACTER SHEET · DIVINE'),
  node('h2','','Divine relationships'),
  node('p','tv254-muted','The gods notice deeds and promises. Only bestowed gifts are revealed here.'));
 const result=sheet.cache.get(c.id);
 if(!result||sheet.loading.has(c.id)){
  pane.append(node('p','tv254-muted','Reading this character’s divine relationships…'));
  if(!sheet.loading.has(c.id))fetchSheet(c.id);return;
 }
 if(result.error){
  pane.append(node('p','tv270-status','Unable to read divine relationships: '+result.error),
   button('Try again',()=>fetchSheet(c.id,true)));return;
 }
 const data=result.data||{},previews=data.previews||[];
 const hints=node('details','tv271-pantheon');
 hints.append(node('summary','','Explore major gods · '+previews.length+' known'));
 const guide=node('p','tv254-muted','Public themes only. Divine judgement, hidden blessings and requirements remain private.');
 hints.append(guide);
 const grid=node('div','tv271-god-grid');
 for(const god of previews){
  const tile=node('details','tv271-god-tile');
  tile.append(node('summary','',god.name),
   node('p','',god.hint||'The mysteries of this patron remain a matter of faith.'));
  grid.append(tile);
 }
 if(!previews.length)grid.append(node('p','tv254-muted','No major gods have been registered yet.'));
 hints.append(grid);pane.append(hints);
 const section=node('section','tv270-panel tv271-revealed');
 section.append(node('h3','','Revealed boons'));
 const granted=data.granted||[];
 if(!granted.length)section.append(node('p','tv254-muted','No divine boon has been bestowed on this character.'));
 for(const g of granted){
  const article=node('article','tv270-awarded-boon');
  article.append(node('div','tv254-eyebrow',families[g.kind]||'Divine boon'),
   node('h4','',g.name),node('small','',g.patron+(g.other_patron?' & '+g.other_patron:'')+' · Granted '+dateLabel(g.granted_at)));
  if(g.summary)article.append(node('p','',g.summary));
  if(Number(g.max_charges)>0)article.append(node('small','',Number(g.charges_remaining)+' / '+g.max_charges+' charges · '+g.recovery+' recovery'));
  if(g.mechanics){
   article.append(node('h5','','Granted effects and burdens'));
   const rules=node('p','tv270-rules',g.mechanics);article.append(rules);
  }
  section.append(article);
 }
 pane.append(section);
}
let queued=false;
const observer=new MutationObserver(()=>{
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;renderSheet()});
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(renderSheet,65));
window.addEventListener('terravale-auth-ready',()=>setTimeout(renderSheet,120));
window.addEventListener('terravale-characters-synced',()=>{
 sheet.cache.clear();if(sheet.open&&sheet.character)fetchSheet(sheet.character,true);
 setTimeout(renderSheet,80);
});
window.TerravaleV270Divine={renderDM,refresh:()=>{dm.data=null;loadDM()},refreshSheet:(id)=>fetchSheet(id,true)};
renderSheet();
})();