#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const file="site/session-room-v2/session-room-v2-live-roster.js";
let src=fs.readFileSync(file,"utf8");
const requireJs='const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");';
assert.ok(src.includes(requireJs),"Pinned browser client import must be present");
src=src.replace(requireJs,'const {createClient}=window.__mockSupabase;');
const projectId="emwlvbmnrrhxhrmlwkhs";
function el(){return {value:"",hidden:false,disabled:false,classList:{toggle(){}},textContent:"",innerHTML:"",addEventListener(type,fn){this[type]=fn;}}}
const byId=Object.fromEntries(["live-roster-button","live-campaign-select","live-roster-status"].map(s=>[s,el()]));
let writes=0,read=0,signed=0,captured=null,loaded=false,live=false,approvedCandidates=null;
const response={
 campaigns:[{id:"unrostered",name:"Inactive campaign",owner_id:"other"},{id:"camp",name:"Test campaign",owner_id:"user"}],
 campaign_members:[{campaign_id:"camp",user_id:"user",role:"player"}],
 party_room_roster:[{campaign_id:"camp",character_id:"char",added_at:"2026-01-01"}],
 characters:[{id:"char",campaign_id:"camp",owner_id:"user",name:"My Character",status:"approved",portrait_path:"char/image.png",sheet_visible_to_party:true,
   approved_build:{stats:{STR:12,DEX:14,CON:10,INT:9,WIS:16,CHA:11},className:"Shaman",maxHp:35,level:5,details:{skills:["Perception"],savingThrows:["WIS"]}}},
  {id:"outside",campaign_id:"camp",owner_id:"other",name:"Extra Approved",status:"approved",portrait_path:null,sheet_visible_to_party:true,approved_build:{stats:{STR:16,DEX:11,CON:12,INT:8,WIS:10,CHA:9},maxHp:28,level:4,className:"Fighter"}}],
 character_state:[{character_id:"char",hp:22,conditions:["Poisoned"]}]
};
class Query{
 constructor(table){this.table=table;this.conditions=[];}
 select(){return this;}
 eq(key,val){this.conditions.push([key,"eq",val]);return this;}
 in(key,arr){this.conditions.push([key,"in",arr]);return this;}
 order(){return this;}
 then(resolve,reject){
  read++;
  let data=(response[this.table]||[]).filter(row=>this.conditions.every(([key,op,val])=>
   op==="eq"?row[key]===val:val.includes(row[key])));
  return Promise.resolve({data,error:null}).then(resolve,reject);
 }
}
const fakeClient={
 auth:{async getUser(){return {data:{user:{id:"user"}},error:null}}},
 from(t){return new Query(t)},
 storage:{from(bucket){assert.equal(bucket,"terravale-character-portraits");return {
  async createSignedUrl(path,ttl){
   assert.equal(path,"char/image.png");assert.equal(ttl,900);signed++;
   return {data:{signedUrl:"/storage/v1/object/sign/terravale-character-portraits/char/image.png?token=test"},error:null};
  }
 }}}
};
const bridge={
 useRoster(payload){captured=payload;loaded=true;live=true;byId["live-roster-button"].textContent="Use Demo Roster";},
 isLive(){return live},
 switchToDemo(){live=false;},
 refreshPortraits(){},
 openExistingPicker(records){approvedCandidates=records;}
};
const doc={getElementById:id=>byId[id],addEventListener(){}};
const win={TerravaleRoomPreview:bridge,__mockSupabase:{createClient(){return fakeClient;}},addEventListener(){}};
const loc={getItem(k){return k==="sb-"+projectId+"-auth-token"?"{session}":null},setItem(){writes++}};
vm.runInNewContext(src,{window:win,document:doc,localStorage:loc,URL,setInterval(){},console,Date,Math,Set,Map,Promise}, {timeout:1000});
(async()=>{
 for(let i=0;i<15&&!loaded;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(loaded,"Signed-in user roster must auto-load");
 assert.equal(captured.actors.length,1);
 assert.equal(captured.actors[0].name,"My Character");
 assert.equal(captured.actors[0].hp,22);
 assert.equal(captured.actors[0].max,35);
 assert.equal(captured.actors[0].liveScores.scores.WIS,16);
 assert.equal(captured.ownId,"char");
 assert.equal(captured.isDm,true);
 assert.match(captured.actors[0].imageUrl,/^https:\/\/emwlvbmnrrhxhrmlwkhs\.supabase\.co\/storage\/v1\/object\/sign\//);
 assert.ok(signed>=1,"Portrait must be signed from the private bucket");
 assert.equal(writes,0,"No live data or signed URL must be saved to localStorage");
 assert.equal(byId["live-campaign-select"].value,"camp","Choose campaign with active roster by default");
 assert.ok(read>=6,"Roster must be loaded from authenticated tables");
 assert.equal(typeof win.TerravaleV2LiveCharacters?.openPicker,"function","Live approved-character picker should be exposed");
 await win.TerravaleV2LiveCharacters.openPicker();
 assert.ok(approvedCandidates&&approvedCandidates.length===2,"Picker includes approved characters outside active roster");
 assert.equal(approvedCandidates.find(a=>a.id==="outside").name,"Extra Approved");
 assert.equal(approvedCandidates.find(a=>a.id==="outside").max,28);
 assert.equal(writes,0,"Browsing existing approved characters must not modify live data or localStorage");
 console.log("Live roster regression passed: signed portrait, DM-approved character outside active roster, zero writes");
})().catch(e=>{console.error(e);process.exitCode=1;});
