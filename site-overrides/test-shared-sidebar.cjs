#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process");
const root=path.resolve("site"),prefix="/terravale-preview/";
let chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!chrome){for(const name of ["google-chrome","chromium","chromium-browser"]){try{chrome=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break}catch{}}}
const main=fs.readFileSync(path.join(root,"index.html"),"utf8");
const menu=fs.readFileSync(path.join(root,"shared-sidebar/index.html"),"utf8");
const expected=(main.match(/data-tour-nav="/g)||[]).length;
if(expected<5||!menu.includes('data-tour-nav="/party"'))throw Error("Shared sidebar missing real Codex links");
const pages=["party/index.html","session-room/index.html","session-room-v2/index.html","characters/sheet-live/index.html","characters/sheet-workshop/index.html"];
for(const file of pages){
 const data=fs.readFileSync(path.join(root,file),"utf8");
 if(!data.includes('class="codex-shared-sidebar-frame"'))throw Error(file+" still has separate sidebar");
 if(!data.includes(prefix+"shared-sidebar/?current="))throw Error(file+" not loading shared navigation");
}
if(!chrome){console.log("PASS: shared sidebar structure checks, browser unavailable");process.exit(0);}
const inject="<script>("+function(){
window.addEventListener("load",function(){
 const iframe=document.querySelector("iframe.codex-shared-sidebar-frame");
 const record={found:!!iframe};
 try{
  const doc=iframe?.contentDocument;
  const aside=doc?.querySelector("aside");
  const nav=doc?.querySelectorAll('[data-tour-nav]');
  const active=doc?.querySelector('[data-tour-nav="/party"]');
  const r=iframe?.getBoundingClientRect();
  record.links=nav?.length||0;
  record.current=active?.getAttribute("aria-current");
  record.height=Math.round(r?.height||0);
  record.width=Math.round(r?.width||0);
  record.sidebarHeight=Math.round(aside?.getBoundingClientRect().height||0);
  record.mainHref=active?.getAttribute("href");
  record.sameStylesheets=doc?.querySelectorAll("link[rel=stylesheet]").length||0;
  record.pass=record.found&&record.links>=5&&record.current==="page"&&record.height>400&&record.width>=100&&
    record.sidebarHeight>400&&record.sameStylesheets>=1&&record.mainHref?.includes("/party/");
 }catch(e){record.error=String(e);record.pass=false;}
 document.body.dataset.sharedSidebarTest=encodeURIComponent(JSON.stringify(record));
});
}.toString()+")();</scr"+"ipt>";
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png"};
const server=http.createServer((req,res)=>{
 let url=new URL(req.url,"http://localhost");
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return}
 let rel=decodeURIComponent(url.pathname.slice(prefix.length));
 if(rel.includes("..")){res.writeHead(403);res.end();return}
 if(rel.endsWith("/"))rel+="index.html";
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{
  let data=fs.readFileSync(file);
  if(rel==="party/index.html"&&url.searchParams.has("test-sidebar")){
   data=Buffer.from(data.toString().replace("</body>",inject+"</body>"));
  }
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});
  res.end(data);
 }catch{res.writeHead(404);res.end()}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const addr=server.address();
  const url="http://127.0.0.1:"+addr.port+prefix+"party/?test-sidebar=1";
  const result=await new Promise((resolve,reject)=>{
   const p=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=5000","--window-size=1650,970","--dump-dom",url],
    {stdio:["ignore","pipe","ignore"]});
   let out="";const kill=setTimeout(()=>{p.kill();reject(Error("Chromium sidebar test timed out"))},35000);
   p.stdout.on("data",chunk=>{out+=chunk.toString();if(out.length>8*1024*1024)p.kill()});
   p.on("error",err=>{clearTimeout(kill);reject(err)});
   p.on("close",code=>{clearTimeout(kill);code===0?resolve(out):reject(Error("Chromium exited "+code))});
  });
  const m=result.match(/data-shared-sidebar-test="([^"]+)"/);
  if(!m)throw Error("Browser returned no sidebar measurement");
  const score=JSON.parse(decodeURIComponent(m[1]));
  console.log("Shared sidebar browser regression:",JSON.stringify(score));
  if(!score.pass)process.exitCode=1;
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
