# The Living Codex V4 — Offline, Live-Fidelity Rebuild

Status: implementation baseline; **not a completed offline port**. This branch starts at the live public-preview source tree and leaves main/production untouched.

## Non-negotiable product contract
1. Start from the **actual live V2 visual and interaction model** (including full sheets, Session Room, campaign management, DM Chronicle, journal and codex), not from an older V3/V4 prototype or an unrelated lookalike UI.
2. Refactor away cumulative DOM fixes and layered override CSS/JS into modular, testable, first-class components. Preserve user-visible behaviour while internal wiring changes.
3. Offline first, with stable IDs and explicit account, campaign, party, content, and character ownership. A storage adapter may start local; the eventual online adapter must support authentication, row-level permissions, real-time subscriptions and scheduled notifications.
4. New campaigns start with *zero* enabled classes, ancestries, or lore, regardless of what Public Codex contains. Character creation requires at least one enabled class **and** one enabled ancestry. No hidden auto-inheritance from SRD/core classes.
5. Campaign Library & Notes only shows entries explicitly associated with the active campaign. With no active campaign, only Journal and Saved References are listed. No accidental cross-campaign leakage.
6. Fixed non-collapsing desktop sidebar. Mobile can use a simple open/close overlay with no animation choreography.
7. Themes: offline Classic and Midnight replace the live default. Theme changes apply across the full interface, including character sheets and Session Room.
8. Session Room is a native page, never a redirect invitation or a second sidebar shortcut. Preserve the live initiative / chat / dice layout.
9. Player vs DM views: DM Chronicle is the DM-facing content and campaign administration home. Player Creator Studio contains Character Creator, Item Vault, Feat Forge and Favour of Divine. Online role checks must be enforced by the server, not by hidden navigation.

## Sidebar / conditional visibility
Dashboard
---
Campaigns
Characters
Session Room
---
DM Chronicle (DM view only)
---
Library & Notes
  * Classes (only when at least one active campaign class is enabled)
  * Ancestries (only when at least one active campaign ancestry is enabled)
  * Lore Codex (only when at least one active campaign lore entry is enabled)
  * Items, Feats and other reference categories (same opt-in rule)
  * Journal
  * Saved References
---
Public Codex (global, always separate)
---
Creator Studio (player view only, category heading)
  * Character Creator
  * Item Vault
  * Feat Forge
  * Favour of Divine

Appearance, identity, account and export/backup controls may remain in a compact footer or settings area.

## Model boundaries
- accounts: account_id, handle, profile
- campaigns: campaign_id, metadata, system/ruleset, DM memberships
- parties: party_id, campaign_id, members
- content: content_id, content_type, version, owner, visibility, rules payload
- campaign_content: campaign_id + content_id + enabled/version
- characters: character_id + campaign_id + party_id + owner_id + approved state + build + live resources
- sessions: session_id + party_id + date/time + plan + room state
- journal, saved references and favour: scoped appropriately; only authorized published/granted boons visible to players

Do not clone global reference content blindly into every campaign; enable by reference with explicit version locking where necessary.

## Parity milestones
1. Inventory the currently deployed V2.86/V2.87 routes, UI, feature behaviours, assets, and embedded room/sheet interfaces. Capture tests/screenshots.
2. Establish a running offline copy of the exact deployed UI and static assets. Stub cloud calls only behind a typed local adapter, rather than replacing screens with mock pages.
3. Isolate the navigation shell, campaign context, and appearance tokens. Implement the new sidebar and two themes.
4. Separate campaign content from global Public Codex; enforce class + ancestry gate at the model layer and in UI.
5. Port DM Chronicle and Creator Studio natively; preserve character-sheet and Session Room behaviour.
6. Add multi-DM/multi-party permissions and session planning, then validate export/import and transition to a cloud adapter.
7. Regression-test each route against the live reference before declaring visual/function parity.

### Warning
The existing published preview includes historical overrides. This branch is a **source baseline only**. Its presence does not mean a clean refactor or finished offline copy exists. The local V4 proof-of-concept delivered separately is a model/navigation exercise, not a substitute for the full fidelity port.
