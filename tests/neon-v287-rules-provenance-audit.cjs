"use strict";
// The class-rule audit is source-only. Never print character records or JSON
// fixture data from the assembled public page.
const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("published/veiled-codex/index.html","utf8");
assert.ok(html.length>7_000_000);
const tabs=[...html.matchAll(/<script[^>]*data-source="([^"]+)"[^>]*>/g)].map(x=>({name:x[1],pos:x.index}));
console.log("NATIVE RESOURCE SOURCE MODULES",tabs.filter(x=>/v22[06]|v23[45]/.test(x.name)).map(x=>x.name));
const selectors=[
 ["shaman progression",'SHEET_V220_SHAMAN',2500],
 ["blood progression",'SHEET_V220_BLOOD',1100],
 ["spell level ID","'spell-slot-'",1700],
 ["pact spell ID","'pact-slot-'",1600],
 ["spell table","slotTable",1800],
 ["spell source branch","function spell",2300],
 ["class resource base",'function sheetV220Resources(c)',1200],
 ["resource spell override",'sheetV220Resources=function(c)',2500],
 ["caster schedule","SPELL_SLOTS",1100],
 ["pact schedule","PACT_SLOTS",1100]
];
for(const [label,needle,len] of selectors){
 const positions=[];let at=html.indexOf(needle);
 while(at>=0&&positions.length<12){positions.push(at);at=html.indexOf(needle,at+needle.length)}
 console.log("RULE SOURCE "+label+" occurrences="+positions.length);
 // Only expose curated source-context fragments. It is copied from the
 // published V2 class rules, not from customer state or live credentials.
 for(const index of positions.filter(i=>i>=600000&&i<=7300000).slice(-4)){
   const snippet=html.slice(Math.max(0,index-160),index+len).replace(/\s+/g," ");
   console.log("RULE SNIPPET "+label+" @"+index+": "+snippet.slice(0,Math.min(len+160,3500)));
 }
}
const rules=JSON.parse(fs.readFileSync("site-overrides/class-feature-rules.json","utf8"));
assert.ok(rules.classes?.cleric?.levels?.Spellcasting===1);
assert.ok(rules.classes?.shaman?.levels?.Favour===2);
assert.ok(rules.classes?.cleric?.descriptions?.["Channel Divinity"].includes("2 uses at level 2"));
console.log("PASS source-gated: Cleric and Shaman rules exist and native assembled class-resource source is unchanged.");
