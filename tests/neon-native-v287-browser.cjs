#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process"),assert=require("node:assert/strict");
const live=fs.readFileSync("published/veiled-codex/index.html","utf8");
const native=fs.readFileSync("published/neon-staging-auth/native-v287/index.html","utf8");
const staging=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
const body=fs.readFileSync("site-overrides/neon-native-v287-hydrate.js","utf8");
for(const mark of ['data-source="v287-adaptive-resources.js"','id="tv238-v14-content"','sheet20-resource-panel'])
 assert.ok(native.includes(mark),"Native copy lost V2.87 component: "+mark);
for(const mark of ['connect-src \'none\'','frame-src \'none\'','data-source="neon-native-v287-bootstrap.js"','data-source="neon-native-v287-hydrate.js"'])
 assert.ok(native.includes(mark),"Staging native safety control missing: "+mark);
assert.ok(!native.includes('data-source="v2-discord-auth.mjs"'));
assert.ok(!native.includes('data-source="v2-ads-atelier.mjs"'));
assert.ok(live.includes('data-source="v2-discord-auth.mjs"'),"Production live V2 not retained unchanged");
assert.match(staging,/sandbox="allow-scripts"/);
assert.doesNotMatch(staging,/sandbox="allow-scripts allow-same-origin"/);
assert.match(body,/event\.source!==window\.parent/);
assert.match(body,/if\(event\.origin!==originalOrigin\)return/);
const id="11111111-1111-4111-8111-111111111111";
const campaignId="22222222-2222-4222-8222-222222222222";
const character={name:"Neon Native Fixture",className:"Gatewarden",ancestry:"Dvergr",level:4,
 str:16,dex:12,con:14,int:10,wis:13,cha:8,ac:17,speed:25,maxHp:36,
 features:["Aegis"],spells:[],sheetV220:{resources:{}}};
const snapshot={
 schema:"terravale.neon.v287.sheet.readonly.v1",read_only:true,id,access:"owned",
 character:{id,campaign:"Fixture campaign",campaign_id:campaignId,name:character.name,status:"approved"},
 sources:{approved_build:{class:"Gatewarden",ancestry:"Dvergr",level:4,character},
 character_state:{hp:20,temp_hp:1,blood_state:0,inventory:[],resources:[],conditions:[],death_saves:{dead:false,stable:false,successes:0,failures:0}},
 item_properties:[],wallet:[],proficiencies:{tools:[],languages:[]},custom_feats:[],canonical_awards:[]}
};
const host=`<!doctype html><html><head><meta charset="utf-8"></head><body>
<iframe id="native" title="original V2.87" sandbox="allow-scripts" src="/terravale-preview/neon-staging-auth/native-v287/" style="width:1260px;height:960px"></iframe>
<script>
const frame=document.querySelector("#native");
const snapshot=${JSON.stringify(snapshot)};
let ready=false,loaded=false,error="",messages=0,handshake=false,originMatched=false;
window.addEventListener("message",event=>{
 if(event.source!==frame.contentWindow||event.origin!=="null")return;
 messages++;
 if(event.data?.type==="TV_NEON_NATIVE_V287_HANDSHAKE"){handshake=true;originMatched=event.data.originMatched===true}
 if(event.data?.type==="TV_NEON_NATIVE_V287_READY"){
   ready=true;frame.contentWindow.postMessage({type:"TV_NEON_NATIVE_V287_LOAD",snapshot},"*");
 }
 if(event.data?.type==="TV_NEON_NATIVE_V287_LOADED"&&event.data?.id===snapshot.id&&event.data?.nativeSheet===true)loaded=true;
 if(event.data?.type==="TV_NEON_NATIVE_V287_ERROR")error=event.data?.reason||"error";
});
const timer=setInterval(()=>{
 const report={ready,handshake,originMatched,loaded,error,messages,pass:ready&&handshake&&originMatched&&loaded&&!error};
 if(report.pass||error||messages>3&&loaded){
   clearInterval(timer);document.body.dataset.nativeTest=encodeURIComponent(JSON.stringify(report));
 }
},120);
setTimeout(()=>{if(!document.body.dataset.nativeTest){clearInterval(timer);
document.body.dataset.nativeTest=encodeURIComponent(JSON.stringify({ready,loaded,error,messages,handshake,originMatched,pass:false,timeout:true}))}},25000);
</script></body></html>`;
const root=path.resolve("published");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript",".json":"application/json",".css":"text/css"};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 if(url.pathname==="/fixture"){res.writeHead(200,{"Content-Type":mime[".html"]});res.end(host);return}
 if(!url.pathname.startsWith("/terravale-preview/")){res.writeHead(404);res.end();return}
 const rel=decodeURIComponent(url.pathname.slice("/terravale-preview/".length));
 if(rel.includes("..")){res.writeHead(403);res.end();return}
 const loc=path.resolve(root,rel.endsWith("/")?rel+"index.html":rel);
 if(!loc.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{"Content-Type":mime[path.extname(loc)]||"application/octet-stream"});res.end(fs.readFileSync(loc))}
 catch{res.writeHead(404);res.end()}
});
(async()=>{
 let chrome=[process.env.CHROME_BIN,"/usr/bin/chromium","/usr/bin/google-chrome","/usr/bin/chromium-browser"].filter(Boolean).find(fs.existsSync);
 if(!chrome)for(const name of ["chromium","google-chrome","chromium-browser"]){
 try{chrome=cp.execFileSync("which",[name],{encoding:"utf8"}).trim();break}catch{}
 }
 if(!chrome)throw Error("Chromium is required for native V2.87 browser validation");
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
 const url="http://127.0.0.1:"+server.address().port+"/fixture";
 const out=await new Promise((resolve,reject)=>{
  const child=cp.spawn(chrome,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--disable-background-networking","--virtual-time-budget=31000","--window-size=1380,900","--dump-dom",url],
   {stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="";
  const timer=setTimeout(()=>{child.kill();reject(Error("Native Chromium test timed out"))},45000);
  child.stdout.on("data",v=>{stdout+=v.toString();if(stdout.length>6e6)child.kill()});
  child.stderr.on("data",v=>{stderr+=v.toString();if(stderr.length>11000)stderr=stderr.slice(-11000)});
  child.on("error",e=>{clearTimeout(timer);reject(e)});
  child.on("close",code=>{clearTimeout(timer);code===0?resolve({stdout,stderr}):reject(Error("Chromium exit "+code+": "+stderr.slice(-1300)))});
 });
 const match=out.stdout.match(/data-native-test="([^"]+)"/);
 assert.ok(match,"Native V2.87 staging browser never completed the synthetic session: "+out.stderr.slice(-400));
 const report=JSON.parse(decodeURIComponent(match[1]));
 console.log("Native V2.87 staging browser report:",JSON.stringify(report));
 assert.ok(report.pass,"Real V2.87 compiled UI did not load synthetic Neon character");
 }finally{server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
