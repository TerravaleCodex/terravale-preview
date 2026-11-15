/* V2.86: card-density, real stock categories, resource legibility,
   source-verified Tier-I demo grants and privacy of source mechanics. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const vault=read('site-overrides/v254-dm-vault.js');
const divine=read('site-overrides/v270-divine-workspace.js');
const css=read('site-overrides/v286-vault-compact-resources.css');
const assembly=read('tools/overlay-v239-with-discord.py');
const dbGrant=read('site-overrides/sql/v286_source_charge_shorthand.sql');
const demoPrivacy=read('site-overrides/sql/v286_demo_grant_visibility.sql');
const demoSeed=read('tools/sql/v286_demo_party_boons.sql');
const html=read('published/veiled-codex/index.html');
for(const js of [vault,divine])assert.doesNotThrow(()=>new Function(js));
assert.ok(vault.includes('tv286-vault-grid'),'Item Vault cards missing');
assert.ok(vault.includes('tv286-vault-description'),'Item preview missing');
assert.ok(vault.includes('tv286-item-type'),'Type tags missing');
assert.ok(vault.includes('tv286-vault-filter'),'Category filter controls missing');
assert.ok(vault.includes("panelState.vaultFilter=value"),'Category filter must change results');
assert.ok(vault.includes('row.item_data?.description'),'Full source descriptions retained');
assert.ok(vault.includes('row.mechanics?.features'),'Fallback item abilities retained');
assert.ok(vault.includes("panelState.editing={mode:'vault',id:row.id}"),'Edit action missing');
assert.ok(vault.includes("panelState.editing={mode:'issue',id:row.id}"),'Send action missing');
const groupFns=vault.slice(vault.indexOf('function vaultItemFamily('),
 vault.indexOf('function listVault('));
const groups=vm.runInNewContext(groupFns+';({vaultItemFamily,vaultItemType})');
assert.equal(groups.vaultItemFamily({item_data:{kind:'trinket',name:'Whisperfern ring'}}),'rings');
assert.equal(groups.vaultItemFamily({item_data:{kind:'trinket',name:'Midnight specimen mantle'}}),'accessories');
assert.equal(groups.vaultItemFamily({item_data:{kind:'helmet',name:'Night-market hood'}}),'armour');
assert.equal(groups.vaultItemFamily({item_data:{kind:'tool',name:'Foldaway book stand'}}),'tools');
assert.equal(groups.vaultItemType({item_data:{kind:'trinket',name:'Refrain ring'}}),'Ring');
assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'Three-column Vault missing');
assert.ok(css.includes('max-width:1030px')&&css.includes('max-width:650px'),
 'Item cards need tablet/mobile layouts');
assert.ok(css.includes('#pageRoot .tv285-resource-card{gap:4px;padding:9px 11px 8px'));
assert.ok(css.includes('#pageRoot .tv285-resource-actions button{min-height:27px'));
assert.ok(divine.includes('tv285-charge-pips')&&divine.includes('tv285-resource-count'),
 'Charge pips/count must remain visible');
assert.ok(divine.includes("values.isShared||sheet.pending.has(gift.id)"),
 'Cannot restore a shared intercession as an independent boon');
for(const fragment of ['1[[:space:]]*/[[:space:]]*long','PB[[:space:]]*/[[:space:]]*long',
  "chosen_slot:='concordant'"]){
 assert.ok(dbGrant.includes(fragment),'Source grant rules missing '+fragment);
}
assert.ok(demoPrivacy.includes("c.owner_id is null and c.status='approved'"));
assert.ok(demoPrivacy.includes("c.approved_build->'character'->>'demo'"));
assert.ok(demoPrivacy.includes('authz.is_member(c.campaign_id)'));
assert.ok(demoPrivacy.includes("a.status='active'"),'Only awarded content should show');
assert.ok(demoSeed.includes("The Wayfarers’ Table · Demo"));
assert.ok(demoSeed.includes("c.owner_id is null"));
assert.ok(demoSeed.includes("c.approved_build->'character'->>'demo'='true'"));
assert.ok(demoSeed.includes('not authz.is_dm(v_campaign.id)'));
assert.ok(demoSeed.includes('terravale_divine_canon_grant('));
assert.ok(demoSeed.includes('terravale_divine_dm_set_favour_v282('));
assert.ok(demoSeed.includes('on conflict')===false,'Do not bypass canonical grant RPC');
const wanted=['Aster Vaelith','Brann Copperveil','Caelis Dawnfeather','Elira Wren',
 'Morrow Vey','Pip Thornwhistle','Tamsin Quickstep'];
for(const name of wanted)assert.ok(demoSeed.includes(name),'Missing demo character '+name);
assert.ok(demoSeed.includes("if exists(select 1 from public.terravale_divine_canon_awards"),
 'Demo seeding must be idempotent');
assert.ok(demoSeed.includes('false);'),'Prevent linked-favour changes to demo unrelated patrons');
assert.ok(assembly.includes('v286-vault-compact-resources.css'));
assert.ok(html.includes('tv286-vault-grid'));
assert.ok(html.includes('Terravale Codex V2.87'));
console.log('PASS V2.86: 3-column classified vault, compact resource cards, original-source charge inference and protected 7-member demo party.');
