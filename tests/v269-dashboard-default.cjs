/* V2.69: homepage opens native Dashboard, not old V2.36 demo Characters. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('published/veiled-codex/index.html');
const launch=read('site-overrides/launch-home.html');
const overlay=read('tools/overlay-v239-with-discord.py');
const deployment=read('.github/workflows/deploy.yml');
const legacy="if(!location.hash || location.hash==='#/' || location.hash==='#/dashboard'){ history.replaceState(null,'','#/characters'); }";
assert.ok(!html.includes(legacy),'V2.36 forced Characters redirect must be removed');
assert.ok(!html.includes("history.replaceState(null,'','#/characters')"),'Any forced Characters redirect remains');
assert.ok(overlay.includes('assert legacy_count == 1'),'Guard against future upstream changes');
assert.ok(overlay.includes('source, legacy_count = legacy_default.subn('),'Remove only the old demo redirect');
assert.ok(html.includes("const route=()=>{let h=decodeURIComponent(location.hash.replace(/^#/,''));return h.startsWith('/')?h:'/'}"),'Native route defaults to slash');
assert.ok(html.includes("root.classList.add(p==='/'?'page-dashboard'"),'Native / route must render dashboard');
assert.ok(html.includes('data-source="v2-discord-auth.mjs"'),'Keep Discord sign-in');
assert.ok(html.includes('data-source="v246-real-characters.js"'),'Keep real characters');
assert.ok(html.includes('v236-eight-character-entry'),'Keep other native demo functionality');
const match=launch.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match,'Entry redirect script available');
for(const [query,hash,expectedHash] of [
 ['','','#/'],
 ['?code=oauth-123&state=a%2Fb','','#/'],
 ['?error=access_denied','#/characters','#/characters'],
 ['','#/party','#/party'],
 ['','#/characters/real-sheet','#/characters/real-sheet'],
 ['?utm_source=friend','#/lore','#/lore'],
 ['','#/','#/']
]){
 const urls=[],location={search:query,hash,replace:url=>urls.push(url)};
 vm.runInNewContext(match[1],{window:{location}});
 assert.deepEqual(urls,['/terravale-preview/veiled-codex/'+query+expectedHash],
  'Incorrect home path for '+query+hash);
}
assert.ok(!deployment.includes("cp site-overrides/awaiting-v2.html published/index.html"));
assert.ok(deployment.includes("cp site-overrides/launch-home.html published/index.html"));
console.log('PASS V2.69: native Dashboard is default, legacy Characters redirect removed, explicit routes + Discord OAuth forwarded.');
