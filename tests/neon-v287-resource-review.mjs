import assert from "node:assert/strict";
import fs from "node:fs";
import {makeV287ResourceReview} from "../site-overrides/neon-v287-resource-review.mjs";
const fixed=JSON.parse(fs.readFileSync("site-overrides/neon-v287-fixed-resource-tables.json","utf8"));
const spell=JSON.parse(fs.readFileSync("site-overrides/neon-v287-spell-progression.json","utf8"));
const snap=(klass,level,resources={})=>({
 schema:"terravale.neon.v287.sheet.readonly.v1",read_only:true,access:"owned",
 sources:{approved_build:{class:klass,level,character:{className:klass,level}}},
 resource_sources:{native_v220_usage:resources}
});
const a=makeV287ResourceReview(snap("Cleric",3,{}),fixed,spell);
assert.equal(a.readOnly,true);
assert.equal(a.validBuild,true);
assert.equal(a.missing,2);
assert.equal(a.saved,0);
assert.deepEqual(a.pools.map(p=>[p.id,p.max,p.remaining,p.status]),[
 ["spell-slot-1",4,null,"requires-dm-confirmation"],
 ["spell-slot-2",2,null,"requires-dm-confirmation"]
]);
assert.ok(a.pools.every(p=>Object.isFrozen(p)));
const b=makeV287ResourceReview(snap("Cleric",3,{"spell-slot-1":0,"manual:unrecognised":2}),fixed,spell);
assert.equal(b.pools[0].remaining,0);
assert.equal(b.pools[0].status,"saved");
assert.equal(b.pools[1].remaining,null);
assert.equal(b.missing,1);
assert.equal(b.saved,1);
assert.equal(b.unsupported,1);
const c=makeV287ResourceReview(snap("Shaman",3,{"spirit-favour":1}),fixed,spell);
assert.deepEqual(c.pools.map(p=>[p.id,p.max,p.remaining]),[["spirit-favour",3,1]]);
const warlock=makeV287ResourceReview(snap("Warlock",3,{}),fixed,spell);
assert.deepEqual(warlock.pools.map(p=>[p.id,p.max]),[["pact-slot-2",2]]);
assert.equal(warlock.pools.some(p=>p.id.startsWith("spell-slot-")),false);
const invalid=makeV287ResourceReview(snap("Warlock",3,{"pact-slot-2":99}),fixed,spell);
assert.equal(invalid.invalid,1);
assert.equal(invalid.pools[0].remaining,null);
assert.equal(invalid.pools[0].status,"invalid-saved-count");
const noCaster=makeV287ResourceReview(snap("Fighter",3,{}),fixed,spell);
assert.equal(noCaster.pools.length,0);
assert.match(noCaster.notice,/Custom or subclass/);
const broken=snap("Cleric",3,{});
broken.sources.approved_build.character.className="Wizard";
const mismatch=makeV287ResourceReview(broken,fixed,spell);
assert.equal(mismatch.validBuild,false);
assert.equal(mismatch.pools.length,0);
assert.throws(()=>makeV287ResourceReview({...snap("Cleric",3),read_only:false},fixed,spell));
assert.throws(()=>makeV287ResourceReview(snap("Cleric",3),{...fixed,auto_rest_authorised:true},spell));
const staging=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
const deploy=fs.readFileSync(".github/workflows/deploy.yml","utf8");
for(const id of ["resource-review","resource-review-summary","resource-review-list"]){
 assert.ok(staging.includes('id="'+id+'"'));
}
assert.ok(staging.includes("await ruleManifestsPromise"));
assert.ok(staging.includes("makeV287ResourceReview(v287,fixed,spell)"));
assert.ok(staging.includes("Unverified remaining · max "));
assert.ok(staging.includes("read-only"));
assert.ok(!staging.includes("terravale_neon_audit_resource_spend("));
assert.ok(!staging.includes("terravale_neon_audit_resource_initialize("));
assert.ok(!staging.includes("terravale_neon_audit_approve_build_rules("));
for(const file of ["v287-resource-review.mjs","spell-progression.json","fixed-resources.json"])
 assert.ok(deploy.includes("published/neon-staging-auth/"+file));
console.log("PASS readonly resource review: 0 charges, missing-not-full, Pact only, fixed class rules, unrecognised resources, invalid counts, source drift and unchanged staging write lock.");
