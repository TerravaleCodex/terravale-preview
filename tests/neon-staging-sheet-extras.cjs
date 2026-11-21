"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),cp=require("node:child_process");
const sql=fs.readFileSync("site-overrides/sql/neon_staging_sheet_extras_read.sql","utf8");
const html=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
const adapter=fs.readFileSync("site-overrides/neon-readonly-bridge.mjs","utf8");
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.terravale_neon_staging_sheet_extras_read\(p_character_id uuid\)/);
assert.match(sql,/STABLE SECURITY DEFINER/);
assert.match(sql,/actor uuid := \(SELECT auth\.uid\(\)\)/);
assert.match(sql,/selected\.owner_id=actor OR/);
assert.match(sql,/authz\.is_dm\(selected\.campaign_id\)/);
assert.match(sql,/RETURN NULL;/);
assert.match(sql,/g\.status='active'/);
assert.match(sql,/a\.status='active'/);
assert.match(sql,/e\.campaign_id=selected\.campaign_id/);
assert.match(sql,/f\.campaign_id=selected\.campaign_id/);
assert.match(sql,/b\.campaign_id=selected\.campaign_id/);
for(const table of [
 "terravale_character_proficiencies","terravale_character_training_overrides",
 "terravale_character_custom_feats","terravale_character_divine_boons",
 "terravale_divine_canon_awards","terravale_divine_canon_effects"
])assert.ok(sql.includes(table));
assert.doesNotMatch(sql,/'score'|private_note|grant_reason|auth\.identities|source_excerpt|proposed_boon/i);
assert.doesNotMatch(sql,/\b(INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE TABLE|GRANT SELECT ON|GRANT ALL)\b/i);
assert.match(sql,/REVOKE ALL ON FUNCTION.*FROM PUBLIC/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION.*TO authenticated/);
assert.match(adapter,/terravale_neon_staging_sheet_extras_read/);
assert.match(html,/Verify linked V2\.87 data \(read-only\)/);
assert.match(html,/readBridge\.rpc\("terravale_neon_staging_sheet_extras_read",\{p_character_id:characterId\}\)/);
assert.match(html,/\.textContent=/);
assert.ok(!/\.innerHTML\s*=|localStorage|sessionStorage/.test(html));
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const checked=cp.spawnSync(process.execPath,["--input-type=module","--check"],{input:script,encoding:"utf8"});
assert.equal(checked.status,0,checked.stderr);
console.log("PASS: explicitly authorised, bounded, staging-only linked sheet reads with no hidden favour/boon leaks or writes.");
