#!/usr/bin/env node
"use strict";
/**
 * Synthetic fixture only. Never fetch production, users, or Neon tokens.
 * Exercises the ACTUAL restored V2 embedded sheet with Chromium instead of
 * trusting static source matches. This must remain a read-only test.
 */
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve("site-overrides");
const html=fs.readFileSync(path.join(root,"sheet-live-v091.html"),"utf8");
assert.match(html,/TV_SHEET_READY/);
assert.match(html,/TV_SHEET_LOAD/);
const fixtures=Object.freeze({
 character:{
  id:"11111111-1111-4111-8111-111111111111",name:"Neon Test Gatewarden",
  className:"Gatewarden",ancestry:"Dvergr",level:4,stats:[16,12,14,10,13,8],
  maxHp:36,hp:0,tempHp:3,ac:17,speed:25,pb:2,readOnly:true,canDM:false,
  skills:["Athletics"],saves:["STR"],features:["Shield Bearer"],conditions:[],
  inventory:[{id:"shield-1",name:"Audit Shield",qty:1,slot:"off"}],resources:[],
  deathSaves:{},portraitUrl:""
 }
});
const fixtureHtml=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Neon staging read-only original V2 renderer test</title></head><body>
<iframe id="v2" title="V2 character" src="/terravale-preview/characters/sheet-render-fixed-20261101/?live=1" style="width:1300px;height:1000px"></iframe>
<script>
const f=document.getElementById('v2');
const payload=${JSON.stringify(fixtures.character)};
let ready=0, writes=0, renders=0,done=false, reason='';
window.addEventListener('message',event=>{
 if(event.source!==f.contentWindow||event.origin!==location.origin)return;
 const type=event.data?.type;
 if(type==='TV_SHEET_READY'){ready++;f.contentWindow.postMessage({type:'TV_SHEET_LOAD',character:payload},location.origin);}
 if(type==='TV_SHEET_PATCH'||type==='TV_SHEET_REST'||type==='TV_SHEET_ABILITY')writes++;
 if(type==='TV_SHEET_LOAD_ERROR')reason='renderer reported load error';
});
let attempts=0;
const check=setInterval(()=>{
 attempts++;
 let report={ready:ready>0,writes,attempts,reason};
 try{
  const doc=f.contentDocument;
  report.embedded=doc.documentElement.classList.contains('live-embedded');
  report.loaded=doc.documentElement.classList.contains('live-loaded');
  report.name=doc.querySelector('.hero')?.textContent.includes('Neon Test Gatewarden')===true;
  report.characterClass=doc.querySelector('.hero')?.textContent.includes('Gatewarden')===true;
  report.characterAncestry=doc.querySelector('.hero')?.textContent.includes('Dvergr')===true;
  report.noSecondSidebar=!!doc.querySelector('.hero')&&!doc.querySelector('.codex-shared-sidebar-frame');
  report.noError=!doc.querySelector('#page')?.textContent.includes('Character sheet could not load');
  report.disabledEditableFields=[...doc.querySelectorAll('#page input,#page textarea,#page select')].every(el=>el.disabled);
  if(report.loaded&&report.name&&report.characterClass&&report.characterAncestry&&report.noSecondSidebar&&report.noError&&report.disabledEditableFields){
   renders++;
   if(renders===1){
    // Read-only controls must never tell the parent to persist gameplay actions.
    const buttons=[...doc.querySelectorAll('button')];
    const action=buttons.find(x=>x.matches('[data-live-action]'))||buttons.find(x=>x.matches('[data-rest]'));
    if(action)action.click();
   }
  }
  report.pass=report.ready&&report.embedded&&report.loaded&&report.name&&report.characterClass&&report.characterAncestry&&report.noSecondSidebar&&report.noError&&report.disabledEditableFields&&writes===0&&renders>=3;
 }catch(error){report.error=String(error)}
 if(report.pass||attempts>=65){
   clearInterval(check);
   document.body.dataset.v2Result=encodeURIComponent(JSON.stringify(report));
 }
},130);
</script></body></html>`;
const prefix="/terravale-preview/characters/sheet-render-fixed-20261101/";
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 if(url.pathname==="/fixture"){res.writeHead(200,{"Content-Type":mime[".html"],"Cache-Control":"no-store"});res.end(fixtureHtml);return}
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return}
 let file=url.pathname.slice(prefix.length);
 if(!file||file==="index.html")file="sheet-live-v091.html";
 if(file==="class-feature-rules.json"){res.writeHead(200,{"Content-Type":mime[".json"]});res.end('{"classes":{}}');return}
 if(!/^[a-zA-Z0-9_.-]+$/.test(file)||file===".."||file.startsWith(".")){res.writeHead(403);res.end();return}
 const location=path.resolve(root,file);
 if(!location.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{"Content-Type":mime[path.extname(location)]||"application/octet-stream"});res.end(fs.readFileSync(location))}
 catch{res.writeHead(404);res.end()}
});
(async()=>{
 const candidates=[process.env.CHROME_BIN,"/usr/bin/chromium","/usr/bin/google-chrome","/usr/bin/chromium-browser"]
  .filter(Boolean);
 let chrome=candidates.find(fs.existsSync);
 if(!chrome)for(const name of ["chromium","google-chrome","chromium-browser"]){
  try{chrome=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break}catch{}
 }
 if(!chrome)throw Error("Chromium is required: original V2 must be browser-tested");
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+server.address().port+"/fixture";
  const output=await new Promise((resolve,reject)=>{
   const process=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--disable-background-networking","--virtual-time-budget=10000","--window-size=1480,980","--dump-dom",url],
    {stdio:["ignore","pipe","pipe"]});
   let dom="",stderr="";const timer=setTimeout(()=>{process.kill();reject(Error("Browser test timed out"))},35000);
   process.stdout.on("data",chunk=>{dom+=chunk;if(dom.length>12*1024*1024)process.kill()});
   process.stderr.on("data",chunk=>{stderr+=chunk;if(stderr.length>8000)stderr=stderr.slice(-8000)});
   process.on("error",e=>{clearTimeout(timer);reject(e)});
   process.on("close",code=>{clearTimeout(timer);code===0?resolve(dom):reject(Error("Chromium exited "+code+": "+stderr.slice(-400)))});
  });
  const marker=output.match(/data-v2-result="([^"]+)"/);
  assert.ok(marker,"Existing V2 renderer did not report a browser result");
  const report=JSON.parse(decodeURIComponent(marker[1]));
  console.log("Original V2 embedded read-only browser smoke:",JSON.stringify(report));
  assert.equal(report.pass,true,"Original V2 renderer failed a read-only browser check");
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
