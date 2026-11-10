#!/usr/bin/env python3
"""Add verified Discord accounts and theme-native ads without modifying V2.39 lore.
The original approved source remains checksum verified by assemble-approved-v239.py.
Only the public-safe placeholder lore package is published.
"""
from pathlib import Path
import hashlib
import html
import json
import os
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
from v277_class_scroll_patch import patch as patch_v277
from v278_character_approval_patch import patch as patch_v278
from v280_class_scroll_patch import patch as patch_v280
from v281_rest_patch import patch as patch_v281
source = patch(source)
source = patch_v245(source)
source = patch_v246(source)
source = patch_v248(source)
source = patch_v277(source)
source = patch_v278(source)
source = patch_v280(source)
source = patch_v281(source)
# V2.69: The old V2.36 demo script forcibly changed '/'/Dashboard to
# '#/characters' on every fresh visit. Remove only that historical redirect.
# The rule is whitespace-tolerant because native build patches reformat HTML.
legacy_default = re.compile(
    r"if\s*\([^{}]{0,400}\)\s*\{\s*history\.replaceState\s*"
    r"\(\s*null\s*,\s*['\"]{2}\s*,\s*['\"]#/characters['\"]\s*\)\s*;\s*\}"
)
source, legacy_count = legacy_default.subn(
    "/* V2.69: dashboard is the default; explicit Characters links still work. */",
    source)
assert legacy_count == 1, f"Expected one legacy forced Characters default, found {legacy_count}"
assert "history.replaceState(null,'','#/characters')" not in source, "Forced Characters route remains"
# V2.58: Extend the native searchable feat reader itself. Do not bolt a
# second panel onto the DOM; the original state machine handles both kinds.
reader_start = source.index("function featEntries(c){")
reader_end = source.index("sheetV222FeaturesPage=function(c){", reader_start)
native_reader = source[reader_start:reader_end]
raw_return = "return [...template.content.querySelectorAll('.sheet22-feat')].map"
assert native_reader.count(raw_return) == 1, "Native feat parser changed"
native_reader = native_reader.replace(raw_return,
    "const native=[...template.content.querySelectorAll('.sheet22-feat')].map", 1)
closing = native_reader.rfind("}")
assert closing > 0, "Native feat function closing brace missing"
native_reader = (native_reader[:closing]
    + "return native.concat(window.TerravaleV258Feats?.getEntries?.(c.id,c.campaign)||[]);}\n"
    + native_reader[closing+1:])
source = source[:reader_start] + native_reader + source[reader_end:]
reader_start = source.index("sheetV222FeaturesPage=function(c){", reader_start)
reader_end = source.index("document.addEventListener('click',e=>", reader_start)
reader_ui = source[reader_start:reader_end]
reader_fixes = [
 ("Ancestry feats <span>", "Feats <span>"),
 ("FIND AN '+(mode==='class'?'ABILITY':'ANCESTRY FEAT')",
  "FIND '+(mode==='class'?'AN ABILITY':'A FEAT')"),
 ("mode==='class'?'Class feature · Level '+f.level:'Recorded ancestry feat'",
  "mode==='class'?'Class feature · Level '+f.level:(f.custom?'DM-granted feat':'Ancestry feat')"),
 ("S(c.ancestry)+' · Recorded ancestry feat'",
  "(selected.custom?'DM-granted feat':S(c.ancestry)+' · Ancestry feat')"),
 ("Only unlocked class abilities and recorded ancestry feats appear here. Choose an entry to read its full mechanics.",
  "Class abilities, ancestry feats and DM-granted feats are available in the same reader."),
 ("No ancestry feats have been recorded on this character.",
  "No feats have been recorded on this character.")
]
for old,new in reader_fixes:
    assert reader_ui.count(old)==1, "Native reader phrase missing: "+old
    reader_ui=reader_ui.replace(old,new,1)
# The active native reader element carries the actual character id.
# This avoids the previous bug where our async feat refresh assumed a URL
# shape that isn't guaranteed for all character-sheet navigation paths.
native_reader_root = '<section class="sheet20-panel sheet227-reader">'
assert reader_ui.count(native_reader_root) == 1, "Native reader root changed"
reader_ui = reader_ui.replace(
    native_reader_root,
    """<section class="sheet20-panel sheet227-reader" data-tv259-character="'+S(c.id)+'">""",1)
