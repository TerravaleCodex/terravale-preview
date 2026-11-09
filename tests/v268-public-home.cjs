/* V2.68 public entrance: no maintenance page, dashboard redirect preserves OAuth. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const launch=fs.readFileSync('site-overrides/launch-home.html','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy.yml','utf8');
const oauth=fs.readFileSync('site-overrides/v2-discord-auth.mjs','utf8');
const V2='/terravale-preview/veiled-codex/';
assert.match(launch,/<title>Terravale — The Living Codex<\/title>/);
assert.ok(launch.includes('href="'+V2+'"'),'Manual Enter button resolves to existing app');
assert.ok(launch.includes('<noscript><meta http-equiv="refresh"'),'Fallback for no-JavaScript users only');
assert.ok(!launch.includes('WE ARE EXPERIENCING'));
assert.ok(!launch.includes('SOME TECHNICAL DIFFICULTIES'));
assert.ok(!launch.includes('ARCANE_CORE_UNRESPONSIVE'));
assert.ok(workflow.includes('cp site-overrides/launch-home.html published/index.html'));
assert.ok(workflow.includes('cp site-overrides/launch-home.html published/404.html'));
assert.ok(!workflow.includes('cp site-overrides/awaiting-v2.html published/index.html'));
assert.ok(workflow.includes('The complete V2 client is not ready'));
assert.ok(workflow.includes('len(data["articles"])==283'));
assert.ok(workflow.includes('len(data["heritageArticles"])==36'));
assert.ok(workflow.includes('len(data["events"])==31'));
assert.ok(oauth.includes('https://terravalecodex.github.io'+V2),'Discord redirect destination retained');
const script=launch.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(script,'Launch redirect exists');
for(const [query,hash] of [
 ['', ''],
 ['?code=oauth-123&state=abc%2Fdef','#/'],
 ['?error=access_denied&error_description=oops','#/characters'],
 ['?utm_source=discord','#/party']
]){
 const locations=[];
 const loc={search:query,hash,replace(url){locations.push(url)}};
 vm.runInNewContext(script[1],{window:{location:loc}});
 assert.deepEqual(locations,[V2+query+(hash||'#/')],'OAuth and explicit SPA routes must be preserved; fresh visits open Dashboard');
}
assert.ok(!workflow.includes('Verify live technical difficulties page'));
assert.ok(!workflow.includes('retired root routes still return the holding page'));
if(fs.existsSync('published/veiled-codex/index.html')){
 const s=fs.readFileSync('published/veiled-codex/index.html','utf8');
 assert.ok(s.includes('data-source="v2-discord-auth.mjs"'));
 assert.ok(s.includes('data-source="v246-real-characters.js"'));
 assert.ok(s.includes('Terravale Codex V2.72'));
}
if(fs.existsSync('published/index.html')){
 const root=fs.readFileSync('published/index.html','utf8');
 assert.equal(root,launch,'Launched root page should match reviewed source');
}
console.log('PASS V2.68: public root enters dashboard; Discord PKCE + SPA query/hash preserved; retiring the maintenance page never touches campaign data.');
