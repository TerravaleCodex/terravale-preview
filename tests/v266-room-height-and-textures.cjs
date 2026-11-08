/* V2.66 regression: equal Session Room columns and richer, independent textures. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const layout=read('site-overrides/v266-equal-workspace-height.css');
const art=read('site-overrides/v266-richer-atmosphere.css');
const iframe=read('site-overrides/v266-cabinet-texture.js');
const build=read('published/veiled-codex/index.html');
const overlay=read('tools/overlay-v239-with-discord.py');
const version=read('site-overrides/v255-shell-role-version.js');
assert.ok(layout.includes('.sr-lower>.sr-chat-panel,\n.page-session .sr-lower>.sr-dice-panel'),'Both columns have one shared selector');
assert.ok(layout.includes('height:752px!important;min-height:752px!important;max-height:752px!important'),'Both columns fixed to 752px on desktop');
assert.ok(layout.includes('min-height:560px!important;max-height:560px!important'),'Both columns match on mobile');
assert.ok(layout.includes('.sr-chat-panel>.sr-chat-feed'),'Chat feed scrolls while message composer remains pinned');
assert.ok(layout.includes('overflow-y:auto!important;overscroll-behavior:contain'),'Inner panel scrolling enabled');
assert.ok(layout.includes('.sr-dice-panel>.sr-dice-area')&&layout.includes('.sr-dice-panel>#tv-v251-session-items'),'Dice and character actions scroll separately');
assert.ok(layout.includes('[hidden]')&&layout.includes('display:none!important'),'Inactive tab hides properly');
assert.ok(!layout.includes('tv265-textures'),'No gameplay layout depends on texture preferences');
for(const c of ['dashboard','featured','character','initiative','lore']){
 assert.ok(art.includes('.tv265-'+c),'Missing '+c+' accent');
}
for(const c of ['dashboard','character','initiative','lore','achievements']){
 assert.ok(art.includes('--tv265-art-'+c)||iframe.includes('--tv265-art-'+c),'Texture source missing '+c);
}
assert.ok(art.includes('html[data-tv265-textures="on"]'),'Enhanced textures obey Appearance preference');
assert.ok(iframe.includes('html[data-tv265-textures="on"]'),'Cabinet obeys the same toggle');
assert.ok(iframe.includes('doc.getElementById(\'tv266-cabinet-texture\')'),'Cabinet iframe stylesheet installs only once');
assert.ok(art.includes('opacity:.46!important')&&art.includes('opacity:.48!important'),'Dashboard and characters are visibly stronger');
assert.ok(art.includes('opacity:.25!important'),'Initiative now visible but less intense');
assert.ok(art.includes('opacity:.41!important'),'Lore texture gain');
assert.ok(art.includes('background-image:linear-gradient(110deg')&&iframe.includes('var(--tv265-art-achievements'),'Original art actually used');
assert.ok(!art.includes('.sr-dice-grid{background-image')&&!art.includes('.sr-dice-area{background-image'),'No bright texture behind dice controls');
for(const p of ['v266-equal-workspace-height.css','v266-richer-atmosphere.css','v266-cabinet-texture.js']){
 assert.ok(overlay.includes(p),'Generator includes '+p);
}
assert.ok(build.includes('height:752px!important;min-height:752px!important;max-height:752px!important'),'New 752px geometry compiled');
assert.ok(build.includes('v266-cabinet-texture.js'),'Cabinet enhancement compiled');
assert.ok(build.includes('tv266-arena-breathe'),'New background atmospheric styling compiled');
assert.ok(build.includes('Terravale Codex V2.66'),'Build uses version 2.66');
assert.ok(version.includes("version:'2.66'"),'Navbar badge uses version 2.66');
cp.execFileSync('node',['--check','site-overrides/v266-cabinet-texture.js']);
console.log('PASS V2.66: matched 752px Chat/Dice heights with independent scrolling; five distinct intensified textures and reversible Cabinet styling.');
