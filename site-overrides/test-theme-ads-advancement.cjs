#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(path.join("site",p),"utf8");
const sheet=read("characters/sheet-live/index.html");
const fixed=read("characters/sheet-render-fixed-20261101/index.html");
const editor=read("characters/advancement/index.html");
const style=read("bloodforger-v2-live.css");
const ads=read("codex-ads/terravale-adblocknt.js");
const classes=read("classes/bloodforger/trees/index.html");
for(const [name,text] of [["live",sheet],["viewer iframe",fixed]]){
 assert(text.includes("characters/advancement/?id="),name+": no link to functional advancement");
 assert(text.includes("target=\"_top\""),name+": advancement would open in embedded frame");
 assert(text.includes("Current approved level"),name+": prototype milestone text still in place");
 assert(text.includes("LIVE.readOnly"),name+": no viewer permission check");
}
assert(editor.includes("Character unavailable")||editor.includes("advancement"),"Advancement route failed to export");
assert(editor.includes("_next/static/"),"Advancement route not compiled as part of main Next app");
for(const needle of ["--bf-surface:var(--panel","--bf-paper:var(--panel2",
 ".tree-node.selected",".tree-node.focused",".tree-inspector h3",
 ".tree-connections path.bf2-route",'.tree-stage','color-mix']){
 assert(style.includes(needle),"Bloodforger theme is missing "+needle);
}
assert(classes.includes("bloodforger-v2-live.js"),"theme-aware Bloodforger adapter not installed in atlas");
for(const needle of ["labButton.hidden=!isDM","if((which==='dm'||which==='adlab')&&!isDM)",
 "function populateGallery()","if(!isDM||!box||galleryPopulated)return","id=\"tv-tab-adlab\" hidden"]){
 assert(ads.includes(needle),"Ad Lab DM gate missing: "+needle);
}
assert(!ads.includes("const gallery=$('#tv-gallery');for(const a of ads){") || ads.includes("function populateGallery()"),"Ad gallery eagerly loaded for everyone");
assert(JSON.parse(read("codex-ads/ads.json")).length===56,"player ads unintentionally removed");
console.log("PASS: themed Bloodforger nodes, DM-only Ad Laboratory UI, fully functional Advancement route + live-sheet links");
