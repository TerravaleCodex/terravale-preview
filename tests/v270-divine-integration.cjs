/* Terravale V2.71 — fail-closed smoke checks for divine UI + deploy. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const js=read('site-overrides/v270-divine-workspace.js');
const css=read('site-overrides/v270-divine-workspace.css');
const sql=read('site-overrides/sql/v271_divine_private_resources_and_pantheon.sql');
const vault=read('site-overrides/v254-dm-vault.js');
const overlay=read('tools/overlay-v239-with-discord.py');
const workflow=read('.github/workflows/deploy.yml');
const html=read('published/veiled-codex/index.html');
assert.doesNotThrow(()=>new Function(js),'Frontend source must parse as JavaScript');
for(const rpc of [
 'terravale_divine_dm_state','terravale_divine_player_state',
 'terravale_divine_dm_set_favour','terravale_divine_dm_save_boon',
 'terravale_divine_dm_grant_boon','terravale_divine_dm_save_patron'
])assert.ok(js.includes(rpc),'Missing verified RPC: '+rpc);
for(const key of ['divine','minor','concordant'])
 assert.ok(js.includes(key),'Missing boon family '+key);
assert.ok(js.includes('account().state.profile?.is_dm'));
assert.ok(js.includes("db.role==='dm'"));
assert.ok(js.includes('return (db.characters||[]).find'),'Player tab resolves the real sheet character');
assert.ok(js.includes('data.granted||[]'),'Player rendering must use awarded list');
assert.ok(js.includes('data.previews||[]'),'Player rendering must use major-god preview');
assert.ok(!js.includes(".from('terravale_dm_divine_boons')"),'Private boon table must not be fetched in public UI');
assert.ok(!js.includes('localStorage.setItem'),'Secret boons must not be persisted in browser storage');
assert.ok(js.includes('renderBoonResources'),'Granted charged boons must render in Resources');
assert.ok(js.includes('importBoonArchive'),'DM-only catalogue import missing');
assert.ok(js.includes('adjustFavour'),'Stable favour updates missing');
assert.ok(js.includes('tv271-boon-filters'),'Filterable boon list missing');
assert.ok(!js.includes('data.can_view_scores'),'Player UI must not show numeric favour');
const player=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.terravale_divine_player_state'),sql.indexOf('create or replace function public.terravale_divine_use_boon'));
assert.ok(!player.includes("'favour',case"),'Player RPC must not return favour values');
assert.ok(!player.includes("'can_view_scores'"),'Player RPC must not return score permission flags');
assert.ok(sql.includes('terravale_divine_use_boon'),'Atomic charge spending RPC missing');
assert.ok(!js.includes('innerHTML'),'Avoid untrusted rule HTML injection');
assert.ok(js.includes('paintKey'),'Prevent mutation observer repaint loop');
assert.ok(vault.includes("['divine','Divine Favour'"),'Native Chronicle tab missing');
assert.ok(vault.includes("view==='divine'"),'Native Chronicle route missing');
assert.ok(vault.includes('TerravaleV270Divine.renderDM'),'Chronicle does not mount divine workspace');
assert.ok(overlay.includes('v270-divine-workspace.css'));
assert.ok(overlay.includes('v270-divine-workspace.js'));
assert.ok(overlay.includes('"version":"2.71"'));
assert.ok(workflow.includes('node tests/v270-divine-integration.cjs'));
assert.ok(css.includes('.tv270-divine-sheet'));
const embedded=html.match(/<script data-source="v270-divine-workspace\.js">([\s\S]*?)<\/script>/);
assert.ok(embedded,'Public V2 build must embed divine client');
assert.doesNotThrow(()=>new Function(embedded[1]));
assert.ok(html.includes("Terravale Codex V2.71"),'Release label out of sync');
assert.ok(!html.includes('sb_secret_'),'Secret key in public site');
console.log('PASS V2.71: verified DM Chronicle, player-only awarded boons, three boon families, no private catalogue on player path, client parses and correct build marker.');
