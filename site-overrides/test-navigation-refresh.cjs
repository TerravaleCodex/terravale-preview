#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process");
const root=path.resolve("site");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const js=read("navigation-refresh.js"),css=read("navigation-refresh.css");
for(const marker of ['GROUP_KEY','Library & Notes','Dungeon Master','Help & Tutorial','avatarUrl()','terravale-help=1','nav:not(.terr-nav)','new MutationObserver']){
 if(!js.includes(marker))throw Error("Missing nav functionality: "+marker);
}
for(const marker of ['.terr-nav-search','.terr-nav-section-links[hidden]','.terr-nav-footer','.terr-account-avatar','.sidebar-is-collapsed','max-width:760px','site-theme-quick']){
 if(!css.includes(marker))throw Error("Missing styles: "+marker);
}
for(const file of ["index.html","campaigns/index.html","shared-sidebar/index.html","party/index.html"]){
 const html=read(file);
 if(!html.includes("navigation-refresh.css?v=20261101-nav1")||!html.includes("navigation-refresh.js?v=20261101-nav1"))
  throw Error("Missing global navigation assets on "+file);
}
if(read("characters/sheet-live/index.html").includes("codex-shared-sidebar-frame"))
 throw Error("Embedded sheet wrongly contains a shared sidebar");
console.log("PASS: navigation structure and published route linkage");
let chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!chrome){console.log("Browser unavailable; source and static checks passed");process.exit(0);}
const prefix="/terravale-preview/";
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://localhost");
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return}
 let name=decodeURIComponent(url.pathname.slice(prefix.length));
 if(name.includes("..")){res.writeHead(403);res.end();return}
 if(name.endsWith("/"))name+="index.html";
 const file=path.resolve(root,name);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});res.end(fs.readFileSync(file))}
 catch{res.writeHead(404);res.end()}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+server.address().port+prefix+"shared-sidebar/?current=party";
  const body=await new Promise((resolve,reject)=>{
   const p=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=5500","--window-size=1300,900","--dump-dom",url],{stdio:["ignore","pipe","ignore"]});
   let out="";const timeout=setTimeout(()=>{p.kill();reject(new Error("Navigation browser test timed out"))},35000);
   p.stdout.on("data",c=>{out+=c.toString();if(out.length>8*1024*1024)p.kill()});
   p.on("error",e=>{clearTimeout(timeout);reject(e)});
   p.on("close",code=>{clearTimeout(timeout);code===0?resolve(out):reject(new Error("Browser exited "+code))});
  });
  for(const marker of ['class="terr-nav"','data-section="workspace"','data-section="characters"','data-section="library"','data-section="settings"','class="terr-nav-footer"','Help &amp; Tutorial','terr-nav-search']){
   if(!body.includes(marker))throw Error("Browser did not render "+marker);
  }
  if(!body.includes('data-sidebar-current="true"'))throw Error("Session Room selection was lost");
  console.log("PASS: Chromium rendered shared sidebar groups, search, footer help and active Session Room route");
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
