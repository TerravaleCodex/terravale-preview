"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("published/veiled-codex/index.html","utf8");
const manifest=JSON.parse(fs.readFileSync("site-overrides/neon-v287-spell-progression.json","utf8"));
assert.equal(manifest.schema,"terravale.native-v287.spell-progression.v1");
assert.equal(manifest.automatic_recovery_authorised,false);
assert.equal(manifest.subclass_required_for_piped_keys,true);
const at=html.indexOf('id="v234-spell-tables"');
assert.ok(at>0,"Original native V2.87 spell tables missing");
const start=html.indexOf(">",at)+1, end=html.indexOf("</script>",start);
assert.ok(start>at&&end>start&&end-start<120000);
const published=JSON.parse(html.slice(start,end));
const entries=manifest.class_schedules;
assert.deepEqual(Object.keys(entries).sort(),Object.keys(published).sort());
const expectedClasses=["Artificer","Bard","Cleric","Druid","Oracle of the Two Waters",
  "Paladin","Ranger","Sorcerer","Warlock","Wizard",
  "Fighter|Eldritch Knight","Rogue|Arcane Trickster"];
assert.deepEqual(Object.keys(entries).sort(),expectedClasses.sort());
for(const [key,entry] of Object.entries(entries)){
 const original=published[key];
 assert.equal(entry.kind,original.kind,"Kind changed: "+key);
 assert.equal(entry.source,original.source,"Original source changed: "+key);
 assert.equal(entry.derived,!!original.derived,"DM-derived flag changed: "+key);
 assert.deepEqual(entry.levels,original.levels,"Published spell progression drift: "+key);
 assert.equal(entry.requires_subclass,key.includes("|"),"Subclass requirement drift: "+key);
 assert.equal(entry.levels.length,20);
 if(entry.kind==="pact"){
  assert.equal(key,"Warlock");
  for(const row of entry.levels){
   assert.ok(Number.isInteger(row.level)&&row.level>=1&&row.level<=5);
   assert.ok(Number.isInteger(row.count)&&row.count>=1&&row.count<=4);
  }
 }else{
  for(const row of entry.levels){
   assert.ok(Array.isArray(row)&&row.every(n=>Number.isInteger(n)&&n>=0&&n<=4));
  }
 }
}
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
function verifiedSlot(className,level,resourceId){
 // Narrowly supports only explicit base-class spell/Pact schedules.
 // Any subclass or DM-reviewed slot must be confirmed by a separate
 // server-authoritative selection protocol before writes become possible.
 if(typeof className!=="string"||!Number.isInteger(level)||level<1||level>20||
    typeof resourceId!=="string"||className.includes("|")||!own(entries,className))
  return null;
 const rule=entries[className];
 if(rule.requires_subclass||rule.derived)return null;
 const row=rule.levels[level-1];
 let max=0;
 if(rule.kind==="pact"){
  if(resourceId!=="pact-slot-"+row.level) return null;
  max=row.count;
 }else{
  const match=/^spell-slot-([1-9])$/.exec(resourceId);
  if(!match)return null;
  max=row[Number(match[1])-1]||0;
 }
 if(!Number.isInteger(max)||max<1)return null;
 return {max,source:rule.source,recovery:"manual-review"};
}
assert.equal(verifiedSlot("Cleric",3,"spell-slot-1").max,4);
assert.equal(verifiedSlot("Cleric",3,"spell-slot-2").max,2);
assert.equal(verifiedSlot("Cleric",3,"spell-slot-3"),null);
assert.equal(verifiedSlot("Warlock",3,"pact-slot-2").max,2);
assert.equal(verifiedSlot("Warlock",3,"pact-slot-1"),null);
assert.equal(verifiedSlot("Warlock",3,"spell-slot-2"),null);
assert.equal(verifiedSlot("Shaman",3,"spell-slot-1"),null);
assert.equal(verifiedSlot("Fighter",3,"spell-slot-1"),null);
assert.equal(verifiedSlot("Fighter|Eldritch Knight",3,"spell-slot-1"),null);
assert.equal(verifiedSlot("Rogue|Arcane Trickster",3,"spell-slot-1"),null);
assert.equal(verifiedSlot("Wizard",1,"spell-slot-2"),null);
assert.equal(verifiedSlot("Wizard",1,"spell-slot-1").max,2);
assert.equal(verifiedSlot("Cleric",3,"spell-slot-01"),null);
assert.equal(verifiedSlot("Cleric",3,"resource:custom"),null);
console.log("PASS all 12 original V2.87 spell/Pact schedules at every level; exact base caster limits, subclass gating, no inferred recovery or pools.");
