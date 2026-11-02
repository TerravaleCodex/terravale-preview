#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve("site"),prefix="/terravale-preview/",read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("codex-ads/terravale-adblocknt.css"),js=read("codex-ads/terravale-adblocknt.js"),bf=read("bloodforger-v2-live.css");
for(const marker of ['data-tv-pane="achievements"','id="tv-view-achievements"','id="tv-ach-card"','id="tv-ach-progress"','aria-valuenow','data-tv-tab="achievements"'])assert(js.includes(marker),'Achievements page missing '+marker);
for(const marker of ['grid-template-rows:auto auto minmax(0,1fr) auto','overflow-y:hidden!important','>main','tv-ach-backdrop .tv-ach-window>nav>button'])assert(css.includes(marker),'Cabinet layout missing '+marker);
for(const marker of ['.blood-tree-shell {','--bf-node:color-mix','.tree-node.dimmed','opacity:.76!important','.tree-connections path.bf2-muted','.tree-budget'])assert(bf.includes(marker),'Bloodforger contrast missing '+marker);
const adapter=read("bloodforger-v2-live.js");
assert(adapter.includes("originalFit=Boolean(fit)"),"Duplicate Fit/Centre correction missing");
const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(x=>x&&fs.existsSync(x))||
 ["google-chrome","chromium","chromium-browser"].map(x=>{try{return cp.execFileSync("which",[x],{encoding:"utf8"}).trim()}catch{return""}}).find(Boolean);
if(!chrome){console.log("PASS static contrast and Cabinet tests; Chromium unavailable");process.exit(0);}
/* The browser verifies the actual Cabinet CSS against its real structural layout,
   independent of asynchronous authentication or the parent Next.js app. */
const sample='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
 +'<style>'+css+'</style></head><body>'
 +'<div class="tv-ach-backdrop"><section class="tv-ach-window">'
 +'<header><span>✧ TERRAVALE CODEX <small>THE CABINET OF CURIOSITIES</small></span><button type="button">×</button></header>'
 +'<nav aria-label="Cabinet sections"><button>Cabinet</button><button class="selected">Achievements</button><button>Unlockables</button><button hidden>Ad Laboratory</button><button hidden>DM Controls</button></nav>'
 +'<main><div data-tv-pane="achievements"><div class="tv-eyebrow">COLLECTION / ACHIEVEMENTS</div><h1>Achievements <em>&amp; discoveries.</em></h1>'
 +'<p class="tv-small">Achievements are linked to the Codex account.</p><div class="tv-stats"><strong>0 of 1 discovered</strong><span>1 APPROVED</span></div>'
 +'<div class="tv-ach-category"><span>MISCHIEF</span><span>1 achievement</span></div><article id="tv-ach-card"><div class="tv-medal">▣</div><div><h2>Undiscovered Secret</h2><p>25 advertisements</p></div></article>'
 +'<div class="tv-progress-label">Progress: 0/25</div><div class="tv-progress-track"><i></i></div><div class="tv-ach-reward"><strong>Terravale Adblocker™</strong><p class="tv-small">An optional unlock.</p><button>View unlockable</button></div></div></main>'
 +'<footer>ALL ADVERTISEMENTS ARE FICTIONAL</footer></section></div>'
 +'<script>(function(){const nav=document.querySelector(".tv-ach-window>nav"),m=document.querySelector(".tv-ach-window>main"),modal=document.querySelector(".tv-ach-window"),r=nav.getBoundingClientRect();'
 +'const controls=[...nav.querySelectorAll("button:not([hidden])")];const data={height:Math.round(r.height),navScroll:nav.scrollHeight,navClient:nav.clientHeight,mainHeight:m.clientHeight,'
 +'tabFits:controls.every(b=>{const x=b.getBoundingClientRect();return x.top>=r.top-2&&x.bottom<=r.bottom+2}),overflowY:getComputedStyle(nav).overflowY,'
 +'modalFits:modal.getBoundingClientRect().bottom<=innerHeight+1,achievement:!!document.querySelector(".tv-ach-reward"),'
 +'tabVisible:!!document.querySelector("nav .selected")};'
 +'data.pass=data.height>=50&&data.navScroll<=data.navClient+2&&data.mainHeight>150&&data.tabFits&&data.overflowY==="hidden"&&data.modalFits&&data.achievement&&data.tabVisible;'
 +'document.body.dataset.cabinetTest=encodeURIComponent(JSON.stringify(data));})();</script></body></html>';
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,"http://localhost");
 if(!u.pathname.startsWith(prefix)){res.writeHead(404).end();return}
 let rel=decodeURIComponent(u.pathname.slice(prefix.length));
 if(rel.includes("..")){res.writeHead(403).end();return}
 if(rel.endsWith("/"))rel+="index.html";
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{let body=rel==="__cabinet-layout-test.html"?Buffer.from(sample):fs.readFileSync(file);res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"}).end(body)}
 catch{res.writeHead(404).end()}
});
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{
  for(const [w,h] of [[1370,930],[420,760]]){
   const url="http://127.0.0.1:"+server.address().port+prefix+"__cabinet-layout-test.html";
   const dom=await new Promise((resolve,reject)=>{
    const p=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=6500","--window-size="+w+","+h,"--dump-dom",url],{stdio:["ignore","pipe","pipe"]});
    let out="",err="";const timer=setTimeout(()=>{p.kill();reject(Error("Browser timeout"))},40000);
    p.stdout.on("data",b=>{out+=b.toString();if(out.length>10*1024*1024)p.kill()});
    p.stderr.on("data",b=>err=(err+b.toString()).slice(-600));
    p.on("error",e=>{clearTimeout(timer);reject(e)});
    p.on("close",code=>{clearTimeout(timer);code===0?resolve(out):reject(Error("Browser "+code+" "+err))});
   });
   const match=dom.match(/data-cabinet-test="([^"]+)"/);
   if(!match)throw Error("No Cabinet measurement at "+w+"px");
   const data=JSON.parse(decodeURIComponent(match[1]));
   console.log("Cabinet achievements "+w+"px: "+JSON.stringify(data));
   if(!data.pass)throw Error("Cabinet layout regression at "+w+"px");
  }
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
