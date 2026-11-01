#!/usr/bin/env node
"use strict";
/* Browser integration: click the Dashboard's sidebar and confirm a document
   navigation to the published room, not the obsolete Next client route. */
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve("site"),prefix="/terravale-preview/";
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
assert(read("index.html").includes('data-tour-nav="/party"'),"Dashboard has no room link");
assert(read("party/index.html").includes('id="room-native-nav"'),"Native room not published");
const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync)
 ||["google-chrome","chromium","chromium-browser"].map(n=>{try{return cp.execFileSync("which",[n],{encoding:"utf8"}).trim()}catch{return""}}).find(Boolean);
if(!chrome)throw Error("Chromium required for routing check");
const inject='<script id="room-click-test">window.addEventListener("load",function(){setTimeout(function(){var a=document.querySelector("aside.sidebar a[data-tour-nav=\\"/party\\"]");if(a)a.click()},1500)},{once:true});</script>';
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2"};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return}
 let rel=decodeURIComponent(url.pathname.slice(prefix.length));
 if(rel.includes("..")){res.writeHead(403).end();return}
 if(rel.endsWith("/"))rel+="index.html";
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{
  let bytes=fs.readFileSync(file);
  if(rel==="index.html"&&url.searchParams.has("room-click-test"))
    bytes=Buffer.from(bytes.toString().replace("</body>",inject+"</body>"));
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"}).end(bytes);
 }catch{res.writeHead(404).end()}
});
(async()=>{
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{
  const url="http://127.0.0.1:"+server.address().port+prefix+"?room-click-test=1";
  const html=await new Promise((resolve,reject)=>{
   const p=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--disable-background-networking","--virtual-time-budget=8500","--window-size=1500,970","--dump-dom",url],{stdio:["ignore","pipe","pipe"]});
   let out="",err="";
   const timeout=setTimeout(()=>{p.kill();reject(Error("Chrome timed out"))},45000);
   p.stdout.on("data",b=>{out+=b.toString();if(out.length>10*1024*1024)p.kill()});
   p.stderr.on("data",b=>err=(err+b.toString()).slice(-1300));
   p.on("error",e=>{clearTimeout(timeout);reject(e)});
   p.on("close",code=>{clearTimeout(timeout);code===0?resolve(out):reject(Error("Chrome failed "+code+": "+err))});
  });
  const output={roomLoaded:html.includes('data-room-production="1"'),nativeSidebar:html.includes('id="room-native-nav"'),oldShell:html.includes('class="app-frame')};
  output.pass=output.roomLoaded&&output.nativeSidebar&&!output.oldShell;
  console.log("Dashboard → Session Room click-through:",JSON.stringify({...output,bytes:html.length,head:html.slice(0,1800),tail:html.slice(-550),injected:html.includes('room-click-test')}));
  if(!output.pass)throw Error("The sidebar click still opens the obsolete Next session room");
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
