# V2.87 resource migration — DM-reviewed build provenance and read-only review

**Scope:** PR #96 on 22 November 2026. This is a staging **read-only presentation** plus disposable-database **synthetic-only** rule-approval experiment. No production or staging character editing is enabled.

## Why the previous progress estimate stayed at 55%

The initial Supabase→Neon schema and data copy, verified OAuth ownership, 65 RLS policies and the original V2.87 read-only sheet are completed foundations. PRs #90–95 were substantive but involved *source-provenance research and audit-only tests* for isolated resource save APIs. They did **not** deliver end-to-end edit flows for live characters, campaign approvals, item/boon actions, Session Room real-time writes, asset storage, final production sync or controlled cutover.

An overall percentage can therefore remain flat even when security foundations advance. Percentages are estimates, not automatically computed work-item totals; each remaining area has different uncertainty and blast radius. See tracker #70 for complete status.

## Isolated private DM-approved build rules

File: `site-overrides/sql/neon_audit_pinned_build_rules_only.sql` — **do not apply outside disposable child** `br-rapid-haze-bglxt1nu`.

The previously tested resource functions checked two matching class and level strings inside `approved_build`. A malicious or stale full-sheet save could change *both* strings together, inadvertently invoking another class's rules. The new synthetic-only experiment records exactly one DM-reviewed `class, level, campaign, owner` tuple and fixed ruleset identifier in a private table, and checks it during resource spend and missing-count initialisation. It also rejects changes to that tuple in the original broad sheet-save mirror through the fixture-only `BEFORE UPDATE` trigger.

Approval requires a linked Discord identity, verified site/campaign DM rights, original session membership, the latest canonical resource version, agreement with the current source character and explicit `dm_reviewed_class_level_and_campaign` acknowledgement. It cannot change the character, grant any additional ability or invent a resource maximum. The approval record cannot be overwritten by calling approval twice.

### Verified on disposable Neon child branch

- Before any approval, both narrow resource spend and DM-confirmed resource initialisation refused to operate on an otherwise valid synthetic character.
- The simulated verified site DM approved four synthetic classes: Cleric, Shaman, Bloodforger and Warlock, at level 3. Their private pin records stayed separate from the editable character sheet.
- After approval, a Warlock's Pact Magic resource was safely spent to zero with a new canonical revision.
- Direct simulated updates changing **both** Warlock class fields, **both** level fields, campaign, owner or approved status were rejected by the private rule trigger.
- A separately linked synthetic **party member sharing the Warlock's campaign** was denied DM approval, even though their identity and membership checks passed.
- A second approval by the DM was rejected as already pinned.
- Original **9 copied character records** and **65 public RLS policies** unchanged, no direct authenticated write grant.

This is *not yet* immutable campaign content versioning; the class/level/campaign/owner record is pinned but full class and subclass packages, version hashes, DM changes and level-up transitions still require a controlled rule catalogue.

## Staging resource-review preview

The staging-only authenticated V2.87 parent page now displays a small **read-only resources awaiting review** area beside the original native sheet, using the **published, source-checked fixed-class and spell/Pact manifests** from PRs #92–93. It only renders after both owner/DM-authorised Neon sheet RPCs pass. It never shows any automatic remaining-use assumption.

For reviewed resource pools:
- An *explicit saved zero* is displayed as `0 / max saved`.
- A *missing current count* displays **Unverified remaining · max N**, not `N remaining`.
- A saved value above the approved maximum is marked for review, not silently clamped.
- Unrecognised custom resource keys remain untouched and are only counted as **outside this review**; no new pool is fabricated.
- Warlock Pact slots are shown at one matching slot tier; ordinary spell slots are not invented.
- Classes or levels not matching the verified build, unavailable rules or subclass-specific capabilities fail closed.

The preview has **no inputs or saving buttons**, and runs outside the original V2.87 iframe. The original live V2 interface, current staging read-only blocker and its network isolation are retained. Unit tests exercise Cleric, Shaman, Warlock, noncaster, saved zero, missing counters, invalid counts, unsupported resources and class mismatch.

## Still needed before the first genuine staged write

Secure one-time DM build-approval storage with real versioned campaign content; owner/site DM real browser acceptance with two independently signed-in users; a separate authoritative missing-counter confirmation action for genuine characters; narrow spell/class spend integration with native buttons and freshness/retry handling; managed rest/refill, item and divine charge updates; DM Chronicle and Session Room synchronisation; media, final incremental backup/sync and cutover/rollback.

The milestone is a **prerequisite**, not proof of a completed real-player write migration.
