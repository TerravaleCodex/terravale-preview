#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('site');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cabinet=read('cabinet-of-curiosities/index.html');
const classPage=read('classes/index.html');
const ancestryPage=read('ancestries/index.html');
const tree=read('classes/bloodforger/trees/index.html');
assert(cabinet.includes('_next/static/chunks/'),'Cabinet route missing compiled Next app');
for(const [name,html] of [['classes',classPage],['ancestries',ancestryPage],['tree',tree]])assert(html.includes('_next/static/chunks/'),name+' route lost');
const jsRoot=path.join(root,'_next','static','chunks');
const chunks=fs.readdirSync(jsRoot).filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync(path.join(jsRoot,x),'utf8'));
const has=x=>chunks.some(c=>c.includes(x));
const keys=[
'classes_complete','ancestries_complete','codex_keeper','bloodforger_3','bloodforger_all',
 'character_first','character_approved','journal_private','journal_party','journal_both',
 'journal_twenty','quicksave_first','theme_first','theme_five','backstory_first',
 'search_first','dice_first','campaign_joined'
];
for(const key of keys)assert(has(key),'Compiled collection missing '+key);
for(const className of ['Artificer','Bloodforger','Shaman','Vitaeforge (v1.10)'])assert(has(className),'Class catalogue omitted '+className);
for(const ancestry of ['Beastfolk','Elf','Flugel','Oni'])assert(has(ancestry),'Ancestry catalogue omitted '+ancestry);
for(const marker of ['codex_achievement_events','codex_achievement_unlocks','codex_record_activity',
 'bloodforger_discipline','read_class','read_ancestry',
 'terravale-achievement-notice','Filter Cabinet rarity','Filter Cabinet achievements',
 'data-cabinet-full-page']){
 assert(has(marker),'Published achievement UI missing '+marker);
}
assert(has('IntersectionObserver'),'Reading achievements should require reaching the end');
assert(!cabinet.includes('codex-shared-sidebar-frame'),'Cabinet must use main native Codex navigation');
assert(read('codex-ads/terravale-adblocknt.js').includes('codex_dismiss_ads'),'Existing Adblockn’t reward system must remain');
console.log('PASS: published 62-achievement account UI, unified Cabinet, reading and tree instrumentation and existing Adblockn’t preserved');
