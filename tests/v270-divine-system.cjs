/* V2.70 regression: secure favour, three boon families, real DM Chronicle and player sheet tabs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('site-overrides/sql/v270_divine_favour_boons.sql');
const js=read('site-overrides/v270-divine-ui.js');
const css=read('site-overrides/v270-divine-ui.css');
const dm=read('site-overrides/v254-dm-vault.js');
const overlay=read('tools/overlay-v239-with-discord.py');
const build=read('published/veiled-codex/index.html');
const version=read('site-overrides/v255-shell-role-version.js');
cp.execFileSync('node',['--check','site-overrides/v270-divine-ui.js']);
for(const name of ['terravale_divine_patrons','terravale_divine_favour',
 'terravale_dm_divine_boons','terravale_character_divine_boons','terravale_divine_activity'])
 assert.ok(sql.includes('alter table public.'+name+' enable row level security'),'RLS '+name);
for(const term of ["kind in ('divine','minor','concordant')","score between -10 and 10",
 "g.status='active'","show_scores:=c.owner_id=actor or authz.is_dm(c.campaign_id)",
 "if not authz.is_dm(target_campaign)","if c.id is null or not authz.is_dm(c.campaign_id)",
 "if b.state<>'ready'","only one active Concordant Boon", "Only three active boons per patron",
 "if coalesce(favour1,0)<b.required_favour",
 "if coalesce(favour2,0)<b.required_favour",
 "revoke all on public.terravale_dm_divine_boons from public,anon,authenticated",
 "revoke all on function public.terravale_divine_dm_state(uuid) from public,anon",
 "grant execute on function public.terravale_divine_player_state(uuid) to authenticated"])
 assert.ok(sql.toLowerCase().includes(term.toLowerCase()),'Secure backend condition '+term);
assert.ok(sql.includes("'previews'")&&sql.includes("'granted'"));
const player=sql.slice(sql.indexOf('create or replace function public.terravale_divine_player_state'),
 sql.indexOf('-- Full notes/catalog/history'));
assert.ok(!player.includes('to_jsonb(b)'),'Never return a raw unpublished boon record to players');
assert.ok(!player.includes("'catalog'"),'Player endpoint must exclude hidden catalog');
assert.ok(!player.includes("'required_favour'"),'Player endpoint must exclude thresholds');
assert.ok(!player.includes("'private_note'"),'Player endpoint must exclude DM notes');
assert.ok(player.includes("g.status='active'"),'Only awarded boons visible');
const exact=[
 "['divine','Divine Favour','sparkles']",
 "['divine','Divine Favour','Track the gods’ favour",
 "divine:['DM CHRONICLE · DIVINE AUTHORITY'",
 "window.TerravaleDivineV270?.renderDM",
 "view==='divine'",
 "['divine','Divine Favour','sparkles']"
];
for(const token of exact)assert.ok(dm.includes(token),'DM Chronicle integration '+token);
for(const token of ['window.TerravaleDivineV270','sheet20-tabs','sheet20-content',
 'terravale_divine_player_state','terravale_divine_dm_state',
 'terravale_divine_dm_set_favour','terravale_divine_dm_save_patron',
 'terravale_divine_dm_save_boon','terravale_divine_dm_grant_boon',
 "'minor'","concordant","Boons bestowed","No divine boons have been bestowed",
 "The attention of the Greater and Major Gods",
 "Not revealed to player"])
 assert.ok(js.includes(token),'Missing UI logic '+token);
assert.ok(css.includes('#tv270-sheet-panel')&&css.includes('.tv270-dm-columns'));
assert.ok(overlay.includes('v270-divine-ui.js')&&overlay.includes('v270-divine-ui.css'));
assert.ok(overlay.indexOf('data-source="v270-divine-ui.js"')<
 overlay.indexOf('data-source="v254-dm-vault.js"'),'Expose Divine renderer before Chronicle startup');
assert.ok(build.includes('data-source="v270-divine-ui.js"'));
assert.ok(build.includes('tv270-sheet-panel'));
assert.ok(build.includes('Terravale Codex V2.70'));
assert.ok(version.includes("version:'2.70'"));
assert.ok(build.includes('data-source="v2-discord-auth.mjs"'));
assert.ok(build.includes('data-source="v255-custom-feat-forge.js"'));
assert.ok(build.includes('data-source="v251-live-item-actions.js"'));
console.log('PASS V2.70: Divine/Minor/Concordant families, DM-only unpublished boons, favour threshold and slot enforcement, live sheet + Chronicle integration.');
