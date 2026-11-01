/* TERRAVALE CODEX · Session Room V2
 * Read-only, RLS-authorized campaign roster and character portrait preview.
 * Same-origin Supabase session as the live site. Never stores private records,
 * access tokens or signed URLs in workshop localStorage, and never writes DB.
 */
(function(){
"use strict";
const PROJECT="emwlvbmnrrhxhrmlwkhs";
const API_URL="https://"+PROJECT+".supabase.co";
const API_KEY="sb_publishable_4kf7TddSu-mzjRGr2J5ACA_OrNFF_5T"; // Public browser key only. NEVER a service_role key.
const BUCKET="terravale-character-portraits";
const $=id=>document.getElementById(id);
const button=$("live-roster-button");
const picker=$("live-campaign-select");
const status=$("live-roster-status");
if(!button||!picker||!status||!window.TerravaleRoomPreview){
 console.error("Terravale Session Room: missing required UI or room bridge");
 return;
}
let sb=null,viewer=null,previewCampaignId=null,currentPortraits=[],currentUserId=null;
let loadCounter=0, signedAt=0, busy=false, rosterMode=false;
let roomId=null,roomDm=false,roomVersion=0,roomReady=false,roomWriting=false,roomPending=null,lastSignature="",fetchingEvents=false;
const safeMessage=x=>String(x||"Unknown error").slice(0,200);
function show(message,problem=false){status.textContent=message;status.classList.toggle("live-roster-error",!!problem);}
function hasLocalSession(){
 try{return !!localStorage.getItem("sb-"+PROJECT+"-auth-token");}
 catch(e){return false;}
}
function codexSessionStorageKey(){
 // The compiled site has used the legacy key and standard Supabase v2 key
 // in different builds. Read only this project's known session locations.
 for(const key of ["supabase.auth.token","sb-"+PROJECT+"-auth-token"]){
  try{
   const raw=localStorage.getItem(key);
   if(!raw)continue;
   const obj=JSON.parse(raw);
   if(typeof obj?.access_token==="string"||
      typeof obj?.currentSession?.access_token==="string"||
      typeof obj?.session?.access_token==="string")return key;
  }catch{}
 }
 return "supabase.auth.token";
}
async function client(){
 if(sb)return sb;
 // This uses Supabase's standard browser storage key: same as the published app.
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");
 sb=createClient(API_URL,API_KEY,{
  // Match the actual compiled Codex client, which uses a custom storageKey.
  // The standard sb-<project>-auth-token key is NOT the site's session.
  auth:{storageKey:codexSessionStorageKey(),persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
  global:{headers:{"X-Client-Info":"terravale-session-room-live"}}});
 return sb;
}
function result(value,what){
 if(value.error)throw new Error(what+": "+safeMessage(value.error.message));
 return value.data;
}
function asNumber(value,fallback){
 let n=Number(value);
 return Number.isFinite(n)?n:fallback;
}
function classScores(character){
 const build=character.approved_build||{};
 const raw=build.stats||{},scores={};
 for(const k of ["STR","DEX","CON","INT","WIS","CHA"]){
  const v=raw[k];scores[k]=Number.isInteger(Number(v))&&Number(v)>=1&&Number(v)<=99?Number(v):null;
 }
 const details=build.details||{};
 const list=x=>Array.isArray(x)?x.filter(v=>typeof v==="string"&&v.length<=80):[];
 const level=Math.max(1,Math.min(20,asNumber(build.level,1)));
 return {scores,proficiency:2+Math.floor((level-1)/4),
  saves:list(details.savingThrows),skills:list(details.skills),expertise:[]};
}
function validSignedUrl(url){
 try{
  const u=new URL(url,API_URL);
  return u.origin===API_URL && u.pathname.startsWith("/storage/v1/object/sign/"+BUCKET+"/")?u.href:"";
 }catch{return "";}
}
async function signPortraits(records,client){
 const batch=await Promise.all(records.map(async ch=>{
  const path=typeof ch.portrait_path==="string"?ch.portrait_path.trim():"";
  // Character portraits are in a private bucket and normally named <id>/...
  if(!path||!path.startsWith(ch.id+"/"))return {id:ch.id,imageUrl:""};
  try{
   const signed=await client.storage.from(BUCKET).createSignedUrl(path,900);
   if(signed.error)return {id:ch.id,imageUrl:""};
   return {id:ch.id,imageUrl:validSignedUrl(signed.data?.signedUrl||"")};
  }catch{return {id:ch.id,imageUrl:""};}
 }));
 signedAt=Date.now();
 return batch;
}
function asConditions(value){
 const list=Array.isArray(value)?value:[];
 return list.map(x=>typeof x==="string"?x:x&&typeof x==="object"?x.name||x.condition||"":"")
  .filter(x=>typeof x==="string"&&x.length>0&&x.length<=64).slice(0,20);
}
async function authorizedCampaigns(client,userId){
 const data=result(await client.from("campaigns").select("id,name,owner_id").order("created_at",{ascending:false}),"Campaigns");
 const members=result(await client.from("campaign_members").select("campaign_id,role").eq("user_id",userId),"Memberships");
 const roleMap=new Map((members||[]).map(x=>[x.campaign_id,x.role]));
 return (data||[]).map(c=>({...c,isDm:c.owner_id===userId||roleMap.get(c.id)==="dm"}));
}
async function authUser(client){
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user)throw new Error("Log in through the main Codex first, then return here.");
 currentUserId=data.user.id;return data.user;
}
function characterToPreviewActor(ch,row,portrait){
 const build=ch.approved_build||{};
 const max=Math.max(1,Math.min(99999,asNumber(build.maxHp,1)));
 const hp=Math.max(0,Math.min(max,asNumber(row?.hp,max)));
 const level=Math.max(1,Math.min(20,asNumber(build.level,1)));
 return {id:ch.id,name:ch.name,type:"Player",
  subtitle:"Lv "+level+" · "+(typeof build.className==="string"?build.className:"Adventurer"),
  init:null,hp,max,hidden:false,conditions:asConditions(row?.conditions),
  ownerId:ch.owner_id,liveScores:classScores(ch),imageUrl:portrait||""};
}
async function rosterForCampaign(client,campaign){
 const roster=result(await client.from("party_room_roster").select("character_id,added_at").eq("campaign_id",campaign.id).order("added_at",{ascending:true}),"Active roster");
 // Empty campaign roster is valid.
 const ids=(roster||[]).map(r=>r.character_id);
 const chars=ids.length?result(await client.from("characters").select("id,campaign_id,owner_id,name,status,portrait_path,approved_build,sheet_visible_to_party")
  .eq("campaign_id",campaign.id).eq("status","approved").in("id",ids),"Approved characters"):[];
 const mine=result(await client.from("characters").select("id,campaign_id,owner_id,name,status,portrait_path,approved_build,sheet_visible_to_party")
 .eq("campaign_id",campaign.id).eq("owner_id",currentUserId).eq("status","approved"),"Your characters");
 const permitted=[...new Map([...(chars||[]),...(mine||[])].map(x=>[x.id,x])).values()];
 const statuses=permitted.length?result(await client.from("character_state").select("character_id,hp,conditions")
  .in("character_id",permitted.map(x=>x.id)),"Character HP and conditions"):[];
 const stateMap=new Map((statuses||[]).map(x=>[x.character_id,x]));
 const charMap=new Map(permitted.map(x=>[x.id,x]));
 const ordered=[...new Map([...ids.map(id=>charMap.get(id)).filter(Boolean),...(mine||[])].map(x=>[x.id,x])).values()];
 const portraits=await signPortraits(ordered,client);
 const portraitMap=new Map(portraits.map(p=>[p.id,p.imageUrl]));
 const actors=ordered.map(ch=>characterToPreviewActor(ch,stateMap.get(ch.id),portraitMap.get(ch.id)));
 return {actors,portraitSources:ordered.map(c=>({id:c.id,path:c.portrait_path||""})),ownId:actors.find(a=>a.ownerId===currentUserId)?.id||""};
}
async function loadRoster(id){
 if(busy)return;
 const sequence=++loadCounter;
 busy=true;button.disabled=true;picker.disabled=true;
 show("Loading authorized campaign characters…");
 try{
  const c=await client();
  const user=await authUser(c);
  const campaigns=await authorizedCampaigns(c,user.id);
  if(!campaigns.length)throw new Error("Your account is not in an accessible campaign.");
  viewer=campaigns;
  picker.innerHTML=campaigns.map(x=>'<option value="'+x.id+'">'+x.name.replace(/[<>&"']/g,"")+'</option>').join("");
  picker.hidden=campaigns.length<2;
  let active=campaigns.find(x=>x.id===id)||campaigns.find(x=>x.id===previewCampaignId);
  if(!active){
   const rosterRows=result(await c.from("party_room_roster").select("campaign_id")
     .in("campaign_id",campaigns.map(x=>x.id)),"Party roster selection");
   const activeSet=new Set((rosterRows||[]).map(row=>row.campaign_id));
   active=campaigns.find(x=>activeSet.has(x.id))||campaigns[0];
  }
  picker.value=active.id;
  const data=await rosterForCampaign(c,active);
  if(sequence!==loadCounter)return;
  previewCampaignId=active.id;
  currentPortraits=data.portraitSources;
  window.TerravaleRoomPreview.useRoster({actors:data.actors,ownId:data.ownId,isDm:active.isDm,campaignName:active.name,userId:user.id});
  roomId=active.id;roomDm=active.isDm;
  document.body.dataset.roomConnection="ready";
  await refreshRoom();await refreshEvents();
  rosterMode=true;
  show("Connected · "+active.name+" · "+data.actors.length+" characters");
 }catch(e){
  show("Campaign connection: "+safeMessage(e.message),true);
  document.body.dataset.roomConnection="error";
  window.TerravaleRoomPreview?.showConnectionFailure?.(safeMessage(e.message));
  if(!window.TerravaleRoomPreview.isLive())button.textContent="Use Live Roster";
 }finally{busy=false;button.disabled=false;picker.disabled=false;}
}
async function refreshImages(){
 if(!window.TerravaleRoomPreview.isLive()||!sb||!currentPortraits.length)return;
 if(Date.now()-signedAt<7*60*1000)return;
 const withSources=currentPortraits.map(c=>({id:c.id,portrait_path:c.path}));
 const signed=await signPortraits(withSources,sb);
 if(window.TerravaleRoomPreview.isLive())window.TerravaleRoomPreview.refreshPortraits(signed);
}
async function openApprovedCharacterPicker(){
 const bridge=window.TerravaleRoomPreview;
 if(busy){show("Campaign roster is still loading. Try again shortly.");return;}
 if(!bridge.isLive()){show("Switch to Live Roster to choose characters from your campaign.",true);return;}
 const campaign=viewer?.find(c=>c.id===previewCampaignId);
 if(!campaign?.isDm){show("Only the campaign DM can add other players' characters.",true);return;}
 try{
  const c=await client();
  await authUser(c);
  const approved=result(await c.from("characters").select(
   "id,campaign_id,owner_id,name,status,portrait_path,approved_build,sheet_visible_to_party")
    .eq("campaign_id",campaign.id).eq("status","approved").order("name",{ascending:true}),"Approved campaign characters");
  if(!Array.isArray(approved)||!approved.length){
    bridge.openExistingPicker([],"No approved characters are available for your campaign.");
    return;
  }
  const ids=approved.map(ch=>ch.id);
  const stateRows=result(await c.from("character_state").select("character_id,hp,conditions")
   .in("character_id",ids),"Character state");
  const map=new Map((stateRows||[]).map(x=>[x.character_id,x]));
  const portraits=await signPortraits(approved,c);
  const images=new Map(portraits.map(x=>[x.id,x.imageUrl]));
  // Keep renewal sources in memory only for the lifetime of this preview.
  const existing=new Map(currentPortraits.map(x=>[x.id,x]));
  for(const ch of approved)existing.set(ch.id,{id:ch.id,path:ch.portrait_path||""});
  currentPortraits=Array.from(existing.values());
  const actors=approved.map(ch=>characterToPreviewActor(ch,map.get(ch.id),images.get(ch.id)));
  bridge.openExistingPicker(actors,"Approved campaign characters · "+campaign.name+
    ". Adding here only changes V2 initiative, not the live campaign roster.");
 }catch(err){show("Unable to load existing characters: "+safeMessage(err.message),true);}
}
window.TerravaleV2LiveCharacters=Object.freeze({openPicker:openApprovedCharacterPicker});


function signature(st){
 let actors=(st.actors||[]).map(a=>({id:a.id,name:a.name,type:a.type,subtitle:a.subtitle||"",ownerId:a.ownerId||null,
 init:Number.isFinite(a.init)?a.init:null,hp:Number.isFinite(a.hp)?a.hp:null,max:Number.isFinite(a.max)?a.max:null,
 hidden:!!a.hidden,conditions:a.conditions||[],notes:a.notes||"",statBlock:a.statBlock||null}));
 return JSON.stringify({actors,queue:st.queue||[],round:st.round||1,steps:st.steps||0});
}
async function refreshRoom(){
 if(!roomId||roomWriting)return;
 let r=await sb.rpc("session_room_get",{target_campaign:roomId});
 if(r.error){show("Room sync failed: "+safeMessage(r.error.message),true);return;}
 roomVersion=Number(r.data?.version)||0;roomReady=true;
 // Refresh player HP/conditions from the approved sheet to avoid stale copies.
 const loaded=r.data||{};
 const players=(loaded.actors||[]).filter(a=>a.type==="Player"&&/^[0-9a-f-]{36}$/i.test(a.id));
 if(players.length){
  const current=await sb.from("character_state").select("character_id,hp,conditions").in("character_id",players.map(x=>x.id));
  if(!current.error){
   const byId=new Map((current.data||[]).map(x=>[x.character_id,x]));
   loaded.actors=loaded.actors.map(x=>{const row=byId.get(x.id);return row?{...x,
    hp:Number.isInteger(row.hp)?row.hp:x.hp,
    conditions:Array.isArray(row.conditions)?row.conditions:x.conditions}:x;});
  }
 }
 window.TerravaleRoomPreview.applyServer(loaded);
 lastSignature=signature(window.TerravaleRoomPreview.readState());
}
async function pushRoom(){
 if(roomWriting||!roomPending||!roomDm||!roomReady)return;
 roomWriting=true;
 while(roomPending){
  let x=roomPending;roomPending=null;
  let r=await sb.rpc("session_room_manage",{target_campaign:roomId,new_actors:x.actors,new_queue:x.queue,
    new_round:x.round,new_steps:x.steps,expected_version:roomVersion});
  if(r.error){roomPending=null;roomWriting=false;show("Room changed; reloading. "+safeMessage(r.error.message),true);await refreshRoom();return;}
  roomVersion=Number(r.data)||roomVersion+1;lastSignature=x.text;
 }
 roomWriting=false;
}
function persistState(st){
 if(!roomReady||!roomDm)return;
 let text=signature(st);if(text===lastSignature)return;
 roomPending={...JSON.parse(text),text};void pushRoom();
}
async function advance(){
 if(!roomReady||!roomId)return;
 let active=window.TerravaleRoomPreview.getCurrent();
 if(!active)return;
 if(!roomDm&&active.ownerId!==currentUserId){show("Not your turn",true);return;}
 let r=await sb.rpc("session_room_advance",{target_campaign:roomId});
 if(r.error){show("End Turn failed: "+safeMessage(r.error.message),true);return;}
 await refreshRoom();
}
async function rollMine(){
 let id=window.TerravaleRoomPreview.readState().own;if(!id||!roomId)return;
 let r=await sb.rpc("session_room_roll_own",{target_campaign:roomId,target_character:id});
 if(r.error){show("Initiative failed: "+safeMessage(r.error.message),true);return;}
 await refreshRoom();show("Initiative: "+r.data.total+" (d20 "+r.data.die+", modifier "+r.data.modifier+")");
}
async function sendLog(m){
 if(!roomId||!roomReady)return;
 let body=m.kind==="text"?String(m.message||"").trim():String(m.who||"Player")+" rolled "+String(m.label||"initiative")+" = "+String(m.total);
 if(!body)return;
 let r=await sb.rpc("send_session_message",{target_campaign:roomId,body_text:body.slice(0,2000)});
 if(r.error)show("Message failed: "+safeMessage(r.error.message),true);
 await refreshEvents();
}
async function roll(expr){
 if(!roomId||!roomReady)return;
 let m=String(expr).replace(/\s/g,"").match(/^(\d{0,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i);
 if(!m){show("Invalid dice notation",true);return;}
 let n=Number(m[1]||1);if(n<1||n>30){show("Maximum 30 dice",true);return;}
 let r=await sb.rpc("roll_campaign_dice",{target_campaign:roomId,dice_count:n,dice_sides:Number(m[2]),
 modifier:Number(m[3]||0),dm_only:false});
 if(r.error)show("Dice failed: "+safeMessage(r.error.message),true);
 await refreshEvents();
}
async function refreshEvents(){
 if(!roomId||fetchingEvents)return;fetchingEvents=true;
 try{
 let [m,r]=await Promise.all([
 sb.from("session_messages").select("author_name,body,created_at").eq("campaign_id",roomId).order("created_at",{ascending:false}).limit(70),
 sb.from("dice_rolls").select("roller_name,dice_count,dice_sides,modifier,results,total,created_at").eq("campaign_id",roomId).order("created_at",{ascending:false}).limit(70)]);
 if(m.error||r.error)throw Error(m.error?.message||r.error?.message);
 let clock=t=>new Date(t).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
 let events=[
 ...(m.data||[]).map(x=>({kind:"text",who:x.author_name,message:x.body,time:clock(x.created_at),date:x.created_at})),
 ...(r.data||[]).map(x=>({kind:"roll",who:x.roller_name,label:x.dice_count+"d"+x.dice_sides,
 total:x.total,detail:(x.results||[]).join(" + ")+(x.modifier?" "+x.modifier:""),time:clock(x.created_at),date:x.created_at}))
 ].sort((a,b)=>a.date.localeCompare(b.date)).slice(-130);
 window.TerravaleRoomPreview.applyMessages(events);
 }catch(e){show("Chat unavailable: "+safeMessage(e.message),true);}
 finally{fetchingEvents=false;}
}
async function updateSheetState(characterId,patch){
 if(!roomDm||!roomId||!characterId)return;
 const safe={};
 if(Number.isInteger(patch.hp)&&patch.hp>=0&&patch.hp<=99999)safe.hp=patch.hp;
 if(Array.isArray(patch.conditions))safe.conditions=patch.conditions.filter(x=>typeof x==="string"&&x.length<=64).slice(0,20);
 if(!Object.keys(safe).length)return;
 const r=await sb.from("character_state").update(safe).eq("character_id",characterId);
 if(r.error)show("Character sheet update failed: "+safeMessage(r.error.message),true);
}
window.TerravaleLiveHooks=Object.freeze({persistState,advance,rollMine,sendLog,roll,updateSheetState,reconnect:()=>loadRoster(roomId)});
setInterval(()=>{if(!document.hidden&&roomId){void refreshRoom();void refreshEvents();}},4500);

// Production has no demo roster; always authenticate and read real campaigns.
button.addEventListener("click",()=>{void loadRoster(previewCampaignId);});
picker.addEventListener("change",()=>{if(picker.value)void loadRoster(picker.value)});
window.addEventListener("focus",()=>{if(window.TerravaleRoomPreview.isLive())void refreshImages()});
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden&&window.TerravaleRoomPreview.isLive())void refreshImages();
});
setInterval(()=>{if(!document.hidden)void refreshImages()},6*60*1000);
// The main Codex may use a different session storage implementation. Always
// ask Supabase for the current user instead of relying on a storage-key guess.
void loadRoster(null);
})();
