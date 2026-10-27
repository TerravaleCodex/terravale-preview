# Terravale Living Codex — Public Preview

## v0.12.3 — Navigation, character privacy controls and Ael'Vaen compatibility
- Sidebar labels restored to compact 12px separate from 15px icons, fixing accidental oversized navigation text.
- Expanded sidebar uses 208px on desktop; collapsing reduces it to a 58px icon rail and actually expands sheet content instead of applying another maximum width cap.
- Top navigation is sticky and reorganised with compact controls and a clearer page breadcrumb.
- Owner information, party sharing, and DM/player visual perspective move to the character's Character settings dialog, leaving gameplay panels uncluttered.
- Database and creator agree: Ael'Vaen are Elves, and Echo-Bearer can use ancestry Elf (legacy AelVaen remains supported). Other class restrictions are unchanged.

## v0.12.2 — Echo-Bearer eligibility, clearer class sheets & focus-mode navigation
- Fixed Echo-Bearer being unselectable: the class had been restricted to AelVaen, an ancestry name not offered by character creation. Base Elf now exposes Echo-Bearer, with Ael’Vaen lineage confirmation left to the DM. Kharithen and Thalassari remain restricted without an explicit exception.
- Six structural class-sheet families replace one-size-fits-all overview composition: Bloodforger, Shaman, Echo-Bearer, defensive, arcane and martial layouts. Information follows approved rules; the styles do not invent powers.
- Desktop sidebar collapses to an accessible icon rail, and the choice persists per browser. Mobile retains the existing open/close navigation.
- Active website themes are Classic Dark and Night Sky only. Active sheet colours are Classic Codex and Night Sky only; old theme metadata and styling remain archived for later rework.
- Retains inventory, rest/recharge and one-click ability mechanics from prior updates.

## Emergency workspace-loading hotfix · October 27, 2026
- Cloud sign-in and initial campaign queries now have bounded loading times. A stalled authentication request can no longer trap all pages behind “Loading workspace…” indefinitely.
- Background polling, initial auth and focus refreshes share one in-flight load; INITIAL_SESSION no longer duplicates startup login checks.
- Failed workspace loading displays visible diagnostics, a Retry workspace control and a targeted Recover sign-in button. Recovery removes only the current Supabase project's browser auth cookies/token cache and redirects to login. It does not delete campaigns, characters or browser backups.
- Initial cloud loading never displays mock local demo campaigns. Both private cloud data and the existing short/long rest and interactive ability features are preserved.

## v0.12.1 — Interactive Abilities
- Players and DMs can spend charges on DM-linked class features and character-specific feats with one click from character sheets; actions show cost, remaining balance and activation type.
- Class ability links can only use unlocked class features or approved selections, and must have explicitly configured costs.
- Custom feats can automatically deduct their own uses and an additional resource pool when the DM configures both.
- Cloud actions verify the latest approved build and atomically compare-and-swap current resources to prevent two open devices double-spending the final charge.
- Rest recovery is now concurrency-checked to avoid overwriting HP or charges that changed in another session.
- Players may only activate their own abilities; campaign DMs retain control. Unconfigured abilities stay reference-only, and effects still follow the written rules.

## v0.12.0 — Rest & Recovery
- Short Rest and Long Rest on character sheets and live session controls, with confirmation before a save.
- Players select Hit Dice to spend on short rests and get automatically rolled healing. Long rests restore HP, clear temporary HP and regain half the total Hit Dice (at least one), following the selected 2014-style baseline.
- DM-authored resource recharge supports full, half, fixed or none on each rest type, including custom feats, class resources and additional custom pools. Unspecified recharge is deliberately not guessed.
- DMs can detect clear feat recharge wording or configure it explicitly. Rest saves resources and HP without overwriting inventory, Blood State or DM-owned conditions.

## v0.11.5 — Shady's portrait rescue, campaign names and custom feats
- Fixed private Storage portrait access; the policy now checks object filenames correctly rather than character names, without making private character sheets public.
- Character/DM portrait uploader supports a retry when portrait files can't be fetched; cloud DM editing uses the secure uploader.
- DMs can rename their campaigns while preserving invitations, character ownership and campaign IDs.
- DMs can create character-specific feats, boons and drawbacks with full rules and prerequisites. They appear on the saved player character sheet.

