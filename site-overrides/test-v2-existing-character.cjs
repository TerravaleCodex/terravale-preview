#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const {pathToFileURL}=require("node:url");
const file=path.resolve("site/session-room-v2/index.html");
if(!fs.existsSync(file))throw Error("Missing published V2 page");
let browser=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!browser){for(const cmd of ["google-chrome","chromium","chromium-browser"])try{browser=cp.execFileSync("which",[cmd],{encoding:"utf8"}).trim();break;}catch{}}
if(!browser){console.log("Existing-character browser regression skipped: no Chromium installed");process.exit(0);}
const injected='<script>('+function(){
const record={};
try{
 const $=q=>document.querySelector(q),all=q=>Array.from(document.querySelectorAll(q));
 window.confirm=()=>true;
 const btn=$("#existing-character-open");
 record.button=!!btn&&!btn.hidden;
 $("#initiative-clear").click();
 record.empty=all("#queue>.actor").length===0;
 btn.click();
 record.dialog=$("#existing-character-modal").open;
 record.candidates=all("#existing-character-list input[data-existing-id]").length;
 const derulo=$("#existing-character-list input[data-existing-id='derulo']");
 derulo.checked=true;
 $("#existing-character-add").click();
 record.added=all("#queue>.actor").length===1&&$("#queue>.actor .name").textContent==="Derulo";
 btn.click();
 record.alreadyDisabled=$("#existing-character-list input[data-existing-id='derulo']").disabled;
 const haruki=$("#existing-character-list input[data-existing-id='haruki']");
 haruki.checked=true;
 $("#existing-character-roll").click();
 record.rolled=all("#queue>.actor").length===2&&
  all("#queue>.actor .name").some(e=>e.textContent==="Haruki")&&
  all("#feed .msg.roll").some(e=>e.textContent.includes("Initiative"));
 btn.click();
 record.rosterStillIncludes=!!$("#existing-character-list input[data-existing-id='kai']");
 $("#existing-character-modal").close();
 $("#view-mode").click();
 record.playerCannotOpen=$("#existing-character-open").hidden;
 record.pass=record.button&&record.empty&&record.dialog&&record.candidates>=4&&record.added&&
   record.alreadyDisabled&&record.rolled&&record.rosterStillIncludes&&record.playerCannotOpen;
}catch(error){record.pass=false;record.error=String(error);}
document.body.dataset.existingRegression=encodeURIComponent(JSON.stringify(record));
}.toString()+')();</scr'+'ipt>';
const temp=path.join(path.dirname(file),"test-existing-characters-temp.html");
try{
 fs.writeFileSync(temp,fs.readFileSync(file,"utf8").replace("</body>",injected+"\n</body>"));
 const dom=cp.execFileSync(browser,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--virtual-time-budget=3200","--window-size=1500,970","--dump-dom",pathToFileURL(temp).href],{encoding:"utf8",timeout:45000,maxBuffer:9*1024*1024,stdio:["ignore","pipe","ignore"]});
 const m=dom.match(/data-existing-regression="([^"]+)"/);
 if(!m)throw Error("No existing-character browser test report");
 const result=JSON.parse(decodeURIComponent(m[1]));
 console.log("Existing character browser regression:",JSON.stringify(result));
 if(!result.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(temp)}catch{}}
