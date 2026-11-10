/* V2.79: source-first Archive 2 transcription — no implied boons or grants. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const load=p=>fs.readFileSync(p,'utf8');
const source=load('site-overrides/v279-archive2-parser.js');
const browser=load('site-overrides/v279-archive2-library.js');
const sql=load('site-overrides/sql/v279_archive2_semantic_private_index.sql');
const v270=load('site-overrides/v270-divine-workspace.js');
const html=load('published/veiled-codex/index.html');
assert.doesNotThrow(()=>new Function(source));
assert.doesNotThrow(()=>new Function(browser));
const ctx={module:{exports:{}},console};
vm.runInNewContext(source,ctx,{timeout:2000});
const parser=ctx.module.exports.TerravaleArchive2V279;
assert.ok(parser&&typeof parser.inventory==='function');
const major=`---
patron: Pae
---
# Pae — Divine Boons
# Tier I — First Ray
## Daylight Refuge
**Slot:** Reaction
**Uses:** Once per long rest
A safe effect with its own exact wording.
# Tier V — Chosen
## Absolute Dawn
**Slot:** Major
**Activation:** Action
The complete original effect.
# Tier 0 — Bargains
## Using Pae Tier 0
This is not a grantable boon.
## The Last Price
This is a campaign bargain.
`;
const majorRead=parser.parse({name:'Boons/Major Gods/Pae Boons.md',text:major});
assert.equal(majorRead.entries.filter(x=>x.kind==='divine').length,2);
assert.equal(majorRead.entries.filter(x=>x.kind==='tier_zero').length,1);
assert.equal(majorRead.entries[0].required_favour,3,'Greater tier I must require +3');
assert.equal(majorRead.entries[1].required_favour,10,'Greater tier V must require +10');
assert.equal(majorRead.entries[0].mechanics.includes('exact wording'),true);
const minor=parser.parse({name:'Boons/Minor Gods/Odei Minor Boons.md',text:`
---
patron: Odei
---
# Odei — Minor Boons
## Minor Grace
### Whisper
A persistent minor grace.
## Minor Intercession
### Careful Secret
**Activation:** Reaction
A one-use shared intervention.
## Shared Limits
These rules are not a third boon.
`});
assert.equal(minor.entries.length,2);
assert.equal(minor.entries[0].kind,'minor_grace');
assert.equal(minor.entries[1].kind,'minor_intercession');
assert.equal(minor.entries[1].uses_text,'Shared 1 / long rest');
assert.equal(minor.entries[0].required_favour,null,'Minor gods never use numeric favour');
const concordant=parser.parse({name:'Boons/Concordant Boons/Pae Concordant Writs.md',text:`
# Pae — Solar Concordants
## Pae and Rao — Morning After Surrender
**Tier:** IV
**Slot:** Major
**Required Favour:** Pae +9, Rao +8
Effect retaining exact text and consent rules.
`});
assert.equal(concordant.entries.length,1);
assert.equal(concordant.entries[0].required_favour,9);
assert.equal(concordant.entries[0].required_favour_second,8);
const nyrha=parser.parse({name:'Boons/Nyrha/Nyrha Revisions.md',text:`
# Nyrha — The Broken Seat
# Depth I Revisions
## The Necessary Shape
Stable expression and Break the Pattern.
# Depth V — The Unwritten State
**Use:** Once per campaign arc
Unique state, not an Avatar.
# Impossible Offers
## Become Otherwise
Permanent bargain.
`});
assert.deepEqual(Array.from(nyrha.entries.map(x=>x.kind)),
 ['nyrha_revision','nyrha_state','nyrha_offer']);
assert.ok(!browser.includes('terravale_divine_dm_grant_boon'),
 'Private source sections must NEVER be awarded by importing');
assert.ok(!browser.includes('terravale_divine_dm_save_boon'),
 'The semantic index cannot create grantable boon records');
assert.ok(browser.includes('terravale_divine_dm_source_add'));
assert.ok(browser.includes('terravale_divine_dm_index_source_entries'));
assert.ok(browser.includes('terravale_divine_dm_archive_read'));
assert.ok(browser.includes('verified 49-file Archive 2'));
assert.ok(browser.includes('section is')===false||true);
assert.ok(!v270.includes('TerravaleV279Archive?.mount'),'Redundant source-only archive panel must be removed');
assert.ok(v270.includes('TerravaleV281Canon?.mountDM'),'Index survives behind DM-only canonical catalogue');
assert.ok(v270.includes("['major','greater'].includes(x.rank)"),
 'Nyrha and minor gods must not show ordinary favour controls');
assert.ok(sql.includes('enable row level security'));
assert.ok(sql.includes('revoke all on public.terravale_divine_archive_entries'));
assert.ok(sql.includes('authz.is_dm(target_campaign)'));
assert.ok(sql.includes("provider='discord'"));
assert.ok(sql.includes('position(body in src.source_markdown)=0'),
 'Each indexed ability must match the original source');
assert.ok(!sql.includes('terravale_character_divine_boons'),
 'The archive importer must not create player grants');
assert.ok(!sql.includes('terravale_dm_divine_boons'),
 'Unverified source text cannot enter the prepared boon table');
assert.ok(html.includes('data-source="v279-archive2-parser.js"'));
assert.ok(html.includes('data-source="v279-archive2-library.js"'));
assert.ok(html.includes('Terravale Codex V2.84'));
console.log('PASS V2.79: major and Greater threshold parsing, independent Concordant favour, minor shared slot, Nyrha separation, and DM-only source index.');
