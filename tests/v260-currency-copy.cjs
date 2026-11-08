/* V2.60 readable conversion labels. Only the display text changes; values stay intact. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rulesSrc=fs.readFileSync('site-overrides/v254-rules-registry.js','utf8');
const rules=JSON.parse(rulesSrc.slice(rulesSrc.indexOf('=')+1).trim().replace(/;\s*$/,''));
const wallet=fs.readFileSync('site-overrides/v255-native-wallet.js','utf8');
const start=wallet.indexOf('function displayedParts(system,amount){');
const end=wallet.indexOf('function displayed(system,amount)',start);
assert.ok(start>=0&&end>start,'Readable conversion function');
const ctx={};
vm.createContext(ctx);
vm.runInContext(wallet.slice(start,end),ctx);
const cases=[
  ['Human Civics',112,'50 Civics × 1','5 Civics × 1','1 Civic × 1'],
  ['Tri-Crown Crownrings',112,'Five Crownrings × 1','Crownring × 4','Third Crownring × 1'],
  ['Crimsonborn Ledger Notes',112,'10 Ledger Note × 1','1 Ledger Note × 1','2 Guild Copper left over'],
  ['Null City Meridian Notes',112,'50 Meridian Note × 1','5 Meridian Note × 1','1 Meridian Note × 1']
];
for(const [name,amount,...parts] of cases){
 const system=rules.currencies.find(c=>c.name===name);
 assert.ok(system,'Currency exists: '+name);
 const actual=[...ctx.displayedParts(system,amount)];
 for(const part of parts)assert.ok(actual.includes(part),name+' should show '+part+'; got '+actual.join(' / '));
 let total=0;
 for(const displayed of actual){
  const denomination=system.denominations.find(d=>displayed.startsWith(d.name+' × '));
  if(denomination){
   total+=Number(displayed.slice((denomination.name+' × ').length).replaceAll(',',''))*denomination.valueGC;
  }else if(displayed.endsWith(' Guild Copper left over')){
   total+=Number(displayed.split(' ')[0].replaceAll(',',''));
  }else assert.fail('Unknown displayed value '+displayed);
 }
 assert.equal(total,amount,'Converted amounts have not changed');
}
console.log('PASS: four confusing currencies now display denomination × count, no value change');
