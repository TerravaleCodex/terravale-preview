/* V2.76 — Archive 2 DM-only source custody and no inferred mechanics. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('site-overrides/v275-source-vault.js','utf8');
const importer=fs.readFileSync('site-overrides/v273-boon-archive-import.js','utf8');
const sql=fs.readFileSync('site-overrides/sql/v275_divine_archive_source_vault.sql','utf8');
const overlay=fs.readFileSync('tools/overlay-v239-with-discord.py','utf8');
const divine=fs.readFileSync('site-overrides/v270-divine-workspace.js','utf8');
const published=fs.readFileSync('published/veiled-codex/index.html','utf8');
assert.doesNotThrow(()=>new Function(source),'Vault client source must parse');
const frame={window:{},TextEncoder,console};
vm.runInNewContext(source,frame,{timeout:1500,filename:'v275-source-vault.js'});
const validate=frame.window.TerravaleV275SourceVault?.validate;
assert.equal(typeof validate,'function');
const originals=[
 {name:'80_DnD/Boons/Divine Boons.md',text:'# Divine Boons\n## Rules'},
 {name:'80_DnD/Boons/Errigan Boons.md',text:'# Errigan Boons\n## Drunk\n## Blackout\n## Rapture'},
 {name:'80_DnD/Boons/Pae Concordant Writs.md',text:'# Pae Concordant Writs'}
];
assert.ok(validate(originals)>0,'Source documents must be accepted without boon inference');
assert.throws(()=>validate([...originals,originals[0]]),/repeated/);
assert.throws(()=>validate([{name:'../secrets.md',text:'bad'}]),/Unsafe/);
assert.throws(()=>validate([{name:'huge.md',text:'x'.repeat(250001)}]),/exceeds/);
assert.ok(source.includes('terravale_divine_dm_source_add'));
assert.ok(source.includes('terravale_divine_dm_source_manifest'));
assert.ok(source.includes('terravale_divine_dm_source_read'));
assert.ok(!source.includes('localStorage'),'Private originals must not be cached in browser storage');
assert.ok(!source.includes('innerHTML'),'Originals must not be inserted as HTML');
assert.ok(source.includes('No boon abilities were created'),'No auto-publish');
assert.ok(divine.includes('TerravaleV275SourceVault?.mount'),'DM Boon Forge must mount the source vault');
assert.ok(sql.includes('enable row level security'));
assert.ok(sql.includes('revoke all on table public.terravale_divine_archive_sources'));
assert.ok(sql.includes('authz.is_dm(target_campaign)'));
assert.ok(sql.includes('provider=\'discord\''));
assert.ok(sql.includes('sha256(convert_to(source_markdown,\'UTF8\'))'));
assert.ok(!sql.includes('terravale_dm_divine_boons'),'Source migration must not create granted boon data');
assert.ok(overlay.includes('v275-source-vault.js'));
assert.ok(published.includes('data-source="v275-source-vault.js"'));
assert.ok(published.includes('Terravale Codex V2.81'));
assert.ok(importer.includes('MAX_ITEM=250000'),'Source document size limit must allow original rules files');
console.log('PASS V2.75: original Markdown source custody, DM-only RPC contract, no forged boons and published client.');
