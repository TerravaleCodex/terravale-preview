/* V2.85 — source-based god-family filters and spell-slot-style Divine charges.
   Inspect the assembled page, not only the separate override modules. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('site-overrides/v270-divine-workspace.js');
const catalog=read('site-overrides/v281-canonical-library.js');
const styles=read('site-overrides/v285-divine-resources.css');
const sql=read('site-overrides/sql/v285_divine_god_families.sql');
const overlay=read('tools/overlay-v239-with-discord.py');
const published=read('published/veiled-codex/index.html');
for(const src of [ui,catalog])assert.doesNotThrow(()=>new Function(src));
for(const feature of [
 'divineChargeState(g)','tv285-resource-card','tv285-resource-count',
 'tv285-charge-pips','tv285-charge-pip','− Spend','+ Restore','tv285-resource-recovery',
 "gift.kind==='minor_intercession'",'values.isShared',
 'renderNativeDivineConsequences(c,sheet.cache.get(c.id)?.data)'
])assert.ok(ui.includes(feature),'Source-backed native-style resource feature missing: '+feature);
assert.ok(ui.includes("text.includes('campaign arc')"),'Campaign-arc resources must not appear long-rest recoverable');
assert.ok(ui.includes("text.includes('proficiency bonus')"),'PB-based uses need original wording');
assert.ok(ui.includes('terravale_divine_canon_dm_refill'),'Correct canonical DM restore function required');
assert.ok(ui.includes("values.remaining>=values.maximum"),'No overfilling');
assert.ok(ui.includes('restore.disabled=!isDM()'),'Player cannot bypass source recovery');
assert.ok(ui.includes('renderNativeDivineConsequences'),'Native Conditions & Tracking integration missing');
assert.ok(ui.includes('tv285-native-condition-grid'));
assert.ok(ui.includes("burden.stacks"),'Divine burdens should remain separate from removable conditions');
assert.ok(styles.includes('tv285-resource-spend')||styles.includes('tv285-resource-actions button'));
assert.ok(styles.includes('.tv285-charge-pip.is-filled'));
assert.ok(styles.includes('tv283-filter-unit[data-filter="majorGod"]'));
assert.ok(styles.includes('tv283-filter-unit[data-filter="minorGod"]'));
assert.ok(catalog.includes("['majorGod','Major gods'"));
assert.ok(catalog.includes("['minorGod','Minor gods'"));
assert.ok(catalog.includes("options.divinity=group;options.patron=patron"));
assert.ok(catalog.includes('major_patrons')&&catalog.includes('minor_patrons'));
assert.ok(catalog.includes('filter_divinity:options.divinity'));
assert.ok(catalog.includes('terravale_divine_dm_archive_search_v285'));
assert.ok(!catalog.includes("['patron','God',filterLabel('patron')]"),
 'Old combined god selector must not appear');
assert.ok(!catalog.includes('tv282-patron-chips'),'No giant scrollable god list');
assert.ok(sql.includes("e.kind in('minor_grace','minor_intercession')"));
assert.ok(sql.includes("e.kind not in('minor_grace','minor_intercession')"));
assert.ok(sql.includes('major_patrons')&&sql.includes('minor_patrons'));
assert.ok(sql.includes('authz.is_dm(target_campaign)'),'DM-only protected search');
assert.ok(sql.includes('revoke all on function'),'No anonymous executable catalogue search');
assert.ok(overlay.includes('v285-divine-resources.css'));
assert.ok(published.includes('tv285-charge-pips'));
assert.ok(published.includes('V2.85'));
console.log('PASS V2.85 — separate Major/Minor gods, visual charge slots, native read-only divine consequences and recovery rules.');
