# Terravale Living Codex — Public Preview

## Fidget Pocket — 10 interactive toys
- Replaces the old Fidget Shrine with ten toys including the Squishable Mimic, Bone Rattle, Potion, Spinner, Rune Scribbler, Pocket Dragon, Big Red Button, Lever, Coin, and Forbidden Worm.
- Includes interaction-responsive generated audio, mute/volume controls, and locally stored settings. All effects are cosmetic and separate from campaign dice.

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
