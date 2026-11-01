#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process");
const root=path.resolve("site"),prefix="/terravale-preview/";
const fresh=fs.readFileSync(path.join(root,"characters/sheet-render-fixed-20261101/index.html"),"utf8");
if(fresh.includes("codex-shared-sidebar-frame"))throw Error("Restored sheet has nested sidebar");
const bundle=fs.readFileSync(path.join(root,"_next/static/chunks/1liev8wshkvix.js"),"utf8");
if(!bundle.includes("characters/sheet-render-fixed-20261101/?live=1"))throw Error("Actual compiled character viewer still references old sheet");
if(bundle.includes("characters/sheet-live/?live=1&v=0912"))throw Error("Old iframe URL remains in compiled viewer");
let chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!chrome)for(const name of ["google-chrome","chromium","chromium-browser"])try{chrome=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break}catch{}
if(!chrome)throw Error("Chromium needed to verify live character viewer");
const fixture="<!doctype html><html><head><meta charset=\"utf-8\"><script src=\"/terravale-preview/approved-sheet-iframe-bridge.js\" defer></script></head><body>\n<div id=\"main-codex\"><h1>Character Sheet</h1></div>\n<iframe id=\"viewer\" title=\"Approved character\" style=\"border:0;width:1200px;height:800px\" src=\"/terravale-preview/characters/sheet-live/?live=1&v=0912\"></iframe>\n<script>\nconst frame=document.getElementById(\"viewer\");\nconst person={id:\"00000000-0000-4000-8000-000000000001\",name:\"Seal-Maintainer Test\",className:\"Gatewarden\",\nancestry:\"Human\",level:4,maxHp:37,hp:37,ac:16,speed:30,pb:2,stats:[16,12,14,10,13,8],\nresources:[],features:[],actions:[],inventory:[],saves:[],skills:[],conditions:[],readOnly:false};\nfunction deliver(){frame.contentWindow?.postMessage({type:\"TV_SHEET_LOAD\",character:person},location.origin)}\nwindow.addEventListener(\"message\",e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type===\"TV_SHEET_READY\")deliver()});\nframe.addEventListener(\"load\",()=>setTimeout(deliver,50));\nlet attempts=0;const interval=setInterval(()=>{\n attempts++;\n try{\n const doc=frame.contentDocument;\n const info={\n  route:frame.getAttribute(\"src\").includes(\"/sheet-render-fixed-20261101/\"),\n  embedded:doc.documentElement.classList.contains(\"live-embedded\"),\n  loaded:doc.documentElement.classList.contains(\"live-loaded\"),\n  navHidden:getComputedStyle(doc.querySelector(\".sidebar\")).display===\"none\",\n  noSecondNav:!doc.querySelector(\".codex-shared-sidebar-frame\"),\n  sheetContentVisible:doc.querySelector(\".hero\")?.getBoundingClientRect().width>500,\n  characterRendered:doc.querySelector(\".hero\")?.textContent.includes(\"Seal-Maintainer Test\"),\n  noError:!doc.querySelector(\"#page\")?.innerText.includes(\"Character sheet could not load\")\n };\n info.pass=Object.values(info).every(Boolean);\n if(info.pass||attempts>=50){clearInterval(interval);document.body.dataset.viewerTest=encodeURIComponent(JSON.stringify(info))}\n }catch(e){\n if(attempts>=50){clearInterval(interval);document.body.dataset.viewerTest=encodeURIComponent(JSON.stringify({pass:false,error:String(e)}))}\n }\n},90);\n</script></body></html>";
const mime={".html":"text/html;charset=utf-8",".js":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",".json":"application/json"};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 if(url.pathname==="/parent-fixture"){res.writeHead(200,{"Content-Type":mime[".html"]});res.end(fixture);return}
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return}
 let rel=decodeURIComponent(url.pathname.slice(prefix.length));
 if(rel.includes("..")){res.writeHead(403);res.end();return}
 if(rel.endsWith("/"))rel+="index.html";
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});res.end(fs.readFileSync(file))}
 catch{res.writeHead(404);res.end()}
});
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{
  const url="http://127.0.0.1:"+server.address().port+"/parent-fixture";
  const result=await new Promise((resolve,reject)=>{
   const proc=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=6000","--window-size=1450,950","--dump-dom",url],{stdio:["ignore","pipe","ignore"]});
   let output="";const timer=setTimeout(()=>{proc.kill();reject(Error("Browser timeout"))},35000);
   proc.stdout.on("data",chunk=>{output+=chunk.toString();if(output.length>12*1024*1024)proc.kill()});
   proc.on("error",error=>{clearTimeout(timer);reject(error)});
   proc.on("close",code=>{clearTimeout(timer);code===0?resolve(output):reject(Error("Chromium exited "+code))});
  });
  const marker=result.match(/data-viewer-test="([^"]+)"/);
  if(!marker)throw Error("No iframe integration report");
  const report=JSON.parse(decodeURIComponent(marker[1]));
  console.log("Real character iframe end-to-end:",JSON.stringify(report));
  if(!report.pass)process.exitCode=1;
 }finally{server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