## v0.11.4 — Character sheets, stable tutorial and inventory
- Fidget Pocket is temporarily hidden; existing toy source is retained for future work.
- The tutorial no longer resets when the workspace refreshes, and it highlights the relevant sidebar menu link, including in mobile navigation.
- Character owners and DMs can add, edit, remove and save inventory items directly on full character sheets. Unsaved inventory changes survive normal refreshes.
- All 33 classes display suggested main and supporting abilities during standard-array assignment, without forcing a particular build.
- Every class has a full reference available from the character sheet. All 13 core classes plus 19 custom classes have level-by-level features; Shaman continues through its dedicated progression system.

## Character ownership, private sheets, class skills and site tour
- Full character sheets and roster cards identify the assigned character owner with a campaign-scoped display name.
- Player or DM can turn full-sheet sharing on/off; Supabase RLS protects full character and state records from other players when private.
- The active Session Room **still shows** private characters through its deliberately limited snapshot, with room portraits. Unavailable full-sheet links are replaced with a privacy indicator.
- All 33 classes show level-one class skill proficiency options and selected skills without silently awarding unchosen proficiencies.
- A one-time skippable interactive site walkthrough with optional DM chapter can be replayed from the '?' help button.
- Applies with Supabase migration `0019_character_sheet_visibility.sql` (already installed and checked).


## Feat-granted ability choices
- Players choose their six standard array scores first and then choose the permitted +1 score from their selected starting ancestry feat.
- ASI/Feat level-up choices allocate standard ASI points separately from any feat-based score increase.
- Post-creation ancestry feat changes propose both the feat and its bonus ability for atomic DM approval.
- Stat previews and DM diffs show the chosen bonus. Supabase migration `0018_feat_ability_score_choices.sql` validates allowed stats and prevents double counting.


## Fidget Pocket v3 — five carefully rebuilt fidgets
- **Bone Rattle**: articulated bones, a three-skeleton dance, secret reactions and the official *Spooky, Scary Skeletons* YouTube player after discovery (the music recording is not bundled).
- **Rune Scribbler**: drawn glyph recognition, ward/flame/wind effects, summons and spell combinations.
- **Big Red Button**: over forty escalating milestones with temporary, reversible visual incidents across the website.
- **Pocket Thunderstorm**: interactive weather simulation, squishable rain cloud, lightning, page-wide storm and hidden elemental.
- **Dvergr Pocket Forge**: heat, bellows, strike accuracy, three object recipes, water quenching, and rare sentient creations.
- Five-option navigation, discoverable secrets, local persistence, touch and keyboard controls, reduced-motion handling, and procedurally generated toy sounds.
- The previous mimic, potion, spinner, dragon, lever, coin, worm and vault toys are retired. Toy actions remain cosmetic, with no campaign data changes.

This repository contains the compiled GitHub Pages preview of **Terravale Living Codex** (v0.11.3).

The editable source code, backend migrations, and campaign administration stay in a **separate private repository**. This repository only publishes the existing public-safe demo site.

The preview is interactive but runs in local demonstration mode until Discord sign-in and Supabase configuration have been completed and tested.

Website: https://terravalecodex.github.io/terravale-preview/

Publishing is handled by GitHub Actions. The website bundle is checksum-verified before deployment.

## v0.11.2 — Portrait Theatre & Bonebound Fidget Shrine
- Bigger character artwork, including Session Mode, with an accessible click-to-enlarge image preview.
- A three-mode optional bottom-right Fidget Shrine: spin, pop bubbles, or roll a decorative bone d20. No campaign dice are affected.
- Shady · Bonebound now has real engraved skull-and-crossbones details and an ossuary visual style in subdued charcoal and bone ivory.

## v0.11.3 — Character portrait layout fix
- Corrects a thin, stretched portrait image in View Character. Images now fill their intended card.
- Prevents the identity header from overflowing: the character sheet stacks portrait and identity at constrained content widths.
- Preserves Session Mode's existing compact portrait layout and full-size image viewer.
