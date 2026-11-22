# V2.87 class and spell resource-state migration audit

**Scope:** read-only comparison of the current Supabase production data with Neon staging, plus analysis of the *actual assembled V2.87 source code*. No database writes, no class/spell counter backfills, no changes to the normal live frontend.

## Verified database coverage

| Question | Supabase production | Neon staging |
|---|---:|---:|
| Characters | 9 | 9 |
| Entries in `public.character_state.resources` | 0 | 0 |
| Characters with nonempty `approved_build.character.sheetV220.resources` | 0 | 0 |
| Characters with an explicit `approved_build.character.spellSlots` member | 0 | 0 |
| Characters with a saved `approved_build.character.spells` list | 1 | 1 |

These results are aggregates, not exported character details. The absence of resource usage **matches in source and destination**. It is not evidence of lost data in the initial Supabase→Neon snapshot. It is also **not proof that counters were never spent**, as no actual player session has confirmed a save-and-reload round trip yet.

## Original native V2.87 source-of-truth trace

The approved assembled site exposes `sheetV220State(c)`. The live V2.34+ Resources tab uses `c.sheetV220.resources` as its per-resource remaining-use map. `sheetV220Resources(c)` derives the available resource IDs and maxima from documented class/spell rules. `sheetV220ResourcesPanel(c)` renders those pools through the original native controls.

**Important fallback:** for every pool whose ID is missing from the saved map, the renderer takes the derived maximum (the relevant source expression is `s.resources[r.id]===undefined?r.max`). An empty map therefore displays apparently full resources, but it does **not** prove the player has that many uses remaining. Explicitly saved `0` must stay `0`.

`public.character_state.resources` is a different JSON array retained for older sheet compatibility. The actual native V2.87 class/spell usage map comes from the approved build; treating the two as interchangeable can silently reset or fabricate counters.

## Existing remote-save path

- In the approved V2 page, `persist()` writes the current in-memory character cache to browser storage and invokes `window.TerravaleV2Bridge?.onLocalPersist?.()`.
- In `site-overrides/v246-real-characters.js`, `onLocalPersist` schedules an owner-only `saveChanges` RPC after approximately 1300 ms. It strips `dmItemProperties` and calls `public.terravale_save_character_sheet(target_character,sheet)`.
- The current SQL function (reviewed on Neon staging) updates `public.characters.approved_build.character` with the supplied sheet. It separately updates HP, inventory, and blood state in `public.character_state`; it does **not** populate `character_state.resources`.
- The broad legacy function is `SECURITY DEFINER`, with ownership/campaign checks and limited protections for level/class/ancestry, but **no comprehensive validation of every gameplay field**. It must **not** be granted as the general Neon write path.

**Conclusion:** a persistence path exists in the original live site. Since all saved native resource-usage maps are empty, we cannot infer whether nobody recorded expenditures, a local save failed, or values were otherwise reset. A real read/reload comparison is required before declaring a live bug. The Neon snapshot preserved the available database data.

## Implemented staging controls

- The protected Neon sheet snapshot exposes the exact `approved_build.character.sheetV220.resources` map as `resource_sources.native_v220_usage`, independent of the legacy state array.
- `resource_coverage` reports the number of explicit saved usage entries and how many use `spell-slot-` or `pact-slot-` resource IDs, **without computing fake remaining/max values**.
- The staging-only parent UI displays a provenance note. If there are no saved resource usages, it warns that native class/spell counters may be showing **derived defaults rather than verified remaining charges**. It makes no change to the original V2.87 display or gameplay data.
- Existing authenticated owner/DM snapshot checks and all write blocks remain unchanged.

## Remaining safety gates before enabling writes

1. Verify at least one actual class-specific resource and a spellcaster (including a depleted `0` counter) through a **synthetic isolated staging save/reload test**. Never use real production characters as write-test fixtures.
2. Define a server-authoritative resource ID/max/recovery catalogue compatible with the accepted Terravale class rules. The browser's suggested maximum cannot alone authorise arbitrary writes.
3. Build a narrow optimistic-concurrency resource adjustment API, not a broad sheet overwrite. Enforce original ownership or campaign-DM permissions, verified identity and revocation, and atomically reject stale resource revisions.
4. Preserve legacy/custom/unrecognised resources rather than silently deleting them; do not invent pools for characters without spells or class resources.
5. Audit rest/recovery transactions, concurrent updates, and multi-player/Session Room sync. Keep writes disabled until tested and accepted.
6. Perform a final production→Neon incremental comparison before cutover.

