#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process");
const root=path.resolve("site"),prefix="/terravale-preview/";
const file=path.join(root,"characters/sheet-live/index.html");
const source=fs.readFileSync(file,"utf8");
if(source.includes("codex-shared-sidebar-frame"))throw Error("Embedded character sheet has a nested sidebar iframe");
if(!source.includes("html.live-embedded .sidebar"))throw Error("Live embedded sidebar-hiding CSS missing");
if(!source.includes("loadApprovedCharacter"))throw Error("Live approved-sheet renderer missing");
let chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!chrome)for(const name of ["google-chrome","chromium","chromium-browser"])try{chrome=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break}catch{}
if(!chrome)throw Error("Chromium required for embedded sheet regression");
const injected="<script>("+function(){
  window.addEventListener("load",()=>{
    setTimeout(()=>{
      const aside=document.querySelector(".sidebar"),hero=document.querySelector(".hero"),view=document.querySelector(".view");
      const report={
        liveMode:document.documentElement.classList.contains("live-embedded"),
        sidebarHidden:!!aside&&getComputedStyle(aside).display==="none",
        noDuplicateMenu:!document.querySelector(".codex-shared-sidebar-frame"),
        heroVisible:!!hero&&hero.getBoundingClientRect().width>600,
        viewVisible:!!view&&view.getBoundingClientRect().width>600,
        approvedLoader:!!document.querySelector("#page"),
        noSheetError:!document.body.textContent.includes("Character sheet could not load")
      };
      report.pass=Object.values(report).every(v=>v===true);
      document.body.dataset.embeddedSheetTest=encodeURIComponent(JSON.stringify(report));
    },350);
  });
}.toString()+")();</scr"+"ipt>";
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 let relative=decodeURIComponent(url.pathname.slice(prefix.length));
 if(relative.includes("..")){res.writeHead(403);res.end();return;}
 if(relative.endsWith("/"))relative+="index.html";
 const location=path.resolve(root,relative);
 if(!location.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{
   let data=fs.readFileSync(location);
   if(relative==="characters/sheet-live/index.html"&&url.searchParams.has("test-embedded"))
      data=Buffer.from(data.toString().replace("</body>",injected+"</body>"));
   const ext=path.extname(location);
   res.writeHead(200,{"Content-Type":({".html":"text/html;charset=utf-8",".js":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",".json":"application/json"})[ext]||"application/octet-stream"});
   res.end(data);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+server.address().port+prefix+"characters/sheet-live/?live=1&test-embedded=1";
  const output=await new Promise((resolve,reject)=>{
   const child=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=3500","--window-size=1420,900","--dump-dom",url],{stdio:["ignore","pipe","ignore"]});
   let output="";const deadline=setTimeout(()=>{child.kill();reject(Error("Sheet test browser timed out"));},35000);
   child.stdout.on("data",buf=>{output+=buf.toString();if(output.length>8*1024*1024)child.kill()});
   child.on("error",err=>{clearTimeout(deadline);reject(err)});
   child.on("close",code=>{clearTimeout(deadline);code===0?resolve(output):reject(Error("Chromium exited "+code))});
  });
  const match=output.match(/data-embedded-sheet-test="([^"]+)"/);
  if(!match)throw Error("Embedded sheet browser produced no test result");
  const report=JSON.parse(decodeURIComponent(match[1]));
  console.log("Embedded live sheet browser regression:",JSON.stringify(report));
  if(!report.pass)process.exitCode=1;
 }finally{server.close()}
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
