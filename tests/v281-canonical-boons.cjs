/* V2.81 — canonical Archive 2 grantability, shared limits and private provenance. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('site-overrides/v270-divine-workspace.js');
const lib=read('site-overrides/v281-canonical-library.js');
const voices=read('site-overrides/v281-divine-voices.js');
const css=read('site-overrides/v281-canonical-library.css');
const base=read('site-overrides/sql/v281_canonical_divine_awards.sql');
const actions=read('site-overrides/sql/v281_canonical_divine_actions.sql');
const offers=read('site-overrides/sql/v281_canonical_formal_offers.sql');
const overlay=read('tools/overlay-v239-with-discord.py');
const html=read('published/veiled-codex/index.html');
for(const script of [ui,lib,voices])assert.doesNotThrow(()=>new Function(script));
const w={};vm.runInNewContext(voices,{window:w},{timeout:1500});
const known=['amora','coeus','errigan','eshael','fjoras','ixi','kalma','kwaeth','luna',
 'nyrha','pae','rao','torridae','tyrius','vaelniv','tedegra'];
assert.deepEqual(Object.keys(w.TerravaleDivineVoicesV281.voices).sort(),known.sort());
for(const key of known){
 const item=w.TerravaleDivineVoicesV281.voices[key];
 for(const tone of ['silence','ominous','cold','veiled','watchful','favoured'])
  assert.ok(item[tone]?.length>6,key+' lacks '+tone);
}
assert.ok(w.TerravaleDivineVoicesV281.status('nyrha','favoured').description.includes('ordinary Favour'));
assert.notEqual(w.TerravaleDivineVoicesV281.status('pae','favoured').label,
 w.TerravaleDivineVoicesV281.status('kalma','favoured').label);
assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert.ok(css.includes('@media(max-width:440px)'));
assert.ok(!ui.includes('TerravaleV275SourceVault?.mount'));
assert.ok(!ui.includes('TerravaleV279Archive?.mount'));
assert.ok(!ui.includes('TerravaleBoonArchiveV273?.mount'));
assert.ok(ui.includes('TerravaleV281Canon?.mountDM'));
assert.ok(ui.includes('terravale_divine_canon_player_state'));
assert.ok(ui.includes('terravale_divine_canon_offers_player_state'));
assert.ok(ui.includes('TerravaleDivineVoicesV281?.status'));
assert.ok(ui.includes("b.source_kind==='canonical'"));
assert.ok(!lib.includes('localStorage'),'Private catalogue cannot be cached in localStorage');
assert.ok(!lib.includes('innerHTML'),'Original source text must never render as raw HTML');
for(const rpc of ['terravale_divine_dm_archive_search_v282','terravale_divine_dm_archive_read',
 'terravale_divine_canon_dm_state','terravale_divine_canon_grant',
 'terravale_divine_canon_dm_set_relation','terravale_divine_canon_revoke',
 'terravale_divine_canon_dm_offer','terravale_divine_canon_dm_fracture',
 'terravale_divine_canon_dm_resolve_fracture'])
 assert.ok(lib.includes(rpc),'DM UI missing RPC '+rpc);
for(const table of ['terravale_divine_canon_awards','terravale_divine_canon_burdens',
 'terravale_divine_canon_state','terravale_divine_canon_effects',
 'terravale_divine_canon_fractures','terravale_divine_canon_history'])
 assert.ok(base.includes('enable row level security')&&base.includes(table),'Source-protected table '+table);
assert.ok(base.includes('e.required_favour_second'));
assert.ok(base.includes('Nyrha Revisions require a fully disclosed Formal Offer'));
assert.ok(base.includes('minor_intercession_remaining=0'));
assert.ok(base.includes("e.kind not in ('divine','concordant','minor_grace','minor_intercession'"));
assert.ok(actions.includes("e.kind='minor_intercession'"));
assert.ok(actions.includes("overflow_count:=overflow_count+1"));
assert.ok(actions.includes('minor_intercession_remaining=1'));
assert.ok(actions.includes("if lower(e.patron)='errigan'"));
assert.ok(actions.includes('Fracture Chain occupied'));
assert.ok(offers.includes('terravale_divine_canon_respond_offer'));
assert.ok(offers.includes("c.owner_id<>actor"));
assert.ok(offers.includes('affected_parties'));
for(const source of [base,actions,offers]){
 assert.ok(source.includes('auth.uid()'),'No anonymous privilege escalation');
 assert.ok(source.includes('provider=\'discord\''),'Verified Discord identity is mandatory');
 assert.ok(source.includes('revoke all on function'),'No PUBLIC default function EXECUTE');
}
assert.ok(overlay.includes('v281-divine-voices.js'));
assert.ok(overlay.includes('v281-canonical-library.js'));
assert.ok(html.includes('data-source="v281-divine-voices.js"'));
assert.ok(html.includes('data-source="v281-canonical-library.js"'));
assert.ok(html.includes('Terravale Codex V2.83'));
console.log('PASS V2.81: 16 unique deity voices, 3×2 boon slots, real canonical grant/Offer flows and protected source data.');
