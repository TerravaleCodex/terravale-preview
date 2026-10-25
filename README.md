# Terravale Living Codex — Public Preview

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
