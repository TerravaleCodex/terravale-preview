import assert from "node:assert/strict";
import fs from "node:fs";
import {makeV287NeonReadOnlySnapshot} from "../site-overrides/neon-v287-sheet-snapshot.mjs";
const id="11111111-1111-4111-8111-111111111111";
const build={class:"Cleric",level:5,character:{className:"Cleric",level:5,
  sheetV220:{resources:{"spell-slot-1":0,"class-use:cleric:channel-divinity":1}},spells:[{name:"Light"}],features:["Feature A"]}};
const core={read_only:true,character:{id,name:"Sample",campaign:"Frostvale",campaign_id:"22222222-2222-4222-8222-222222222222",status:"approved",access:"owned",approved_build:build},
 state:{hp:5,temp_hp:0,resources:[],conditions:[],inventory:[{name:"Sword"}],death_saves:{dead:false,stable:false,successes:0,failures:0}},
 wallet:[{denomination_id:"cp",quantity:12}],
 item_properties:[
  {item_id:"one",properties:{charges:0,max_charges:3}},
  {item_id:"two",properties:{attuned:true}}
 ]};
const extras={read_only:true,character_id:id,access:"owned",
 proficiencies:{tools:["Forge"],languages:["Common"]},training:{extra_tools:[]},
 wallet_ledger:[{id:"row",denomination_id:"cp",delta:-1,note:"Trade",operation:"withdraw",created_at:"2026-01-01"}],
 bonus_requests:[],
 custom_feats:[{id:"feat",name:"Magical Talent"}],granted_boons:[],
 canonical_awards:[{id:"divine",name:"Grace",uses_remaining:0,max_uses:2,recovery:"long"}],
 divine_effects:[],divine_previews:[{key:"pae",name:"Pae",rank:"major",hint:"A public hint"}],
 divine_dispositions:[{key:"pae",disposition:"watchful"}],
 divine_state:{entanglement:0,divine_pressure:0,minor_intercession_remaining:1},
 divine_burdens:[],divine_fractures:[],divine_offers:[]};
const out=makeV287NeonReadOnlySnapshot(core,extras,id);
assert.equal(out.read_only,true);
assert.equal(out.schema,"terravale.neon.v287.sheet.readonly.v1");
assert.equal(out.sources.character_state.hp,5);
assert.equal(out.character.campaign_id,"22222222-2222-4222-8222-222222222222");
assert.equal(out.sources.item_properties[0].properties.charges,0);
assert.equal(out.resource_sources.item_charge_properties.length,1);
assert.deepEqual(out.resource_sources.saved_spell_list,[{name:"Light"}]);
assert.deepEqual(out.resource_sources.saved_sheet_resource_settings,{"spell-slot-1":0,"class-use:cleric:channel-divinity":1});
assert.deepEqual(out.resource_sources.native_v220_usage,{"spell-slot-1":0,"class-use:cleric:channel-divinity":1});
assert.equal(out.resource_coverage.native_usage_source,"approved_build.character.sheetV220.resources");
assert.equal(out.resource_coverage.explicit_saved_usage_entries,2);
assert.equal(out.resource_coverage.explicit_spell_usage_entries,1);
assert.equal(out.resource_coverage.explicit_class_usage_entries,1);
assert.equal(out.resource_coverage.has_explicit_saved_usage,true);
assert.equal(out.resource_sources.native_v220_usage["spell-slot-1"],0,"A depleted spell slot must remain zero");
const missingUsage=makeV287NeonReadOnlySnapshot({
 ...core,character:{...core.character,approved_build:{...build,character:{
 ...build.character,sheetV220:{resources:{}}
 }}}},extras,id);
assert.deepEqual(missingUsage.resource_sources.native_v220_usage,{});
assert.equal(missingUsage.resource_coverage.has_explicit_saved_usage,false);
assert.equal(missingUsage.resource_coverage.explicit_spell_usage_entries,0);
assert.equal(missingUsage.resource_coverage.missing_entries_mean,"native-renderer-derived-default-not-verified-remaining");
assert.equal(out.resource_sources.granted_divine_charge_records[0].current,0);
assert.equal(out.resource_sources.granted_divine_charge_records[0].max,2);
assert.deepEqual(out.counts,{inventory:1,saved_class_resources:0,explicit_native_usage:2,explicit_spell_usage:1,explicit_class_usage:1,wallet_denominations:1,wallet_ledger:1,bonus_requests:0,
 item_properties:2,item_charge_properties:1,custom_feats:1,granted_boons:0,canonical_awards:1,divine_effects:0,
 divine_burdens:0,divine_fractures:0,divine_offers:0});
assert.deepEqual(out.sources.approved_build,build,"Approved build retains its original values");
assert.equal(out.sources.favour,undefined,"Raw favour is never included");
assert.deepEqual(out.sources.divine_dispositions,[{key:"pae",disposition:"watchful"}]);
assert.equal(out.sources.divine_state.minor_intercession_remaining,1);
assert.throws(()=>makeV287NeonReadOnlySnapshot(core,{...extras,divine_state:{}},id));
assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.sources)&&Object.isFrozen(out.sources.approved_build));
assert.ok(Object.isFrozen(out.resource_coverage)&&Object.isFrozen(out.resource_sources.native_v220_usage));
assert.ok(Object.isFrozen(out.resource_sources.granted_divine_charge_records));
assert.notEqual(out.sources.approved_build,build,"Original RPC response must not share mutable references");
assert.throws(()=>makeV287NeonReadOnlySnapshot({...core,read_only:false},extras,id));
assert.throws(()=>makeV287NeonReadOnlySnapshot(core,{...extras,read_only:false},id));
assert.throws(()=>makeV287NeonReadOnlySnapshot(core,{...extras,access:"dm"},id));
assert.throws(()=>makeV287NeonReadOnlySnapshot(core,{...extras,character_id:"22222222-2222-4222-8222-222222222222"},id));
assert.throws(()=>makeV287NeonReadOnlySnapshot({...core,state:{...core.state,resources:{}}},extras,id));
assert.throws(()=>makeV287NeonReadOnlySnapshot(core,{...extras,canonical_awards:new Array(101).fill({})},id));
const html=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
assert.match(html,/makeV287NeonReadOnlySnapshot\(currentCoreSheet,v,characterId\)/);
assert.match(html,/V2\.87 source snapshot checked/);
assert.ok(!/\.innerHTML\s*=|localStorage|sessionStorage/.test(html));
console.log("PASS: stable V2.87 read-only snapshot preserves original builds, zero charges, item/source shapes and per-character authorization.");
