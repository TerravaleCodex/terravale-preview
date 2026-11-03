/* Terravale Codex — portable character export v1.
 * Read-only: no database mutations or automatic imports.
 * Export is available only to the character owner or authorised campaign DM.
 */
(()=>{
'use strict';
if(window.__tvCharacterExportMounted)return;
window.__tvCharacterExportMounted=true;
const BASE='/terravale-preview/';
const API='https://emwlvbmnrrhxhrmlwkhs.supabase.co/rest/v1/';
const APIKEY='sb_publishable_4kf7TddSu-mzjRGr2J5ACA_OrNFF_5T';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const $=(s,scope=document)=>scope.querySelector(s);
const make=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
};
function parseStoredSession(value){
 try{
  if(!value)return null;
  let session=value;
  if(typeof session==='string'){
   session=decodeURIComponent(session);
   if(session.startsWith('base64-')){
    const raw=session.slice(7).replace(/-/g,'+').replace(/_/g,'/');
    const bytes=atob(raw.padEnd(Math.ceil(raw.length/4)*4,'='));
    session=JSON.parse(decodeURIComponent(Array.from(bytes,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
   }else session=JSON.parse(session);
  }
  if(session&&typeof session==='object'&&!Array.isArray(session))session=session.currentSession||session.session||session.data?.session||session;
  const token=Array.isArray(session)?session[0]:session?.access_token;
  if(typeof token!=='string'||token.split('.').length!==3)return null;
  let uid=Array.isArray(session)?null:session?.user?.id;
  if(!uid){
   const segment=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const claims=JSON.parse(atob(segment.padEnd(Math.ceil(segment.length/4)*4,'=')));
   uid=claims?.sub;
  }
  if(typeof uid==='string'&&/^[a-f0-9-]{36}$/i.test(uid))return {uid,token};
 }catch(e){}
 return null;
}
function getAuth(){
 const base='sb-emwlvbmnrrhxhrmlwkhs-auth-token';
 try{
  for(const key of [base,'supabase.auth.token']){
   const auth=parseStoredSession(localStorage.getItem(key));
   if(auth)return auth;
  }
 }catch(e){}
 try{
  const pairs=new Map(document.cookie.split(';').map(s=>{
   const pos=s.indexOf('=');
   return pos<0?['','']:[s.slice(0,pos).trim(),s.slice(pos+1).trim()];
  }));
  const whole=pairs.get(base);
  if(whole){const auth=parseStoredSession(whole);if(auth)return auth;}
  const chunks=[...pairs.entries()].filter(([k])=>new RegExp('^'+base+'\\.[0-9]+$').test(k)).sort(([a],[b])=>Number(a.slice(base.length+1))-Number(b.slice(base.length+1)));
  if(chunks.length&&chunks.every(([k],i)=>Number(k.slice(base.length+1))===i)){
   const auth=parseStoredSession(chunks.map(([,v])=>v).join(''));if(auth)return auth;
  }
 }catch(e){}
 return null;
}

const pathNow=()=>decodeURIComponent(location.pathname).replace(/^\/terravale-preview\/?/,'/').replace(/\/+$/,'')||'/';
function onCharacterPage(){
 const path=pathNow();
 return path==='/characters'||(path.startsWith('/characters/')&&!/^\/characters\/(create|sheet-live|sheet-workshop|sheet-render|sheet-preview|sheet-test)(\/|$)/i.test(path));
}
function plainObject(v){
 return v&&typeof v==='object'&&!Array.isArray(v)?JSON.parse(JSON.stringify(v)):{};
}
function safeList(v){return Array.isArray(v)?JSON.parse(JSON.stringify(v)):[];}
function optionalInteger(n){return Number.isInteger(n)?n:null;}
function buildPortableExport(row,state,campaignName=''){
 if(!row||!ID.test(row.id)||!ID.test(row.campaign_id)||typeof row.name!=='string')throw Error('Invalid character record');
 const stateRecord=state||null;
 return {
  format:'terravale.codex.character',
  formatVersion:1,
  exportedAt:new Date().toISOString(),
  source:{
   application:'Terravale Codex',
   originalCharacterId:row.id,
   originalCampaignId:row.campaign_id,
   originalCampaignName:String(campaignName||''),
   originalCreatedAt:row.created_at||null,
   originalStatus:row.status==='approved'?'approved':'draft'
  },
  character:{
   name:row.name,
   approved_build:plainObject(row.approved_build),
   sheet_visible_to_party:row.sheet_visible_to_party===true,
   portrait_path:typeof row.portrait_path==='string'?row.portrait_path:null
  },
  character_state:stateRecord?{
   hp:optionalInteger(stateRecord.hp),
   temp_hp:optionalInteger(stateRecord.temp_hp),
   blood_state:optionalInteger(stateRecord.blood_state),
   resources:safeList(stateRecord.resources),
   conditions:safeList(stateRecord.conditions),
   inventory:safeList(stateRecord.inventory),
   death_saves:plainObject(stateRecord.death_saves),
   updated_at:typeof stateRecord.updated_at==='string'?stateRecord.updated_at:null
  }:null,
  portability:{
   importRequiresDMReview:true,
   newCharacterAndCampaignIdsRequired:true,
   doNotRestoreApprovalAutomatically:true,
   portraitImageEmbedded:false,
   journalEntriesIncluded:false,
   note:'Portable character backup. A future DM importer must validate the build and assign new ownership, campaign, approval and state records.'
  }
 };
}
function nameForDownload(name){
 const safe=String(name||'character').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,64).toLowerCase()||'character';
 return 'terravale-'+safe+'-'+new Date().toISOString().slice(0,10)+'.json';
}
async function request(resource,auth){
 const response=await fetch(API+resource,{method:'GET',headers:{apikey:APIKEY,Authorization:'Bearer '+auth.token,Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw Error('Codex export service '+response.status);
 return response.json();
}
const charsPath='characters?select=id,campaign_id,owner_id,name,status,approved_build,portrait_path,sheet_visible_to_party,created_at&order=name.asc&limit=250';
let modal=null,toolbar=null,trigger=null,lastFocus=null,eligible=[],campaignById=new Map(),authForDialog=null,working=false;
function status(message,isError=false){
 const el=modal&&$('#tvce-status',modal);
 if(el){el.textContent=message;el.classList.toggle('tvce-error',Boolean(isError));}
}
function modalUI(){
 if(modal)return modal;
 modal=make('div','tvce-backdrop');
 modal.hidden=true;
 modal.innerHTML=`<section class="tvce-dialog" role="dialog" aria-modal="true" aria-labelledby="tvce-title">
 <header class="tvce-head"><div><small>CHARACTER ARCHIVE · PORTABLE RECORD</small><h2 id="tvce-title">Export character</h2></div><button type="button" id="tvce-close" aria-label="Close export dialog">×</button></header>
 <p class="tvce-description">Keep a personal backup or hand a character file to your DM for a future transfer.</p>
 <div class="tvce-field"><label for="tvce-select">Character</label><select id="tvce-select" disabled><option>Checking your characters…</option></select></div>
 <div id="tvce-details" class="tvce-details">The export includes the approved build, equipment, current HP, conditions, resources, blood state and death saves when saved.</div>
 <p class="tvce-explain">JSON · Read-only download · The live character is unchanged. Portrait image files and journal entries are not embedded.</p>
 <p id="tvce-status" class="tvce-status" role="status" aria-live="polite">Preparing export options…</p>
 <footer class="tvce-actions"><button type="button" id="tvce-cancel">Cancel</button><button type="button" id="tvce-download" class="tvce-primary" disabled>Download JSON</button></footer>
 </section>`;
 document.body.append(modal);
 $('#tvce-close',modal).onclick=close;
 $('#tvce-cancel',modal).onclick=close;
 $('#tvce-select',modal).onchange=describe;
 $('#tvce-download',modal).onclick=downloadSelected;
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 return modal;
}
function close(){
 if(!modal||working)return;
 modal.hidden=true;
 document.body.classList.remove('tvce-dialog-open');
 if(lastFocus?.isConnected)lastFocus.focus();
}
function describe(){
 const id=$('#tvce-select',modal)?.value;
 const selected=eligible.find(x=>x.id===id);
 const details=$('#tvce-details',modal);
 const download=$('#tvce-download',modal);
 download.disabled=!selected||working;
 if(!selected){details.textContent='No eligible character selected.';return;}
 const campaign=campaignById.get(selected.campaign_id)||'Campaign';
 details.replaceChildren();
 const strong=make('strong','',selected.name);
 const meta=make('span','',campaign+' · '+(selected.status==='approved'?'DM-approved':'Draft')+' · '+((selected.approved_build||{}).className||'Class not set'));
 details.append(strong,meta);
}
async function show(){
 lastFocus=document.activeElement;
 modalUI().hidden=false;
 document.body.classList.add('tvce-dialog-open');
 const select=$('#tvce-select',modal),button=$('#tvce-download',modal);
 select.replaceChildren(new Option('Loading…',''));
 select.disabled=true;button.disabled=true;
 status('Checking account access…');
 const auth=getAuth();
 if(!auth){
  authForDialog=null;eligible=[];
  status('Sign in to Terravale Codex before exporting a character.',true);
  const link=make('a','tvce-login','Open sign-in');
  link.href=BASE+'login/';
  $('#tvce-details',modal).replaceChildren(link);
  return;
 }
 authForDialog=auth;
 try{
  const [list,members,campaigns,siteDM]=await Promise.allSettled([
   request(charsPath,auth),
   request('campaign_members?select=campaign_id,role&user_id=eq.'+encodeURIComponent(auth.uid)+'&limit=250',auth),
   request('campaigns?select=id,name,owner_id&limit=250',auth),
   request('rpc/codex_am_i_site_dm',auth)
  ]);
  if(modal.hidden||getAuth()?.uid!==auth.uid)return;
  if(list.status!=='fulfilled'||!Array.isArray(list.value))throw Error('Character list unavailable');
  const campaignsList=campaigns.status==='fulfilled'&&Array.isArray(campaigns.value)?campaigns.value:[];
  campaignById=new Map(campaignsList.filter(c=>ID.test(c.id)).map(c=>[c.id,String(c.name||'Campaign')]));
  const dmCampaigns=new Set(
   (members.status==='fulfilled'&&Array.isArray(members.value)?members.value:[])
    .filter(m=>m.role==='dm').map(m=>m.campaign_id)
  );
  for(const campaign of campaignsList)if(campaign.owner_id===auth.uid)dmCampaigns.add(campaign.id);
  const siteDMAllowed=siteDM.status==='fulfilled'&&siteDM.value===true;
  eligible=list.value.filter(c=>ID.test(c.id)&&ID.test(c.campaign_id)&&typeof c.name==='string'&&(c.owner_id===auth.uid||dmCampaigns.has(c.campaign_id)||siteDMAllowed));
  eligible.sort((a,b)=>a.name.localeCompare(b.name));
  select.replaceChildren();
  if(!eligible.length){
   select.append(new Option('No characters available for export',''));
   status('No character you own or manage as DM is available in this account.',true);
   describe();return;
  }
  for(const c of eligible){
   const campaign=campaignById.get(c.campaign_id)||'Campaign';
   select.append(new Option(c.name+' — '+campaign+' ('+(c.status==='approved'?'Approved':'Draft')+')',c.id));
  }
  select.disabled=false;
  describe();
  status(eligible.length+' eligible character'+(eligible.length===1?'':'s')+' available.');
  select.focus();
 }catch(err){
  select.replaceChildren(new Option('Unable to load characters',''));
  status('Could not load character records. '+(err?.message||'Please retry.'),true);
 }
}
async function downloadSelected(){
 if(working||!authForDialog)return;
 const id=$('#tvce-select',modal)?.value;
 if(!ID.test(id)||!eligible.some(c=>c.id===id)){status('Choose an available character first.',true);return;}
 const auth=getAuth();
 if(!auth||auth.uid!==authForDialog.uid){status('Your session changed. Reopen the export dialog.',true);return;}
 working=true;$('#tvce-download',modal).disabled=true;
 status('Reading the character’s latest saved data…');
 try{
  const [rows,states,members,campaigns,siteDM]=await Promise.allSettled([
   request('characters?select=id,campaign_id,owner_id,name,status,approved_build,portrait_path,sheet_visible_to_party,created_at&id=eq.'+encodeURIComponent(id)+'&limit=1',auth),
   request('character_state?select=character_id,hp,temp_hp,blood_state,resources,conditions,inventory,death_saves,updated_at&character_id=eq.'+encodeURIComponent(id)+'&limit=1',auth),
   request('campaign_members?select=campaign_id,role&user_id=eq.'+encodeURIComponent(auth.uid)+'&limit=250',auth),
   request('campaigns?select=id,owner_id&limit=250',auth),
   request('rpc/codex_am_i_site_dm',auth)
  ]);
  if(rows.status!=='fulfilled'||!rows.value?.[0])throw Error('Character is no longer accessible');
  if(states.status!=='fulfilled')throw Error('Could not read the saved character state; export stopped to avoid an incomplete backup');
  const row=rows.value[0];
  if(row.id!==id)throw Error('Character identity changed');
  const dmRole=(members.status==='fulfilled'&&Array.isArray(members.value)?members.value:[]).some(m=>m.campaign_id===row.campaign_id&&m.role==='dm');
  const ownsCampaign=(campaigns.status==='fulfilled'&&Array.isArray(campaigns.value)?campaigns.value:[]).some(c=>c.id===row.campaign_id&&c.owner_id===auth.uid);
  const siteDMAllowed=siteDM.status==='fulfilled'&&siteDM.value===true;
  if(row.owner_id!==auth.uid&&!dmRole&&!ownsCampaign&&!siteDMAllowed)throw Error('Export requires character ownership or DM permission');
  if(!getAuth()||getAuth().uid!==auth.uid)throw Error('Session changed during export');
  const bundle=buildPortableExport(row,states.value?.[0]||null,campaignById.get(row.campaign_id)||'');
  const blob=new Blob([JSON.stringify(bundle,null,2)+'\n'],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),anchor=make('a');anchor.href=url;anchor.download=nameForDownload(row.name);
  anchor.style.display='none';document.body.append(anchor);
  anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  status('Export created: '+anchor.download+'. Your original character has not changed.');
 }catch(err){
  status('Export could not complete: '+(err?.message||'Unexpected error'),true);
 }finally{working=false;describe();}
}
function mount(){
 if(!onCharacterPage()){
  if(toolbar){toolbar.remove();toolbar=null;trigger=null;}
  return;
 }
 const main=document.querySelector('main')||document.querySelector('[role="main"]')||document.querySelector('#main-codex');
 if(!main)return;
 if(toolbar&&toolbar.isConnected&&toolbar.parentElement===main)return;
 if(toolbar)toolbar.remove();
 toolbar=make('div','tvce-toolbar');
 trigger=make('button','tvce-trigger','↓  Export character');
 trigger.type='button';trigger.title='Download a portable character backup (JSON)';
 trigger.addEventListener('click',show);
 toolbar.append(trigger);
 main.insertBefore(toolbar,main.firstChild);
}
let pending=false;
function schedule(){
 if(pending)return;
 pending=true;
 requestAnimationFrame(()=>{pending=false;mount();});
}
function init(){
 modalUI();
 mount();
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 setInterval(mount,2500);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)close();});
}
window.TerravaleCharacterExport={open:show,buildPortableExport};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
