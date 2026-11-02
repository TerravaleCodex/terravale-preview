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
const probe="<script id=\"cabinet-regression\">\n(function(){\n var attempts=0,timer=setInterval(function(){\n  var widget=document.querySelector(\".tv-ach-widget\");\n  if(!widget){if(++attempts>80){document.body.dataset.cabinetTest=encodeURIComponent(JSON.stringify({pass:false,reason:\"widget missing\"}));clearInterval(timer)}return}\n  clearInterval(timer);widget.click();document.querySelector('[data-tv-tab=\"achievements\"]')?.click();\n  setTimeout(function(){\n   var nav=document.querySelector(\".tv-ach-window>nav\"),modal=document.querySelector(\".tv-ach-window\"),main=document.querySelector(\".tv-ach-window>main\"),pane=document.querySelector('[data-tv-pane=\"achievements\"]'),r=nav.getBoundingClientRect();\n   var buttons=Array.from(nav.querySelectorAll(\"button:not([hidden])\"));\n   var result={\n    navHeight:Math.round(r.height),scrollHeight:nav.scrollHeight,clientHeight:nav.clientHeight,\n    mainHeight:main.clientHeight,\n    paneVisible:!!pane&&!pane.hidden,\n    reward:!!pane?.querySelector(\".tv-ach-reward\"),\n    progress:!!pane?.querySelector(\"#tv-ach-progress\"),\n    tabFits:buttons.every(function(b){var x=b.getBoundingClientRect();return x.top>=r.top-2&&x.bottom<=r.bottom+2}),\n    overflowY:getComputedStyle(nav).overflowY,\n    fits:modal.getBoundingClientRect().bottom<=innerHeight+1,\n    adLabHidden:document.querySelector(\"#tv-tab-adlab\")?.hidden===true\n   };\n   result.pass=result.navHeight>=50&&result.scrollHeight<=result.clientHeight+2&&result.mainHeight>150&&result.paneVisible&&result.reward&&result.progress&&result.tabFits&&result.overflowY===\"hidden\"&&result.fits&&result.adLabHidden;\n   document.body.dataset.cabinetTest=encodeURIComponent(JSON.stringify(result));\n  },250);\n },80);\n})();\n</script>";
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,"http://localhost");
 if(!u.pathname.startsWith(prefix)){res.writeHead(404).end();return}
 let rel=decodeURIComponent(u.pathname.slice(prefix.length));
 if(rel.includes("..")){res.writeHead(403).end();return}
 if(rel.endsWith("/"))rel+="index.html";
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{let body=fs.readFileSync(file);if(rel==="index.html"&&u.searchParams.has("cabinet-test"))body=Buffer.from(body.toString().replace("</head>",probe+"</head>"));res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"}).end(body)}
 catch{res.writeHead(404).end()}
});
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{
  for(const [w,h] of [[1370,930],[420,760]]){
   const url="http://127.0.0.1:"+server.address().port+prefix+"?cabinet-test=1";
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
