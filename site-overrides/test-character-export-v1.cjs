#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', 'site');
const source = fs.readFileSync(path.join(root, 'character-export/character-export-v1.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'character-export/character-export-v1.css'), 'utf8');
const page = fs.readFileSync(path.join(root, 'characters/index.html'), 'utf8');
assert(page.includes('/terravale-preview/character-export/character-export-v1.js'));
assert(page.includes('/terravale-preview/character-export/character-export-v1.css'));
assert(css.includes('.tvce-trigger') && css.includes('.tvce-backdrop'));
for (const field of ['character_state?select=', 'campaign_members?select=', 'characters?select=', 'getAuth()', 'downloadSelected', 'doNotRestoreApprovalAutomatically:true']) {
 assert(source.includes(field), 'Required portable export behavior missing: ' + field);
}
assert(!/method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/.test(source), 'Export must be read-only');
const win = {};
vm.runInNewContext(source, { window: win, document: { readyState:'loading', addEventListener() {} }, Date, JSON });
const character = {
 id: '22222222-2222-4222-8222-222222222222',
 campaign_id: '33333333-3333-4333-8333-333333333333',
 owner_id: '11111111-1111-4111-8111-111111111111',
 name: 'Export Example', status: 'approved',
 approved_build: { className:'Shaman', level:5, ancestry:'Elf', feats:['Spirit Link'] },
 portrait_path:'characters/photo.png', sheet_visible_to_party:true
};
const state = {
 hp:17, temp_hp:3, blood_state:2,
 resources:[{name:'Spirit',remaining:3}],
 conditions:['blessed'], inventory:[{name:'Sword'}],
 death_saves:{successes:1,failures:0}
};
const result = win.TerravaleCharacterExport.buildPortableExport(character, state, 'Frostvale');
assert.equal(result.format,'terravale.codex.character');
assert.equal(result.formatVersion,1);
assert.equal(result.source.originalStatus,'approved');
assert.equal(result.character.approved_build.level,5);
assert.equal(result.character_state.hp,17);
assert.equal(result.character_state.inventory[0].name,'Sword');
assert.equal(result.character_state.resources[0].remaining,3);
assert.equal(result.character_state.death_saves.successes,1);
assert.equal(result.portability.doNotRestoreApprovalAutomatically,true);
assert.equal(result.portability.portraitImageEmbedded,false);
assert(!JSON.stringify(result).includes(character.owner_id),'Never expose private account owner ID in exported JSON');
assert.equal(win.TerravaleCharacterExport.buildPortableExport(character,null).character_state,null);
console.log('PASS: owner/DM-gated read-only JSON exports preserve build, live state and no automatic approval');