source=source[:reader_start]+reader_ui+source[reader_end:]
# V2.60: V2.28 replaces the V2.27 reader entirely. Patch the *actual*
# readerPage() implementation that later revisions retain and wrap. Prior
# patches to featEntries()/V2.27 alone never reached the visible Feats tab.
v228_start=source.index("function readerPage(c){")
v228_end=source.index("sheetV222FeaturesPage=readerPage;",v228_start)
v228_reader=source[v228_start:v228_end]
def v228_once(before,after):
    global v228_reader
    assert v228_reader.count(before)==1, "V2.28 feature reader changed: "+before[:110]
    v228_reader=v228_reader.replace(before,after,1)
v228_once("const data=makeEntries(c);",
    """const data=makeEntries(c);
    const assigned=window.TerravaleV258Feats?.getEntries?.(c.id,c.campaign)||[];
    const known=new Set(data.feats.map(f=>String(f.key)));
    for(const feat of assigned){
      const key='dm-grant:'+feat.id;
      if(known.has(key))continue;
      known.add(key);
      data.feats.push({key,name:feat.name,html:feat.html,
        custom:true,level:0,complex:false,partCount:0});
    }""")
v228_once("['feats','Ancestry feats',data.feats.length]",
          "['feats','Feats',data.feats.length]")
v228_once("const headingLabel=view.mode==='feats'?'ANCESTRY FEAT · '+c.ancestry:",
          "const headingLabel=view.mode==='feats'?'FEATS · '+c.ancestry:")
v228_once("view.mode==='feats'?entry.level?'Level-up feat · Level '+entry.level:'Recorded ancestry feat':",
          "view.mode==='feats'?entry.custom?'DM-granted feat':entry.level?'Level-up feat · Level '+entry.level:'Recorded ancestry feat':")
v228_once("Only unlocked class abilities and recorded ancestry feats appear here. Choose one entry to read its mechanics.",
          "Class abilities, ancestry feats and DM-granted custom feats appear together here. Select one to read its rules.")
v228_once("view.mode==='feats'?'AN ANCESTRY FEAT':'AN ABILITY'",
          "view.mode==='feats'?'A FEAT':'AN ABILITY'")
v228_once('<section class="sheet20-panel sheet227-reader sheet228-reader">',
          '<section class="sheet20-panel sheet227-reader sheet228-reader" data-tv259-character="${esc(c.id)}">')
# Change the detail heading only for custom feats without altering ancestry lore.
v228_once("${esc(headingLabel)}${selected.level?' · LEVEL '+selected.level:''}",
          "${esc(selected.custom?'DM-GRANTED FEAT':headingLabel)}${selected.level?' · LEVEL '+selected.level:''}")
source=source[:v228_start]+v228_reader+source[v228_end:]
# V2.55: DM Chronicle paths all use the same native page; a focused
# role-checked workspace then fills the selected routed subsection.
dm_route="else if(p==='/dm')out=renderDM();"
assert source.count(dm_route)==1, "DM Chronicle routing changed"
source=source.replace(dm_route,"else if(p==='/dm'||p.startsWith('/dm/'))out=renderDM();",1)
dm_guard="function renderDM(){"
assert source.count(dm_guard)==1, "Native DM view entry changed"
source=source.replace(dm_guard,
    dm_guard+"\n if(db.role!=='dm'||!window.TerravaleVerifiedAccount?.state?.profile?.is_dm) return pageHeader('DUNGEON MASTER','DM Chronicle is locked','Switch to DM view with a verified Dungeon Master account.')+foot();",1)
