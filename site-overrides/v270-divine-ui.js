/* Terravale V2.70 — Divine Favour / three canonical boon families.
   DM catalog and unpublished rules NEVER enter player RPC or client state.
   All mutations are server-checked against Discord identity + authz.is_dm.
*/
(function(){
'use strict';
if(window.TerravaleDivineV270)return;
const AUTH=()=>window.TerravaleVerifiedAccount;
const API=()=>AUTH()?.supabase;
const READY=()=>!!AUTH()?.state?.ready;
const el=(tag,cls='',value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
const say=s=>typeof toast==='function'?toast(s):console.info('[Divine]',s);
const action=(label,handler,cls='btn ghost small')=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',handler);return b};
const field=(label,value='',multiline=false)=>{
 const wrap=el('label','tv270-field');
 const caption=el('span','',label);
 const input=el(multiline?'textarea':'input','tv254-input');
 input.value=value??'';if(multiline)input.rows=4;
 wrap.append(caption,input);return{wrap,input};
};
const group=(options,selected,onChange)=>{
 const host=el('div','tv270-options');
 for(const [id,label] of options){
  const b=action(label,()=>onChange(id),'tv270-pill'+(String(id)===String(selected)?' is-selected':''));
  b.setAttribute('aria-pressed',String(String(id)===String(selected)));
  host.append(b);
 }
 return host;
};
const kinds={divine:'Divine Boon',minor:'Minor God Boon',concordant:'Concordant Boon'};
const cache=new Map();let sheetOpen=false,sheetId='',sheetBusy=false,dmBusy=false;
const dm={character:null,campaign:null,loading:false,data:null,editing:null,patronEditor:false,patronRank:'major',kind:'divine',patron:null,other:null,threshold:3,state:'draft'};
const sameCharacter=()=>{const id=location.hash.match(/^#\/characters\/([^/?#]+)/)?.[1];try{return decodeURIComponent(id||'')}catch{return id||''}};
function character(){
 const id=sameCharacter();return (typeof db==='undefined'?[]:db.characters||[]).find(c=>String(c.id)===String(id));
}
const canDM=()=>READY()&&AUTH()?.state?.profile?.is_dm&&typeof db!=='undefined'&&db.role==='dm';
async function rpc(name,args){
 if(!READY())throw Error('Connect Discord before using divine records.');
 const {data,error}=await API().rpc(name,args);
 if(error)throw Error(error.message||'Request failed');return data;
}
function heading(label,title,desc){
 const div=el('header','tv270-head');
 div.append(el('div','tv254-eyebrow',label),el('h2','',title),el('p','tv270-muted',desc));return div;
}
function empty(text){return el('p','tv270-muted',text)}
function boonCard(boon){
 const div=el('article','tv270-boon-card');
 const head=el('div','tv270-boon-title');
 head.append(el('strong','',boon.name),el('small','',kinds[boon.kind]||'Divine Boon'));
 div.append(head,el('p','tv270-muted',(boon.patron||'')+(boon.other_patron?' + '+boon.other_patron:'')));
 if(boon.summary)div.append(el('p','',boon.summary));
 if(boon.mechanics){const rule=el('div','tv270-mechanics');rule.textContent=boon.mechanics;div.append(rule)}
 return div;
}
async function loadSheet(id,force=false){
 if(sheetBusy||(!force&&cache.has(id)&&Date.now()-cache.get(id).at<50000))return;
 sheetBusy=true;const target=id;
 try{
  const data=await rpc('terravale_divine_player_state',{target_character:id});
  cache.set(id,{data,at:Date.now()});
 }catch(err){cache.set(id,{error:err.message,at:Date.now()})}
 finally{sheetBusy=false;if(sheetOpen&&sameCharacter()===target)renderSheet();}
}
function renderSheet(){
 const id=sameCharacter(),host=document.getElementById('tv270-sheet-panel');
 if(!host||!host.isConnected||id!==sheetId)return;
 host.replaceChildren();
 host.append(heading('DIVINE FAVOUR · AWARDED POWERS','Your Divine Boons',
  'The gods may notice your deeds. Boons appear here only after your DM has awarded them.'));
 if(!READY()){host.append(empty('Connect your Discord account to view your divine record.'));return}
 const record=cache.get(id);
 if(!record){host.append(empty('Consulting the divine ledger…'));loadSheet(id);return}
 if(record.error){host.append(empty('Divine records unavailable: '+record.error));host.append(action('Retry',()=>{cache.delete(id);loadSheet(id,true)}));return}
 const data=record.data||{};
 const granted=el('section','tv270-sheet-section');
 granted.append(el('h3','','Boons bestowed'));
 const cards=el('div','tv270-boon-grid');
 for(const item of data.granted||[])cards.append(boonCard(item));
 if(!cards.childElementCount)cards.append(empty('No divine boons have been bestowed upon this character.'));
 granted.append(cards);host.append(granted);
 if(data.can_view_scores&&Array.isArray(data.favour)&&data.favour.length){
  const favour=el('section','tv270-sheet-section');
  favour.append(el('h3','','Your divine favour'),empty('Favour is adjusted by your Dungeon Master. Reaching a threshold does not automatically grant a boon.'));
  const grid=el('div','tv270-favour-grid');
  for(const f of data.favour){
   const card=el('div','tv270-favour-card');
   const top=el('div','tv270-favour-title');
   top.append(el('strong','',f.name),el('b','',String(f.score>0?'+':'')+f.score));
   card.append(top);
   const track=el('div','tv270-favour-track');const meter=el('span');
   meter.style.width=((Number(f.score)+10)*5)+'%';track.append(meter);
   card.append(track,el('small','',f.rank==='minor'?'Minor God':'Divine patron'));grid.append(card);
  }
  favour.append(grid);host.append(favour);
 }
 const previews=el('section','tv270-sheet-section');
 previews.append(el('h3','','The attention of the Greater and Major Gods'),
  empty('Only broad, publicly known divine interests are shown. Hidden boons, private judgements and unearned rewards are not revealed.'));
 const grid=el('div','tv270-preview-grid');
 for(const p of data.previews||[]){
  const card=el('article','tv270-preview');
  card.append(el('strong','',p.name),el('small','',p.rank==='greater'?'Greater God':'Major God'));
  if(p.hint)card.append(el('p','',p.hint));
  grid.append(card);
 }
 if(!grid.childElementCount)grid.append(empty('Your DM has not published major-god previews for this campaign.'));
 previews.append(grid);host.append(previews);
}
function setSheetOpen(value){
 sheetOpen=!!value;const nav=document.querySelector('#pageRoot .sheet20-tabs');
 const panel=document.getElementById('tv270-sheet-panel');
 const tab=nav?.querySelector('[data-tv270-tab]');
 const native=document.querySelector('#pageRoot .sheet20-content');
 if(panel)panel.hidden=!sheetOpen;
 if(native)native.hidden=sheetOpen;
 if(tab){tab.setAttribute('aria-selected',String(sheetOpen));tab.classList.toggle('is-selected',sheetOpen)}
 if(sheetOpen){nav?.querySelectorAll('[data-action="sheetTab"]').forEach(x=>x.setAttribute('aria-selected','false'));renderSheet()}
}
function mountSheet(){
 const id=sameCharacter(),c=character(),nav=document.querySelector('#pageRoot .sheet20-tabs');
 if(!id||!c||!nav)return;
 if(sheetId!==id){sheetId=id;sheetOpen=false}
 let tab=nav.querySelector('[data-tv270-tab]');
 if(!tab){tab=action('Divine','', 'tv270-sheet-tab');
  // Replace default event from factory; never trigger the native sheetTab handler.
  tab.replaceWith?.(tab);tab.dataset.tv270Tab='1';tab.setAttribute('role','tab');
  tab.setAttribute('aria-selected','false');tab.onclick=e=>{e.preventDefault();e.stopPropagation();setSheetOpen(true)};
  nav.append(tab);
 }
 let panel=document.getElementById('tv270-sheet-panel');
 if(!panel){
  panel=el('section','tv270-sheet-panel');panel.id='tv270-sheet-panel';panel.hidden=true;
  const native=document.querySelector('#pageRoot .sheet20-content');
  if(native)native.insertAdjacentElement('afterend',panel);
  else nav.insertAdjacentElement('afterend',panel);
 }
 if(sheetOpen){const native=document.querySelector('#pageRoot .sheet20-content');if(native)native.hidden=true;panel.hidden=false;tab.setAttribute('aria-selected','true');if(!panel.hasChildNodes())renderSheet()}
}
document.addEventListener('click',e=>{
 if(!e.target.closest?.('#pageRoot .sheet20-tabs [data-action="sheetTab"]'))return;
 if(sheetOpen)setSheetOpen(false);
},true);
function renderDM(host,campaign,characters){
 if(!host||!canDM()){host?.append(empty('Only the verified campaign DM may open the divine ledger.'));return}
 if(dm.campaign!==campaign.id){dm.campaign=campaign.id;dm.character=null;dm.data=null;dm.editing=null}
 if(!characters.length){host.append(empty('There are no characters in this campaign yet.'));return}
 if(!characters.some(c=>c.id===dm.character))dm.character=characters[0].id;
 host.replaceChildren();
 host.append(heading('DM CHRONICLE · DIVINE AUTHORITY','The Divine Ledger',
  'Only you can adjust favour or prepare and award divine boons. Unearned powers are never sent to players.'));
 const nav=el('div','tv270-character-select');
 for(const c of characters)nav.append(action(c.name,()=>{dm.character=c.id;dm.data=null;refreshDM(host,campaign,characters)},'tv270-pill'+(c.id===dm.character?' is-selected':'')));
 host.append(nav);
 const workspace=el('div','tv270-workspace');workspace.id='tv270-workspace';host.append(workspace);
 if(!dm.data){workspace.append(empty('Loading the private divine ledger…'));refreshDM(host,campaign,characters);return}
 paintDM(workspace,host,campaign,characters);
}
async function refreshDM(host,campaign,characters){
 if(dm.loading)return;
 dm.loading=true;try{dm.data=await rpc('terravale_divine_dm_state',{target_character:dm.character})}
 catch(e){dm.data={error:e.message}}
 finally{dm.loading=false;if(host.isConnected)renderDM(host,campaign,characters)}
}
async function mutate(name,args,host,campaign,characters,message){
 if(dmBusy)return;
 dmBusy=true;try{await rpc(name,args);say(message);dm.data=null;dm.editing=null;
  cache.delete(dm.character);window.dispatchEvent(new CustomEvent('terravale-divine-updated',{detail:{characterId:dm.character}}));
  await refreshDM(host,campaign,characters)}
 catch(e){say('Divine ledger: '+e.message)}
 finally{dmBusy=false}
}
function paintDM(work,host,campaign,characters){
 if(dm.data?.error){work.append(empty(dm.data.error),action('Retry',()=>{dm.data=null;refreshDM(host,campaign,characters)}));return}
 const data=dm.data,patrons=data.patrons||[],favour=data.favour||[],boons=data.catalog||[],grants=data.grants||[];
 const columns=el('div','tv270-dm-columns');work.append(columns);
 const left=el('div','tv270-dm-col'),right=el('div','tv270-dm-col');columns.append(left,right);
 left.append(el('h3','','Divine Favour · −10 to +10'),
 empty('Adjust the numbers directly; only a DM can save a change. A threshold gives permission to award a boon, not an automatic reward.'));
 for(const p of patrons){
  const row=el('div','tv270-dm-favour');
  const old=favour.find(f=>f.patron_id===p.id);
  const score=field(p.name,old?.score??0);
  score.input.type='number';score.input.min='-10';score.input.max='10';score.input.step='1';
  row.append(score.wrap);
  const save=action('Save favour',()=>mutate('terravale_divine_dm_set_favour',{
    target_character:dm.character,target_patron:p.id,new_score:Number(score.input.value),
    reason:''},host,campaign,characters,'Divine favour updated.'),'btn primary small');
  row.append(save);left.append(row);
 }
 if(!patrons.length)left.append(empty('Create a patron to begin tracking favour.'));
 const add=action(dm.patronEditor?'Close patron editor':'Add / edit a god',()=>{dm.patronEditor=!dm.patronEditor;renderDM(host,campaign,characters)});
 left.append(add);
 if(dm.patronEditor)patronEditor(left,host,campaign,characters,patrons);
 right.append(el('h3','','Prepared boon library'),
 empty('Boons are DM-only until granted. Three families: Divine, Minor God and Concordant.'));
 right.append(action(dm.editing?'Cancel editing':'Create a boon',()=>{
  dm.editing=dm.editing?null:{kind:'divine',required_favour:3,state:'draft'};
  renderDM(host,campaign,characters);
 },'btn primary small'));
 if(dm.editing)boonEditor(right,host,campaign,characters,patrons,dm.editing);
 for(const b of boons){
  const card=el('article','tv270-dm-boon');
  const patron=patrons.find(p=>p.id===b.patron_id);
  const other=patrons.find(p=>p.id===b.second_patron_id);
  card.append(el('strong','',b.name),el('small','',kinds[b.kind]+' · '+(patron?.name||'Unknown')+(other?' + '+other.name:'')+' · Favour '+b.required_favour+' · '+b.state));
  if(b.summary)card.append(el('p','',b.summary));
  const status=grants.find(g=>g.boon_id===b.id&&g.status==='active');
  const controls=el('div','tv270-actions');
  controls.append(action('Edit',()=>{dm.editing={...b};renderDM(host,campaign,characters)}));
  if(status)controls.append(action('Revoke',()=>mutate('terravale_divine_dm_grant_boon',{
    target_character:dm.character,target_boon:b.id,give_boon:false,reason:'DM revocation'
  },host,campaign,characters,'Boon revoked.'),'btn ghost small tv254-danger'));
  else if(b.state==='ready')controls.append(action('Grant boon',()=>mutate('terravale_divine_dm_grant_boon',{
    target_character:dm.character,target_boon:b.id,give_boon:true,reason:'DM award'
  },host,campaign,characters,'Boon bestowed.'),'btn primary small'));
  if(status)card.append(el('span','tv270-active','Awarded'));else card.append(el('span','tv270-hidden','Not revealed to player'));
  card.append(controls);right.append(card);
 }
 if(!boons.length)right.append(empty('No boon mechanics have been prepared yet. Existing canon can be entered without exposing it to players.'));
 const history=el('details','tv270-history');
 history.append(el('summary','','Divine activity · '+(data.activity||[]).length));
 const rows=el('div','tv270-activity');
 for(const a of data.activity||[])rows.append(el('p','',new Date(a.created_at).toLocaleString()+' · '+a.action+
  (a.action==='favour'?' '+String(a.old_score??'—')+' → '+a.new_score:'')));
 history.append(rows);work.append(history);
}
function patronEditor(host,body,campaign,characters,patrons){
 const form=el('section','tv270-editor');
 form.append(el('h4','','Public deity preview'));
 const current=el('div','tv270-options');
 for(const p of patrons)current.append(action(p.name,()=>{dm.editPatron={...p};renderDM(body,campaign,characters)},'tv270-pill'+(dm.editPatron?.id===p.id?' is-selected':'')));
 form.append(current);
 const p=dm.editPatron||{};
 const name=field('God name',p.name||'');
 const slug=field('Stable key (e.g. kalma)',p.key_name||'');
 const hint=field('Player-safe hint · major / greater only',p.public_hint||'',true);
 form.append(name.wrap,slug.wrap,el('span','tv270-minor-label','Divine status'));
 let rank=p.rank||dm.patronRank;
 form.append(group([['greater','Greater'],['major','Major'],['minor','Minor']],rank,v=>{
  dm.patronRank=v;dm.editPatron={...p,rank:v};renderDM(body,campaign,characters);
 }));
 form.append(hint.wrap,action('Save deity',()=>mutate('terravale_divine_dm_save_patron',{
   target_campaign:campaign.id,existing_patron:p.id||null,
   patron_spec:{key:slug.input.value.trim().toLowerCase(),name:name.input.value.trim(),
    rank:dm.editPatron?.rank||dm.patronRank,public_hint:hint.input.value}
  },body,campaign,characters,'God details saved.'),'btn primary small'));
 host.append(form);
}
function boonEditor(host,body,campaign,characters,patrons,b){
 const form=el('section','tv270-editor');
 form.append(el('h4','',b.id?'Edit prepared boon':'Prepare a new boon'));
 let kind=b.kind||dm.kind,first=b.patron_id||dm.patron||patrons[0]?.id,
 second=b.second_patron_id||dm.other;
 const chooser=(options,value,update)=>{
  const area=el('div','tv270-options');
  for(const [k,title] of options)area.append(action(title,()=>update(k),'tv270-pill'+(String(k)===String(value)?' is-selected':'')));
  return area;
 };
 form.append(el('span','tv270-minor-label','Boon family'));
 form.append(chooser(Object.entries(kinds),kind,v=>{dm.editing={...b,kind:v,second_patron_id:v==='concordant'?second:null};renderDM(body,campaign,characters)}));
 form.append(el('span','tv270-minor-label','Patron'));
 form.append(chooser(patrons.map(p=>[p.id,p.name]),first,v=>{dm.editing={...b,patron_id:v};renderDM(body,campaign,characters)}));
 if(kind==='concordant'){
  form.append(el('span','tv270-minor-label','Second patron'));
  form.append(chooser(patrons.filter(p=>p.id!==first).map(p=>[p.id,p.name]),second,v=>{
   dm.editing={...b,second_patron_id:v};renderDM(body,campaign,characters);
  }));
 }
 const name=field('Boon title',b.name||''),summary=field('Description',b.summary||'',true);
 const mechanics=field('Full mechanics (DM only until awarded)',b.mechanics||'',true);
 const threshold=field('Favour needed for DM to grant',b.required_favour??3);
 threshold.input.type='number';threshold.input.min='1';threshold.input.max='10';
 form.append(name.wrap,summary.wrap,mechanics.wrap,threshold.wrap);
 let stage=b.state||'draft';
 form.append(el('span','tv270-minor-label','Availability'),
 chooser([['draft','Draft'],['ready','Ready to grant']],stage,v=>{
  dm.editing={...b,state:v};renderDM(body,campaign,characters)
 }));
 form.append(action('Save boon',()=>mutate('terravale_divine_dm_save_boon',{
  target_campaign:campaign.id,existing_boon:b.id||null,
  boon_spec:{kind,patron_id:first,second_patron_id:kind==='concordant'?second:null,
   name:name.input.value.trim(),summary:summary.input.value,
   mechanics:mechanics.input.value,required_favour:Number(threshold.input.value),state:stage}
 },body,campaign,characters,'Boon saved privately.'),'btn primary small'));
 host.append(form);
}
let queued=false;
function mount(){
 queued=false;
 if(/^#\/characters\/[^/]+/.test(location.hash))mountSheet();
}
const obs=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(mount)});
obs.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{sheetOpen=false;sheetId='';mount()});
window.addEventListener('terravale-auth-ready',()=>{cache.clear();mount()});
window.addEventListener('terravale-divine-updated',e=>{if(e.detail?.characterId)cache.delete(e.detail.characterId);if(sheetOpen)renderSheet()});
window.addEventListener('terravale-characters-synced',mount);
window.TerravaleDivineV270={renderDM,refreshSheet:id=>{cache.delete(id);if(sheetOpen)renderSheet()},families:kinds};
mount();
})();
