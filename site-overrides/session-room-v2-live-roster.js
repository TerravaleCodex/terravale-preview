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
if(!button||!picker||!status||!window.TerravaleRoomPreview)return;
let sb=null,viewer=null,previewCampaignId=null,currentPortraits=[],currentUserId=null;
let loadCounter=0, signedAt=0, busy=false, rosterMode=false;
const safeMessage=x=>String(x||"Unknown error").slice(0,200);
function show(message,problem=false){status.textContent=message;status.classList.toggle("live-roster-error",!!problem);}
function hasLocalSession(){
 try{return !!localStorage.getItem("sb-"+PROJECT+"-auth-token");}
 catch(e){return false;}
}
async function client(){
 if(sb)return sb;
 // This uses Supabase's standard browser storage key: same as the published app.
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");
 sb=createClient(API_URL,API_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
   global:{headers:{"X-Client-Info":"terravale-v2-readonly-roster"}}});
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
async function rosterForCampaign(client,campaign){
 const roster=result(await client.from("party_room_roster").select("character_id,added_at").eq("campaign_id",campaign.id).order("added_at",{ascending:true}),"Active roster");
 if(!roster?.length)throw new Error("No characters are currently in this campaign's active party roster.");
 const ids=roster.map(r=>r.character_id);
 const chars=result(await client.from("characters").select("id,campaign_id,owner_id,name,status,portrait_path,approved_build,sheet_visible_to_party")
  .eq("campaign_id",campaign.id).eq("status","approved").in("id",ids),"Approved characters");
 const permitted=(chars||[]).filter(x=>ids.includes(x.id));
 if(!permitted.length)throw new Error("No approved roster characters are visible to this account.");
 const statuses=result(await client.from("character_state").select("character_id,hp,conditions")
  .in("character_id",permitted.map(x=>x.id)),"Character HP and conditions");
 const stateMap=new Map((statuses||[]).map(x=>[x.character_id,x]));
 const charMap=new Map(permitted.map(x=>[x.id,x]));
 const ordered=ids.map(id=>charMap.get(id)).filter(Boolean);
 const portraits=await signPortraits(ordered,client);
 const portraitMap=new Map(portraits.map(p=>[p.id,p.imageUrl]));
 const actors=ordered.map(ch=>{
  const build=ch.approved_build||{},row=stateMap.get(ch.id)||{};
  const max=Math.max(1,Math.min(99999,asNumber(build.maxHp,1)));
  const hp=Math.max(0,Math.min(max,asNumber(row.hp,max)));
  const level=Math.max(1,Math.min(20,asNumber(build.level,1)));
  return {id:ch.id,name:ch.name,type:"Player",
   subtitle:"Lv "+level+" · "+(typeof build.className==="string"?build.className:"Adventurer"),
   // No combat has started in this preview: initiative is not rolled by the app.
   init:null,hp,max,hidden:false,conditions:asConditions(row.conditions),
   ownerId:ch.owner_id,liveScores:classScores(ch),imageUrl:portraitMap.get(ch.id)||""};
 });
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
  let active=campaigns.find(x=>x.id===id)||campaigns.find(x=>x.id===previewCampaignId)||campaigns[0];
  picker.value=active.id;
  const data=await rosterForCampaign(c,active);
  if(sequence!==loadCounter)return;
  previewCampaignId=active.id;
  currentPortraits=data.portraitSources;
  window.TerravaleRoomPreview.useRoster({actors:data.actors,ownId:data.ownId,isDm:active.isDm,campaignName:active.name});
  rosterMode=true;
  show("Live roster: "+active.name+" · "+data.actors.length+" characters · read-only");
 }catch(e){
  show(safeMessage(e.message),true);
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
button.addEventListener("click",()=>{
 if(window.TerravaleRoomPreview.isLive()){
  ++loadCounter;rosterMode=false;currentPortraits=[];
  window.TerravaleRoomPreview.switchToDemo();
  picker.hidden=true;show("Sample characters · no account data");return;
 }
 void loadRoster(previewCampaignId);
});
picker.addEventListener("change",()=>{if(picker.value)void loadRoster(picker.value)});
window.addEventListener("focus",()=>{if(window.TerravaleRoomPreview.isLive())void refreshImages()});
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden&&window.TerravaleRoomPreview.isLive())void refreshImages();
});
setInterval(()=>{if(!document.hidden)void refreshImages()},6*60*1000);
if(hasLocalSession()){
 // Automatically use the signed-in player's active character without making
 // the user manually choose among other people's sample characters.
 void loadRoster(null);
}else show("Sample characters · sign in on the Codex to load your campaign");
})();
