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
source = patch(source)
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
auth = (ROOT / "site-overrides/v2-discord-auth.mjs").read_text()
ads = (ROOT / "site-overrides/v2-ads-atelier.mjs").read_text()
bridge = (ROOT / "site-overrides/v243-campaign-achievement-bridge.js").read_text()
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
assert 'Join a campaign first' in source and 'Played by ' in source
assert 'Want to test <strong>Adblockn’t' not in source
assert source.count('data-source="v2-ads-atelier.mjs"') == 1
assert "terravale-profile-avatars" in source
target.write_text(source,encoding="utf-8")
print("PASS: authentic V2.39 theme and lore unchanged, two safe integration modules installed")
print(f"PASS: {len(catalog)} approved artwork files; automatic Discord verification, profiles and ad controls")
print(f"Published: {target}, {len(source.encode('utf-8'))} bytes")
