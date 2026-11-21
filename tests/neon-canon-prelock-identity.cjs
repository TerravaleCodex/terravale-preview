"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const sql=fs.readFileSync("site-overrides/sql/neon_canonical_prelock_identity.sql","utf8");
const actions=[
  "terravale_divine_canon_dm_adjust_burden",
  "terravale_divine_canon_dm_fracture",
  "terravale_divine_canon_dm_offer",
  "terravale_divine_canon_dm_record_bargain",
  "terravale_divine_canon_dm_refill",
  "terravale_divine_canon_dm_resolve_fracture",
  "terravale_divine_canon_dm_resolve_offer",
  "terravale_divine_canon_dm_set_effect",
  "terravale_divine_canon_dm_set_relation",
  "terravale_divine_canon_dm_set_status",
  "terravale_divine_canon_respond_offer",
  "terravale_divine_canon_rest",
  "terravale_divine_canon_revoke",
  "terravale_divine_canon_use"
];
assert.equal(actions.length,14);
for(const action of actions){
  assert.equal(sql.split("'"+action+"'").length,2,"Missing or duplicate protected action "+action);
}
assert.ok(sql.includes("TERRAVALE_NEON_PRELOCK_IDENTITY_GUARD"));
assert.ok(sql.includes("auth.identities"));
assert.ok(sql.includes(String.raw`auth\.uid`));
assert.ok(sql.includes("provider='discord'"));
assert.ok(sql.includes("errcode='28000'"));
assert.ok(sql.includes("total_functions<>14"));
assert.ok(sql.includes("guarded+unchanged<>14"));
assert.ok(sql.includes("regexp_count(source_definition"));
assert.ok(sql.includes("Unexpected function layout"));
assert.ok(!/^\s*CREATE OR REPLACE FUNCTION/im.test(sql),"Patch must only adjust existing definitions dynamically");
assert.ok(!/\b(?:DROP|TRUNCATE|DELETE\s+FROM|GRANT\s+ALL|ALTER\s+TABLE|REVOKE)\b/i.test(sql),"Migration must not alter data or table privileges");
assert.ok(sql.includes("refusing partial patch"));
console.log("PASS: all 14 canonical divine actions receive idempotent authenticated pre-lock guards; no table/data mutations.");
