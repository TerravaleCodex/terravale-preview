# V4 — real live V2.87 layout, blank content, offline database

The V4 build uses the **actual original V2.87 website source and UI**. It does not redraw or imitate its dashboard, character sheets, Session Room, DM Chronicle, or components. Only a separate local copy is modified; the production site is untouched.

**V4 is a world-agnostic platform, not a bundled Terravale campaign.**

## What the offline build strips

- Lore Codex V14: the original 283 public articles, 36 restricted placeholders, 31 calendar events, and other serialized world content
- The curated Terravale demo party and premade characters
- Built-in rules-registry languages, tools, currency denominations, and other setting-specific options
- Native `RULES` world-content lists (classes, ancestries, spell, feat, world entries) where the original JS catalog can be located and safely rewritten

The source reference is first compiled **unchanged** using the official V2 workflow. The exporter then applies `tools/v4_blank_content_patch.py` to its output before adding the local database adapter. It writes `V4_BLANK_CONTENT_REPORT.json` listing what was removed. The original unmodified source is never included in the distributed user-facing offline ZIP.

**Limitations:** Original UI labels, sample dialogue, and small constants may still reference Terravale, even after the full lore payload is stripped. These need further genericisation. We do not claim that every original setting-specific word has been removed or that all data-dependent pages work yet.

## Local data emulator

`v4/offline-database.js` stores account, campaign, class/ancestry enablement, party, character, state, wallet, vault, feat, approval and backup records in IndexedDB with a localStorage fallback. Unsupported RPCs return explicit errors rather than claiming to save.

New campaigns start with **no classes, ancestries, lore, characters, items, currencies, or gods**. A DM must add or import their own content. Saving a character is rejected until its specific class and ancestry have been enabled.

The V2 native creator's class/ancestry menus still need to read these new DM-authored schemas; the blank catalog is not yet a complete replacement for V2's original hardcoded class rules. The divine backend, remaining rest/charges, media, and realtime collaboration are incomplete.

## Build on Windows

Use the `Living_Codex_V4_Blank_Content_Live_UI_Builder.zip` companion builder, or run:

```bash
python tools/export-v4-offline-first-pass.py
python -m unittest discover -s tests -p 'test_v4_actual_live_parity.py' -v
node tests/v4-offline-database.cjs
```

The resulting local edition is `dist/V4_Live_Layout_Offline_First_Pass.html` and the distributable ZIP is `dist/V4_Live_Layout_Offline_First_Pass.zip`. The original reference `dist/V4_Live_Exact_Source_Baseline.zip` contains live world data and must **not** be given to end users. The Windows builder deletes this temporary reference and all downloaded sources after a successful export.

## GitHub Actions

[View the isolated V4 workflow](https://github.com/TerravaleCodex/terravale-preview/actions/workflows/v4-export-live-baseline.yml)

It publishes only the sanitized offline ZIP and blank-content report. The GitHub Pages production branch and authenticated databases are untouched.
