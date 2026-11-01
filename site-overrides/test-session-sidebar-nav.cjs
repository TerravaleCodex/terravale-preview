"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const js=fs.readFileSync("site/session-room-navigation-bridge.js","utf8");
function scenario({path,isProduction,target}){
 const handlers={};
 const destination={value:null};
 const link={href:"https://terravalecodex.github.io"+target,closest(){return this}};
 const body={dataset:{roomProduction:isProduction?"1":""}};
 const doc={body};
 const win={addEventListener(type,fn,capture){
   assert.equal(type,"click");
   assert.equal(capture,true,"Sidebar listener must run before Next.js event handling");
   handlers[type]=fn;
 }};
 const loc={href:"https://terravalecodex.github.io"+path,origin:"https://terravalecodex.github.io",
  assign(url){destination.value=url}};
 vm.runInNewContext(js,{window:win,document:doc,location:loc,URL,Set},{timeout:1000});
 assert.equal(typeof handlers.click,"function");
 const event={button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,target:link,
   preventDefault(){this.prevented=true},
   stopImmediatePropagation(){this.stopped=true}};
 handlers.click(event);
 return {url:destination.value,prevented:!!event.prevented,stopped:!!event.stopped};
}
for(const target of ["/terravale-preview/party/","/terravale-preview/session-room/"]){
 const r=scenario({path:"/terravale-preview/",target});
 assert.equal(r.url,"/terravale-preview/party/?native-room=1");
 assert.ok(r.prevented&&r.stopped,"Old app must not handle the click");
}
const onParty=scenario({path:"/terravale-preview/party/",target:"/terravale-preview/party/"});
assert.equal(onParty.url,"/terravale-preview/party/?native-room=1","An already-open old party page must refresh");
const live=scenario({path:"/terravale-preview/party/",target:"/terravale-preview/party/",isProduction:true});
assert.equal(live.url,null,"New room must not reload itself");
const other=scenario({path:"/terravale-preview/",target:"/terravale-preview/characters/"});
assert.equal(other.url,null,"Unrelated site navigation must remain unchanged");
console.log("PASS: Sidebar navigation opens the replacement document rather than the old Next page");
