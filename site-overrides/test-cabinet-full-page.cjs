#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..','site',p),'utf8');
const home=read('index.html');
const cabinet=read('cabinet-of-curiosities/index.html');
const ads=read('codex-ads/terravale-adblocknt.js');
assert(home.includes('data-tour-nav="/cabinet-of-curiosities"'),'Left navigation must link to the Cabinet page');
assert(home.includes('Discoveries'),'Cabinet must have a named sidebar section');
// The shared Shell intentionally waits for cloud authentication before
// rendering the child page; static HTML contains the route and navigation,
// and the page body is provided by the corresponding compiled React chunk.
const chunkDir=path.join(__dirname,'..','site','_next','static','chunks');
const chunks=fs.readdirSync(chunkDir).filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync(path.join(chunkDir,x),'utf8'));
assert(cabinet.includes('_next/static/chunks/'),'Cabinet route must reference the compiled Next application');
for(const marker of ['data-cabinet-full-page','codex_achievement_progress','Search Cabinet achievements','Terravale Adblocker™']){
 assert(chunks.some(s=>s.includes(marker)),'Cabinet client page missing compiled functionality: '+marker);
}
assert(!cabinet.includes('TCAdsLive'),'Do not restore obsolete standalone progress tracker');
assert(ads.includes('terravale-cabinet-progress'),'Global ad layer must publish live progress to Cabinet page');
assert(ads.includes('openUnlockables:()=>openPanel'),'Reuse current achievement reward controls');
console.log('PASS: standalone Cabinet full route linked in native sidebar with live achievements and unlocks');
