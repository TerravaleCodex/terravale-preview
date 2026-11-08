# V2.70 Divine Ledger — Operations and Canon Boundary

## Included
- **DM Chronicle → Divine Favour**: select a campaign character; adjust individual god favour from **−10 to +10**; add or edit patron previews; author boon mechanics as private drafts; mark ready; grant/revoke deliberately; review activity.
- **Character sheet → Divine**: shows only active, **DM-awarded** boons with mechanics. Owner/authorised DM also sees the personal favour counters. Approved, shared sheets may show received boons to party members, but never raw favour/DM notes.
- **Three boon families**: Divine Boons (Major/Greater Gods), Minor God Boons (Minor Gods), and Concordant Boons (two qualifying patrons).
- **Limits**: up to three active non-Concordant boons for one patron, plus one active Concordant Boon. Both patrons' favour must meet the Concordant threshold.
- **Favour thresholds**: DM specifies integer 1–10 per boon, but reaching a threshold only enables the **DM to grant**; it never automatically reveals or awards a boon.
- **Public-safe previews**: only Major/Greater Gods. Initial generic starter cards: Pae, Kalma, Tyrius. The DM may add other gods and change player-safe hint text. The preview never includes unpublished mechanics.

## Backend privacy architecture
- All five new tables are RLS-enabled and have **no direct authenticated/anonymous table privileges**. Zero row-level direct-read policies is **deliberate deny-by-default**, not a missing protection.
- Authenticated clients read only via `terravale_divine_player_state(uuid)`, which checks Discord verification, campaign membership and ownership/shared-sheet permission and returns awarded boons only.
- Full catalog, favour notes and history via `terravale_divine_dm_state(uuid)`, checking the campaign's actual `authz.is_dm` role.
- All mutations live in guarded DM-only RPCs; no DOM hiding or Discord username is accepted as permission.
- Grant is checked again on the server for publication state, favour thresholds, active slots and campaign match.
- Direct SQL access to private tables must **not** be granted to frontend users.
- Security advisors report authenticated-executable `SECURITY DEFINER` RPCs because they are intentional API endpoints; each checks `auth.uid`, verified Discord and `authz.is_dm` before returning private content or mutating data. Review this on future edits.

## Source text still to import
The prior complete boon canon comes from the 49 original `80_DnD/Boons` Markdown files in the Terravale Main Vault: Divine, Minor God, and Concordant sources. **This release does not synthesize or publish those full mechanics** because the authoritative source bytes were not included in this repo. The DM-only prepared-boon editor is ready for direct, lossless import after the source files are supplied. Do not invent a blanket universal tier threshold: use the correct canon requirements in each entry.

## Release and test
- SQL: `site-overrides/sql/v270_divine_favour_boons.sql`; tested on staging, then applied as an additive production migration.
- Styles/script: `site-overrides/v270-divine-ui.css` and `v270-divine-ui.js`.
- Native Chronicle tab in `v254-dm-vault.js`; build integration in `tools/overlay-v239-with-discord.py`.
- Automated tests in `tests/v270-divine-system.cjs`. The staging transaction verified hidden→granted→revoked visibility without persisting test data.
