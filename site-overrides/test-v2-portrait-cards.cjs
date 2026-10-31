#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const {pathToFileURL}=require("node:url");
const file=path.resolve("site/session-room-v2/index.html");
if(!fs.existsSync(file))throw Error("Missing deployed V2 page");
let browser=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!browser){for(const cmd of ["google-chrome","chromium","chromium-browser"])try{browser=cp.execFileSync("which",[cmd],{encoding:"utf8"}).trim();break;}catch{}}
if(!browser){console.log("Card layout browser check skipped: no Chromium installed");process.exit(0);}
const original=fs.readFileSync(file,"utf8");
const check="<script>("+function(){
try{
const all=s=>Array.from(document.querySelectorAll(s)),sel=s=>document.querySelector(s),rect=e=>e.getBoundingClientRect();
const cards=all("#queue>.actor"),card=cards[0],portrait=card?.querySelector(".portrait"),name=card?.querySelector(".name"),ini=card?.querySelector(".card-initiative");
const conditions=card?.querySelector(".card-conditions"),crest=card?.querySelector(".codex-missing-portrait");
const cardBox=card&&rect(card),photoBox=portrait&&rect(portrait),nameBox=name&&rect(name),initiativeBox=ini&&rect(ini);
const before=rect(sel("#active-combatant")).height;
const toggle=sel("[data-action='active-collapse']");
toggle?.click();
const collapsed=rect(sel("#active-combatant")).height;
const hidden=sel("#active-expanded-content")?.hidden===true;
const prev=sel("#queue>.actor .name")?.textContent;
sel("#next-turn")?.click();
const next=sel("#queue>.actor .name")?.textContent;
const persists=sel("#active-combatant").classList.contains("is-collapsed");
sel("[data-action='active-collapse']")?.click();
const expanded=rect(sel("#active-combatant")).height;
const score={cards:cards.length,cardWidth:cardBox?.width,cardHeight:cardBox?.height,photoWidth:photoBox?.width,photoHeight:photoBox?.height,
nameY:nameBox?.top,initiativeY:initiativeBox?.top,crest:!!crest,portraitText:portrait?.textContent,
before,collapsed,hidden,afterRotation:next,persists,expanded,conditions:!!conditions};
const pass=cards.length>=7&&cardBox.height>cardBox.width*1.75&&photoBox.height>=photoBox.width*.85&&initiativeBox.top>=nameBox.bottom-1&&
!!crest&&portrait.textContent.trim()===""&&before>150&&collapsed<90&&collapsed<before*.45&&hidden&&prev!==next&&persists&&expanded>150&&!!conditions;
document.body.dataset.cardRegression=encodeURIComponent(JSON.stringify({pass,...score}));
}catch(e){document.body.dataset.cardRegression=encodeURIComponent(JSON.stringify({pass:false,error:String(e)}));}
}.toString()+")();</scr"+"ipt>";
const t=path.join(path.dirname(file),"v2-cards-regression-temp.html");
try{
fs.writeFileSync(t,original.replace("</body>",check+"\n</body>"));
const dom=cp.execFileSync(browser,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--virtual-time-budget=3000","--window-size=1600,900","--dump-dom",pathToFileURL(t).href],{encoding:"utf8",timeout:45000,stdio:["ignore","pipe","ignore"],maxBuffer:8*1024*1024});
const match=dom.match(/data-card-regression="([^"]+)"/);
if(!match)throw Error("Browser did not return card metrics");
let result=JSON.parse(decodeURIComponent(match[1]));
console.log("Portrait cards / collapse regression:",JSON.stringify(result));
if(!result.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(t)}catch{}}
