/* Terravale Codex — live attack workflow.
 * Results use authenticated Supabase dice RPCs, never Math.random. The DM
 * explicitly confirms HP application through a protected server RPC.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const bridge=window.TerravaleRoomPreview;
const hooks=()=>window.TerravaleLiveHooks;
if(!bridge||!$("attack-workbench"))return;
const form={
 source:$("attack-source"),sourceWrap:$("attack-source-wrap"),
 target:$("attack-target"),bonus:$("attack-bonus"),ac:$("attack-ac"),
 damage:$("attack-damage"),mode:$("attack-mode"),
 roll:$("attack-roll"),rollDamage:$("attack-roll-damage"),
 apply:$("attack-apply"),status:$("attack-result"),
 help:$("attack-help"),role:$("attack-role-note")
};
let attackerId="",targetId="",manualAc=null,attack=null,damage=null,busy=false,knownRole=null;
const esc=s=>String(s??"");
const state=()=>bridge.readState?.()||{};
const actors=()=>Array.isArray(state().actors)?state().actors:[];
const current=id=>actors().find(a=>a.id===id);
const isDm=()=>state().dm===true;
const inQueue=()=>Array.isArray(state().queue)?state().queue:[];
const intIn=(value,low,high)=>/^-?\d+$/.test(String(value).trim())&&
 Number(value)>=low&&Number(value)<=high?Number(value):null;
const pretty=n=>n>=0?"+"+n:String(n);
const status=(message,type="neutral")=>{
 form.status.textContent=message;
 form.status.dataset.outcome=type;
};
function acOf(target){
 if(!target)return null;
 // For a hidden monster do not expose secret AC in the player UI.
 if(!isDm()&&target.type!=="Player"&&target.hidden)return null;
 const block=target.statBlock||{};
 for(const value of [target.ac,block.ac,block.armorClass,block.armourClass,block.armor_class]){
  const v=Number(value);
  if(value!==null&&value!==""&&value!==undefined&&Number.isInteger(v)&&v>=1&&v<=99)return v;
 }
 return null;
}
function parseDamage(raw){
 const m=String(raw||"").replace(/\s+/g,"").match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i);
 if(!m)return null;
 const count=Number(m[1]),sides=Number(m[2]),modifier=Number(m[3]||0);
 if(count<1||count>15||Math.abs(modifier)>100)return null;
 return {count,sides,modifier};
}
function setOptions(sel,options,selected,placeholder){
 const wanted=String(selected||"");
 const signature=options.map(a=>a.id+":"+a.name).join("|")+"@"+placeholder;
 if(sel.dataset.signature!==signature){
  const fragments=[];
  if(placeholder)fragments.push(new Option(placeholder,""));
  for(const a of options)fragments.push(new Option(a.name,a.id));
  sel.replaceChildren(...fragments);
  sel.dataset.signature=signature;
 }
 sel.value=options.some(a=>a.id===wanted)?wanted:"";
 return sel.value;
}
function invalidate(clearAttack=true){
 if(clearAttack)attack=null;
 damage=null;
 form.apply.disabled=true;
 form.rollDamage.disabled=true;
 if(!busy)status("Ready to roll. Damage is only available after a confirmed hit.");
}
function effectiveAc(){
 const known=acOf(current(targetId));
 return isDm()&&manualAc!==null?manualAc:known;
}
function refresh(){
 const st=state(),dm=isDm();
 if(dm!==knownRole){knownRole=dm;attackerId="";targetId="";manualAc=null;invalidate();}
 const available=actors().filter(a=>a&&typeof a.id==="string"&&a.name);
 const party=inQueue().map(id=>available.find(a=>a.id===id)).filter(Boolean);
 const own=available.find(a=>a.id===st.own&&a.type==="Player");
 const sources=dm?party:(own?[own]:[]);
 if(!dm)attackerId=own?.id||"";
 else if(!sources.some(a=>a.id===attackerId))attackerId=sources[0]?.id||"";
 form.sourceWrap.hidden=!dm;
 form.role.textContent=dm?"DM · Choose any combatant in initiative":own?"Rolling as "+own.name:"No approved character is assigned";
 setOptions(form.source,sources,attackerId,sources.length?"Choose attacker":"No attacker in initiative");
 const targets=party.filter(a=>a.id!==attackerId);
 if(!targets.some(a=>a.id===targetId)){targetId="";manualAc=null;attack=null;damage=null;}
 setOptions(form.target,targets,targetId,"Choose a target");
 const known=acOf(current(targetId));
 form.ac.readOnly=!dm;
 if(manualAc===null||!dm)form.ac.value=known===null?"":known;
 else form.ac.value=manualAc;
 form.ac.placeholder=known===null?"Unknown":"AC";
 form.help.textContent=dm
  ?"AC comes from an approved sheet or saved creature block. You can override AC for this attack. HP changes require explicit confirmation."
  :"Your attacker is locked to your approved character. Hidden or unknown AC requires the DM to decide whether the roll hits.";
 form.roll.disabled=busy||!attackerId||!targetId||!hooks()?.combatRoll;
 form.rollDamage.disabled=busy||!attack||attack.outcome!=="hit"||!!damage;
 form.apply.hidden=!dm;
 form.apply.disabled=busy||!dm||!damage||damage.applied;
 $("attack-workbench").dataset.advanced=dm?"dm":"player";
 const confirmation=$("attack-confirm-hit");
 if(confirmation)confirmation.hidden=!dm||busy||!attack||attack.outcome!=="pending";
 if(!party.length)status(dm?"Add characters or creatures from the DM Desk before rolling attacks.":"No targets are in initiative yet.");
}
async function rollHit(){
 if(busy||!attackerId||!targetId)return;
 const attacker=current(attackerId),defender=current(targetId),bonus=intIn(form.bonus.value,-30,100);
 if(!attacker||!defender||bonus===null){status("Choose an attacker, a target, and a valid attack bonus.","warning");return;}
 const ac=effectiveAc();
 const mode=form.mode.value;
 const count=mode==="normal"?1:2;
 busy=true;attack=null;damage=null;refresh();
 try{
  const roll=await hooks().combatRoll(count,20,0);
  const faces=roll.results.map(Number);
  if(faces.length!==count||faces.some(x=>!Number.isInteger(x)||x<1||x>20))throw Error("Invalid attack roll data");
  const chosen=mode==="advantage"?Math.max(...faces):mode==="disadvantage"?Math.min(...faces):faces[0];
  const total=chosen+bonus,critical=chosen===20;
  const outcome=chosen===1?"miss":critical?"hit":ac===null?"pending":total>=ac?"hit":"miss";
  attack={attackerId,targetId,bonus,ac,total,chosen,faces,mode,critical,outcome};
  const label=outcome==="hit"?(critical?"CRITICAL HIT":"HIT"):outcome==="miss"?"MISS":"AC unknown · DM adjudicates";
  status(attacker.name+" attacks "+defender.name+": "+chosen+pretty(bonus)+" = "+total+
   (ac===null?" (AC unknown)":" vs AC "+ac)+" — "+label,outcome);
  // Roll totals and target names are shared in campaign chat. For a hidden
  // creature, omit the actual AC so the player cannot infer it from the note.
  try{await hooks().combatMessage(attacker.name+" → "+defender.name+": attack "+
   (faces.length===2?faces.join("/")+" ("+mode+"), ":"")+chosen+pretty(bonus)+" = "+total+
   " · "+label+(defender.hidden&&defender.type!=="Player"?"":" (AC "+(ac??"?")+")"));}
  catch(error){status(form.status.textContent+" · Chat note unavailable: "+error.message,"warning");}
 }catch(error){status("Attack roll failed: "+error.message,"warning");attack=null;}
 finally{busy=false;refresh();}
}
async function rollDamage(){
 if(busy||attack?.outcome!=="hit"||damage)return;
 if(attack.attackerId!==attackerId||attack.targetId!==targetId)return;
 const parsed=parseDamage(form.damage.value);
 if(!parsed){status("Enter damage like 1d8+3 or 2d6-1 (up to 15 dice).","warning");return;}
 const totalDice=parsed.count*(attack.critical?2:1);
 busy=true;refresh();
 try{
  const roll=await hooks().combatRoll(totalDice,parsed.sides,parsed.modifier);
  const sum=Number(roll.total);
  if(!Number.isInteger(sum))throw Error("Damage result missing");
  damage={amount:Math.max(0,sum),raw:sum,targetId,applied:false};
  const target=current(targetId);
  const desc=(attack.critical?"Critical damage: ":"Damage: ")+totalDice+"d"+parsed.sides+
   pretty(parsed.modifier)+" = "+damage.amount+" to "+(target?.name||"target");
  status(desc,isDm()?"hit":"neutral");
  try{await hooks().combatMessage(desc+" · "+(isDm()?"Awaiting DM HP confirmation":"DM applies HP separately"));}
  catch(error){status(desc+" · Chat note unavailable: "+error.message,"warning");}
 }catch(error){status("Damage roll failed: "+error.message,"warning");damage=null;}
 finally{busy=false;refresh();}
}
async function confirmHit(){
 if(!isDm()||!attack||attack.outcome!=="pending")return;
 attack.outcome="hit";
 status("DM confirmed: "+(current(attack.attackerId)?.name||"Attacker")+
  " hit "+(current(attack.targetId)?.name||"target")+". Damage roll is ready.","hit");
 refresh();
}
async function applyDamage(){
 if(!isDm()||!damage||damage.applied||busy||!current(targetId)||targetId!==damage.targetId)return;
 const defender=current(targetId);
 if(!confirm("Apply "+damage.amount+" damage to "+defender.name+"'s live HP? Temporary HP is consumed first when present."))return;
 busy=true;refresh();
 try{
  const result=await bridge.applyCombatDamage(targetId,damage.amount);
  damage.applied=true;
  status("Applied "+damage.amount+" damage to "+defender.name+
   ". "+Number(result?.absorbed||0)+" absorbed by temporary HP; "+
   Number(result?.hp)+" HP remaining.","hit");
  try{await hooks()?.combatMessage?.("DM applies "+damage.amount+" damage to "+defender.name+
   " ("+Number(result?.absorbed||0)+" temporary HP absorbed).");}catch{}
 }catch(error){status("HP update failed: "+error.message+" · Refresh and review before retrying.","warning");}
 finally{busy=false;refresh();}
}
function init(){
 form.source.addEventListener("change",()=>{
  attackerId=form.source.value;targetId="";manualAc=null;invalidate();refresh();
 });
 form.target.addEventListener("change",()=>{
  targetId=form.target.value;manualAc=null;invalidate();refresh();
 });
 form.bonus.addEventListener("change",()=>{invalidate();refresh()});
 form.mode.addEventListener("change",()=>{invalidate();refresh()});
 form.damage.addEventListener("change",()=>{damage=null;refresh()});
 form.ac.addEventListener("change",()=>{
  if(!isDm())return;
  manualAc=form.ac.value.trim()?intIn(form.ac.value,1,99):null;
  if(form.ac.value.trim()&&manualAc===null){status("AC must be from 1 to 99.","warning");return;}
  invalidate();refresh();
 });
 form.roll.addEventListener("click",()=>{void rollHit()});
 form.rollDamage.addEventListener("click",()=>{void rollDamage()});
 form.apply.addEventListener("click",()=>{void applyDamage()});
 const confirmHitButton=document.createElement("button");
 confirmHitButton.id="attack-confirm-hit";
 confirmHitButton.type="button";
 confirmHitButton.className="btn small";
 confirmHitButton.textContent="DM: Confirm hit";
 confirmHitButton.hidden=true;
 form.rollDamage.after(confirmHitButton);
 confirmHitButton.addEventListener("click",()=>{void confirmHit()});
 refresh();
}
window.TerravaleCombatPanel=Object.freeze({refresh,parseDamage,acOf});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();