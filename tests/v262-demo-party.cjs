/* Final demo-party integrity and sharing guards. Does not write live data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const kit=JSON.parse(fs.readFileSync('site-overrides/data/v262_demo_party_kit.json','utf8'));
const raw=fs.readFileSync('site-overrides/v254-rules-registry.js','utf8');
const registry=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;\s*$/,''));
const currencyIds=new Set(registry.currencies.flatMap(c=>c.denominations.map(d=>d.id)));
const toolIds=new Set(registry.tools.map(t=>t.id));
const languages=new Set(registry.languages.map(l=>l.id));
const slots=['main','off','head','chest','gloves','legs','feet','cloak','neck','ring1','ring2','accessory','accessory2','focus'];
const oldEquipped=[
 ['main','chest','accessory'],
 ['main','chest','accessory','cloak'],
 ['main','chest','cloak','focus'],
 ['main','off','chest','gloves','accessory'],
 ['focus','chest','feet','cloak'],
 ['main','off','chest','feet','cloak'],
 ['main','chest','accessory']
];
assert.equal(kit.characters.length,7);
assert.equal(new Set(kit.characters.map(c=>c.slot)).size,7);
let itemCount=0,feats=0,vault=0;
for(const [index,c] of kit.characters.entries()){
 assert.equal(c.slot,index+1);
 const all=[...oldEquipped[index],...c.items.filter(x=>x.location==='equipped').map(x=>x.slot)];
 assert.equal(new Set(all).size,all.length,c.name+' no equipment-slot conflicts');
 assert.ok(all.length>=9,c.name+' well equipped');
 assert.ok(c.items.length>=12,c.name+' plentiful items');
 assert.equal(c.feats.length,2,c.name+' two DM feats');
 assert.equal(c.vault_picks.length,2,c.name+' prepared Vault examples');
 for(const id of c.vault_picks)assert.ok(c.items.some(x=>x.id===id));
 for(const item of c.items){
  assert.match(item.id,/^demo62-[1-7]-[a-z0-9-]+$/);
  assert.ok(!item.slot||slots.includes(item.slot),c.name+' valid item slot');
  assert.ok(item.description.length>=15);
  assert.equal(item.qty,item.quantity);
  assert.ok(item.mechanics.rarity);
  const p=item.mechanics;
  if('charges' in p){
   assert.ok(p.max_charges>=p.charges&&p.max_charges>0);
   assert.ok(['manual','short','long','dawn'].includes(p.recovery));
  }
 }
 for(const feat of c.feats){
  assert.ok(feat.short_description.length>=15&&feat.rules_text.length>=35);
  assert.ok(feat.minimum_level<=20);
  assert.ok(feat.state==='ready');
  assert.ok(['passive','reaction','action','bonus action','special'].includes(feat.action_type));
 }
 for(const coin of c.purse){
  assert.ok(currencyIds.has(coin.denomination),c.name+' denomination '+coin.denomination);
  assert.ok(Number.isInteger(coin.quantity)&&coin.quantity>0);
 }
 for(const id of c.training.tools)assert.ok(toolIds.has(id),c.name+' tool '+id);
 for(const id of c.training.languages)assert.ok(languages.has(id),c.name+' language '+id);
 itemCount+=c.items.length;feats+=c.feats.length;vault+=c.vault_picks.length;
}
assert.ok(itemCount>=95);assert.equal(feats,14);assert.equal(vault,14);
const policy=fs.readFileSync('site-overrides/sql/v262_shared_character_read_only.sql','utf8');
for(const table of ['terravale_character_custom_feats','terravale_dm_custom_feats',
 'terravale_character_wallet','terravale_character_training_overrides'])
 assert.ok(policy.includes('on public.'+table+'\n for select to authenticated'));
assert.equal((policy.match(/for select to authenticated/g)||[]).length,4);
assert.ok(!/for (update|insert|delete) to authenticated/i.test(policy));
const script=fs.readFileSync('site-overrides/v255-native-wallet.js','utf8');
assert.ok(script.includes('else if(validRole(c))breakdown.append(manager)'),
 'Shared wallet cannot render change-money controls');
assert.ok(script.includes('if(!canRead(c))'),'Approved shared wallets can be viewed');
assert.ok(script.includes('c.sheetVisibleToParty===true'));
const seed=fs.readFileSync('site-overrides/sql/v262_curate_demo_party.sql','utf8');
assert.ok(seed.includes("c.owner_id is null and c.status='approved'"),'Only curated ownerless demos');
assert.ok(seed.includes('d.template_slot'),'Slot-limited seed');
assert.ok(seed.includes('on conflict (id) do update'),'Idempotent vault examples');
console.log('PASS: '+kit.characters.length+' curated heroes, '+itemCount+' new items, '+feats+
 ' custom feats, '+vault+' reusable Vault items, region-specific wallets and read-only guards');
