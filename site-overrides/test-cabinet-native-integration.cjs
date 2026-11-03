#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const root=path.join(__dirname,'..','site');
const js=fs.readFileSync(path.join(root,'codex-achievements/codex-achievements-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'codex-achievements/codex-achievements-v1.css'),'utf8');
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&fs.existsSync(x));
assert(js.includes('integrateCabinet(page'),'Native integration must be connected to the catalogue');
assert(js.includes('parseStoredSession('),'SSR auth must be decoded');
assert(css.includes('.tv-cabinet-retired{display:none!important}'),'Retired card must disappear');
if(!chrome){console.log('PASS: static integration tests; Chromium not available');process.exit(0);}
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body>'
+'<a aria-label="Account: player">Player</a>'
+'<main data-cabinet-full-page><header><h1>Cabinet of Curiosities</h1><p>Achievements, strange discoveries and their rewards. One secret at a time.</p></header>'
+'<strong id="old-top-count">0 / 1 discovered</strong><p>Only approved achievements are listed here. More mysteries can be added after they are designed and approved.</p>'
+'<div><strong id="old-completion">0%</strong></div>'
+'<section><h2>Achievements &amp; discoveries</h2><small id="old-approved">1 approved achievement</small>'
+'<input aria-label="Search Cabinet achievements" value=""><select aria-label="Filter Cabinet achievements"><option value="All">All discoveries</option><option value="Discovered">Discovered</option><option value="Locked">Locked</option></select>'
+'<div id="layout" style="display:grid;grid-template-columns:3fr 1fr;gap:14px">'
+'<div id="left-column"><article id="legacy"><h3>Undiscovered Secret</h3><p>Single old ad card</p></article>'
+'<div id="sealed"><strong>Further drawers remain sealed</strong><p>Old placeholder</p></div></div>'
+'<aside id="reward">Terravale Adblocker™</aside></div></section>'
+'<footer id="old-footer">CABINET OF CURIOSITIES · RELEASE 001 — Adblockn’t is the only currently approved achievement.</footer></main>'
+'<button id="tv-ach-widget">✧ 0/1</button>'
+'<script>'+js+'</script>'
+'<script>setTimeout(function(){'
+'document.getElementById("tv-ach-widget").textContent="✧ 0/1";'
+'var input=document.querySelector("input[aria-label=\\"Search Cabinet achievements\\"]");input.value="paladin";input.dispatchEvent(new Event("input",{bubbles:true}));'
+'},1000);setTimeout(function(){'
+'var section=document.getElementById("tv-approved-catalog-page");'
+'var data={inside:!!section&&document.getElementById("left-column").contains(section),'
+'retired:!!document.querySelector("#legacy.tv-cabinet-retired")&&!!document.querySelector("#sealed.tv-cabinet-retired"),'
+'reward:!!document.getElementById("reward")&&!document.getElementById("reward").classList.contains("tv-cabinet-retired"),'
+'count:document.getElementById("old-top-count").textContent.trim(),'
+'approved:document.getElementById("old-approved").textContent.trim(),'
+'widget:document.getElementById("tv-ach-widget").textContent.trim(),'
+'footer:document.getElementById("old-footer").classList.contains("tv-cabinet-retired"),'
+'filtered:section?section.querySelectorAll(".tv-approved-item").length:0,'
+'authHint:!!section&&section.textContent.includes("Account connected")};'
+'document.body.dataset.achievementFixture=encodeURIComponent(JSON.stringify(data));'
+'},3300)</script></body></html>';
const server=http.createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html));
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/';
  const stdout=await new Promise((resolve,reject)=>{
   const proc=cp.spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=5000','--window-size=1440,900','--dump-dom',url],{stdio:['ignore','pipe','pipe']});
   let out='',err='';
   proc.stdout.on('data',b=>out+=b.toString());
   proc.stderr.on('data',b=>err=(err+b.toString()).slice(-1000));
   const timeout=setTimeout(()=>{proc.kill();reject(Error('Chromium timed out'))},30000);
   proc.on('error',e=>{clearTimeout(timeout);reject(e)});
   proc.on('close',code=>{clearTimeout(timeout);code===0?resolve(out):reject(Error('Chromium '+code+' '+err))});
  });
  const match=stdout.match(/data-achievement-fixture="([^"]+)"/);
  if(!match)throw Error('No achievement fixture result');
  const result=JSON.parse(decodeURIComponent(match[1]));
  console.log('Cabinet native replacement: '+JSON.stringify(result));
  assert.equal(result.inside,true,'Collection must be inside original achievement column');
  assert.equal(result.retired,true,'Original ad-only card and placeholder must be removed');
  assert.equal(result.reward,true,'Terravale Adblocker reward must remain visible');
  assert.equal(result.count,'0 / 62 discovered');
  assert.equal(result.approved,'62 approved achievements');
  assert.equal(result.widget,'✧ 0/62','Old ad widget must not repaint the stale 0/1');
  assert.equal(result.footer,true,'Obsolete release caption must be hidden');
  assert.equal(result.filtered,1,'Native search must filter the 62-achievement catalogue');
  assert.equal(result.authHint,true,'Signed-in Codex must not misleadingly say Sign in');
  console.log('PASS: unified Cabinet, live counters, filters, Adblocker and session fallback');
 }finally{server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
