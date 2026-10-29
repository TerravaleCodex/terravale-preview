const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sandbox={};vm.runInNewContext(fs.readFileSync('site-overrides/death-mechanics.js','utf8'),sandbox,{timeout:2000});
const M=sandbox.TVDeath;
const norm=x=>JSON.parse(JSON.stringify(x));
function hit(d,hp,max,amt,temp=0,crit=false){return M.damaged(d,hp,max,amt,temp,crit)}
let one=hit(M.empty(),12,12,30,0);assert.equal(one.hp,0);assert.equal(one.death.dead,true,'Massive damage kills');
one=hit(M.empty(),12,12,12,0);assert.equal(one.hp,0);assert.equal(one.death.dead,false,'Exact zero begins dying');
one=hit(M.empty(),12,12,4,3);assert.equal(one.hp,11);assert.equal(one.tempHp,0);
one=hit(M.empty(),0,12,3,0);assert.equal(one.death.failures,1);
one=hit(one.death,0,12,3,0,true);assert.equal(one.death.failures,3);assert.equal(one.death.dead,true);
let d=M.empty();
d=M.rolled(d,0,[1]).state;assert.equal(d.failures,2,'Natural 1 counts twice');
d=M.rolled(d,0,[17]).state;assert.equal(d.successes,1);
assert.equal(M.rolled(d,0,[20]).hp,1,'Natural 20 revives to 1 HP');
d=M.empty();
d=M.rolled(d,0,[10]).state;d=M.rolled(d,0,[12]).state;d=M.rolled(d,0,[15]).state;
assert.equal(d.stable,true,'Three successes stabilise');
d=hit(d,0,12,1).death;assert.equal(d.stable,false);assert.equal(d.successes,0);assert.equal(d.failures,1,'Damage destabilises');
assert.throws(()=>M.stable(M.empty(),['Pain-Wracked']),/Pain-Wracked/);
assert.equal(M.stable(M.empty(),[]).stable,true);
let saved=M.prevented(M.empty(),'Tenacious Soul');
assert.equal(saved.hp,1);assert.equal(saved.death.rescueUses['Tenacious Soul'],true);
assert.throws(()=>M.prevented(saved.death,'Tenacious Soul'),/unavailable/);
assert.equal(M.healed(saved.death).rescueUses['Tenacious Soul'],true,'Healing does not replenish rescue uses');
assert.equal(M.rolled(M.empty(),0,[8,17],'advantage').success,true);
assert.equal(M.rolled(M.empty(),0,[8,17],'disadvantage').success,false);
let rapid={hp:30,tempHp:0,death:M.empty()};
for(let i=0;i<75;i++){const x=hit(rapid.death,rapid.hp,30,1,rapid.tempHp);rapid={hp:x.hp,tempHp:x.tempHp,death:x.death};}
assert.equal(rapid.hp,0);assert.equal(rapid.death.dead,true,'Repeated damage is cumulative, not based on stale HP');
const html=fs.readFileSync('site-overrides/sheet-live-v091.html','utf8');
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean).at(-1);
new vm.Script(script);
for(const needle of ["LIVE.postTimer=setTimeout","deathSaves:TVDeath.normal(state.deathSaves)","function deathPanel()","function rollDeathSave()","LIVE.survivalHints","function useRescue(name)","function resetDeathByDM()"]){
 assert(html.includes(needle),'Missing live integration '+needle);
}
console.log('PASS: death saves, rescue state, zero HP damage, critical outcomes, rapid damage, and live integration');
