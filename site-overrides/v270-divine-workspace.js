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
  dm.data=null;sheet.cache.delete(dm.character);dm.busy=false;dm.reason='';
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
 const title=node('header','tv272-dm-heading');
 title.append(node('div','tv254-eyebrow','DM CHRONICLE · DIVINE COURT'),
  node('h2','','Divine Favour & Boons'),
  node('p','tv254-muted','Keep divine judgement private, manage blessings, and decide when the gods intervene. No threshold grants a boon automatically.'));
 host.append(title);
 if(!dm.chars.length){
  host.append(node('p','tv254-muted','There are no adventurers in this campaign yet.'));return;
 }
 const shell=node('div','tv272-dm-workspace');
 const rail=node('aside','tv272-dm-rail');
 rail.setAttribute('aria-label','Divine management');
 const roster=node('section','tv272-dm-roster');
 roster.append(node('div','tv272-rail-label','CAMPAIGN ADVENTURERS'));
 const people=node('div','tv272-roster-options');
 for(const c of dm.chars){
  const current=c.id===dm.character;
  const btn=button(c.name,()=>{
   if(c.id===dm.character)return;
   dm.character=c.id;dm.data=null;dm.edit=null;dm.error='';
   drawDM();loadDM();
  },'tv272-roster-person'+(current?' active':''));
  btn.setAttribute('aria-pressed',String(current));people.append(btn);
 }
 roster.append(people);rail.append(roster);
 const nav=node('nav','tv272-dm-nav');
 nav.append(node('div','tv272-rail-label','MANAGEMENT'));
 const entries=[
  ['favour','Divine standing','Judge a patron’s regard'],
  ['boons','Boon library','Prepare and grant gifts'],
  ['patrons','The pantheon','Manage divine patrons']
 ];
 for(const [id,name,desc] of entries){
  const opt=button('',()=>{if(dm.mode===id)return;dm.mode=id;dm.edit=null;drawDM()},
   'tv272-workspace-link'+(dm.mode===id?' current':''));
  opt.replaceChildren();
  const label=node('span','tv272-workspace-text');
  label.append(node('strong','',name),node('small','',desc));
  opt.append(label);
  if(dm.mode===id)opt.setAttribute('aria-current','page');
  nav.append(opt);
 }
 rail.append(nav);
 const stage=node('div','tv272-dm-stage');
 stage.setAttribute('aria-live','off');
 const status=node('p','tv270-status',dm.error||
  (dm.loading?'Reading divine records…':dm.busy?'Saving to the campaign…':''));
 status.setAttribute('role','status');
 stage.append(status);
 if(dm.data){
  if(dm.mode==='favour')drawFavour(stage);
  else if(dm.mode==='boons')drawBoons(stage);
  else drawPatrons(stage);
 }
 shell.append(rail,stage);host.append(shell);
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
  const {data,error}=await api().rpc('terravale_divine_dm_set_favour_v282',{
   target_character:target,target_patron:patron,new_score:next,reason,
   apply_links:window.TerravaleDivineRelationsV282?.applies()??true
  });
  if(error)throw error;
  if(target!==dm.character)return;
  const accepted=Number(data?.score??next);
  score.dataset.value=String(accepted);
  score.textContent=(accepted>0?'+':'')+accepted;
  score.className='tv270-score '+colourFor(accepted);
  const updateScore=(id,value)=>{
   const item=dm.data.favour.find(f=>f.patron_id===id);
   if(item)item.score=value;else dm.data.favour.push({patron_id:id,score:value});
  };
  updateScore(patron,accepted);
  for(const impact of data?.relationships||[]){
   const linked=dm.data.patrons.find(p=>String(p.key_name).toLowerCase()===impact.target);
   if(!linked)continue;updateScore(linked.id,Number(impact.score));
   const tile=[...dm.host.querySelectorAll('.tv270-favour-row')].find(x=>x.dataset.patron===linked.id);
   const value=tile?.querySelector('.tv270-score');
   if(value){
    value.dataset.value=String(impact.score);
    value.textContent=(impact.score>0?'+':'')+impact.score;
    value.className='tv270-score '+colourFor(impact.score);
    const controls=tile.querySelectorAll('button');
    if(controls[0])controls[0].disabled=impact.score<=-10;
    if(controls[1])controls[1].disabled=impact.score>=10;
   }
  }
  window.TerravaleDivineRelationsV282?.impactSummary(data?.relationships||[]);
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
  sheet.cache.delete(target);
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
 const d=dm.data,p=(d.patrons||[]).filter(x=>['major','greater'].includes(x.rank)&&
 String(x.key_name||x.name).toLowerCase()!=='nyrha'),f=d.favour||[];
 const scores=new Map(f.map(x=>[x.patron_id,Number(x.score)]));
 const body=node('section','tv270-panel tv272-standings-panel');
 body.append(node('div','tv254-eyebrow','PRIVATE · DM ONLY'),
  node('h3','',activeCharacter()?.name+' · Divine standing'),
  node('p','tv254-muted','Only conventional major and Greater Gods use −10 to +10 Favour. Minor gods use Notice and Offering; Nyrha uses Entanglement instead. No threshold automatically grants a boon.'));
 const why=input('Reason for the next adjustment (DM-only)',dm.reason,{maxlength:500});
 why.el.addEventListener('input',()=>{dm.reason=why.el.value});body.append(why.wrap);
 const relationships=node('div','tv282-favour-relationship-target');
 body.append(relationships);
 const standings=node('div','tv272-standings-grid');
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
  card.dataset.patron=patron.id;card.append(info,control);standings.append(card);
 }
 body.append(standings);
 if(!p.length)body.append(node('p','tv254-muted','No patrons registered. Add the relevant gods in the Patron register.'));
 host.append(body);
 window.TerravaleDivineRelationsV282?.mount(relationships,dm.campaign);
 const history=node('details','tv272-history');
 history.append(node('summary','','Private activity history'),
  node('p','tv254-muted','Favour changes, blessings granted, and withdrawals are recorded here.'));
 const names=new Map(p.map(x=>[x.id,x.name]));
 const catalog=new Map((d.catalog||[]).map(x=>[x.id,x.name]));
 const events=d.activity||[];
 const activityList=node('div','');activityList.dataset.tv270FavourHistory='1';
 for(const e of events.slice(0,30)){
  const row=node('div','tv270-activity');
  const title=e.action==='favour'?'Favour: '+(names.get(e.patron_id)||'Patron'):
   e.action==='favour_resonance'?'Related Favour: '+(names.get(e.patron_id)||'Patron'):
   (e.action==='grant'?'Boon granted: ':'Boon withdrawn: ')+(catalog.get(e.boon_id)||'Recorded boon');
  row.append(node('strong','',title),node('small','',dateLabel(e.created_at)));
  if(['favour','favour_resonance'].includes(e.action))row.append(node('span','',String(e.old_score??0)+' → '+String(e.new_score)));
  if(e.reason)row.append(node('p','',e.reason));
  activityList.append(row);
 }
 activityList.className='tv272-history-rows';
 history.append(activityList);
 if(!events.length)history.append(node('p','tv254-muted','No divine activity has been recorded for this character.'));
 host.append(history);
}
function drawPatrons(host){
 const d=dm.data;
 const section=node('section','tv270-panel tv272-patrons');
 section.append(node('div','tv254-eyebrow','PUBLIC THEMES / PRIVATE ADMINISTRATION'),node('h3','','The pantheon'),
  node('p','tv254-muted','Major and greater gods have public thematic previews. Minor gods remain private to the DM unless a boon is awarded.'));
 for(const p of d.patrons||[]){
  const card=node('details','tv272-patron-compact');
  card.append(node('summary','',p.name+' · '+p.rank),
   node('p','',p.public_hint||'No player-safe description recorded.'));
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
 const section=node('section','tv270-panel tv272-forge');
 section.append(node('div','tv254-eyebrow','PRIVATE · DM ONLY'),node('h3','','Boon library'),
  node('p','tv254-muted','The original 49 documents are already in the database. Grant their exact source-backed boons directly below; custom designs remain separate. No repeated ZIP imports are needed.'));
 if(dm.edit){drawBoonEditor(section);host.append(section);return}
 section.append(button('+ Prepare a boon',()=>{dm.edit=blankBoon();drawDM()},'btn primary small'));
 const filePick=node('input');filePick.type='file';filePick.accept='.json,application/json';
 filePick.hidden=true;const importStatus=node('small','tv271-import-status');
 filePick.addEventListener('change',()=>{
  if(filePick.files?.[0])importBoonArchive(filePick.files[0],importStatus);
  filePick.value='';
 });
 section.append(button('Import boon list · JSON',()=>filePick.click()),filePick,importStatus);
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
   mutate('terravale_divine_dm_grant_boon',{target_character:dm.character,target_boon:boon.id,give_boon:false,reason:''},'Boon withdrawn.');
  },'btn ghost small tv254-danger'));
  else controls.append(button('Grant boon',()=>{
   mutate('terravale_divine_dm_grant_boon',{target_character:dm.character,target_boon:boon.id,give_boon:true,reason:''},'Boon bestowed.');
  },'btn primary small'));
  controls.lastChild.disabled=dm.busy||dm.loading||(!has&&(boon.state!=='ready'||!can));
  card.append(detail,controls);list.append(card);
 }
 if(!(dm.data.catalog||[]).length)section.append(node('p','tv254-muted','No custom boons prepared yet. The canonical Archive 2 catalogue is available above.'));
 section.append(list);filter();
 window.TerravaleV281Canon?.mountDM(section,{campaign:dm.campaign,character:dm.character,
  currentCharacter:()=>dm.character});
 host.append(section);
}
async function importBoonArchive(file,status){
 if(!isDM()||!dm.campaign||!file)return;
 if(file.size>3000000){status.textContent='Import file is too large.';return}
 let rows;
 try{
  const parsed=JSON.parse(await file.text());
  rows=Array.isArray(parsed)?parsed:parsed?.boons;
  if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('Use a JSON array of 1–500 boons (or an object containing a boons array).');
 }catch(e){status.textContent='Could not read boon JSON: '+(e.message||String(e));return}
 const patronByName=new Map();
 for(const p of dm.data?.patrons||[]){
  patronByName.set(p.key_name.toLowerCase(),p);
  patronByName.set(p.name.toLowerCase(),p);
 }
 const current=new Set((dm.data?.catalog||[]).map(b=>[b.kind,b.name.toLowerCase(),b.patron_id].join('|')));
 const specs=[];
 try{
  for(const [i,raw] of rows.entries()){
   if(!raw||typeof raw!=='object')throw Error('Entry '+(i+1)+' is not an object');
   const kind=String(raw.kind||'').toLowerCase().trim();
   const name=String(raw.name||'').trim();
   const primary=patronByName.get(String(raw.patron||raw.patron_key||'').toLowerCase().trim());
   const other=patronByName.get(String(raw.second_patron||raw.second_patron_key||'').toLowerCase().trim());
   const required_favour=Number(raw.required_favour);
   const max_charges=Number(raw.max_charges||0);
   const recovery=String(raw.recovery||'long').toLowerCase();
   if(!Object.hasOwn(families,kind)||name.length<2||name.length>130||
      !primary||!Number.isInteger(required_favour)||required_favour<1||required_favour>10||
      !Number.isInteger(max_charges)||max_charges<0||max_charges>99||
      !['short','long','dawn','manual','none'].includes(recovery)||
      (kind==='concordant'&&(!other||other.id===primary.id))||
      (kind==='minor'&&primary.rank!=='minor')||
      (kind==='divine'&&primary.rank==='minor'))throw Error('Entry '+(i+1)+' ('+name+') has an invalid family, patron, threshold or resource configuration.');
   const summary=String(raw.summary||''),mechanics=String(raw.mechanics||'');
   if(summary.length>1200||mechanics.length>10000)throw Error('Entry '+(i+1)+' exceeds text limits.');
   const key=[kind,name.toLowerCase(),primary.id].join('|');
   if(current.has(key))continue;
   current.add(key);
   specs.push({kind,name,summary,mechanics,required_favour,
    patron_id:primary.id,second_patron_id:kind==='concordant'?other.id:null,
    state:raw.state==='ready'?'ready':'draft',max_charges,recovery});
  }
 }catch(e){status.textContent='Import checked; nothing changed. '+(e.message||String(e));return}
 if(!specs.length){status.textContent='All imported boon names already exist in this campaign.';return}
 if(!window.confirm('Import '+specs.length+' new private boons? Originals are not overwritten. Drafts stay hidden from players.'))return;
 status.textContent='Importing 0 / '+specs.length+' private boons…';
 let done=0;
 for(const spec of specs){
  const {error}=await api().rpc('terravale_divine_dm_save_boon',{
   target_campaign:dm.campaign,boon_spec:spec,existing_boon:null,archive_boon:false
  });
  if(error){status.textContent=done+' imported, then stopped: '+(error.message||String(error));await loadDM();return}
  done++;
  status.textContent='Importing '+done+' / '+specs.length+' private boons…';
 }
 notice(done+' boons added to the private catalogue.');
 await loadDM();
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
  const gathered={...data};
  const canonical=await api().rpc('terravale_divine_canon_player_state',{target_character:id});
  if(canonical.error){
   gathered.canon_warning='Canonical boons unavailable: '+canonical.error.message;
  }else{
   const extra=canonical.data||{};
   const gifts=(extra.granted||[]).map(g=>g.kind==='minor_intercession'?
    {...g,max_charges:1,charges_remaining:extra.divine_state?.minor_intercession_remaining??1}:g);
   gathered.granted=[...(data?.granted||[]),...gifts];
   gathered.divine_state=extra.divine_state||{};
   gathered.burdens=extra.burdens||[];
   gathered.statuses=extra.statuses||[];
   gathered.fractures=extra.fractures||[];
  }
  const offers=await api().rpc('terravale_divine_canon_offers_player_state',
    {target_character:id});
  if(!offers.error)gathered.offers=offers.data?.offers||[];
  sheet.cache.set(id,{at:Date.now(),data:gathered});
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
 const granted=(data?.granted||[]).filter(g=>Number(g.max_charges)>0&&g.kind!=='nyrha_revision');
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
    const {error}=await api().rpc(b.source_kind==='canonical'?
     'terravale_divine_canon_use':'terravale_divine_use_boon',
     b.source_kind==='canonical'?
      {target_award:b.id,material_invocation:true}:{target_grant:b.id});
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
   if(b.source_kind!=='canonical')actions.append(refill);
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
  node('p','tv254-muted','Divine attention is never exact. Only bestowed gifts are revealed here.'));
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
 const bestowed=Array.isArray(data.granted)?data.granted:[];

 const observations=new Map((data.dispositions||[]).map(x=>[x.key,x.disposition]));
 const layout=node('div','tv280-sheet-layout');
 const left=node('section','tv280-gifts');
 left.setAttribute('aria-label','Divine boon and blessing slots');
 left.append(node('div','tv254-eyebrow','BESTOWED · CHARACTER RECORD'),
  node('h3','','Boon slots'),
  node('p','tv254-muted','Only blessings actually granted to this character appear here. Empty spaces are kept visible, as in your inventory.'));
 const slots=node('div','tv280-boon-slots');
 const assigned=new Set();
 const familiesForSlots=[
  {family:'divine',label:'Divine boon',count:3,filter:g=>g.kind==='divine'},
  {family:'concordant',label:'Concordant',count:1,filter:g=>g.kind==='concordant'},
  {family:'grace',label:'Minor Grace',count:1,filter:g=>g.kind==='minor_grace'},
  {family:'intercession',label:'Minor Intercession',count:1,filter:g=>g.kind==='minor_intercession'}
 ];
 const renderGranted=(target,g)=>{
  target.classList.add('tv280-slot-filled');
  target.append(node('div','tv280-slot-icon','✦'),node('strong','',g.name));
  target.append(node('small','tv280-slot-patron',g.patron+(g.other_patron?' & '+g.other_patron:'')));
  const detail=node('details','tv280-granted-detail');
  detail.append(node('summary','','Read bestowed gift'));
  const content=node('div','tv280-granted-body');
  if(g.summary)content.append(node('p','',g.summary));
  if(Number(g.max_charges)>0){
   const remaining=Number(g.charges_remaining);
   content.append(node('small','',Math.max(0,remaining)+' / '+g.max_charges+' uses · '+(g.recovery||'DM review')+' recovery'));
  }
  if(g.mechanics){
   const renderer=window.TerravaleDivineReaderV282;
   content.append(renderer?.feature(g.mechanics,g)||
    node('p','tv280-granted-mechanics',g.mechanics));
  }
  if(g.source_kind==='canonical'&&g.slot!=='passive'&&
   g.kind!=='nyrha_revision'&&g.kind!=='minor_grace'){
   const use=button(Number(g.max_charges)>0?'Use recorded charge':'Record invocation',async()=>{
    if(sheet.pending.has(g.id))return;
    sheet.pending.add(g.id);use.disabled=true;
    try{
     const {error}=await api().rpc('terravale_divine_canon_use',{
      target_award:g.id,material_invocation:true});
     if(error)throw error;await fetchSheet(c.id,true);
    }catch(e){notice('Could not invoke boon: '+(e.message||String(e)));}
    finally{sheet.pending.delete(g.id);use.disabled=false}
   },'btn ghost small');
   if(Number(g.max_charges)>0&&Number(g.charges_remaining)<1)use.disabled=true;
   content.append(use);
  }
  if(g.source_kind==='canonical'&&g.kind==='nyrha_revision')
   content.append(node('p','tv281-small',
    'Break the Pattern requires a DM-confirmed Fracture and explicit player consent.'));
  detail.append(content);target.append(detail);
 };
 for(const group of familiesForSlots){
  for(let i=0;i<group.count;i++){
   const slot=node('div','tv280-boon-slot');
   slot.dataset.kind=group.family;
   const available=bestowed.find(g=>!assigned.has(g.id)&&group.filter(g));
   slot.append(node('span','tv280-slot-label',group.label+(group.count>1?' · '+(i+1):'')));
   if(available){assigned.add(available.id);renderGranted(slot,available)}
   else{
    slot.classList.add('tv280-slot-empty');
    slot.append(node('div','tv280-slot-mark','✧'),node('strong','','Empty slot'),
     node('small','','Awaiting a divine gift'));
   }
   slots.append(slot);
  }
 }
 left.append(slots);
 const extras=bestowed.filter(g=>!assigned.has(g.id));
 if(extras.length){
  const overflow=node('section','tv280-extra-awards');
  overflow.append(node('h4','','Other bestowed gifts'));
  for(const g of extras){
   const slot=node('article','tv280-boon-slot tv280-other-award');
   slot.append(node('span','tv280-slot-label',families[g.kind]||'Other divine gift'));
   renderGranted(slot,g);overflow.append(slot);
  }
  left.append(overflow);
 }
 left.append(node('p','tv280-slot-note',
  'Original rules are preserved. Explicit resource use, patron burdens, and recorded Fractures are tracked; story judgement and unlisted dice effects remain with the DM.'));
 window.TerravaleV281Canon?.renderPlayerStatuses(left,data,c);
 window.TerravaleV281Canon?.renderPlayerOffers(left,data,c,()=>fetchSheet(c.id,true));
 if(data.canon_warning)left.append(node('p','tv270-status',data.canon_warning));
 const aside=node('aside','tv280-gods-rail');
 aside.setAttribute('aria-label','Known gods and approximate divine disposition');
 aside.append(node('div','tv254-eyebrow','THE DIVINE COURT'),
  node('h3','','The gods'),
  node('p','tv254-muted','Impressions only. Favour scores, unearned blessings and divine requirements stay hidden.'));
 const groups=[
  {title:'The Twelve',keys:new Set(['pae','amora','vaelniv','torridae','coeus','errigan','rao','kalma','tyrius','eshael','fjoras','kwaeth'])},
  {title:'Beyond the Twelve',keys:null}
 ];
 for(const group of groups){
  const gods=previews.filter(g=>group.keys?group.keys.has(g.key):
   !groups[0].keys.has(g.key));
  if(!gods.length)continue;
  const groupEl=node('section','tv280-god-family');
  groupEl.append(node('h4','',group.title));
  const list=node('div','tv280-gods');
  for(const god of gods){
   const disposition=observations.get(god.key);
   const mood=window.TerravaleDivineVoicesV281?.status(god.key,disposition,{
     entanglement:data.divine_state?.entanglement})||{
     label:'A judgement unspoken',description:god.hint||'No public omen.',tone:'unknown'};
   const entry=node('details','tv280-god');
   const summary=node('summary','');
   const title=node('strong','',god.name);
   const tag=node('small','tv280-god-signal mood-'+mood.tone,mood.label);
   summary.append(title,tag);entry.append(summary);
   const text=node('p','',mood.description);
   entry.append(text);list.append(entry);
  }
  groupEl.append(list);aside.append(groupEl);
 }
 layout.append(left,aside);pane.append(layout);
}
let queued=false;
const observer=new MutationObserver(()=>{
 // V2.76: a chat message or dice roll must not trigger character-sheet work.
 if(!routeCharacter()||queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;renderSheet()});
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(renderSheet,65));
window.addEventListener('terravale-auth-ready',()=>setTimeout(renderSheet,120));
window.addEventListener('terravale-characters-synced',()=>{
 sheet.cache.clear();if(sheet.open&&sheet.character)fetchSheet(sheet.character,true);
 setTimeout(renderSheet,80);
});
window.TerravaleV270Divine={renderDM,refresh:()=>{dm.data=null;loadDM()},
 refreshSheet:(id)=>fetchSheet(id,true),
 importPreparedBoons:(rows,status)=>importBoonArchive(
  new File([JSON.stringify({boons:rows})],'reviewed-boons.json',{type:'application/json'}),status)
};
renderSheet();
})();