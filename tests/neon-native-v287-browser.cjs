#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process"),assert=require("node:assert/strict");
const live=fs.readFileSync("published/veiled-codex/index.html","utf8");
const native=fs.readFileSync("published/neon-staging-auth/native-v287/index.html","utf8");
const staging=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
const body=fs.readFileSync("site-overrides/neon-native-v287-hydrate.js","utf8");
for(const mark of ['data-source="v287-adaptive-resources.js"','id="tv238-v14-content"','sheet20-resource-panel'])
 assert.ok(native.includes(mark),"Native copy lost V2.87 component: "+mark);
for(const mark of ['connect-src \'none\'','frame-src \'none\'','data-source="neon-native-v287-bootstrap.js"','data-source="neon-native-v287-read-client.js"','data-source="neon-native-v287-hydrate.js"'])
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
 character_state:{hp:20,temp_hp:1,blood_state:0,
 inventory:[
 {id:"empty_wand",name:"Empty Wand",kind:"item",slot:"",qty:1,description:"No charges left"},
 {id:"charged_staff",name:"Charged Staff",kind:"item",slot:"hand",qty:1,description:"Expends two charges"},
 {id:"hidden_amulet",name:"Hidden Amulet",kind:"item",slot:"",qty:1,description:"No resource card"},
 {id:"ordinary_apple",name:"Ordinary Apple",kind:"item",slot:"",qty:1,description:"Not magical"}
 ],resources:[],conditions:[],death_saves:{dead:false,stable:false,successes:0,failures:0}},
 item_properties:[
 {item_id:"empty_wand",properties:{charges:0,max_charges:3,resource_tracker:true,recovery:"short",charge_cost:1,features:"Read-only spell source"}},
 {item_id:"charged_staff",properties:{charges:2,max_charges:5,resource_tracker:true,recovery:"long",charge_cost:2,attunement:true,attuned:true,features:"Read-only magic staff"}},
 {item_id:"hidden_amulet",properties:{charges:6,max_charges:6,resource_tracker:false,recovery:"manual",charge_cost:1}},
 {item_id:"ordinary_apple",properties:{rarity:"mundane"}}
 ],
 wallet:[{denomination_id:"gp",quantity:3}],
 wallet_ledger:[{id:"transaction",denomination_id:"gp",delta:-1,note:"Sample purchase",operation:"adjust",created_at:"2026-11-01T00:00:00Z"}],
 bonus_requests:[],proficiencies:{tools:[{id:"smith",source:"Starting training"}],
   languages:[{id:"common",source:"Ancestry"}],submitted:true,pending_languages:[],dm_bonus:[]},
 training:{hidden_tools:[],hidden_languages:[],extra_tools:[],extra_languages:[],language_modes:{}},
 custom_feats:[{id:"feat-grant",feat_id:"33333333-3333-4333-8333-333333333333",
   name:"Audit Feat",summary:"Original feat description",rules:"Guard yourself",
   prerequisites:"Dvergr",rarity:"Custom",action_type:"passive",uses_per_rest:1,recovery:"long"}],
 granted_boons:[],
 canonical_awards:[{id:"44444444-4444-4444-8444-444444444444",
   kind:"divine",name:"Audited Grace",summary:"Granted test gift",
   mechanics:"Read-only granted rules",patron:"Pae",source_kind:"canonical",
   slot:"divine",max_charges:2,charges_remaining:0,uses_remaining:0,
   max_uses:2,recovery:"long"}],
 divine_effects:[{key:"divine-echo",stacks:2,note:"Audited effect"}],
 divine_previews:[{key:"pae",name:"Pae",rank:"major",hint:"Visible to all"}],
 divine_dispositions:[{key:"pae",disposition:"watchful"}],
 divine_state:{entanglement:0,divine_pressure:1,minor_intercession_remaining:0},
 divine_burdens:[{patron:"pae",name:"Sacred Burden",stacks:1,overflow_pending:false}],
 divine_fractures:[],
 divine_offers:[]}
};
const host=`<!doctype html><html><head><meta charset="utf-8"></head><body>
<iframe id="native" title="original V2.87" sandbox="allow-scripts" src="/terravale-preview/neon-staging-auth/native-v287/?audit-native-panels=1" style="width:1260px;height:960px"></iframe>
<script>
const frame=document.querySelector("#native");
const snapshot=${JSON.stringify(snapshot)};
let ready=false,loaded=false,error="",messages=0,handshake=false,originMatched=false,phases=[],diagnostic=null,panels=null,deadline=null;
const finish=(timedOut=false)=>{
 if(document.body.dataset.nativeTest)return;
 clearInterval(timer);clearTimeout(deadline);
 const pass=ready&&handshake&&originMatched&&loaded&&!error&&panels?.training===true&&panels?.feats===true&&panels?.wallet===true&&panels?.divine===true&&panels?.divineResources===true&&panels?.zeroCharges===true&&
 panels?.itemResources===true&&panels?.itemZeroCharges===true&&panels?.itemPartialCharges===true&&
 panels?.hiddenItemOmitted===true&&panels?.itemActivationBlocked===true&&panels?.adaptiveItemCatalog===true&&panels?.noInventedSpells===true;
 document.body.dataset.nativeTest=encodeURIComponent(JSON.stringify({ready,loaded,error,messages,handshake,originMatched,phases,diagnostic,panels,pass,timeout:timedOut}));
};
deadline=setTimeout(()=>finish(true),60000);
window.addEventListener("message",event=>{
 if(event.source!==frame.contentWindow||event.origin!=="null")return;
 messages++;
 if(event.data?.type==="TV_NEON_NATIVE_V287_HANDSHAKE"){handshake=true;originMatched=event.data.originMatched===true}
 if(event.data?.type==="TV_NEON_NATIVE_V287_PHASE")phases.push(event.data.phase);
 if(event.data?.type==="TV_NEON_NATIVE_V287_DIAGNOSTIC")diagnostic=event.data;
 if(event.data?.type==="TV_NEON_NATIVE_V287_PANEL_AUDIT")panels=event.data;
 if(event.data?.type==="TV_NEON_NATIVE_V287_READY"){
   ready=true;
   // The full, 7MB V2.87 page can take time to boot; start the load deadline
   // only AFTER the native iframe has actually announced its readiness.
   clearTimeout(deadline);deadline=setTimeout(()=>finish(true),55000);
   frame.contentWindow.postMessage({type:"TV_NEON_NATIVE_V287_LOAD",snapshot},"*");
 }
 if(event.data?.type==="TV_NEON_NATIVE_V287_LOADED"&&event.data?.id===snapshot.id&&event.data?.nativeSheet===true)loaded=true;
 if(event.data?.type==="TV_NEON_NATIVE_V287_ERROR")error=event.data?.reason||"error";
});
const timer=setInterval(()=>{
 const report={ready,handshake,originMatched,loaded,error,messages,phases,pass:ready&&handshake&&originMatched&&loaded&&!error};
 if(error||panels){
   finish(false);
 }
},120);

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
 const os=require("node:os");
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),"terravale-neon-v287-"));
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let browser=null,ws=null;
 try{
   const url="http://127.0.0.1:"+server.address().port+"/fixture";
   browser=cp.spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
     "--disable-background-networking","--remote-debugging-port=0","--user-data-dir="+profile,
     "--window-size=1400,950",url],{stdio:"ignore"});
   let port="";
   for(let k=0;k<100;k++){
     const marker=path.join(profile,"DevToolsActivePort");
     if(fs.existsSync(marker)){
       port=fs.readFileSync(marker,"utf8").split("\n")[0];break;
     }
     await sleep(100);
   }
   assert.ok(port,"Chromium DevTools did not start");
   let target=null;
   for(let k=0;k<100;k++){
     const rows=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
     target=rows.find(x=>x.type==="page"&&x.url.includes("/fixture"));
     if(target)break;
     await sleep(100);
   }
   assert.ok(target?.webSocketDebuggerUrl,"Native V2.87 fixture page not found");
   ws=new WebSocket(target.webSocketDebuggerUrl);
   await new Promise((resolve,reject)=>{
     ws.addEventListener("open",resolve,{once:true});
     ws.addEventListener("error",reject,{once:true});
   });
   let seq=0;const pending=new Map();
   ws.addEventListener("message",event=>{
     let item;try{item=JSON.parse(event.data)}catch{return}
     const next=pending.get(item.id);
     if(next){pending.delete(item.id);clearTimeout(next.timer);
       if(item.error)next.reject(Error(JSON.stringify(item.error)));
       else next.resolve(item.result)}
   });
   const request=(method,params={})=>new Promise((resolve,reject)=>{
     const id=++seq;
     const timer=setTimeout(()=>{pending.delete(id);reject(Error("Chrome DevTools call timed out: "+method))},7000);
     pending.set(id,{resolve,reject,timer});
     ws.send(JSON.stringify({id,method,params}));
   });
   await request("Runtime.enable");
   let report=null,progress="";
   // Real browser time, not Chromium's virtual-time fast-forward: iframe
   // postMessage handlers must have the opportunity to execute asynchronously.
   for(let n=0;n<100;n++){
     const evaluated=await request("Runtime.evaluate",{
       expression:'document.body?.dataset?.nativeTest || ""',returnByValue:true});
     const value=evaluated?.result?.value;
     if(value){report=JSON.parse(decodeURIComponent(value));break;}
     if(n%12===0){
       const state=await request("Runtime.evaluate",{
         expression:'JSON.stringify({ready,handshake,originMatched,loaded,error,messages,phases})',
         returnByValue:true});
       progress=state?.result?.value||"";
     }
     await sleep(250);
   }
   console.log("Native V2.87 staging browser report:",JSON.stringify(report||{timeout:true,progress}));
   assert.ok(report?.pass===true,"Original V2.87 did not mount the authorised synthetic character");
 }finally{
   try{ws?.close()}catch{}
   try{browser?.kill("SIGKILL")}catch{}
   fs.rmSync(profile,{recursive:true,force:true});
   server.close();
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
