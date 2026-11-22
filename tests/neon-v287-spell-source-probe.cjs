"use strict";
/* Public-source-only probe of the original assembled Terravale V2.87 spell
   progression definitions. Never reads personal character data or secrets. */
const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("published/veiled-codex/index.html","utf8");
assert.ok(html.length>7_000_000&&html.includes('data-source="v287-adaptive-resources.js"'));
const markers=[
 "const SPELLS=","const SPELLS =","const SOURCES=","const FULL=",
 "function currentMagic(c)","function spellRows(c)",
 "function spellRows","const fullCaster=",
 "const magicSources=","SPELLS={","'Eldritch Knight'",
 "'Arcane Trickster'","function spellTable",
 "terravale_save_character_sheet","function saveChanges("
];
for(const needle of markers){
 const indexes=[];let at=html.indexOf(needle);
 while(at>=0&&indexes.length<16){indexes.push(at);at=html.indexOf(needle,at+needle.length);}
 console.log("SPELL PROBE "+needle+" count="+indexes.length);
 // Only the V2.34 spell-resource logic and the V2.46 save bridge.
 for(const index of indexes.filter(i=>i>6000000&&i<7850000).slice(0,5)){
 const snippet=html.slice(index,index+7500).replace(/\s+/g," ");
 console.log("SPELL SOURCE "+needle+" at "+index+" = "+snippet.slice(0,7500));
 }
}
const el=html.match(/<script[^>]*id=["']v234-spell-tables["'][^>]*>([\\s\\S]*?)<\\/script>/);
assert.ok(el,"Original V2.34 spell tables not embedded in assembled V2.87");
const published=JSON.parse(el[1]);
console.log("SPELL TABLE KEYS",Object.keys(published));
for(const [name,entry] of Object.entries(published)){
 console.log("SPELL TABLE "+name+" "+JSON.stringify({
   kind:entry.kind,source:entry.source,derived:!!entry.derived,
   levels:Array.isArray(entry.levels)?entry.levels:null
 }).slice(0,5200));
}
console.log("PASS original V2.87 spell and save source inspected");
