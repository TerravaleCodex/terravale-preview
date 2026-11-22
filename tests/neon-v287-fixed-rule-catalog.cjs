"use strict";
/* Fail closed if the published native V2.87 class tables differ from the
 * reviewed manifest. This is a narrow source-checked candidate for a future
 * server-side rules catalogue, NOT a write grant or auto-rest implementation. */
const fs=require("node:fs"),assert=require("node:assert/strict"),vm=require("node:vm");
const html=fs.readFileSync("published/veiled-codex/index.html","utf8");
const rules=JSON.parse(fs.readFileSync("site-overrides/neon-v287-fixed-resource-tables.json","utf8"));
assert.equal(rules.schema,"terravale.native-v287.fixed-resources.v1");
assert.equal(rules.auto_rest_authorised,false);
assert.deepEqual(Object.keys(rules.classes).sort(),["Bloodforger","Shaman"]);
function extractLiteral(name){
 const regex=new RegExp("const\\s+"+name+"=\\[([^\\]]+)\\];");
 const match=html.match(regex);
 assert.ok(match,"Original native table "+name+" is missing");
 const literal="["+match[1]+"]";
 // Only a fixed table of integer counts and plain {count,die} objects can be
 // evaluated; any other source syntax is rejected BEFORE sandbox evaluation.
 const stripped=literal.replaceAll("count","").replaceAll("die","").replaceAll("null","");
 assert.ok([...stripped].every(ch=>"[]{}:,0123456789 \\n\\r\\t".includes(ch)),
   "Unexpected source tokens in native progression");
 const value=vm.runInNewContext(literal,Object.create(null),{timeout:200});
 assert.equal(value.length,21,"Need explicit level-0 through level-20 entries");
 return JSON.parse(JSON.stringify(value));
}
const shaman=extractLiteral("SHEET_V220_SHAMAN");
const blood=extractLiteral("SHEET_V220_BLOOD");
for(let level=0;level<=20;level++){
 const native=shaman[level];
 const count=native===null?null:native?.count;
 const die=native===null?null:native?.die;
 assert.equal(rules.classes.Shaman.max_by_level[level],count,"Shaman count L"+level);
 assert.equal(rules.classes.Shaman.die_by_level[level],die,"Shaman die L"+level);
 assert.equal(rules.classes.Bloodforger.max_by_level[level],blood[level],"Blood Reserve L"+level);
}
assert.ok(html.includes("id:'spirit-favour'")&&html.includes("id:'blood-reserve'"));
assert.ok(html.includes("source:'Player Primer v2.0 · Shaman table'"));
assert.ok(html.includes("source:'Player Primer v2.0 · Bloodforger table'"));
function lookup(className,level,resourceId){
 if(!Number.isInteger(level)||level<1||level>20)return null;
 if(!Object.prototype.hasOwnProperty.call(rules.classes,className))return null;
 const candidate=rules.classes[className];
 if(candidate.resource_id!==resourceId)return null;
 const limit=candidate.max_by_level[level];
 if(!Number.isInteger(limit)||limit<1)return null;
 return Object.freeze({max:limit,source:candidate.source,recovery:candidate.recovery,
   autoRest:false,unit:className==="Shaman"?"d"+candidate.die_by_level[level]:"points"});
}
assert.deepEqual(lookup("Shaman",3,"spirit-favour"),{
 max:3,source:"Player Primer v2.0 · Shaman table",recovery:"manual-review",autoRest:false,unit:"d6"
});
assert.equal(lookup("Shaman",1,"spirit-favour"),null);
assert.equal(lookup("Shaman",3,"spell-slot-1"),null,"Do not invent spellcasting");
assert.equal(lookup("Cleric",3,"spell-slot-1"),null,"Cleric slot schedule has not been formally approved");
assert.equal(lookup("Bloodforger",3,"blood-reserve").max,5);
assert.equal(lookup("Bloodforger",20,"blood-reserve").max,14);
assert.equal(lookup("Bloodforger",3,"blood-reserve").autoRest,false);
assert.equal(lookup("Dvergr",3,"blood-reserve"),null);
assert.equal(lookup("shaman",3,"spirit-favour"),null,"Class names are case-sensitive");
assert.equal(lookup("Shaman",0,"spirit-favour"),null);
assert.equal(lookup("Shaman",21,"spirit-favour"),null);
const sql=fs.readFileSync("site-overrides/sql/neon_audit_fixed_resource_catalog_only.sql","utf8");
assert.ok(sql.startsWith("-- AUDIT-ONLY RULES-CATALOG FOLLOW-UP"));
for(const fragment of [
 "p_character NOT IN","name LIKE 'Neon resource audit %'",
 "r.class_name=row_data.approved_build#>>'{character,className}'",
 "r.character_level=(row_data.approved_build#>>'{character,level}')::integer",
 "r.source_revision='native-v287-v220-verified'",
 "r.recovery='manual-review'",
 "No source-verified server resource limit",
 "authz.is_member(row_data.campaign_id)",
 "authz.is_dm(row_data.campaign_id)",
 "Outdated resource revision: reload required",
 "REVOKE ALL ON terravale_internal.neon_resource_rules_audit"
])assert.ok(sql.includes(fragment),"Rules-only audit safety control missing: "+fragment);
assert.ok(!sql.includes("FROM terravale_internal.neon_resource_roundtrip_audit_limits"),
 "Do not trust old per-character fixture maximums");
assert.ok(!/GRANT UPDATE ON public\\.characters/i.test(sql));
assert.equal((sql.match(/\('native-v287-v220-verified','(?:Shaman|Bloodforger)',\d+,'(?:spirit-favour|blood-reserve)',\d+,'manual-review'\)/g)||[]).length,39,
 "Only 39 source-reviewed level/class resource limits may be installed");
console.log("PASS: exact original V2.87 fixed class tables at every level; only reviewed Shaman/Bloodforger resources can be looked up, no default or automatic recovery.");
