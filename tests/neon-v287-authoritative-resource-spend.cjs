"use strict";
/* CI source check. The live site MUST remain read-only: no SQL below runs
 * from this test and no production/staging access grant is performed. */
const fs=require("node:fs"),assert=require("node:assert/strict");
const sql=fs.readFileSync("site-overrides/sql/neon_audit_authoritative_resource_spend_only.sql","utf8");
const peer=fs.readFileSync("site-overrides/sql/neon_audit_second_linked_actor_only.sql","utf8");
const native=fs.readFileSync("site-overrides/neon-native-v287-read-client.js","utf8");
const boots=fs.readFileSync("site-overrides/neon-native-v287-bootstrap.js","utf8");
assert.match(sql,/^-- AUDIT ONLY\. NEVER install on Neon staging\/main or production Supabase\./);
assert.match(peer,/^-- AUDIT ONLY:/);
assert.equal((sql.match(/'11111111-1111-4111-8111-99999999999[1-4]'::uuid/g)||[]).length>=8,true);
for(const t of [
 "CREATE TABLE terravale_internal.neon_resource_authority_audit",
 "resource_values jsonb NOT NULL",
 "version integer NOT NULL",
 "CREATE TABLE terravale_internal.neon_resource_spend_events_audit",
 "PRIMARY KEY(character_id,request_id)",
 "CREATE OR REPLACE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()",
 "NEW.approved_build#>'{character,sheetV220,resources}'",
 "IS DISTINCT FROM canonical.resource_values",
 "IS DISTINCT FROM canonical.version::text",
 "CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_spend(",
 "actor uuid := (SELECT auth.uid())",
 "WHERE c.id=p_character AND c.name LIKE 'Neon resource audit %'",
 "FOR UPDATE",
 "authz.is_member(picked.campaign_id)",
 "authz.is_dm(picked.campaign_id)",
 "FROM terravale_internal.neon_resource_authority_audit a",
 "FROM terravale_internal.neon_resource_spend_events_audit ev",
 "request_id=p_request_id",
 "prior.actor_id IS DISTINCT FROM actor",
 "prior.expected_version IS DISTINCT FROM p_expected_version",
 "prior.spent IS DISTINCT FROM p_spend",
 "Operation token reused with different request",
 "Resource version conflict; reload current state",
 "r.source_revision IN",
 "'native-v287-v220-verified','native-v287-v234-spells-verified'",
 "r.class_name=picked.approved_build->>'class'",
 "r.character_level=(picked.approved_build->>'level')::integer",
 "limit_count<>1",
 "No unique approved resource limit for class and level",
 "Explicit saved resource count required; defaults are unverified",
 "current_value<p_spend",
 "next_state:=jsonb_set(canonical.resource_values",
 "UPDATE terravale_internal.neon_resource_authority_audit",
 "UPDATE public.characters SET approved_build=linked_build",
 "INSERT INTO terravale_internal.neon_resource_spend_events_audit",
 "'replayed',true",
 "'requires_refresh',prior.resulting_version IS DISTINCT FROM canonical.version",
 "'replayed',false"
])assert.ok(sql.includes(t),"Required server-side resource spend control missing: "+t);
assert.ok(sql.indexOf("SELECT * INTO picked")<sql.indexOf("SELECT * INTO canonical"));
assert.ok(sql.indexOf("SELECT * INTO canonical")<sql.indexOf("SELECT * INTO prior"));
assert.ok(sql.indexOf("UPDATE terravale_internal.neon_resource_authority_audit")<
          sql.indexOf("UPDATE public.characters SET approved_build=linked_build"));
for(const bad of [
 /GRANT\s+UPDATE\s+ON\s+public\.characters/i,
 /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.terravale_save_character_sheet/i,
 /CREATE\s+POLICY/i,/ALTER\s+ROLE/i,
 /p_new_remaining/i,/p_max_uses/i,/p_expected_class/i,
 /RESET\s+ROLE/i
])assert.doesNotMatch(sql,bad,"Forbidden broad gameplay grant or caller-supplied authority");
assert.match(sql,/REVOKE ALL ON terravale_internal.neon_resource_authority_audit/);
assert.match(sql,/REVOKE ALL ON terravale_internal.neon_resource_spend_events_audit/);
assert.match(sql,/REVOKE ALL ON FUNCTION public\.terravale_neon_audit_resource_spend/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.terravale_neon_audit_resource_spend/);
assert.match(peer,/audit-synthetic-discord-second-20261122/);
assert.match(peer,/INSERT INTO public\.campaign_members/);
assert.doesNotMatch(peer,/"accessToken"|"refreshToken"|318928301332627456/);
assert.match(native,/NO network, JWT, credentials, storage/);
assert.match(boots,/connect-src 'none'/);
console.log("PASS authoritative resource-spend audit only: canonical mirror, optimistic revision, atomic decrement, idempotency, verified ownership, no broad grants or live UI write path.");
