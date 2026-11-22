# Neon V2.87: authoritative resource-spend prototype (audit-only)

**Milestone:** PR #94, 22 November 2026.  
**Database:** disposable Neon child branch `resource-usage-roundtrip-audit` (`br-rapid-haze-bglxt1nu`), **not** Neon staging/main or Supabase production.  
**Status:** narrow synthetic-only proof passes; there is **no live gameplay write enablement** and the original V2.87 staging character sheet remains read-only.

## Why revision numbers were not enough

The old `public.terravale_save_character_sheet` rewrites `approved_build.character` as a whole. An older browser tab could send out-of-date resource values. A trigger that simply compares the browser's `resourceRevision` against the previous saved value can be fooled by a forged larger revision.

For this prototype, `terravale_internal.neon_resource_authority_audit` stores a **private canonical pair**: the explicit `sheetV220.resources` JSON object and a monotonically increasing version. The original V2.87 sheet keeps the same values in its existing JSON location as a **mirror**. A synthetic-only `BEFORE UPDATE OF approved_build` trigger rejects any mirror that disagrees with the private pair, even if the caller claims revision 999. Authorized field-specific resource changes update the private pair and the sheet mirror atomically in one transaction. Broad legacy writes remain disallowed for genuine staging characters.

## Narrow API design

`public.terravale_neon_audit_resource_spend(character, resource_id, expected_version, units_to_spend, operation_uuid)`

The audit function:

- Accepts **spend only**, not a caller-specified remaining value, maximum, restoration or rest. `units_to_spend` must be positive and bounded.
- Requires a real linked Discord identity under `auth.uid()`, current campaign membership and **owner/authorised DM** rights. A non-owner player in the same campaign is not authorised merely because they can view the character.
- Permits only four explicitly named synthetic characters in the disposable audit branch. The original nine copied characters can **never** match its UUID whitelist.
- Uses server-held, source-reviewed resource maxima from PRs #92–93: Shaman/Bloodforger fixed class pools and ten base-class spell/Pact schedules. The two subclass-dependent configurations, custom resources, unexplained rules and automatic recovery remain blocked.
- Confirms the approved build's top-level and nested class/level agree. Requires an **explicit** saved remaining count; an absent count is not treated as full.
- Locks the character row, then private authority row. Checks expected version and current remaining uses before atomically decrementing. Conflicting sessions cannot both consume a stale version.
- Records the operation UUID in the private `neon_resource_spend_events_audit` table. An exact retry has no second effect; a reused ID with different parameters is rejected. Retrying a historical operation returns `requires_refresh=true` so a UI will not display a stale replay as current state.
- Grants neither direct `UPDATE` access on character tables nor any broad whole-sheet write RPC. All private tables have no `authenticated`/`anonymous` direct access.

This is a **test design**, not permission to expose the function as a real staging gameplay action. The SQL under `site-overrides/sql/neon_audit_authoritative_resource_spend_only.sql` must not be installed on a real character branch.

## Tests actually performed on the isolated database

| Test | Result |
|---|---|
| Shaman spending 1 from 3 uses | Stored 2 remaining, revision 3 |
| Same UUID and same parameters retried | Original result, no additional spend, `replayed=true` |
| Warlock spending 1 from 2 Pact slots | Stored 1 remaining, revision 2 |
| Two simultaneous requests against Shaman revision 3 | One succeeded, one failed with SQLSTATE 40001 |
| Another linked **synthetic** player sharing Shaman's campaign | Identity and membership resolved, but spend denied (not owner/DM) |
| Different-campaign linked synthetic player | Spend denied |
| Synthetic campaign owner marked departed | Spend denied and fixture departure reversed |
| Stale expected revision | Denied, no extra operation logged |
| Reused operation UUID with changed amount | Denied |
| Missing/unknown resource ID or wrong Pact tier | Denied |
| Zero-charge Cleric / exhausted Shaman | Spending denied |
| Attempt to spend more than saved remaining uses | Denied |
| Any nonfixture original character ID | Denied |
| Unlinked account, anonymous execution, direct private event insert | Denied |
| Forge full-sheet resources with `resourceRevision=999` | Denied by private authority guard |
| Valid unrelated backstory edit | Allowed without changing canonical resources |
| Shaman depleted to zero, then replay old request | Stored zero/revision 5 unchanged; replay marked `requires_refresh=true` |
| Original copied characters and RLS | All 9 original characters preserved, all 65 original public RLS policies preserved |

Only one genuine connected Discord account was available. To validate a separate owner, **fake Neon Auth and Discord identity rows were created exclusively on this child branch**, without passwords, sessions, tokens or an actual Discord account. That validates the SQL permission path, not the live Neon Auth sign-in flow. A second real signed-in user, site DM permissions and original Session Room multi-user interaction still require browser acceptance.

## Production blockers

1. **Safe initialization:** none of the nine copied real characters has explicit native class/spell usage. A new server-authoritative initialization/DM confirmation protocol is needed; never automatically assert a class-derived maximum reflects the player's true remaining pool.
2. **Immutable class/rule provenance:** bind resource caps to a server-reviewed, versioned campaign/build selection, not fields that a legacy broad sheet writer can mutate. Subclass and DM-specific rules still require validation.
3. **Approved recovery and other actions:** rests, refunds, spell swaps, replacement abilities, multiclass-free custom classes and divine/item resources require separate server-side rules and atomic operations.
4. **Real identity tests:** require at least two actual Discord users and a site DM, including membership revocation/owner reassignment and simultaneous character edits.
5. **Sheet integration:** native V2.87 spend buttons must call the exact narrow API with a fresh operation ID and expected revision, handle `40001` by re-reading the authoritative state and handle retries with `requires_refresh`. The current staging iframe remains intentionally isolated and read-only.
6. **Session Room/realtime:** ensure exactly-once resource events and consistent initiative/session visibility. Do not restore the legacy broad `terravale_save_character_sheet` grant.
7. **Operational cutover:** media migration, final incremental database sync, deployment rollback and signed-in acceptance remain outstanding.

**Bottom line:** field-specific source-checked, versioned, idempotent resource spending works on synthetic characters in a disposable audit branch. It is not yet a live feature, and it does not establish that all write paths on V2.87 are migrated.