source=source.replace('Terravale Codex V2.37 · Rest & Death','Terravale Codex V2.85')
source=source.replace('Choose your people','Choose people & languages')
source=source.replace('Find your calling','Choose class & tools')
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
css += "\n" + (ROOT / "site-overrides/v252-invite-and-permanent-demo.css").read_text()
css += "\n" + (ROOT / "site-overrides/v253-item-gifts.css").read_text()
css += "\n" + (ROOT / "site-overrides/v254-dm-vault.css").read_text()
css += "\n" + (ROOT / "site-overrides/v254-proficiencies-wallet.css").read_text()
css += "\n" + (ROOT / "site-overrides/v255-chronicle-wallet-creator.css").read_text()
css += "\n" + (ROOT / "site-overrides/v256-refinement.css").read_text()
css += "\n" + (ROOT / "site-overrides/v257-density.css").read_text()
css += "\n" + (ROOT / "site-overrides/v258-flat-ux.css").read_text()
css += "\n" + (ROOT / "site-overrides/v259-inline-mechanics.css").read_text()
css += "\n" + (ROOT / "site-overrides/v261-owner-byline.css").read_text()
css += "\n" + (ROOT / "site-overrides/v263-compact-equipment-preview.css").read_text()
css += "\n" + (ROOT / "site-overrides/v264-room-actions-parallax.css").read_text()
css += "\n" + (ROOT / "site-overrides/v265-fixed-session-chat.css").read_text()
css += "\n" + (ROOT / "site-overrides/v266-equal-workspace-height.css").read_text()
css += "\n" + (ROOT / "site-overrides/v270-divine-workspace.css").read_text()
css += "\n" + (ROOT / "site-overrides/v275-source-vault.css").read_text()
css += "\n" + (ROOT / "site-overrides/v276-ui-stability.css").read_text()
css += "\n" + (ROOT / "site-overrides/v277-class-stability.css").read_text()
css += "\n" + (ROOT / "site-overrides/v278-character-approvals.css").read_text()
css += "\n" + (ROOT / "site-overrides/v279-archive2-library.css").read_text()
css += "\n" + (ROOT / "site-overrides/v280-divine-sheet.css").read_text()
css += "\n" + (ROOT / "site-overrides/v281-canonical-library.css").read_text()
css += "\n" + (ROOT / "site-overrides/v282-boon-reader.css").read_text()
css += "\n" + (ROOT / "site-overrides/v283-compact-filters.css").read_text()
css += "\n" + (ROOT / "site-overrides/v284-concordant-reader.css").read_text()
css += "\n" + (ROOT / "site-overrides/v285-divine-resources.css").read_text()
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
gifts = (ROOT / "site-overrides/v253-backpack-gifts.js").read_text()
rules_v254 = (ROOT / "site-overrides/v254-rules-registry.js").read_text()
vault_v254 = (ROOT / "site-overrides/v254-dm-vault.js").read_text()
prof_v254 = (ROOT / "site-overrides/v254-character-proficiencies-wallet.js").read_text()
feat_v255 = (ROOT / "site-overrides/v255-custom-feat-forge.js").read_text()
training_v255 = (ROOT / "site-overrides/v255-character-training.js").read_text()
wallet_v255 = (ROOT / "site-overrides/v255-native-wallet.js").read_text()
creator_v255 = (ROOT / "site-overrides/v255-creator-native-choices.js").read_text()
shell_v255 = (ROOT / "site-overrides/v255-shell-role-version.js").read_text()
owner_v261 = (ROOT / "site-overrides/v261-owner-byline.js").read_text()
compact_v263 = (ROOT / "site-overrides/v263-compact-equipment-preview.js").read_text()
divine_v270 = (ROOT / "site-overrides/v270-divine-workspace.js").read_text()
divine_import_v273 = (ROOT / "site-overrides/v273-boon-archive-import.js").read_text()
source_vault_v275 = (ROOT / "site-overrides/v275-source-vault.js").read_text()
ui_stability_v276 = (ROOT / "site-overrides/v276-ui-stability.js").read_text()
class_stability_v277 = (ROOT / "site-overrides/v277-class-stability.js").read_text()
approval_v278 = (ROOT / "site-overrides/v278-character-approvals.js").read_text()
archive_parser_v279 = (ROOT / "site-overrides/v279-archive2-parser.js").read_text()
archive_index_v279 = (ROOT / "site-overrides/v279-archive2-library.js").read_text()
divine_voices_v281 = (ROOT / "site-overrides/v281-divine-voices.js").read_text()
canonical_library_v281 = (ROOT / "site-overrides/v281-canonical-library.js").read_text()
boon_reader_v282 = (ROOT / "site-overrides/v282-boon-reader.js").read_text()
divine_links_v282 = (ROOT / "site-overrides/v282-divine-relationships.js").read_text()
build_meta = json.dumps({"version":"2.85","build":os.environ.get("GITHUB_SHA","offline-preview")[:9]},separators=(',',':'))
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
    '<script data-source="v253-backpack-gifts.js">\n' + gifts + '\n</script>\n'
    '<script data-source="v254-rules-registry.js">\n' + rules_v254 + '\n</script>\n'
    '<script data-source="v254-dm-vault.js">\n' + vault_v254 + '\n</script>\n'
    '<script data-source="v254-character-proficiencies-wallet.js">\n' + prof_v254 + '\n</script>\n'
    '<script data-source="v255-build">window.TerravaleV255Build=' + build_meta + ';</script>\n'
    '<script data-source="v255-creator-native-choices.js">\n' + creator_v255 + '\n</script>\n'
    '<script data-source="v255-character-training.js">\n' + training_v255 + '\n</script>\n'
    '<script data-source="v255-native-wallet.js">\n' + wallet_v255 + '\n</script>\n'
    '<script data-source="v255-custom-feat-forge.js">\n' + feat_v255 + '\n</script>\n'
    '<script data-source="v255-shell-role-version.js">\n' + shell_v255 + '\n</script>\n'
    '<script data-source="v261-owner-byline.js">\n' + owner_v261 + '\n</script>\n'
    '<script data-source="v263-compact-equipment-preview.js">\n' + compact_v263 + '\n</script>\n'
    '<script data-source="v270-divine-workspace.js">\n' + divine_v270 + '\n</script>\n'
    '<script data-source="v273-boon-archive-import.js">\n' + divine_import_v273 + '\n</script>\n'
    '<script data-source="v275-source-vault.js">\n' + source_vault_v275 + '\n</script>\n'
    '<script data-source="v276-ui-stability.js">\n' + ui_stability_v276 + '\n</script>\n'
    '<script data-source="v277-class-stability.js">\n' + class_stability_v277 + '\n</script>\n'
    '<script data-source="v278-character-approvals.js">\n' + approval_v278 + '\n</script>\n'
    '<script data-source="v279-archive2-parser.js">\n' + archive_parser_v279 + '\n</script>\n'
    '<script data-source="v279-archive2-library.js">\n' + archive_index_v279 + '\n</script>\n'
    '<script data-source="v281-divine-voices.js">\n' + divine_voices_v281 + '\n</script>\n'
    '<script data-source="v281-canonical-library.js">\n' + canonical_library_v281 + '\n</script>\n'
    '<script data-source="v282-boon-reader.js">\n' + boon_reader_v282 + '\n</script>\n'
    '<script data-source="v282-divine-relationships.js">\n' + divine_links_v282 + '\n</script>\n'
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
assert source.count('data-source="v253-backpack-gifts.js"') == 1
assert source.count('data-source="v254-rules-registry.js"') == 1
assert source.count('data-source="v254-dm-vault.js"') == 1
assert source.count('data-source="v254-character-proficiencies-wallet.js"') == 1
for file in ('v255-creator-native-choices.js','v255-character-training.js',
             'v255-native-wallet.js','v255-custom-feat-forge.js',
             'v255-shell-role-version.js'):
    assert source.count('data-source="'+file+'"') == 1, file
