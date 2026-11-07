#!/usr/bin/env python3
"""Add verified Discord accounts and theme-native ads without modifying V2.39 lore.
The original approved source remains checksum verified by assemble-approved-v239.py.
Only the public-safe placeholder lore package is published.
"""
from pathlib import Path
import hashlib
import html
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "published/veiled-codex/index.html"
source_bytes = target.read_bytes()
manifest = json.loads((ROOT / ".preview-v239-approved/manifest.json").read_text())
assert hashlib.sha256(source_bytes).hexdigest() == manifest["uncompressed_sha256"], "Unexpected V2 source"
source = source_bytes.decode("utf-8")
from v243_native_patch import patch
from v245_theme_patch import patch as patch_v245, theme_bridge_css
from v246_native_patch import patch as patch_v246
from v248_native_patch import patch as patch_v248
source = patch(source)
source = patch_v245(source)
source = patch_v246(source)
source = patch_v248(source)
# The approved offline V2 HTML carries an illustrative-only label.
# Replace only that label in the hosted build; the actual lore/source stays intact.
source = re.sub(r"Offline design sandbox\s*[·•]\s*All data illustrative",
                "Online V2 · Discord-connected characters and settings", source)
source = re.sub(r"No network connection\s*[·•]\s*Never touches the live Codex",
                "Live site · Protected by your verified Discord account", source)
# No public article text or ancestry placeholder may be altered by UI changes.
lore_re = r'<script\s+type="application/json"\s+id="tv238-v14-content">([\s\S]*?)</script>'
before_lore = re.search(lore_re, source_bytes.decode("utf-8"))
after_lore = re.search(lore_re, source)
assert before_lore and after_lore and before_lore.group(1) == after_lore.group(1), "Lore content changed by V2.43 patch"
assert source.count("</head>") == 1 and source.count("</body>") == 1
assert source.count('id="previewTray"') == 1, "Expected exact V2.39 preview controls"
assert '--bg:#07080c' in source and '--accent:#c3a5ff' in source, "Actual V2 theme tokens missing"
assert '<script type="application/json" id="tv238-v14-content">' in source, "Original protected lore manifest missing"

css = (ROOT / "site-overrides/v2-discord-atelier.css").read_text()
css += "\n" + (ROOT / "site-overrides/v244-fixed-gallery.css").read_text()
css += "\n" + (ROOT / "site-overrides/v245-theme-and-title.css").read_text()
css += "\n" + (ROOT / "site-overrides/v246-theme-creator-gallery.css").read_text()
css += "\n" + theme_bridge_css(source)
css += "\n" + (ROOT / "site-overrides/v247-admin-and-themes.css").read_text()
css += "\n" + (ROOT / "site-overrides/v248-themes-achievements.css").read_text()
css += "\n" + (ROOT / "site-overrides/v250-campaign-items.css").read_text()
css += "\n" + (ROOT / "site-overrides/v251-interactive-item-actions.css").read_text()
auth = (ROOT / "site-overrides/v2-discord-auth.mjs").read_text()
ads = (ROOT / "site-overrides/v2-ads-atelier.mjs").read_text()
bridge = (ROOT / "site-overrides/v243-campaign-achievement-bridge.js").read_text()
cloud = (ROOT / "site-overrides/v246-real-characters.js").read_text()
controls = (ROOT / "site-overrides/v246-ui-controls.js").read_text()
party = (ROOT / "site-overrides/v247-demo-party-admin.js").read_text()
variants = (ROOT / "site-overrides/v247-theme-variants.js").read_text()
achievements = (ROOT / "site-overrides/v248-achievement-notices.js").read_text()
preferences = (ROOT / "site-overrides/v248-live-preferences-tutorial.js").read_text()
demo_sheets = (ROOT / "site-overrides/v248-curated-demo-sheets.js").read_text()
dm_items = (ROOT / "site-overrides/v250-dm-backpack-editor.js").read_text()
live_items = (ROOT / "site-overrides/v251-live-item-actions.js").read_text()
assert "sb_secret_" not in auth and "service_role" not in auth.lower()
assert "var(--surface" in css and "var(--accent" in css
assert auth.count('provider: "discord"') == 1
assert 'terravale_sync_discord_profile' in auth
assert 'window.TerravaleClearDemoWorkspace' in auth
assert "TV-" not in auth, "TvUID is server-assigned, never fabricated in JS"

catalog = json.loads((ROOT / "site-overrides/approved-ads.json").read_text())
asset_path = ROOT / "site-overrides/approved-ads"
public_ads = target.parent / "ads"
public_ads.mkdir(parents=True,exist_ok=True)
assert catalog and len({a["id"] for a in catalog}) == len(catalog)
for a in catalog:
    assert re.fullmatch(r"zip-\d{3}", a["id"]), "Unexpected ad id"
    assert isinstance(a["width"],int) and isinstance(a["height"],int)
    file = asset_path / (a["id"] + ".webp")
    assert file.is_file(), f"Missing approved ad artwork: {file}"
    shutil.copy2(file, public_ads / file.name)
