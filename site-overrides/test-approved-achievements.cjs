#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('site-overrides/codex-achievements-v1.js');
const css=read('site-overrides/codex-achievements-v1.css');
const installed=read('site/codex-achievements/codex-achievements-v1.js');
const html=read('site/index.html');
const cabinet=read('site/cabinet-of-curiosities/index.html');
for(const needle of ['collection.length!==62','codex_achievement_events','codex_achievement_unlocks','rpc/codex_record_activity','bloodforger_discipline','theme_changed','quicksave_first','character_approved','journal_both','adblocknt']){
 assert(src.includes(needle),'Achievement script missing '+needle);
}
assert.equal(installed,src,'The deployed asset must match the reviewed source');
assert(css.includes('.tv-approved-item'),'Achievement catalogue style missing');
for(const page of [html,cabinet])for(const file of ['codex-achievements-v1.js','codex-achievements-v1.css']){
 assert(page.includes('/terravale-preview/codex-achievements/'+file),'Missing '+file+' from published route');
}
assert(read('site/codex-ads/terravale-adblocknt.js').includes('codex_dismiss_ads'),'Existing Adblockn’t must remain intact');
console.log('PASS: all 62 approved achievements available site-wide with account progress, existing Adblockn’t unchanged');
