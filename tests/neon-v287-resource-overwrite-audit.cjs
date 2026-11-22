"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const sql=fs.readFileSync("site-overrides/sql/neon_audit_resource_overwrite_guard_only.sql","utf8");
assert.ok(sql.startsWith("-- AUDIT ONLY"));
for(const fragment of [
 "OLD.id NOT IN","OLD.name NOT LIKE 'Neon resource audit %'",
 "OLD.approved_build#>'{character,sheetV220,resources}'",
 "NEW.approved_build#>'{character,sheetV220,resources}'",
 "resourceRevision","new_rev<old_rev","new_rev>old_rev+1",
 "new_map IS DISTINCT FROM old_map AND new_rev=old_rev",
 "Stale or unsupported whole-sheet resource overwrite denied",
 "BEFORE UPDATE OF approved_build ON public.characters"
])assert.ok(sql.includes(fragment),"Missing safe test-only full-sheet overwrite guard: "+fragment);
for(const bad of [/GRANT\s+UPDATE\s+ON\s+public\.characters/i,
 /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.terravale_save_character_sheet/i,
 /DROP\s+TRIGGER/i])
 assert.doesNotMatch(sql,bad,"Guard must not grant broad writes");
const resourceSql=fs.readFileSync("site-overrides/sql/neon_audit_fixed_resource_catalog_only.sql","utf8");
assert.match(resourceSql,/Outdated resource revision/);
assert.match(resourceSql,/r\.class_name=row_data\.approved_build/);
assert.match(resourceSql,/r\.character_level=\(row_data\.approved_build/);
assert.match(resourceSql,/p_remaining<0 OR p_remaining>cap/);
const native=fs.readFileSync("published/veiled-codex/index.html","utf8");
assert.ok(native.includes("rpc('terravale_save_character_sheet'"),"Legacy broad sheet writer call changed");
assert.ok(native.includes("onLocalPersist"),"Legacy save schedule missing");
console.log("PASS test-only stale resource write guard contract; no broad staging/production SQL grants.");
