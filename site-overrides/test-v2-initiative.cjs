#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const {pathToFileURL}=require("node:url");
const page=path.resolve("site/session-room-v2/index.html");
if(!fs.existsSync(page))throw Error("Missing V2 HTML");
let browser=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!browser){for(const cmd of ["google-chrome","chromium","chromium-browser"])try{browser=cp.execFileSync("which",[cmd],{encoding:"utf8"}).trim();break;}catch{}}
if(!browser){console.log("Initiative browser test skipped: no Chromium installed");process.exit(0);}
const check='<script>('+function(){
const data={};
try{
const $=x=>document.querySelector(x),all=x=>Array.from(document.querySelectorAll(x));
window.confirm=()=>true;
data.original=all("#queue>.actor").length;
$("#initiative-clear").click();
data.empty=all("#queue>.actor").length===0&&$("#active-combatant").textContent.includes("Awaiting combatants")&&$("#round-info").textContent.includes("No encounter");
$("#initiative-manager-open").click();
data.modal=$("#initiative-modal").open;
data.checked=all("[data-init-select]:checked").length;
$("#initiative-roll-selected").click();
let order=all("#queue>.actor .card-initiative strong").map(x=>Number(x.textContent));
data.playerRolls={length:order.length,ordered:order.every((v,i)=>i===0||order[i-1]>=v),count:all("#feed .msg.roll").length};
let remove=$("#initiative-roster-list button[data-action='initiative-toggle'][data-id='kai']");
const before=all("#queue>.actor").length;
remove?.click();
data.removal={count:all("#queue>.actor").length,works:all("#queue>.actor").length===before-1,rosterHas:!!$("#initiative-roster-list [data-init-row='kai']"),addBack:$("#initiative-roster-list button[data-action='initiative-toggle'][data-id='kai']")?.textContent==="Add"};
const val=$("#initiative-roster-list [data-init-value='goblin']");
val.value="35";
$("#initiative-roster-list button[data-action='initiative-set'][data-id='goblin']").click();
data.manual={first:$("#queue>.actor .name")?.textContent,init:$("#queue>.actor .card-initiative strong")?.textContent};
$("#initiative-clear-modal").click();
data.clearedAgain=all("#queue>.actor").length===0;
$("#initiative-modal").close();
$("#view-mode").click();
data.playerView=!$("#initiative-roll-mine").hidden;
$("#initiative-roll-mine").click();
data.playerRoll={count:all("#queue>.actor").length,name:$("#queue>.actor .name")?.textContent,init:$("#queue>.actor .card-initiative strong")?.textContent};
data.pass=data.original>=7&&data.empty&&data.modal&&data.checked===4&&data.playerRolls.length===4&&data.playerRolls.ordered&&
data.removal.works&&data.removal.rosterHas&&data.removal.addBack&&data.manual.first==="Goblin Scout"&&data.manual.init==="35"&&
data.clearedAgain&&data.playerView&&data.playerRoll.count===1&&data.playerRoll.name==="Kai"&&Number.isFinite(Number(data.playerRoll.init));
}catch(error){data.pass=false;data.error=String(error);data.stack=String(error?.stack||"").slice(0,500);}
document.body.dataset.initiativeRegression=encodeURIComponent(JSON.stringify(data));
}.toString()+')();</scr'+'ipt>';
const tmp=path.join(path.dirname(page),"test-initiative-temp.html");
try{
fs.writeFileSync(tmp,fs.readFileSync(page,"utf8").replace("</body>",check+"\n</body>"));
const out=cp.execFileSync(browser,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--virtual-time-budget=3000","--window-size=1500,1050","--dump-dom",pathToFileURL(tmp).href],{encoding:"utf8",timeout:45000,maxBuffer:10*1024*1024,stdio:["ignore","pipe","ignore"]});
const found=out.match(/data-initiative-regression="([^"]+)"/);
if(!found)throw Error("Initiative test did not report metrics");
const result=JSON.parse(decodeURIComponent(found[1]));
console.log("Initiative browser regression:",JSON.stringify(result));
if(!result.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(tmp)}catch{}}
