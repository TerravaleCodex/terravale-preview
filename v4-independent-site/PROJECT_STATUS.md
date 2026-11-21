# Independent Living Codex V4 — project status

This is a **real folder project**, not a source downloader, installer or importer.

The project began as a **one-time completed live V2 snapshot**, and its actual HTML, CSS and JavaScript files are now independently editable. The screenshot/layout, DOM, sheet code and Session Room client code originate from the live version, not a newly-designed imitation.

## Included

- `index.html`: the genuine V2-based page structure, rewritten only for local database and blank-content integration
- `js/`: original live frontend scripts extracted in their execution order, plus the offline database emulator
- `css/`: original live styles in link order, plus Classic / Midnight overrides
- `V4_SOURCE_MANIFEST.json`: source hashes, script inventory, live-source version and remaining terminology to audit
- `START_V4.bat` and `START_V4.ps1`: launch *this folder* with localhost using Python 3
- `README.md`: source ownership and local run notes

No V2.39 archive, Github checkout, network download, patch runner or rebuild-from-live script is needed to run or edit **this folder**.

## Important unfinished work

- The one-time source split does **not** remove the history of patches inside individual scripts; real refactoring is needed, with visual/function regression checks.
- Large Terravale lore JSON and curated demo-party content were removed, but hardcoded *terminology, formulas, world-specific branches and sample labels* remain. Refer to `V4_SOURCE_MANIFEST.json` and audit/remove those before public reuse.
- The offline IndexedDB emulator currently implements core profiles, campaigns, approvals, wallets, inventory, DM stock and feats. Some divine, recharge/rest, profile media and multi-device collaborative paths remain unsupported.
- The native class/ancestry creator needs to read the campaign's DM-enabled definitions instead of the former built-in Terravale class progression. Its save-time gate is already in place.
- Local profiles simulate access; they do **not** provide secure multi-user internet authentication. A future online deployment will need server-side validation.

## Running

On Windows, double-click `START_V4.bat`. This serves the contents of this directory at **http://127.0.0.1:8765/**. Python 3 is required; internet is not.

Do not open the HTML directly using `file://` if you want a stable browser IndexedDB origin. Use the localhost start file.

Your saved local browser database is **not bundled into the source folder ZIP**. Use the in-app **Offline DB** export/import JSON controls to back it up or move it.

## Development rule

**Edit the files in this folder directly.** The live V2 application is the behaviour/appearance reference only. This V4 project is not rebuilt from live as part of normal development, and the production site is untouched.
