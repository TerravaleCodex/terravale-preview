# V2.87 resource initialisation — DM-confirmed audit (PR #95)

**Status: synthetic-only proof on disposable Neon child branch `br-rapid-haze-bglxt1nu`.** Never install this SQL on Neon staging/main or Supabase production. No real character has been edited and the staging V2.87 sheet remains strictly **read-only**.

## Why the step matters

Both real production Supabase and the copied Neon staging snapshot have **nine approved/draft characters but zero explicit saved native class/spell-resource counters** in `approved_build.character.sheetV220.resources`. The original V2.87 renderer displays a class-derived maximum when no saved counter exists, but that is **not proof the player has that number of uses remaining**. Source-checked maxima from PRs #92–93 do not solve that missing-current-value problem.

An initial count must be entered and affirmed by an authorised DM from the player's current sheet/session record, then recorded as a distinct auditable event. **Missing, explicitly saved zero and a DM-confirmed positive count are different states.** A reinitialisation must never erase a spent count or silently refill the pool.

## Synthetic DM-only initialisation contract

The test-only `terravale_neon_audit_resource_initialize(character,resource,expected_version,current_remaining,request_id,basis,confirmation)` supports:

- **Explicit DM verification:** requires linked Discord identity, existing campaign membership, `authz.is_dm(campaign_id)`, an explicit `confirmed_current_remaining_not_derived` acknowledgement and structured provenance `player_confirmed` or `dm_session_record`. Neither a party member nor a normal character owner automatically receives DM powers.
- **Original character integrity:** only four named synthetic UUIDs; currently approved status; top-level/nested class and level must match; exactly one authoritative class/level/resource maximum from the private rule tables; confirmed remaining value within 0–max.
- **No automatic full/default:** the exact resource key must be **absent** from the private authoritative JSON object. The presence of `0` is not interpreted as missing. A unique `(character_id,resource_id)` event log also prevents a second initialisation if the key were ever removed.
- **Atomic private authority:** character row and private resource row are locked in the same order as the narrow resource-spend operation. A matching expected version is required. Only the chosen saved count is added to the private JSON and mirrored into `approved_build.character.sheetV220.resources`; both versions increment exactly once. Unknown/custom resources and other saved counters remain untouched.
- **Idempotent requests:** one `(character_id,request_id)` event is stored. Exact retries do not repeat the initialisation; changed replay parameters or request IDs already used for spending are rejected. Historical successful replies require refresh if their revision no longer matches the current private authority.
- **No real write path:** only the disposable child branch grants the synthetic test function to `authenticated`. Private tables deny direct user edits. The legacy broad sheet-save function remains ungranted. There is no V2.87 staging UI control or function invocation.

## Actual PostgreSQL results

The synthetic level-3 Cleric had a saved first-level resource count of `0`, an unrelated custom value `2`, and **no** `spell-slot-2` key. Its authorised audit DM explicitly confirmed `spell-slot-2=0` under `player_confirmed`, with the server-reviewed maximum `2` and expected revision `4`. The function wrote `0/2`, advanced the revision to `5`, preserved the original `spell-slot-1=0` and custom count, and recorded exactly one private confirmation event.

Exact repetition with the same request ID returned a replay response without additional writes. These failure cases were tested in one isolated transaction and all rejected:

- Another attempt to initialise the already-saved pool, including an explicitly stored zero; stale expected revision; proposed `3` with verified maximum `2`.
- Omitted confirmation, null provenance, changed-parameter request UUID and an operation UUID previously used for spending.
- A Pact Magic resource not allowed for a Cleric, an unlinked account, and a **separately linked synthetic non-DM party member who was in the same campaign**.
- Anonymous function execution, direct private event/canonical table writes and legacy broad-sheet RPC access.

The synthetic second party member's added membership was removed after its test. The **nine original copied characters** and **65 existing public RLS policies** remain unchanged. No actual player-owned usage value was fabricated.

## What's not yet completed

1. A user-facing DM confirmation flow. The original read-only staging panel currently only explains missing values; it has no saving or confirmation button.
2. A **trusted class/build selection** separate from data that broad legacy saves could change. The test checks that top-level and nested class/level agree, but that agreement is not by itself immutable provenance.
3. A real, independently authenticated site-DM and player sign-in acceptance run, including true cross-session sync and DM decisions for actual counters.
4. More complete rules for custom classes, subclass features, Divine, items, rest/recovery and changes when features are replaced.
5. Exact server-authoritative first-time resource setup and reapproval processes for the actual campaign owner; secure rollouts, media, final data sync and rollback.

The next development step is an **approval/read-only DM workflow design tied to immutable campaign rules**, followed by small, fully audited live-staging write grants only after multi-identity acceptance.