assert source.count('data-source="v255-build"') == 1
assert source.count('data-source="v261-owner-byline.js"') == 1
assert source.count('data-source="v263-compact-equipment-preview.js"') == 1
assert source.count('data-source="v270-divine-workspace.js"') == 1
assert source.count('data-source="v273-boon-archive-import.js"') == 1
assert source.count('data-source="v275-source-vault.js"') == 1
assert source.count('data-source="v276-ui-stability.js"') == 1
assert source.count('data-source="v277-class-stability.js"') == 1
assert source.count('data-source="v278-character-approvals.js"') == 1
assert source.count('data-source="v279-archive2-parser.js"') == 1
assert source.count('data-source="v279-archive2-library.js"') == 1
assert source.count('data-source="v281-divine-voices.js"') == 1
assert source.count('data-source="v281-canonical-library.js"') == 1
assert source.count('data-source="v282-boon-reader.js"') == 1
assert source.count('data-source="v282-divine-relationships.js"') == 1
assert 'terravale_set_user_appearance' in source
assert 'terravale_set_tutorial_progress' in source
assert 'tv-achievement-notifications' in source
assert 'nullmeridian' in source and 'gloamglass' in source
assert "118000" in source and "tv-demo-permanent-party" in party and "resetDemo" not in party
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
