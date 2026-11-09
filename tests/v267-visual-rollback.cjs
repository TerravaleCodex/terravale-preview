/* V2.67 — rollback ONLY decorative, low-resolution texture layers.
   Preserve Session Room matched height, normal chat and item/feat/currency logic. */
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('published/veiled-codex/index.html');
const generator=read('tools/overlay-v239-with-discord.py');
const layout=read('site-overrides/v266-equal-workspace-height.css');
const version=read('site-overrides/v255-shell-role-version.js');
const room=read('site-overrides/v251-live-item-actions.js');
const inspect=read('site-overrides/v263-compact-equipment-preview.js');
const oldCosmetics=[
 'v265-texture-dashboard.css','v265-texture-character.css','v265-texture-initiative.css',
 'v265-texture-lore.css','v265-texture-achievements.css','v265-atmosphere.css',
 'v265-atmosphere.js','v266-richer-atmosphere.css','v266-cabinet-texture.js'
];
for(const file of oldCosmetics){
 assert.ok(!generator.includes('site-overrides/'+file),
  'Low-resolution layer still injected into generator: '+file);
}
for(const marker of [
 '--tv265-art-dashboard','--tv265-art-character','--tv265-art-initiative',
 '--tv265-art-lore','--tv265-art-achievements',
 'data-source="v265-atmosphere.js"','data-source="v266-cabinet-texture.js"',
 'tv266-arena-breathe','tv265-appearance-panel'
]){
 assert.ok(!html.includes(marker),'Low-resolution visual layer remains in generated HTML: '+marker);
}
for(const marker of ['v266-equal-workspace-height.css','v264-room-actions-parallax.css']){
 assert.ok(generator.includes(marker),'Functional Session Room source missing: '+marker);
}
assert.ok(layout.includes('height:752px!important;min-height:752px!important;max-height:752px!important'));
assert.ok(layout.includes('.sr-chat-panel>.sr-chat-feed'));
assert.ok(layout.includes('.sr-dice-panel>#tv-v251-session-items'));
assert.ok(layout.includes('overflow-y:auto!important'));
assert.ok(html.includes('height:752px!important;min-height:752px!important;max-height:752px!important'));
assert.ok(html.includes('tv-v264-room-tabs'),'Character action tabs preserved');
assert.ok(html.includes('tv263-item-inspector'),'Item mechanics inspector preserved');
assert.ok(room.includes("'terravale_item_action'"),'Item actions preserved');
assert.ok(inspect.includes('function inspect(c,item)'),'Item preview preserved');
assert.ok(version.includes("version:'2.73'"));
assert.ok(html.includes('Terravale Codex V2.73'));
cp.execFileSync('node',['--check','site-overrides/v251-live-item-actions.js']);
console.log('PASS V2.67: pixelated materials removed from compiled preview; Session Room matched heights and functional controls preserved.');
