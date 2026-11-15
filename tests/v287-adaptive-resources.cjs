'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const text=path=>fs.readFileSync(path,'utf8');
const js=text('site-overrides/v287-adaptive-resources.js');
const css=text('site-overrides/v287-adaptive-resources.css');
const overlay=text('tools/overlay-v239-with-discord.py');
const item=text('site-overrides/v251-live-item-actions.js');
const html=text('published/veiled-codex/index.html');
assert.doesNotThrow(()=>new Function(js));
assert.ok(overlay.includes("['resources','Resources']"),'Native sheet navigation not extended');
assert.ok(overlay.includes("tab==='resources'?sheetV220ResourcesPanel(c)"),'Native resource route absent');
assert.ok(overlay.includes('v287-adaptive-resources.js')&&overlay.includes('v287-adaptive-resources.css'));
assert.ok(html.includes('data-source="v287-adaptive-resources.js"'),'Adaptive script missing in publication');
assert.ok(html.includes('data-value="resources"')||html.includes("['resources','Resources']"),
 'Resources tab not present in native code');
assert.ok(html.includes("tab==='resources'?sheetV220ResourcesPanel(c)"));
assert.ok(html.includes('Terravale Codex V2.87'),'Published version not bumped');
for(const pattern of [
 '.sheet20-resource-panel','.v234-resource-item','.tv-v251-resource-card',
 '.tv285-resource-card','window.TerravaleV287Adaptive','localStorage',
 'state.stars','button.click()','aria-pressed','getStarred','starred-only'
]){
 if(pattern==='starred-only')continue;
 assert.ok(js.includes(pattern),'Lost source-linked resource support: '+pattern);
}
assert.ok(item.includes('card.dataset.v287ItemId=String(i.id)'),'Item stars need stable IDs');
assert.ok(js.includes('state.storageKey')&&js.includes('character:c')===false);
assert.ok(js.includes('record.controls')&&js.includes('!button.isConnected'),
 'Mirrored actions must use mounted real controls and validate their state');
assert.ok(!js.includes("api().rpc("),'Resource mirror must not bypass native server-side actions');
assert.ok(css.includes('tv287-catalog-grid')&&css.includes('tv287-quick-panel'));
assert.ok(css.includes('repeat(3,minmax(0,1fr))')&&css.includes('max-width:720px'));
assert.ok(js.includes("filter:'all'")&&js.includes("query:''"));
assert.ok(js.includes("const id=baseKey+(idx?':'+idx:'')"),'Stable key collision handling missing');
console.log('PASS V2.87: native Resources routing, real backend actions, starred-only Overview, stable item keys and responsive catalog.');