**Status:** source mapping complete; staged read-only provenance safeguards implemented. Write-path migration and real browser acceptance remain pending.

## Isolated synthetic save/reload result (22 November, audit only)

**Test location:** disposable Neon child branch `resource-usage-roundtrip-audit` (`br-rapid-haze-bglxt1nu`), created from staging. Nothing was installed on Neon staging or main, and no actual player character was edited.

Two synthetic **campaigns** and characters were necessary because the real schema enforces a unique assigned PC per owner and campaign. The first fixture insert was correctly rejected by that rule and rolled back; the final test respected it.

A **test-only** RPC `terravale_neon_audit_resource_adjust` was installed exclusively on the child branch. It accepts the resource ID, expected revision and requested remaining value, but never accepts a caller-supplied maximum or broad sheet JSON. Maxima come from a private two-row **fixture registry**, **not** a production-authoritative rule catalogue. A row-level lock and expected-revision comparison prevent stale overwrites.

| Test | Observed result |
|---|---|
| Synthetic Cleric first-level spell-slot pool | Saved `0`, read back `0` with revision 1 |
| Synthetic Shaman Spirit Favour | Saved `1`, read back `1` with revision 1 |
| Spell pool updated with revision 1 | Saved `2`, revision incremented to 2 |
| Stale spell request with revision 1 | Rejected; current value preserved |
| Spell pool returned to zero at revision 2 | Saved `0` again at revision 3 |
| Unknown/custom resource entry | Preserved unchanged while adjusting the registered spell slot |
| Class and level fields | Preserved unchanged |
| Above-capacity values | Rejected |
| Unregistered resource identifier | Rejected |
| Any copied real character | Rejected by synthetic-ID-only restriction |
| Unlinked Discord identity | Rejected |
| Anonymous function execution | Denied |
| Direct character-table UPDATE as authenticated | Denied |
| Original 9 migrated characters and 65 RLS policies | Unchanged |

**Status:** the native saved-counter JSON structure supports precise versioned, field-level persistence in an isolated test, with explicit zero and unknown resources preserved. This proves a *mechanical approach*, **not** the production-ready write API. Before a staging write grant, remove the synthetic-only design, derive registered maxima and recovery rules from an authenticated campaign rules catalogue, test DM/other-player authorisation and concurrent browser sessions, and address legacy whole-sheet overwrite conflicts. Keep the original staging/live sheets read-only until those gates pass.


## Source-reviewed V2.87 fixed class-resource limits (22 November)

**Strict policy:** there is no universal safe resource maximum. Native V2.87 combines fixed class progressions, spellcasting schedules, subclass-dependent grants and named limited-use text. A client-supplied `max`, or an unspecified source-derived default, must never authorise a server write.

The actual assembled V2.87 HTML contains fixed `SHEET_V220_SHAMAN` and `SHEET_V220_BLOOD` arrays. `site-overrides/neon-v287-fixed-resource-tables.json` captures **only** those immutable tables and is checked against the actual HTML **at all 20 levels on every build** by `tests/neon-v287-fixed-rule-catalog.cjs`. The Shaman Spirit Favour count is absent at level 1 and rises from 3 dice at levels 2–4 to 7 at level 20. The Bloodforger Blood Reserve uses 4 at level 1, 5 at level 3, and 14 at level 20. Changes to the original built tables fail the provenance check until reviewed.

On a disposable Neon child branch only, the previous synthetic resource API now reads a **private, versioned 39-row class/level catalogue** instead of its arbitrary two-row, per-character test maximum table. The old registry deliberately remains irrelevant to the new function. A synthetic level-3 Shaman saved **3/3** Favour and a synthetic level-3 Bloodforger saved **5/5** Reserve. Values above these limits were rejected, as was an unverified Cleric spell-slot request. The 9 copied real characters, 65 RLS policies, direct character UPDATE denial and anonymous function EXECUTE denial remain unchanged. No production or staging writes were enabled.