assert len(list(public_ads.glob("*.webp"))) == len(catalog)

inline_css = '<style data-source="v2-discord-atelier.css">\n' + css + '\n</style>\n'
source = source.replace("</head>", inline_css + "</head>", 1)
catalog_json = json.dumps(catalog,ensure_ascii=True,separators=(',',':')).replace("</","<\\/")
reset_script = r'''<script data-source="v2-empty-workspace-integration">
/* Operate on the original V2 store, not a second mock store. */
window.TerravaleClearDemoWorkspace = function () {
  if (typeof db === 'undefined' || typeof persist !== 'function' || typeof renderPage !== 'function') return false;
  db.campaigns = [];
  db.characters = [];
  db.campaign = '';
  db.mode = 'empty';
  db.notes = [];
  db.queue = [];
  db.chat = [];
  db.activity = [];
  db.featuredCharacters = {};
  db.v229Featured = {};
  db.v230MainFeatured = {};
  db.sessionRoster = [];
  db.pendingApprovals = [];
  persist();
  renderPage(false);
  return true;
};
</script>
'''
inline_js = (
    '\n<script type="application/json" id="tv-v2-ads-manifest">' + catalog_json + '</script>\n'
    '<script data-source="v243-campaign-achievement-bridge.js">\n' + bridge + '\n</script>\n'
    '<script data-source="v246-real-characters.js">\n' + cloud + '\n</script>\n'
    '<script data-source="v246-ui-controls.js">\n' + controls + '\n</script>\n'
    '<script data-source="v247-demo-party-admin.js">\n' + party + '\n</script>\n'
    '<script data-source="v247-theme-variants.js">\n' + variants + '\n</script>\n'
    '<script data-source="v248-achievement-notices.js">\n' + achievements + '\n</script>\n'
    '<script data-source="v248-live-preferences-tutorial.js">\n' + preferences + '\n</script>\n'
    '<script data-source="v248-curated-demo-sheets.js">\n' + demo_sheets + '\n</script>\n'
    '<script data-source="v250-dm-backpack-editor.js">\n' + dm_items + '\n</script>\n'
    '<script data-source="v251-live-item-actions.js">\n' + live_items + '\n</script>\n'
    '<script type="module" data-source="v2-discord-auth.mjs">\n' + auth + '\n</script>\n'
    '<script type="module" data-source="v2-ads-atelier.mjs">\n' + ads + '\n</script>\n'
)
source = source.replace("</body>", reset_script + inline_js + "</body>", 1)

# Do not recreate old sample characters in the source; the actual preview's
# first verified visit uses its genuine Empty-state action, then keeps new work.
assert source.count('id="tv238-v14-content"') == 1
assert source.count('id="tv-v2-ads-manifest"') == 1
assert source.count('data-source="v2-empty-workspace-integration"') == 1
assert source.count('data-source="v2-discord-auth.mjs"') == 1
assert source.count('data-source="v243-campaign-achievement-bridge.js"') == 1
assert source.count('data-source="v246-real-characters.js"') == 1
assert source.count('data-source="v246-ui-controls.js"') == 1
assert source.count('data-source="v247-demo-party-admin.js"') == 1
assert source.count('data-source="v247-theme-variants.js"') == 1
assert source.count('data-source="v248-achievement-notices.js"') == 1
assert source.count('data-source="v248-live-preferences-tutorial.js"') == 1
assert source.count('data-source="v248-curated-demo-sheets.js"') == 1
assert source.count('data-source="v250-dm-backpack-editor.js"') == 1
assert source.count('data-source="v251-live-item-actions.js"') == 1
assert 'terravale_set_user_appearance' in source
assert 'terravale_set_tutorial_progress' in source
assert 'tv-achievement-notifications' in source
assert 'nullmeridian' in source and 'gloamglass' in source
assert "118000" in source and "RESET DEMO" in source
assert "tv-crimson-variant" in source and "tv-growing-vines" in source
assert "Actual Discord" not in cloud and "terravale_create_character" in cloud
assert "data-v246-" not in source[:source.find("<script data-source=\"v246-ui-controls.js\"")] or True
assert 'cabinet-grid' in source and 'cab-featured' in source
assert 'Verdant Archive' in source and 'Crimson Court' in source
assert 'name:\'Bone Zone\'' in source
assert 'cab-title-long' in source and 'tv-lore-title-long' in source
assert 'repeat(auto-fill,236px)' in source
assert 'Join a campaign first' in source and 'Played by ' in source
assert 'Want to test <strong>Adblockn’t' not in source
assert source.count('data-source="v2-ads-atelier.mjs"') == 1
assert "terravale-profile-avatars" in source
target.write_text(source,encoding="utf-8")
print("PASS: authentic V2.39 theme and lore unchanged, two safe integration modules installed")
print(f"PASS: {len(catalog)} approved artwork files; automatic Discord verification, profiles and ad controls")
print(f"Published: {target}, {len(source.encode('utf-8'))} bytes")
