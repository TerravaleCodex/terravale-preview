/* Terravale player-sheet death-save mechanics. Rules are deliberately conservative:
   automatic standard dice resolution; selected class, ancestry and item exceptions
   must be confirmed against their published descriptions. */
(function(root){
'use strict';
const empty=()=>({successes:0,failures:0,stable:false,dead:false,rescueUses:{}});
const clamp=(x,max)=>Math.max(0,Math.min(max,Math.floor(Number(x)||0)));
function normal(raw){
 const v=raw&&typeof raw==='object'?raw:{},d=empty();
 return {...d,successes:clamp(v.successes,3),failures:clamp(v.failures,3),
  stable:!!v.stable,dead:!!v.dead,lastRoll:v.lastRoll===undefined?undefined:clamp(v.lastRoll,20),
  rescueUses:v.rescueUses&&typeof v.rescueUses==='object'&&!Array.isArray(v.rescueUses)?{...v.rescueUses}:{}};
}
function healed(d){return {...empty(),rescueUses:normal(d).rescueUses}}
function rolled(d,hp,rolls,mode='normal',bonus=0){
 let v=normal(d);
 if(hp>0||v.stable||v.dead)throw Error('Death saves require an unstable character at 0 HP.');
 const dice=rolls.slice(0,mode==='normal'?1:2).map(x=>Math.max(1,Math.min(20,Math.floor(Number(x)))));
 if(dice.length!==(mode==='normal'?1:2))throw Error('Missing a death-save die roll');
 const selected=mode==='advantage'?Math.max(...dice):mode==='disadvantage'?Math.min(...dice):dice[0];
 if(selected===20)return {dice,selected,success:true,critical:'twenty',hp:1,state:healed(v)};
 const success=selected!==1&&selected+Math.floor(Number(bonus)||0)>=10;
 v.lastRoll=selected;
 v.successes=clamp(v.successes+(success?1:0),3);
 v.failures=clamp(v.failures+(success?0:selected===1?2:1),3);
 v.stable=v.successes>=3;v.dead=v.failures>=3;
 return {dice,selected,success,critical:selected===1?'one':null,hp:0,state:v};
}
function damageAtZero(d,critical=false){
 const v=normal(d);
 if(v.dead)return v;
 // A stable creature becomes unstable with a new set of rolls.
 if(v.stable){v.successes=0;v.failures=0;v.stable=false;}
 v.failures=clamp(v.failures+(critical?2:1),3);
 v.dead=v.failures>=3;return v;
}
function damaged(d,current,max,amount,temp,critical=false){
 const v=normal(d);
 const total=Math.max(0,Math.floor(Number(amount)||0));
 const absorb=Math.min(Math.max(0,temp),total),remaining=total-absorb;
 if(v.dead)return {hp:0,tempHp:temp,death:v,absorbed:0};
 if(!remaining)return {hp:current,tempHp:temp-absorb,death:v,absorbed:absorb};
 if(current<=0)return {hp:0,tempHp:temp-absorb,death:damageAtZero(v,critical),absorbed:absorb};
 const hp=Math.max(0,current-remaining);
 const instant=remaining-current>=max;
 return {hp,tempHp:temp-absorb,death:hp===0?{...healed(v),dead:instant}:v,absorbed:absorb};
}
function prevented(d,name){
 const v=normal(d);if(!name||v.dead||v.rescueUses[name])throw Error('Rescue unavailable');
 return {hp:1,death:{...healed(v),rescueUses:{...v.rescueUses,[name]:true}}};
}
function painWracked(list){return Array.isArray(list)&&list.some(c=>String(c).toLowerCase().replace(/\s+/g,'-')==='pain-wracked')}
function stable(d,conditions){
 const v=normal(d);
 if(v.dead)throw Error('Death requires DM resolution or a legal resurrection feature.');
 if(painWracked(conditions))throw Error('Pain-Wracked prevents stabilisation until the condition ends.');
 return {...v,successes:3,stable:true};
}
root.TVDeath={empty,normal,healed,rolled,damageAtZero,damaged,prevented,stable,painWracked};
})(typeof window==='undefined'?globalThis:window);
