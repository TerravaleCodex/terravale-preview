# Archive 2 — authoritative divine-system integration contract

Status: **source review pending**. This file is implementation guidance, not proof that the original ZIP was read or imported. Do not merge new mechanics or seed player-facing boon entries until full source review is complete.

## Primary source and traceability

- The user's `Boons.zip`, extracted from Terravale Archive 2, is authoritative. Archive 2 previously contained **49 source files** under `80_DnD/Boons`, including shared rules and patron-specific multi-boon documents.
- The number of source documents is **not** the number of individual boon definitions. Each source must be inventoried, classified and cited by its original archive-relative path and heading.
- Preserve original source Markdown as an immutable/source-of-record version in a DM-only system. Keep canonical rule text distinct from normalized execution metadata.
- Identify framework/index files, patron collections, condition/rule definitions and individual boon abilities. A patron file such as `Errigan Boons.md` must not be imported as a single boon.
- Never silently infer favour requirements, recovery, charges, patron combination or Divine Burdens from matching a word. Every mechanically meaningful field needs a traceable source passage or an explicit DM-authored override.

## Rules and relationships to evaluate against the files

- Divine, Minor God and Concordant are mechanically distinct. **Greater God** is a mechanics-relevant classification, not just a visual label.
- Archive-specific rules and conditions must survive integration, including **Errigan's Drunk, Blackout and Rapture**, and **Ixi's Burned and Scorched**.
- **Amora's Entanglement** and **Nyrhan Entanglement** are distinct. Do not conflate them.
- **Nyrha's** complete mechanical system must not override her imprisonment or campaign-gated availability; specific boon availability is DM-controlled.
- Preserve actual Concordant combinations and **Pae Concordant Writs**. Do not invent a Pae–Kwaeth combination absent from the original source.
- Deity names and theological office should be reconciled with existing canon, including Odei corrections, without overwriting the archive's mechanical meaning.
- Do not assume every rule fits the current numeric -10..+10 favour model, the 1–10 thresholds, or a flat one-charge-per-use system until the source explicitly establishes those mappings.

## Required implementation layers

1. **DM rulebook/reference.** Exact shared rules, condition mechanics and exceptions with source provenance.
2. **DM boon catalogue.** Each mechanically distinct boon as an independent, searchable definition with family, patron relations, requirements, text, exceptions and source identifiers. Allow private drafts, custom creations and corrections without rewriting canon.
3. **Rules engine / event model.** Handle special conditions and interacting resources with explicit transitions and costs. Do not promote simple text detection to game mechanics.
4. **Grant state.** DM-authorised eligibility, award, withdrawal and activity history. A threshold never automatically grants a boon.
5. **Character sheets.** Only awarded boons and their authorized rules are visible. Charged boons appear in Resources with correct cost, reset and limits. Do not expose hidden or unawarded options.
6. **Player deity relations.** Broad narrative standing only, without exact favour scores, hidden thresholds or precise bands that reveal the score.

## Acceptance gates

- Inventory every source file; compare count and original paths against Archive 2 (expected 49 sources, but verify uploaded ZIP contents rather than forcing a count).
- Record all shared rule definitions, named conditions, exceptions, dependencies, and individual boon count; flag conflicting or ambiguous statements for DM review.
- Unit tests for Errigan, Ixi, Amora/Nyrha and Concordant mechanics; preserve exact name, wording, charges and limitations. No invented combinations.
- Permissions tests: player RPC must not return hidden catalogue, unearned mechanics, exact favour or DM-only conditions.
- Charge activation and rest-reset tests using the original source conditions, including multi-cost and nonstandard recharge where specified.
- Regression test full character-sheet visibility, awarding/revoking, DM-only filtering, and no jolt/repaint on favour edits.
- Stage and inspect before a live import. No production catalogue seeding before the source audit is complete.

## Immediate safeguard

The V2.73 browser importer treated each Markdown file as one potential boon, although Archive 2 contains shared frameworks and patron-wide collections. The V2.74 review branch adds a conservative preflight: mixed/system/collection archives are **blocked from per-file import**; simple standalone-boon Markdown imports remain available. This is a safety measure only, not a substitute for completing the source audit and building the correct rules model.
