#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process");
const root=path.resolve("site"),prefix="/terravale-preview/";
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const main=read("index.html"),menu=read("shared-sidebar/index.html");
if((main.match(/data-tour-nav="/g)||[]).length<5||!menu.includes('data-tour-nav="/party"'))
 throw Error("Source Codex sidebar missing");
for(const file of ["party/index.html","party.html","session-room/index.html","session-room.html"]){
 const data=read(file);
 if(!data.includes('id="room-native-nav"')||!data.includes('room-nav-inline.css'))
  throw Error("Production Session Room does not render native navigation: "+file);
 if(data.includes("codex-shared-sidebar-frame")||data.includes('class="nav-head"'))
  throw Error("Legacy iframe or previous navigation still in production: "+file);
 if(!data.includes('id="codex-theme-before-paint"'))
  throw Error("Theme is not initialised before first paint: "+file);
}
if(!read("session-room-v2/index.html").includes('codex-shared-sidebar-frame'))
 throw Error("Isolated workshop must retain its working shared-sidebar iframe");
for(const file of ["characters/sheet-live/index.html","characters/sheet-workshop/index.html"]){
 const data=read(file);
 if(data.includes("codex-shared-sidebar-frame"))throw Error(file+" contains a nested menu");
 if(!data.includes('<aside class="sidebar"'))throw Error(file+" lost its embedded sidebar");
}
let chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
if(!chrome){for(const cmd of ["google-chrome","chromium","chromium-browser"]){try{chrome=cp.execFileSync("which",[cmd],{encoding:"utf8"}).trim();break}catch{}}}
if(!chrome){console.log("PASS structural native Session Room navigation; Chromium unavailable");process.exit(0)}
const script='<script>('+function(){
 window.addEventListener("load",()=>{
 const r={};
 try{
  const nav=document.getElementById("room-native-nav");
  const route=nav?.querySelector('[data-tour-nav="/party"]');
  const links=nav?.querySelectorAll('[data-tour-nav]')||[];
  const topbar=document.querySelector(".topbar");
  const width=nav?.getBoundingClientRect().width||0;
  const rectHeight=nav?.getBoundingClientRect().height||0;
  const font=route?parseFloat(getComputedStyle(route.querySelector(".nav-text")).fontSize):0;
  const height=route?.getBoundingClientRect().height||0;
  const rail=nav?.querySelectorAll(".sidebar-nav-section").length||0;
  r.inline=!!nav&&!document.querySelector(".codex-shared-sidebar-frame");
  r.navWidth=Math.round(width);r.navHeight=Math.round(rectHeight);
  r.topbarHeight=Math.round(topbar?.getBoundingClientRect().height||0);
  r.navLabelFont=font;r.linkHeight=Math.round(height);
  r.sections=rail;r.links=links.length;
  r.active=route?.getAttribute("aria-current")==="page"&&
   route.classList.contains("room-nav-current")&&!route.classList.contains("active");
  r.oldDashboardActive=!!nav?.querySelector('[data-tour-nav="/"].room-nav-current,[data-tour-nav="/"].active');
  r.noCombatActiveLinks=!nav?.querySelector(".nav-item.active");
  const dashboard=nav?.querySelector('[data-tour-nav="/"]');
  const campaigns=nav?.querySelector('[data-tour-nav="/campaigns"]');
  const geometry=link=>{
   if(!link)return null;
   const item=link.getBoundingClientRect();
   const icon=link.querySelector(".nav-symbol")?.getBoundingClientRect();
   const text=link.querySelector(".nav-text")?.getBoundingClientRect();
   return {height:item.height,iconOffset:icon?icon.left-item.left:NaN,
           textOffset:text?text.left-item.left:NaN};
  };
  const activeRect=geometry(route);
  r.navAlignment=[geometry(dashboard),geometry(campaigns)].every(g=>
    g&&activeRect&&Math.abs(g.iconOffset-activeRect.iconOffset)<2&&
    Math.abs(g.textOffset-activeRect.textOffset)<2&&
    Math.abs(g.height-activeRect.height)<2);
  r.activeRowGeometry=activeRect;
  r.help=!!nav?.querySelector(".sidebar-foot .sidebar-help");
  r.campaignPicker=!!nav?.querySelector("select");
  r.bridge=!!window.TerravaleRoomPreview?.useRoster;
  if(r.bridge){
   window.TerravaleRoomPreview.useRoster({actors:[],ownId:"",userId:"dm-user",isDm:true,campaignName:"Shady Test"});
   r.dmDesk=document.querySelector("#right-heading")?.textContent==="DM Desk";
   r.campaignName=document.querySelector("#live-campaign-caption")?.textContent?.includes("Shady Test");
   r.dmActions=document.querySelector("#my-character-content")?.textContent?.includes("Existing character");
  }
  const theme=document.getElementById("codex-theme-select");
  const current=document.documentElement.dataset.codexTheme;
  if(theme){theme.value="shady";theme.dispatchEvent(new Event("change",{bubbles:true}))}
  r.theme=document.documentElement.dataset.codexTheme;
  r.bodyBg=getComputedStyle(document.body).backgroundColor;
  r.sidebarBg=nav?getComputedStyle(nav).backgroundColor:"";
  if(theme){theme.value=current||"dark";theme.dispatchEvent(new Event("change",{bubbles:true}))}
  r.pass=r.inline&&r.navWidth===208&&r.navHeight>400&&r.topbarHeight===62&&
   r.navLabelFont>=11.5&&r.navLabelFont<=12.5&&r.linkHeight>=31&&r.linkHeight<=43&&
   r.sections>=4&&r.links>=10&&r.active&&!r.oldDashboardActive&&
   r.noCombatActiveLinks&&r.navAlignment&&r.help&&!r.campaignPicker&&
   r.bridge&&r.dmDesk&&r.campaignName&&r.dmActions&&
   r.theme==="shady"&&r.bodyBg==="rgb(5, 5, 6)"&&r.sidebarBg==="rgb(9, 9, 11)";
 }catch(e){r.pass=false;r.error=String(e)}
 document.body.dataset.sharedSidebarTest=encodeURIComponent(JSON.stringify(r));
 });
}.toString()+')();</scr'+'ipt>';
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,"http://localhost");
 if(!u.pathname.startsWith(prefix)){res.writeHead(404);res.end();return}
 let rel=decodeURIComponent(u.pathname.slice(prefix.length));
 if(rel.includes("..")){res.writeHead(403);res.end();return}
 if(rel.endsWith("/"))rel+="index.html";
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{
  let b=fs.readFileSync(file);
  if(rel==="party/index.html"&&u.searchParams.has("test-sidebar"))
   b=Buffer.from(b.toString().replace("</body>",script+"</body>"));
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});
  res.end(b);
 }catch{res.writeHead(404);res.end()}
});
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{
  const url="http://127.0.0.1:"+server.address().port+prefix+"party/?test-sidebar=1";
  const html=await new Promise((resolve,reject)=>{
   const p=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=5000","--window-size=1650,970","--dump-dom",url],{stdio:["ignore","pipe","ignore"]});
   let out="";const timeout=setTimeout(()=>{p.kill();reject(Error("Room browser test timed out"))},35000);
   p.stdout.on("data",x=>{out+=x.toString();if(out.length>8*1024*1024)p.kill()});
   p.on("error",e=>{clearTimeout(timeout);reject(e)});
   p.on("close",code=>{clearTimeout(timeout);code===0?resolve(out):reject(Error("Chrome exited "+code))});
  });
  const match=html.match(/data-shared-sidebar-test="([^"]+)"/);
  if(!match)throw Error("Browser did not return native room layout measurements");
  const score=JSON.parse(decodeURIComponent(match[1]));
  console.log("Native Session Room layout regression:",JSON.stringify(score));
  if(!score.pass)process.exitCode=1;
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
