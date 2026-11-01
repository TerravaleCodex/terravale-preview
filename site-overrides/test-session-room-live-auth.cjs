#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const file="site/session-room/session-room-live.js";
let code=fs.readFileSync(file,"utf8");
const entry='const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");';
assert.ok(code.includes(entry),"Production room must load a pinned Supabase browser client");
code=code.replace(entry,'const {createClient}=window.__fakeCreateClient;');
let config=null,registered=null,bridgeState=null,pickerRows=null,roomSnapshot=null,upserts=0,rolls=0,endTurns=0,authRequests=0,loaded=0,forcedReads=0,errors=[];
const els={};
function element(){return {hidden:false,disabled:false,value:"",innerHTML:"",textContent:"",dataset:{},
 classList:{toggle(){},add(){},remove(){}},addEventListener(t,fn){this[t]=fn;}};}
for(const id of ["live-roster-button","live-campaign-select","live-roster-status"])els[id]=element();
const rows={
 campaigns:[{id:"camp",name:"Shady Test",owner_id:"dm"}],
 campaign_members:[{campaign_id:"camp",role:"dm",user_id:"dm"}],
 party_room_roster:[{campaign_id:"camp",character_id:"derulo",added_at:"2026-10-01"}],
 characters:[
 {id:"derulo",campaign_id:"camp",owner_id:"player",name:"Derulo",status:"approved",portrait_path:"",
  approved_build:{level:8,className:"Shaman",maxHp:90,stats:{STR:15,DEX:8,CON:10,INT:12,WIS:13,CHA:14}}},
 {id:"kai",campaign_id:"camp",owner_id:"other",name:"Kai",status:"approved",portrait_path:"",
  approved_build:{level:5,className:"Fighter",maxHp:42,stats:{STR:16,DEX:14,CON:14,INT:12,WIS:10,CHA:8}}}
 ],
 character_state:[{character_id:"derulo",hp:90,conditions:[]},{character_id:"kai",hp:42,conditions:[]}],
 session_messages:[],dice_rolls:[]
};
class Query{
 constructor(table){this.table=table;this.terms=[];this.writes=false;}
 select(){return this}
 eq(key,value){this.terms.push([key,"eq",value]);return this}
 in(key,values){this.terms.push([key,"in",values]);return this}
 order(){return this}
 limit(){return this}
 update(obj){this.writes=true;this.data=obj;return this}
 then(resolve,reject){
  if(this.writes){upserts++;return Promise.resolve({data:[],error:null}).then(resolve,reject);}
  forcedReads++;
  let results=(rows[this.table]||[]).filter(x=>this.terms.every(([k,op,v])=>op==="eq"?x[k]===v:v.includes(x[k])));
  return Promise.resolve({data:results,error:null}).then(resolve,reject);
 }
}
const backend={
 auth:{async getUser(){authRequests++;return {data:{user:{id:"dm"}},error:null}}},
 from(table){return new Query(table)},
 storage:{from(){return {async createSignedUrl(){return {data:null,error:{message:"no image"}}}}}},
 async rpc(fn,args){
   if(fn==="session_room_get")return {data:roomSnapshot||{actors:[],queue:[],round:1,steps:0,version:0},error:null};
   if(fn==="session_room_manage"){upserts++;roomSnapshot={actors:args.new_actors,queue:args.new_queue,round:args.new_round,steps:args.new_steps,version:args.expected_version+1};return {data:roomSnapshot.version,error:null};}
   if(fn==="session_room_advance"){endTurns++;return {data:2,error:null};}
   if(fn==="session_room_roll_own"){rolls++;return {data:{die:12,total:11,modifier:-1},error:null};}
   if(fn==="send_session_message"||fn==="roll_campaign_dice")return {data:null,error:null};
   return {data:null,error:{message:"Unknown RPC "+fn}};
 }
};
const liveBridge={
 isLive(){return true},
 useRoster(p){registered=p;loaded++;bridgeState={...p,actors:p.actors,queue:[],round:1,steps:0};},
 applyServer(p){bridgeState={...bridgeState,actors:p.actors.length?p.actors:bridgeState.actors,queue:p.queue,round:p.round,steps:p.steps,version:p.version};},
 readState(){return bridgeState},
 getCurrent(){return bridgeState.actors.find(x=>x.id===bridgeState.queue[0]);},
 applyMessages(){},
 refreshPortraits(){},
 openExistingPicker(p){pickerRows=p}
};
const createClient=(url,key,settings)=>{config=settings;return backend;};
const d={getElementById:id=>els[id],hidden:false,addEventListener(){},body:{dataset:{}}};
const w={TerravaleRoomPreview:liveBridge,__fakeCreateClient:{createClient},addEventListener(){}};
const local={getItem(k){return k==="supabase.auth.token"?"{\"access_token\":\"fixture\"}":null}};
vm.runInNewContext(code,{window:w,document:d,localStorage:local,URL,Date,Math,Promise,setInterval(){},console}, {timeout:1500});
(async()=>{
 for(let i=0;i<50&&!loaded;i++)await new Promise(r=>setImmediate(r));
 assert.equal(loaded,1,"Authenticated campaign roster should load automatically");
 assert.equal(config.auth.storageKey,"supabase.auth.token","Must share compiled main Codex authentication storage");
 assert.equal(registered.isDm,true,"The campaign owner must get the DM Desk");
 assert.equal(registered.campaignName,"Shady Test");
 assert.equal(registered.userId,"dm");
 assert.equal(registered.actors.length,1);
 assert.equal(registered.actors[0].name,"Derulo");
 assert.equal(registered.actors[0].hp,90);
 assert.equal(els["live-campaign-select"].value,"camp");
 assert.ok(forcedReads>=6);
 assert.equal(typeof w.TerravaleV2LiveCharacters?.openPicker,"function");
 await w.TerravaleV2LiveCharacters.openPicker();
 assert.equal(pickerRows.length,2,"The picker must include approved characters not already rostered");
 assert.ok(pickerRows.some(p=>p.name==="Kai"));
 assert.equal(typeof w.TerravaleLiveHooks?.persistState,"function");
 const state={...bridgeState,actors:pickerRows,queue:["derulo","kai"],round:1,steps:0};
 w.TerravaleLiveHooks.persistState(state);
 for(let i=0;i<12&&!upserts;i++)await new Promise(r=>setImmediate(r));
 assert.ok(upserts>0,"DM initiative selections must persist to server");
 assert.deepEqual(Array.from(roomSnapshot.queue),["derulo","kai"]);
 assert.equal(roomSnapshot.actors[0].name,"Derulo");
 assert.equal(authRequests,2,"Campaign and picker must verify current logged-in user");
 console.log("PASS Live room signed-in DM: campaign, full approved-character picker, RLS-backed queued encounter, session storage");
})().catch(e=>{console.error(e);process.exitCode=1});
