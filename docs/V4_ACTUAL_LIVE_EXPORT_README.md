# V4 actual live-site offline first pass

The generated first pass is derived from the **complete V2.87 HTML** used by the official Terravale site. It does **not** reconstruct, redesign or copy its styling by hand.

- The reference version is byte-for-byte identical to the official build of the public-safe live V2.87 source.
- The first offline version removes the Discord sign-in overlay and online advertising module so a local file can display the original V2 screens.
- Classic/Midnight and the fixed desktop sidebar are added on top. No page, character sheet, Session Room or Chronicle view is rewritten.
- This does NOT yet mean Supabase-backed characters, DM vault actions, divine awards, role security or online multiplayer work offline; they still need real local storage adapters.
- This public snapshot retains the normal restricted lore placeholders. Protected text is never imported from an account.

## Download the actual build
[GitHub Actions — V4 offline first-pass export](https://github.com/TerravaleCodex/terravale-preview/actions/workflows/v4-export-live-baseline.yml)
Choose the run on the `v4/offline-live-baseline` branch and download its artifact:
`V4-ACTUAL-LIVE-SITE-AND-OFFLINE-FIRST-PASS`.

Inside it are:
- `V4_Live_Exact_Source_Baseline.zip` (untouched real live version)
- `V4_Live_Layout_Offline_First_Pass.zip` (live version with local-preview modifications)

## Run locally from checkout
```bash
git clone --depth 1 --branch v4/offline-live-baseline https://github.com/TerravaleCodex/terravale-preview.git
cd terravale-preview
python tools/export-v4-offline-first-pass.py
```

Then open `dist/V4_Live_Layout_Offline_First_Pass.html`.

## Important
The V4 user requirements for campaign-specific content, multi-DM/multi-party ownership and player creator tools are documented separately in `docs/V4_OFFLINE_LIVE_FIDELITY_CONTRACT.md`. No false claim of offline data parity is made at this stage. Production main branch remains unchanged.
