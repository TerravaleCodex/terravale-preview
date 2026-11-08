/* V2.64: no second Weapons & Powers block; character actions are inside native Dice & Checks. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const js=fs.readFileSync('site-overrides/v251-live-item-actions.js','utf8');
const css=fs.readFileSync('site-overrides/v264-room-actions-parallax.css','utf8');
const inspector=fs.readFileSync('site-overrides/v263-compact-equipment-preview.js','utf8');
const html=fs.readFileSync('published/veiled-codex/index.html','utf8');
const overlay=fs.readFileSync('tools/overlay-v239-with-discord.py','utf8');
for(const expected of [
 'const tableUI={mode:',
 "dicePanel=document.querySelector('#pageRoot .sr-dice-panel')",
 "'Dice'","'Quick Checks'","'Character Actions'",
 'role','tablist','data-v264-room-tab',
 "tableUI.mode='dice'","paintRoomTabs(dicePanel,diceArea,actionsPanel,actors)",
 "const actionsPanel=renderRoomActions(actors,signature,dicePanel)",
 "c.owner==='You'||(db.role==='dm'&&dm(c))",
 'roomCard(chosen)','tv-v264-character-picker',
 'data-v264-actor','data-v264-inspect',
 'tv-v264-roll-history',
 "renderLog()",
 'rollItem(c,i,b.dataset.tvItemAction)',
 'useItem(c,i,b.dataset.tvItemAction)',
 "'terravale_item_action'","'terravale_item_rest'",
 'window.TerravaleV263Inspector?.open',
 "const nativeToggle=diceArea.querySelector('[data-action=\"toggleQuickChecks\"]')",
 'nativeToggle.click()',
 "e.pointerType==='touch'",
 "prefers-reduced-motion: reduce"
])assert.ok(js.includes(expected),'Missing V2.64 integration: '+expected);
assert.ok(!js.includes("node('h3','','Weapons and powers')"),'No extra full-width Weapons and Powers panel');
assert.ok(!js.includes("activity.insertAdjacentElement('beforebegin',panel)"),'No detached item-action panel below chat');
assert.ok(js.includes("panel?.remove()"),'Selection changes clear the old actions before redrawing');
assert.ok(js.includes("role==='dm'"),'DM-only selection remains conditional');
assert.ok(inspector.includes('window.TerravaleV263Inspector={'),'Existing item details open from Session Room');
assert.ok(inspector.includes("sameCampaign=c.campaign===db.campaign"),'Inspector respects campaign scope');
for(const x of ['.tv-v264-room-tabs','.tv-v264-character-picker','.tv-v264-room-tab',
 '.sr-dice-area[hidden]','.tv-v264-quick-only','.tv-v264-roll-history',
 '.sr-encounter::before','.sr-encounter::after','prefers-reduced-motion:reduce'])
 assert.ok(css.includes(x),'Missing compact/motion styles '+x);
assert.ok(overlay.includes('v264-room-actions-parallax.css'),'Styles included in generated build');
assert.ok(html.includes('Terravale Codex V2.65'),'New version appears in the preview');
for(const p of ['site-overrides/v251-live-item-actions.js','site-overrides/v263-compact-equipment-preview.js'])
 cp.execFileSync('node',['--check',p]);
console.log('PASS: compact Dice/Checks/Character Actions; owner/DM RPCs reused; accessible item inspection; encounter-only reduced-motion parallax.');