Only two resource IDs are eligible for this **audit**: `spirit-favour` for Shaman and `blood-reserve` for Bloodforger. Even these have **recovery=manual-review**, since the V2 recovery variants and specific class/feature cadence must be approved before automating rests. Any spell slot, Pact slot, subclass, custom or other class ability returns **unsupported** until its source, prerequisites and authoritative maximum are explicitly verified. A second author's class selection must never inherit a counter from another class.

**Remaining before a real write API:** complete the source-reviewed spell/pact slot and subclass manifests, verify class/campaign revision and approved-build integrity on the server, account for all resource recovery rules, test competing session writers and roles, and stop the legacy whole-sheet writer from overwriting newer resource revisions. The child-branch implementation is only a safety experiment, not a production grant.


## Native spell/Pact progression and stale full-sheet protection (PR #93)

**Exact source:** the approved V2.87 build embeds a `v234-spell-tables` JSON object. The reader uses `spell-slot-N` for ordinary spell slots and **only one active `pact-slot-N` tier** for Pact Magic, matching the native class/level row. The original schedules are now retained in `site-overrides/neon-v287-spell-progression.json`: 12 configurations across levels 1–20. These include 10 base caster classes (Artificer, Bard, Cleric, Druid, Oracle of the Two Waters, Paladin, Ranger, Sorcerer, Warlock, Wizard) and two subclass configurations (Eldritch Knight, Arcane Trickster). GitHub CI checks every entry and original source/derived flags against the newly assembled actual V2.87 source. **Do not infer missing spell slots for Shaman, Bloodforger or noncasters.**

**Limited audit write catalogue:** the **test-only** SQL `site-overrides/sql/neon_audit_spell_slot_catalog_only.sql` imports exactly the ten base-class schedules into the private, versioned resource-cap table on the disposable Neon child branch only. This generated 848 class/level/spell-tier resource-cap records. The two subclass schedules remain **ungranted** until server-side approved subclass/progression selection is verified. No automatic rest/slot recovery is authorised. The write prototype now checks the approved build's top-level class/level against the nested character class/level, instead of trusting only a client-editable nested field.

**Real PostgreSQL negative and round-trip audit on child branch:**
- Level-3 Cleric `spell-slot-1=0` was saved and read back with original V2.87 resource revision 4; the server-derived cap is 4.
- Level-3 Warlock received `pact-slot-2=2` at revision 1; only the matching Pact slot tier is allowed.
- Warlock standard `spell-slot-1`, wrong Pact tier `pact-slot-1`, Warlock over-capacity 3, an outdated Cleric revision, and a mismatched top-level/nested class were all denied. The test deliberately restored its synthetic class field afterward.
- The first, second and third resource-audit fixtures remain isolated; the original nine copied real characters, 65 public RLS policies, private source table and denied broad authenticated table update remain unchanged.
- All write-test SQL is **AUDIT-ONLY**. It has **not** been installed on Neon staging, Neon main or production Supabase, and the live site's character editing remains unchanged/blocked on Neon staging.

**Legacy full-sheet overwrite test:** the original `terravale_save_character_sheet` replaces the saved character JSON. A stale whole-sheet save can therefore lose resource changes if permitted unchecked. A child-branch-only, three-fixture-scoped `BEFORE UPDATE OF approved_build` guard was installed and tested. With a synthetic Shaman at revision 2 and 3 Favour, a stale legacy whole-sheet payload at revision 1 was rejected with SQLSTATE `40001`; a current backstory edit preserved both the resource count and version. Legacy function execution was granted to the audit actor **only within the test transaction, then revoked**. This trigger alone is not sufficient against a privileged writer that deliberately forges a higher version, and should not be presented as a production security boundary. The production approach must keep the broad writer ungranted, use field-specific versioned server actions, and reconcile unrelated sheet fields without overwriting authoritative resources.

**Still blocking player edits:** verify approved class/subclass state and campaign-specific rule revisions, account and DM authorisation across multiple real identities, atomic Session Room updates and concurrent writer conflicts, recovery semantics, rollout/rollback, storage and final incremental sync. Do not grant broad writes simply because source tables match.
