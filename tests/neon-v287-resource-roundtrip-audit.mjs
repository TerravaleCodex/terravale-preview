import assert from "node:assert/strict";
import fs from "node:fs";
import {makeV287NeonReadOnlySnapshot} from "../site-overrides/neon-v287-sheet-snapshot.mjs";

// This verifies the original saved-state format and the proposed test-only
// PostgreSQL adjustment contract. NO network, SQL execution or real users.
const sql=fs.readFileSync("site-overrides/sql/neon_audit_resource_roundtrip_only.sql","utf8");
for(const match of [
 /AUDIT ONLY\. DO NOT RUN ON NEON STAGING/,
 /p_character NOT IN/,
 /name LIKE 'Neon resource audit %'/,
 /FOR UPDATE/,
 /authz\.is_member\(row_data\.campaign_id\)/,
 /authz\.is_dm\(row_data\.campaign_id\)/,
 /Outdated resource revision/,
 /USING errcode='40001'/,
 /p_remaining<0 OR p_remaining>cap/,
 /WHERE l\.character_id=p_character AND l\.resource_id=p_resource_id/,
 /'\{character,sheetV220,resources\}'/,
 /'\{character,sheetV220,resourceRevision\}'/,
 /REVOKE ALL ON FUNCTION public\.terravale_neon_audit_resource_adjust/,
 /GRANT EXECUTE ON FUNCTION public\.terravale_neon_audit_resource_adjust/
])assert.match(sql,match,"Audit-only write contract lost a safety boundary");
assert.doesNotMatch(sql,/\bGRANT\s+UPDATE\s+ON\s+public\.characters/i);
const linked={
 read_only:true,access:"owned",
 proficiencies:{tools:[],languages:[]},
 training:{extra_tools:[]},wallet_ledger:[],bonus_requests:[],
 custom_feats:[],granted_boons:[],canonical_awards:[],divine_effects:[],
 divine_previews:[],divine_dispositions:[],
 divine_state:{entanglement:0,divine_pressure:0,minor_intercession_remaining:1},
 divine_burdens:[],divine_fractures:[],divine_offers:[]
};
const campaign="22222222-2222-4222-8222-222222222222";
function sample(id,klass,usage,version){
 return {
  read_only:true,
  character:{id,name:"Synthetic resource fixture",status:"approved",campaign:"Audit",
   campaign_id:campaign,access:"owned",
   approved_build:{class:klass,level:3,character:{className:klass,level:3,
     sheetV220:{resources:usage,resourceRevision:version}}}},
  state:{hp:12,temp_hp:0,resources:[],inventory:[],conditions:[],
   death_saves:{dead:false,stable:false,successes:0,failures:0}},
  wallet:[],item_properties:[]
 };
}
const cases=[
 ["11111111-1111-4111-8111-999999999991","Cleric",{"spell-slot-1":0},
  {spell:1,klass:0}],
 ["11111111-1111-4111-8111-999999999992","Shaman",{"spirit-favour":1},
  {spell:0,klass:1}]
];
for(const [id,klass,usage,expected] of cases){
 const core=sample(id,klass,usage,1);
 const out=makeV287NeonReadOnlySnapshot(core,{...linked,character_id:id},id);
 assert.equal(out.resource_coverage.explicit_saved_usage_entries,1);
 assert.equal(out.resource_coverage.explicit_spell_usage_entries,expected.spell);
 assert.equal(out.resource_coverage.explicit_class_usage_entries,expected.klass);
 assert.deepEqual(out.resource_sources.native_v220_usage,usage);
 assert.equal(out.sources.approved_build.character.sheetV220.resourceRevision,1);
 assert.equal(out.sources.character_state.resources.length,0,
  "Native usage must not be placed in unrelated character_state.resources");
 assert.ok(Object.isFrozen(out.resource_sources.native_v220_usage));
 assert.ok(Object.isFrozen(out));
 // A full class-derived pool is NEVER stored where none was explicitly saved.
 const absent=sample(id,klass,{},0);
 const missing=makeV287NeonReadOnlySnapshot(absent,{...linked,character_id:id},id);
 assert.equal(missing.resource_coverage.has_explicit_saved_usage,false);
 assert.equal(missing.resource_coverage.explicit_saved_usage_entries,0);
 assert.deepEqual(missing.resource_sources.native_v220_usage,{});
}
console.log("PASS: synthetic Cleric 0-slot and Shaman 1-use round trips preserve original V2.87 source, revision and zero; audit-only writer remains fixture-scoped.");
