# V4 — Actual V2.87 Live UI with Offline Database Emulation

The exact **original V2.87 live HTML** is still compiled using the original official site sources and remains available as a byte-for-byte untouched reference. The local V4 fork keeps its native dashboard, characters, sheets, Session Room and Chronicle scripts.

## Running the local fork

Run `python tools/export-v4-offline-first-pass.py` in the source repository or the companion Windows builder. Open the resulting `dist/V4_Live_Layout_Offline_First_Pass.html`, preferably served from `http://127.0.0.1:8765` so the local database keeps a stable browser origin.

On Windows use `BUILD_FROM_LIVE.bat` then `START_OFFLINE.bat` from the downloadable builder. The first command downloads the source; the second runs without internet.

The V4 data compatibility layer lives at `v4/offline-database.js`; it replaces the V2 Discord/Supabase client in this local build. It never calls production RPCs, and no authenticated account, protected lore or production record is copied.

## Implemented local data methods

The IndexedDB emulator (with a localStorage fallback) stores versioned records for profiles, campaigns, membership, join codes, parties, campaign-enabled content, characters, state, approvals, inventory, DM vault, wallet/ledger, custom feats and backup metadata.

- Separate local DM/player profiles, with campaign-scoped DM memberships
- Campaign creation, invitation codes, joining and leave safeguards
- Campaigns default to **zero enabled classes and ancestries**
- Character-save validation rejects any class or ancestry not enabled by that campaign
- Original V2 character create/save/sync and initial or level-up approval RPCs
- Basic DM Item Vault create/edit/delete, stock issuing, inventory edit
- Character wallets and ledger with non-negative balances and owner/DM controls
- Custom feat creation, archival, grants and revocation
- JSON full database export/import for portability

The new `Offline DB` control in the real V2 header exposes local profile switching, campaign content enablement, co-DM assignments, parties, and backup controls.

## Still outstanding

This is a **functional partial offline backend**, not full V2.87 parity. Divine boon/favour RPCs, charge/rest mechanics, advanced class/proficiency choices, media uploads, real-time cross-device play, final multi-party session routing, and every remaining cloud RPC require porting.

Unimplemented methods return a visible `Offline database: Method ... needs an offline implementation` error; they do **not** claim a successful save.

The existing visual campaign library and character creation menus are still the authentic V2 ones; save-time campaign eligibility is enforced, but full campaign-filtered menu rendering remains a separate task. Local profile switching is a simulator on one computer, not secure online authentication.

## Verification

```
python -m unittest discover -s tests -p 'test_v4_actual_live_parity.py' -v
node tests/v4-offline-database.cjs
```

The production main branch and live Supabase/Neon data are not modified. Work takes place solely in `v4/offline-live-baseline`.
