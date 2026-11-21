
/* Terravale V2.37 offline only. House-rule: three successful death saves -> 1 HP.
   Deliberately no server calls. Do not reuse this client trust model in live Supabase. */
(function(){'use strict';
const esc = value => safe(String(value??''));
const getChar = id => db.characters.find(c=>String(c.id)===String(id));
const can = c => c&&sheetV220CanEdit(c);
const isDM = () => db.role==='dm';
function deathState(c){
 const s=sheetV220State(c);let d=s.death;
 if(!d||typeof d!=='object')d=s.death={success:0,fail:0};
 d.success=Math.min(3,Math.max(0,Number(d.success)||0));
 d.fail=Math.min(3,Math.max(0,Number(d.fail)||0));
 d.rolls=Array.isArray(d.rolls)?d.rolls.slice(-12):[];
 d.dead=!!d.dead||d.fail>=3;
 return d;
}
function liveDeathRoomSync(c){
 const p=sheetV220Room(c);if(p){const d=deathState(c);p.death={success:d.success,fail:d.fail,stable:false,dead:!!d.dead,lastRoll:d.lastRoll};}
}
function resetDeath(c, note=''){
 const s=sheetV220State(c);
 s.death={success:0,fail:0,dead:false,rolls:[],lastRoll:note?{text:note}:null};liveDeathRoomSync(c);
}
function hitDice(c){
 const s=sheetV220State(c),total=Math.min(20,Math.max(1,Number(c.level)||1));
 let prior=Math.max(1,Number(s.v237HitDiceTotal)||total);
 if(!Number.isFinite(Number(s.v237HitDiceRemaining)))s.v237HitDiceRemaining=total;
 else if(total>prior)s.v237HitDiceRemaining+=total-prior;
 s.v237HitDiceRemaining=Math.max(0,Math.min(total,Math.floor(Number(s.v237HitDiceRemaining))));
 s.v237HitDiceTotal=total;
 const specified=Number(c.rulesV217?.hitDie??sheetV220Meta(c)?.die);
 const faces=[4,6,8,10,12,20].includes(specified)?specified:0;
 const con=Math.floor(((Number(c.con)||10)-10)/2);
 return {total,remaining:s.v237HitDiceRemaining,faces,con};
}
function applyResources(c,kind){
 const rs=sheetV220Resources(c),state=sheetV220State(c).resources;let n=0;
 for(const r of rs){
  const max=Number(r.max);if(!Number.isFinite(max)||max<1)continue;
  const prior=state[r.id]===undefined?(r.v235Recovery==='temporary'?0:max):Math.max(0,Math.min(max,Number(state[r.id])||0));
  let next=prior;
  if(r.v235Recovery==='temporary')next=0;
  else if(kind==='long')next=max;
  else if(kind==='short'&&r.v235Recovery==='short-long')next=max;
  else if(kind==='short'&&r.v235Recovery==='half-short')next=Math.min(max,prior+Math.ceil(max/2));
  if(next!==prior){state[r.id]=next;n++}
 }
 return n;
}
function lastRestLine(c){const r=sheetV220State(c).v237LastRest;if(!r)return '';
 if(r.kind==='short')return `Last short rest · ${r.spent} Hit Dice (${r.rolls.join(', ')||'none'}) · ${r.hpGained} HP gained`;
 return `Last long rest · restored ${r.hpGained} HP · recovered ${r.diceGained} Hit Dice`;
}
// Replace only the health panel's rest and death controls; keep existing sheet visuals / HP quick controls.
const oldHealth=sheetV220Health;
sheetV220Health=function(c){
 const s=sheetV220State(c),d=deathState(c),hd=hitDice(c);
 const t=document.createElement('template');t.innerHTML=oldHealth(c);
 const panel=t.content.querySelector('.sheet20-vitals');if(!panel)return t.innerHTML;
 const actions=panel.querySelector('.sheet20-hp-actions');
 if(actions){
  const old=actions.querySelector('[data-action="rest"]');if(old){
   const wrap=document.createElement('span');wrap.className='v237-rest-actions';
   const disabled=c.hp<=0||d.dead;
   wrap.innerHTML=`<button type="button" data-v237-rest="short" data-id="${esc(c.id)}" ${disabled?'disabled title="Recover from unconsciousness before resting"':''}>Short Rest</button><button type="button" class="v237-rest-long" data-v237-rest="long" data-id="${esc(c.id)}" ${disabled?'disabled title="Recover from unconsciousness before resting"':''}>Long Rest</button>`;
   old.replaceWith(wrap);
  }
 }
 const summary=document.createElement('div');summary.className='v237-hitdice';
 summary.innerHTML=`<span>Hit Dice <strong>${hd.remaining} / ${hd.total}</strong> · d${hd.faces}</span><span>CON ${hd.con>=0?'+':''}${hd.con}</span>`;
 const last=lastRestLine(c);if(last){const small=document.createElement('div');small.className='v237-rest-last';small.textContent=last;summary.appendChild(small)}
 if(actions)actions.after(summary);else panel.querySelector('.sheet20-hp-sub')?.after(summary);
 if(Number(c.hp)>0&&d.lastRoll&&d.lastRoll.text){
  const note=document.createElement('div');note.className='v237-rest-last v237-death-recovered';note.textContent=d.lastRoll.text;
  summary.after(note);
 }
 if(Number(c.hp)===0){
  const dead=d.dead||d.fail>=3;
  const old=panel.querySelector('.sheet20-death');if(old){
   const box=document.createElement('div');box.className='sheet20-death v237-death';
   box.innerHTML=`<div class="v237-death-title"><div><strong>${dead?'Deceased':'Death saves'}</strong><small>${dead?'Three failed saves. Only the DM can reopen this character’s death-save state.':'Roll 1d20: 10+ succeeds. Natural 1 counts as two failures. Natural 20 restores 1 HP. Three successes restore 1 HP (Terravale house rule). Three failures mean death.'}</small></div></div>
   <div class="v237-death-grid"><div class="v237-death-state"><span>Successes</span><b>${'●'.repeat(d.success)}${'○'.repeat(3-d.success)}</b></div><div class="v237-death-state"><span>Failures</span><b>${'●'.repeat(d.fail)}${'○'.repeat(3-d.fail)}</b></div></div>
   ${d.lastRoll?.text?`<div class="v237-death-result ${dead?'warning':''}" role="status">${esc(d.lastRoll.text)}</div>`:''}
   <div class="v237-death-buttons">${can(c)?`<button type="button" class="v237-roll" data-v237-roll="${esc(c.id)}" ${dead?'disabled':''}>Roll death save · d20</button>`:''}${isDM()?`<button type="button" data-v237-dm="${esc(c.id)}">DM override</button>`:''}</div>`;
   old.replaceWith(box);
  }
  const status=panel.querySelector('.sheet20-status');if(status)status.textContent=dead?'Deceased · DM override required':'Unconscious · death saves';
 }
 return t.innerHTML;
};
// Remove the duplicate resource-only rest actions; both now live with the character's HP.
const oldResourcePanel=sheetV220ResourcesPanel;
sheetV220ResourcesPanel=function(c){
 const t=document.createElement('template');t.innerHTML=oldResourcePanel(c);
 t.content.querySelectorAll('.v235-rest-actions').forEach(el=>el.remove());
 return t.innerHTML;
};
function rollForChar(c, rawOverride){
 if(!can(c)||Number(c.hp)>0)return null;
 const d=deathState(c);if(d.dead)return null;
 const raw=rawOverride==null?Math.floor(Math.random()*20)+1:rawOverride;
 const result={raw,status:'',success:d.success,fail:d.fail};
 if(raw===20){c.hp=1;d.success=3;result.status='Natural 20 — immediately regain 1 HP';}
 else{
  if(raw===1)d.fail=Math.min(3,d.fail+2);
  else if(raw>=10)d.success=Math.min(3,d.success+1);
  else d.fail=Math.min(3,d.fail+1);
  if(d.fail>=3){d.dead=true;result.status='Three failed saves — deceased';}
  else if(d.success>=3){c.hp=1;result.status='Three successful saves — regain 1 HP';}
  else result.status=raw>=10?'Success recorded':'Failure recorded';
 }
 result.success=d.success;result.fail=d.fail;
 d.rolls.push(raw);d.rolls=d.rolls.slice(-12);
 d.lastRoll={raw,text:`d20 → ${raw} · ${result.status} (${d.success} successes / ${d.fail} failures)`};
 liveDeathRoomSync(c);return result;
}
function doRest(c,kind,amount){
 if(!can(c)||Number(c.hp)<=0||deathState(c).dead){toast('Recover consciousness before resting; a DM can resolve death saves.');return;}
 const s=sheetV220State(c),hd=hitDice(c);let hpGained=0,spent=0,rolls=[],diceGained=0;
 if(kind==='short'){
  const n=Math.floor(Number(amount));
  if((n>0&&!hd.faces)||!Number.isInteger(n)||n<0||n>hd.remaining){toast('Choose a valid number of available Hit Dice');return;}
  spent=n;
  for(let i=0;i<n;i++){const raw=Math.floor(Math.random()*hd.faces)+1;rolls.push(raw);hpGained+=Math.max(0,raw+hd.con);}
  s.v237HitDiceRemaining=hd.remaining-n;
  const before=Number(c.hp)||0;c.hp=Math.min(Number(c.maxHp)||before,before+hpGained);
  hpGained=c.hp-before;
 }else{
  const before=Number(c.hp)||0;c.hp=Number(c.maxHp)||before;hpGained=c.hp-before;
  // 2014/2014-style 5e: up to half total Hit Dice (minimum 1) regained after long rest.
  diceGained=Math.min(hd.total-hd.remaining,Math.max(1,Math.floor(hd.total/2)));
  s.v237HitDiceRemaining=hd.remaining+diceGained;
  s.tempHp=0;
 }
 const changed=applyResources(c,kind);
 const result={kind,spent,rolls,hpGained,diceGained,recoveredResources:changed};
 s.v237LastRest=result;persist();closeModal();renderPage(false);window.TerravaleV281Canon?.onNativeRest?.(c.id,kind);
 toast(kind==='short'?`Short rest: ${hpGained} HP gained; ${spent} Hit Dice spent; ${changed} resources refreshed.`:`Long rest: full HP; ${diceGained} Hit Dice regained; ${changed} resources refreshed.`);
}
function openRest(c,kind,trigger){
 if(!can(c))return;
 if(Number(c.hp)<=0||deathState(c).dead){toast('A character at 0 HP must recover before resting.');return;}
 const hd=hitDice(c),hp=Number(c.hp)||0,max=Math.max(1,Number(c.maxHp)||1);
 if(kind==='short'){
  const pre=hd.faces?Math.min(hd.remaining,Math.max(0,Math.ceil((max-hp)/(Math.max(1,(hd.faces+1)/2+hd.con))))):0;
  const maxSpend=hd.faces?hd.remaining:0;
  modal('Short Rest · '+c.name,'Spend some of your remaining Hit Dice to heal; eligible class resources also recover.',
   `<form id="v237ShortRestForm" class="v237-rest-form"><input name="id" type="hidden" value="${esc(c.id)}"><div class="v237-rest-preview"><div><small>Current HP</small><strong>${hp} / ${max}</strong></div><div><small>Remaining Hit Dice</small><strong>${hd.remaining} / ${hd.total} · d${hd.faces}</strong></div></div><label>Hit Dice to spend<input name="count" type="number" min="0" max="${maxSpend}" step="1" value="${pre}" required></label><p>${hd.faces?'Each spent d'+hd.faces+' adds your CON modifier':'No verified class Hit Die; only a resource-only rest is available until DM verification.'}  (${hd.con>=0?'+':''}${hd.con}). Enter 0 for a resource-only short rest. Rolls are made once on confirmation and stored with the character.</p><button type="submit" class="btn primary">Complete Short Rest</button></form>`,trigger);
 }else{
  const gain=Math.min(hd.total-hd.remaining,Math.max(1,Math.floor(hd.total/2)));
  modal('Long Rest · '+c.name,'Restore your HP and long-rest resources; regain Hit Dice as established for the Codex.',
   `<form id="v237LongRestForm" class="v237-rest-form"><input name="id" type="hidden" value="${esc(c.id)}"><div class="v237-rest-preview"><div><small>HP after rest</small><strong>${max} / ${max}</strong></div><div><small>Hit Dice regained</small><strong>+${gain}</strong></div></div><p>Temporary HP ends. Short- or long-rest resources recover according to their published rules. Any abilities requiring a special recharge condition remain governed by their own text.</p><button type="submit" class="btn primary">Complete Long Rest</button></form>`,trigger);
 }
}
function openDM(c,trigger){
 if(!isDM())return;
 const d=deathState(c);
 modal('DM death-save override · '+c.name,'Choose one explicit adjustment. Only the DM can declare a character revived or reopen a fatal death-save result.',
 `<div class="v237-override-actions"><button type="button" data-v237-dm-action="revive" data-id="${esc(c.id)}">Revive at 1 HP <small>· reset failures and unconsciousness</small></button><button type="button" data-v237-dm-action="reset" data-id="${esc(c.id)}">Reset saves at 0 HP <small>· allow a new sequence of rolls</small></button><button type="button" data-v237-dm-action="dead" data-id="${esc(c.id)}">Mark deceased <small>· lock rolls until DM changes state</small></button></div>`,trigger);
}
function overrideDeath(c,action){
 if(!isDM())return;
 if(action==='revive'){c.hp=1;resetDeath(c,'DM override: returned to 1 HP');}
 else if(action==='reset'){c.hp=0;resetDeath(c,'DM override: saves reset');}
 else if(action==='dead'){c.hp=0;const d=deathState(c);d.dead=true;d.fail=3;d.lastRoll={text:'DM declared this character deceased'};liveDeathRoomSync(c);}
 else return;
 persist();closeModal();renderPage(false);toast('DM death-save adjustment recorded.');
}
const oldModify=modifyHP;
modifyHP=function(id,delta){
 const c=getChar(id);if(!c)return;
 const before=Number(c.hp)||0;
 if(deathState(c).dead){toast('This character is deceased. Use DM override on the character sheet.');return;}
 oldModify(id,delta);
 if(before>0&&Number(c.hp)===0){resetDeath(c);persist();}
 else if(before===0&&Number(c.hp)>0){resetDeath(c,'Recovered through healing');persist();}
};
const oldRoomSetHealth=roomSetHealth;
roomSetHealth=function(p,delta){
 const c=roomCharacter(p);if(c&&deathState(c).dead){toast('A deceased character requires a DM override.');return;}
 const prior=c?Number(c.hp):Number(p.hp||0);
 oldRoomSetHealth(p,delta);
 if(c){
  if(prior>0&&Number(c.hp)===0)resetDeath(c);
  else if(prior===0&&Number(c.hp)>0)resetDeath(c,'Recovered through healing');
  liveDeathRoomSync(c);persist();
 }
};
// Session Room uses the same rules and the same saved death state as the sheet.
const oldRoomDeathRoll=roomDeathRoll;
roomDeathRoll=function(p){
 const c=roomCharacter(p);
 if(!c){
  // Preserve existing NPC death-save mechanics; the new player-character house rule is not inferred for monsters.
  oldRoomDeathRoll(p);return;
 }
 if(!roomCanManage(p))return;
 const r=rollForChar(c);if(!r){toast(deathState(c).dead?'Death saves locked after death':'Rolls are only available at 0 HP');return;}
 roomWrite(c.name,deathState(c).lastRoll.text,'system');
 roomEvent('death','Death save rolled for '+c.name,c.name);
 persist();renderPage(false);toast(deathState(c).lastRoll.text);
};
// Intercept before the old generic sheet handler, using separate action names.
document.addEventListener('click',event=>{
 const t=event.target.closest('[data-v237-rest],[data-v237-roll],[data-v237-dm],[data-v237-dm-action]');
 if(!t)return;
 event.preventDefault();event.stopImmediatePropagation();
 const c=getChar(t.dataset.id||t.dataset.v237Roll||t.dataset.v237Dm);
 if(!c)return;
 if(t.hasAttribute('data-v237-roll')){
  const r=rollForChar(c);if(!r)return;
  persist();renderPage(false);toast(deathState(c).lastRoll.text);
 }else if(t.hasAttribute('data-v237-rest'))openRest(c,t.dataset.v237Rest,t);
 else if(t.hasAttribute('data-v237-dm'))openDM(c,t);
 else if(t.hasAttribute('data-v237-dm-action'))overrideDeath(c,t.dataset.v237DmAction);
},true);
document.addEventListener('submit',event=>{
 const form=event.target;
 const fid=form.getAttribute('id');
 if(fid!=='v237ShortRestForm'&&fid!=='v237LongRestForm')return;
 event.preventDefault();event.stopImmediatePropagation();
 const fd=new FormData(form),c=getChar(fd.get('id'));if(!c)return;
 if(fid==='v237ShortRestForm')doRest(c,'short',fd.get('count'));
 else doRest(c,'long',0);
},true);
// Prevent the old generic HP and session action buttons from resurrecting someone marked dead.
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action="hp"],[data-action="roomHP"],[data-action="rest"],[data-action="sheetDeath"],[data-action="sheetDeathReset"]');
 if(!b)return;
 const c=getChar(b.dataset.id);if(!c)return;
 if(['sheetDeath','sheetDeathReset'].includes(b.dataset.action)||
    (deathState(c).dead&&(Number(b.dataset.delta)>0||b.dataset.action==='rest'))){
    e.preventDefault();e.stopImmediatePropagation();toast('Use the new death-save roll or DM override controls.');
 }
},true);
window.TERRAVALE_V237={version:'2.37',houseDeathSuccessHp:1,longRestHitDice:'half of total (minimum 1)',shortRest:'spend Hit Dice + verified resource recovery',serverConnected:false};
renderPage(false);
})();
