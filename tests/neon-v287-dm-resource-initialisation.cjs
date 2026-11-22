"use strict";
/* CI only: contract checks for isolated Neon audit-branch DM confirmation.
 * Never runs SQL, connects to Neon, or enables any real-character writes. */
const fs=require("node:fs"), assert=require("node:assert/strict");
const sql=fs.readFileSync("site-overrides/sql/neon_audit_dm_resource_initialization_only.sql","utf8");
const staging=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
const native=fs.readFileSync("site-overrides/neon-native-v287-read-client.js","utf8");
const rules=JSON.parse(fs.readFileSync("site-overrides/neon-v287-spell-progression.json","utf8"));
assert.match(sql,/^-- AUDIT ONLY\. NEVER INSTALL ON NEON STAGING, NEON MAIN OR SUPABASE PRODUCTION\./);
assert.ok(sql.includes("CREATE TABLE terravale_internal.neon_resource_initializations_audit"));
assert.ok(sql.includes("UNIQUE(character_id,resource_id)"),"One-time initialisation must be irreversibly recorded");
assert.ok(sql.includes("PRIMARY KEY(character_id,request_id)"),"Idempotency per character/request");
for(const part of [
 "actor uuid := (SELECT auth.uid())",
 "authz.is_member(picked.campaign_id)",
 "authz.is_dm(picked.campaign_id)",
 "WHERE c.id=p_character AND c.name LIKE 'Neon resource audit %'",
 "AND c.status='approved'",
 "FOR UPDATE",
 "FROM terravale_internal.neon_resource_authority_audit a",
 "canonical.resource_values",
 "IS DISTINCT FROM canonical.version::text",
 "p_basis IS NULL",
 "p_basis NOT IN ('player_confirmed','dm_session_record')",
 "'confirmed_current_remaining_not_derived'",
 "Resource version conflict; reload before DM confirmation",
 "Confirmation operation UUID reused with different data",
 "FROM terravale_internal.neon_resource_spend_events_audit e",
 "Operation UUID was already used for spending",
 "r.source_revision IN",
 "'native-v287-v220-verified','native-v287-v234-spells-verified'",
 "r.class_name=picked.approved_build->>'class'",
 "r.character_level=(picked.approved_build->>'level')::integer",
 "limit_count<>1",
 "p_initial_remaining>cap",
 "canonical.resource_values ? p_resource",
 "Resource already has a saved count; no implicit reset",
 "next_state:=jsonb_set(canonical.resource_values,ARRAY[p_resource]",
 "UPDATE terravale_internal.neon_resource_authority_audit",
 "UPDATE public.characters SET approved_build=linked_build",
 "INSERT INTO terravale_internal.neon_resource_initializations_audit",
 "prior.resulting_version IS DISTINCT FROM canonical.version",
 "'replayed',false,'requires_refresh',false",
 "GRANT EXECUTE ON FUNCTION public.terravale_neon_audit_resource_initialize"
])assert.ok(sql.includes(part),"DM initialisation audit safety condition missing: "+part);
assert.ok(!/GRANT\s+UPDATE\s+ON\s+public\.characters/i.test(sql));
assert.ok(!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.terravale_save_character_sheet/i.test(sql));
assert.ok(!/p_max(?:imum|_uses)?\s+integer/i.test(sql),
 "Maximum may only come from the server-reviewed catalogue");
assert.ok(!/p_recover|p_rest|p_auto_full/i.test(sql));
assert.ok(!staging.includes("terravale_neon_audit_resource_initialize"),
 "Actual staging must not enable DM initialisation action");
assert.ok(!native.includes("terravale_neon_audit_resource_initialize"),
 "Original V2.87 native facade must remain read-only");
assert.ok(rules.class_schedules.Cleric.levels[2][1]===2,
 "Tested third-level Cleric second-level slot limit must match reviewed source");
assert.ok(rules.automatic_recovery_authorised===false);
const body=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_initialize"));
assert.ok(body.indexOf("SELECT * INTO picked")<body.indexOf("SELECT * INTO canonical"),
 "Character and private canonical row lock order must match narrow spending");
assert.ok(body.indexOf("SELECT * INTO canonical")<body.indexOf("SELECT * INTO prior"),
 "Existing idempotency check must happen after ownership and canonical consistency");
assert.ok(body.indexOf("IF canonical.version IS DISTINCT FROM p_expected_version")<
body.indexOf("IF canonical.resource_values ? p_resource"),
 "Reject stale confirmations before interpreting missing keys");
assert.ok(body.indexOf("UPDATE terravale_internal.neon_resource_authority_audit")<
body.indexOf("UPDATE public.characters SET approved_build=linked_build"),
 "Canonical source must be updated before guarded approved-build mirror");
console.log("PASS isolated DM initialization contract: linked site DM, source-checked cap, explicit zero, one-time saved key, idempotent verification, canonical revision and read-only staging.");
