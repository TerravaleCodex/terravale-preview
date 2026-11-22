"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const sql=fs.readFileSync("site-overrides/sql/neon_audit_pinned_build_rules_only.sql","utf8");
assert.match(sql,/^-- AUDIT ONLY\. DO NOT APPLY TO NEON STAGING, NEON MAIN, SUPABASE/);
for(const text of [
 "CREATE TABLE terravale_internal.neon_resource_build_approval_audit",
 "character_id uuid PRIMARY KEY",
 "campaign_id uuid NOT NULL",
 "owner_id uuid NOT NULL",
 "approved_class text NOT NULL",
 "approved_level integer NOT NULL",
 "approved_by uuid NOT NULL",
 "approval_basis text NOT NULL CHECK(approval_basis='dm_reviewed_fixture_build')",
 "REVOKE ALL ON terravale_internal.neon_resource_build_approval_audit",
 "CREATE OR REPLACE FUNCTION public.terravale_neon_audit_approve_build_rules",
 "p_confirmation IS DISTINCT FROM 'dm_reviewed_class_level_and_campaign'",
 "actor uuid:=(SELECT auth.uid())",
 "authz.is_member(picked.campaign_id)",
 "authz.is_dm(picked.campaign_id)",
 "FROM terravale_internal.neon_resource_authority_audit a",
 "canonical.version IS DISTINCT FROM p_expected_resource_version",
 "picked.approved_build#>'{character,sheetV220,resources}'",
 "picked.approved_build->>'class' IS DISTINCT FROM p_expected_class",
 "picked.approved_build#>>'{character,className}' IS DISTINCT FROM p_expected_class",
 "picked.approved_build->>'level' IS DISTINCT FROM p_expected_level::text",
 "picked.approved_build#>>'{character,level}' IS DISTINCT FROM p_expected_level::text",
 "No audited resource rules for approved class/level",
 "INSERT INTO terravale_internal.neon_resource_build_approval_audit",
 "CREATE OR REPLACE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()",
 "NEW.campaign_id IS DISTINCT FROM pinned.campaign_id",
 "NEW.owner_id IS DISTINCT FROM pinned.owner_id",
 "NEW.approved_build->>'class' IS DISTINCT FROM pinned.approved_class",
 "NEW.approved_build#>>'{character,className}' IS DISTINCT FROM pinned.approved_class",
 "NEW.approved_build->>'level' IS DISTINCT FROM pinned.approved_level::text",
 "NEW.approved_build#>>'{character,level}' IS DISTINCT FROM pinned.approved_level::text",
 "NEW.approved_build#>'{character,sheetV220,resources}'",
 "NEW.approved_build#>>'{character,sheetV220,resourceRevision}'",
 "BEFORE UPDATE OF approved_build,owner_id,campaign_id,status",
 "CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_spend",
 "CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_initialize",
 "approved.approved_class=picked.approved_build->>'class'",
 "approved.approved_level=(picked.approved_build->>'level')::integer",
 "approved.ruleset_version=canonical.ruleset_version",
 "No current DM-approved build/rules identity"
])assert.ok(sql.includes(text),"Missing synthetic immutable rule gate: "+text);
assert.equal((sql.match(/No current DM-approved build\/rules identity/g)||[]).length,2,
 "Both spend and initialisation must require the exact same privately pinned rules");
assert.ok(!/GRANT\s+UPDATE\s+ON\s+public\.characters/i.test(sql));
assert.ok(!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.terravale_save_character_sheet/i.test(sql));
assert.ok(!/INSERT\s+INTO\s+public\.characters/i.test(sql));
assert.ok(!/GRANT\s+(?:INSERT|UPDATE|DELETE)\s+ON\s+terravale_internal/i.test(sql));
assert.ok(sql.includes("'11111111-1111-4111-8111-999999999994'::uuid"));
assert.ok(!/ALTER\s+TABLE\s+public\.characters\s+DISABLE/i.test(sql));
const page=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
assert.ok(!page.includes("terravale_neon_audit_approve_build_rules("));
assert.ok(!page.includes("terravale_neon_audit_resource_spend("));
console.log("PASS fixture-only DM-approved build lock: private class/level/owner/campaign rules, approved spend and initialisation, no broad real-character write grants.");
