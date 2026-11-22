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
