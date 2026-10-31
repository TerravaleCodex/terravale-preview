#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const {pathToFileURL}=require("node:url");
const f=path.resolve("site/session-room/index.html");
if(!fs.existsSync(f))throw Error("Missing live session page");
let browser=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!browser){for(const name of ["google-chrome","chromium","chromium-browser"])try{browser=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}}
if(!browser){console.log("Live Session browser test unavailable");process.exit(0);}
const injected="<script>("+function(){
const out={};
try{
 const $=s=>document.querySelector(s),all=s=>Array.from(document.querySelectorAll(s));
 const bridge=window.TerravaleRoomPreview;
 out.production=document.body.dataset.roomProduction==="1";
 out.empty=all("#queue>.actor").length===0&&$("#active-combatant").textContent.includes("Awaiting");
 out.noSamples=!$("#feed").textContent.includes("shadyStray");
 out.dmDockHidden=getComputedStyle($("#initiative-dm-controls")).display==="none";
 const hero={id:"11111111-1111-4111-a111-111111111111",name:"Actual Player",type:"Player",ownerId:"owner",hp:35,max:35,init:17,conditions:[],subtitle:"Lv 5 · Shaman",liveScores:{scores:{STR:12,DEX:14,CON:13,INT:9,WIS:16,CHA:10},proficiency:3,saves:[],skills:[],expertise:[]}};
 const other={id:"22222222-2222-4222-a222-222222222222",name:"Other Player",type:"Player",ownerId:"other",hp:30,max:30,init:21,conditions:[],subtitle:"Lv 5 · Fighter",liveScores:{scores:{STR:16,DEX:13,CON:13,INT:9,WIS:8,CHA:10},proficiency:3,saves:[],skills:[],expertise:[]}};
 bridge.useRoster({actors:[hero,other],ownId:hero.id,userId:"owner",isDm:false,campaignName:"Campaign"});
 bridge.applyServer({actors:[hero,other],queue:[other.id,hero.id],round:1,steps:0,version:1});
 out.notTurn=all("#active-combatant button[data-action='next']").every(b=>b.disabled);
 bridge.applyServer({actors:[hero,other],queue:[hero.id,other.id],round:1,steps:0,version:2});
 out.myTurn=all("#active-combatant button[data-action='next']").some(b=>!b.disabled);
 bridge.useRoster({actors:[hero,other],ownId:"",userId:"dm",isDm:true,campaignName:"Campaign"});
 bridge.applyServer({actors:[hero,other],queue:[other.id,hero.id],round:2,steps:1,version:3});
 out.dmDesk=$("#right-heading").textContent==="DM Desk"&&$("#my-character-content").textContent.includes("Clear queue")&&$("#my-character-content").textContent.includes("Existing character")&&$("#my-character-content").textContent.includes("Advance turn");
 out.dmCannotUsePlayerButton=all("#active-combatant button[data-action='next']").every(b=>b.disabled);
 out.queueCount=all("#queue>.actor").length;
 out.pass=out.production&&out.empty&&out.noSamples&&out.dmDockHidden&&out.notTurn&&out.myTurn&&out.dmDesk&&out.dmCannotUsePlayerButton&&out.queueCount===2;
}catch(e){out.error=String(e);out.pass=false}
document.body.dataset.liveRoomTest=encodeURIComponent(JSON.stringify(out));
}.toString()+")();</scr"+"ipt>";
const temp=path.join(path.dirname(f),"live-room-test-temp.html");
try{
fs.writeFileSync(temp,fs.readFileSync(f,"utf8").replace("</body>",injected+"\n</body>"));
const dom=cp.execFileSync(browser,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--virtual-time-budget=3000","--window-size=1570,950","--dump-dom",pathToFileURL(temp).href],{encoding:"utf8",timeout:45000,maxBuffer:10*1024*1024,stdio:["ignore","pipe","ignore"]});
const m=dom.match(/data-live-room-test="([^"]+)"/);if(!m)throw Error("No live room browser result");
const r=JSON.parse(decodeURIComponent(m[1]));console.log("Live Session Room browser regression:",JSON.stringify(r));
if(!r.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(temp)}catch{}}
