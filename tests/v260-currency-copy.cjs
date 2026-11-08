/* V2.61: consolidated currency display; native money values stay unchanged. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rulesSrc=fs.readFileSync('site-overrides/v254-rules-registry.js','utf8');
const rules=JSON.parse(rulesSrc.slice(rulesSrc.indexOf('=')+1).trim().replace(/;\s*$/,''));
const wallet=fs.readFileSync('site-overrides/v255-native-wallet.js','utf8');
const start=wallet.indexOf('const unitSummaries={');
const end=wallet.indexOf('function displayed(system,amount)',start);
assert.ok(start>=0&&end>start,'Consolidated conversion function exists');
const ctx={};
vm.createContext(ctx);
vm.runInContext(wallet.slice(start,end),ctx);
const examples=[
 ['Kharithen Witness Tallies',112,['28 Tallies']],
 ['Human Civics',112,['56 Civics']],
 ['Tri-Crown Crownrings',112,['9 Crownrings','1 Third Crownring']],
 ['Crimsonborn Ledger Notes',112,['11 Ledger Notes','2 Guild Copper left over']],
 ['Null City Meridian Notes',112,['56 Meridian Notes']],
 ['Flügel Currents',112,['56 Currents']],
 ['Dvergr Measures',115,['11 Measures','1 Half Measure']],
 ['Guild Seals',112,['Gold Seal × 1','Silver Seal × 1','Copper Seal × 2']]
];
for(const [name,guildCopper,want] of examples){
 const system=rules.currencies.find(c=>c.name===name);
 assert.ok(system,'Known currency system: '+name);
 const display=[...ctx.displayedParts(system,guildCopper)];
 assert.deepEqual(display,want,name+' converted clearly');
}
for(const system of rules.currencies){
 for(const amount of [0,1,3,8,30,112,115,1003,10000]){
  // Every display conversion must leave the authoritative currency registry untouched.
  const snapshot=JSON.stringify(system);
  assert.ok(ctx.displayedParts(system,amount).length,'Nonempty display');
  assert.equal(JSON.stringify(system),snapshot,'Never mutate stored denominations');
 }
}
console.log('PASS: 28 Tallies instead of multiple notes, clear mixed units, registry unchanged');
