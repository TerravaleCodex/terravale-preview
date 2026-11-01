#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const {pathToFileURL}=require("node:url");
const page=path.resolve("site/session-room/index.html");
if(!fs.existsSync(page))throw Error("Live room HTML missing");
const bins=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean);
let chrome=bins.find(fs.existsSync);
if(!chrome){for(const name of ["google-chrome","chromium","chromium-browser"])try{chrome=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break}catch{}}
if(!chrome){console.log("Combat browser regression skipped: Chromium missing");process.exit(0);}
const test='<script>('+async function(){
window.addEventListener("load",async()=>{
 const report={};
 const $=id=>document.getElementById(id);
 const sleep=(ms=25)=>new Promise(resolve=>setTimeout(resolve,ms));
 const change=(el,value)=>{el.value=value;el.dispatchEvent(new Event("change",{bubbles:true}))};
 const fixture=(id,name,type,ac,hp)=>({id,name,type,ac,hp,max:hp,ownerId:id==="p1"?"user1":null,
  subtitle:type,init:12,hidden:type!=="Player",conditions:[],liveScores:{scores:{STR:16,DEX:14,CON:12,INT:10,WIS:10,CHA:9},
   saves:[],skills:[],expertise:[],proficiency:3}});
 try{
  const b=window.TerravaleRoomPreview,c=window.TerravaleCombatPanel;
  report.module=!!b&&!!c;
  report.quickChecksRemoved=!document.getElementById("roller")&&!document.querySelector(".check-shell");
  const p1=fixture("p1","Archer","Player",16,24);
  const p2=fixture("p2","Knight","Player",18,38);
  const mon=fixture("monster","Pale Warden","Monster",14,25);
  mon.hidden=false;
  const all=[p1,p2,mon];
  const queue=["p1","monster","p2"];
  let requested=[],posted=[],applied=[],rolled=[];
  window.confirm=()=>true;
  window.TerravaleLiveHooks={
   combatRoll:async(count,sides,mod)=>{
    requested.push({count,sides,mod});
    const x=rolled.shift();
    if(!x)throw Error("No prepared mocked dice");
    if(x.results.length!==count)throw Error("Incorrect count requested: "+count);
    return {results:x.results,total:x.results.reduce((a,b)=>a+b,0)+mod};
   },
   combatMessage:async(message)=>posted.push(message),
   applyCombatDamage:async(id,amount)=>{applied.push({id,amount});return {hp:25-amount,absorbed:0}}
  };
  b.useRoster({actors:all,ownId:"p1",userId:"dm",isDm:true,campaignName:"Shady Test"});
  b.applyServer({actors:all,queue,round:1,steps:0,version:1});
  await sleep();
  report.dmAttacker=$("attack-source").options.length===3&&!$("attack-source-wrap").hidden;
  change($("attack-source"),"p1");
  change($("attack-target"),"monster");
  report.autoAC=$("attack-ac").value==="14";
  change($("attack-bonus"),"5");
  rolled.push({results:[12]});
  $("attack-roll").click();await sleep(60);
  report.hit=$("attack-result").dataset.outcome==="hit"&&!$("attack-roll-damage").disabled;
  change($("attack-damage"),"1d8+3");
  rolled.push({results:[4]});
  $("attack-roll-damage").click();await sleep(65);
  report.damage=$("attack-result").textContent.includes("= 7")&&!$("attack-apply").disabled;
  $("attack-apply").click();await sleep(85);
  report.applied=applied.length===1&&applied[0].id==="monster"&&applied[0].amount===7&&$("attack-apply").disabled;
  change($("attack-target"),"p2");
  change($("attack-bonus"),"0");
  rolled.push({results:[20]});
  $("attack-roll").click();await sleep(55);
  report.critical=$("attack-result").textContent.includes("CRITICAL HIT");
  rolled.push({results:[2,6]});
  $("attack-roll-damage").click();await sleep(55);
  report.doubleDice=requested[requested.length-1].count===2&&requested[requested.length-1].sides===8;
  change($("attack-target"),"monster");
  rolled.push({results:[1]});
  $("attack-roll").click();await sleep(55);
  report.naturalOne=$("attack-result").dataset.outcome==="miss"&&$("attack-roll-damage").disabled;
  mon.ac=null;
  b.applyServer({actors:all,queue,round:1,steps:0,version:2});
  change($("attack-target"),"");
  change($("attack-target"),"monster");
  rolled.push({results:[13]});
  $("attack-roll").click();await sleep(60);
  report.unknownAC=$("attack-result").dataset.outcome==="pending"&&!$("attack-confirm-hit").hidden;
  $("attack-confirm-hit").click();await sleep();
  report.dmConfirmation=$("attack-result").dataset.outcome==="hit"&&!$("attack-roll-damage").disabled;
  b.useRoster({actors:all,ownId:"p1",userId:"user1",isDm:false,campaignName:"Shady Test"});
  b.applyServer({actors:all,queue,round:1,steps:0,version:3});
  await sleep(30);
  report.playerLocked=$("attack-source-wrap").hidden&&$("attack-source").options.length===1&&$("attack-source").value==="p1";
  report.noPlayerHPApply=$("attack-apply").hidden;
  report.chatPosted=posted.length>=4;
  report.pass=Object.entries(report).every(([k,v])=>k==="pass"||v===true);
 }catch(e){report.error=String(e);report.pass=false;}
 document.body.dataset.combatTest=encodeURIComponent(JSON.stringify(report));
});
}.toString()+')();</scr'+'ipt>';
const temp=path.join(path.dirname(page),"attack-browser-test-temp.html");
try{
 const html=fs.readFileSync(page,"utf8");
 fs.writeFileSync(temp,html.replace("</body>",test+"</body>"));
 const dom=cp.execFileSync(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--allow-file-access-from-files","--virtual-time-budget=3800","--window-size=1640,960","--dump-dom",pathToFileURL(temp).href],
  {encoding:"utf8",timeout:45000,maxBuffer:10*1024*1024,stdio:["ignore","pipe","ignore"]});
 const m=dom.match(/data-combat-test="([^"]+)"/);
 if(!m)throw Error("No browser combat report");
 const report=JSON.parse(decodeURIComponent(m[1]));
 console.log("Live combat browser regression:",JSON.stringify(report));
 if(!report.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(temp)}catch{}}
