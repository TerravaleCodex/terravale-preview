/* Terravale V2.51 — interactive DM-approved item mechanics.
   Native rest/character/initiative controls remain authoritative.
   Charges, attunement and recharge are atomic Supabase RPC updates. */
(function(){
'use strict';
const auth=()=>window.TerravaleVerifiedAccount;
const api=()=>auth()?.supabase;
const ready=()=>!!auth()?.state?.ready;
const chars=()=>typeof db==='undefined'?[]:db.characters||[];
const char=id=>chars().find(c=>String(c.id)===String(id));
const inv=c=>Array.isArray(c?.inventory)?c.inventory:[];
const props=c=>c?.dmItemProperties||{};
const itemProps=(c,i)=>props(c)[i.id]||{};
const actor=c=>!!(ready()&&c&&(c.owner==='You'||(auth().state.profile?.is_dm&&db.campaigns.some(x=>x.id===c.campaign&&x.role==='dm'))));
const dm=c=>!!(auth()?.state?.profile?.is_dm&&db.campaigns.some(x=>x.id===c.campaign&&x.role==='dm'));
const mayUse=(c,p)=>actor(c)&&(!p.attunement||p.attuned===true);
const charged=p=>Number(p.max_charges)>0;
const cost=p=>Math.max(1,Number(p.charge_cost)||1);
const node=(tag,klass,txt)=>{const x=document.createElement(tag);if(klass)x.className=klass;if(txt!==undefined)x.textContent=String(txt);return x};
const button=(label,action,c,i)=>{const b=node('button','btn ghost small',label);b.type='button';b.dataset.tvItemAction=action;b.dataset.characterId=c.id;b.dataset.itemId=i.id;return b};
const notify=s=>{if(typeof toast==='function')toast(s);else console.info('[Terravale item]',s)};
const signed=n=>Number(n)>0?'+'+n:String(n);
const attuned=p=>!p.attunement||p.attuned===true;
const ability=(c,k)=>!k||k==='none'?0:Math.floor(((Number(c[k]??c[k.toUpperCase()])||10)-10)/2);
const proficiency=c=>2+Math.floor((Math.min(20,Math.max(1,Number(c.level)||1))-1)/4);
const rollLog=[],pending=new Set();
function roll(faces){
 if(window.crypto?.getRandomValues){const a=new Uint32Array(1),limit=Math.floor(4294967296/faces)*faces;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%faces+1}
 return Math.floor(Math.random()*faces)+1;
}
function dice(expression){
 const m=String(expression||'').trim().match(/^([1-9]|1\d|20)d(4|6|8|10|12|20|100)(?:\s*([+-])\s*(\d{1,2}))?$/i);
 if(!m)return null;
 const r=Array.from({length:Number(m[1])},()=>roll(Number(m[2])));
 const mod=m[3]?(m[3]==='-'?-1:1)*Number(m[4]):0;
 return {value:r.reduce((a,b)=>a+b,0)+mod,detail:r.join(' + ')+(mod?signed(mod):'')};
}
function renderLog(){
 const feed=document.getElementById('tv-v251-roll-lines');if(!feed)return;
 feed.replaceChildren();
 if(!rollLog.length){feed.append(node('p','tv-v251-muted','Item roll history appears here. These rolls are local, not shared chat messages.'));return}
 for(const item of rollLog){
  const row=node('div','tv-v251-roll-log');
  row.append(node('span','',item.message),node('time','',new Date(item.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
  feed.append(row);
 }
}
function announce(message){rollLog.unshift({message,time:Date.now()});rollLog.splice(8);renderLog();notify(message)}
function rollItem(c,i,op){
 const p=itemProps(c,i);
 if(!i.slot||!mayUse(c,p)){notify('Equip and, if required, attune to this weapon first.');return}
 if(op==='attack'){
  const raw=roll(20),mod=ability(c,p.attack_ability),prof=p.proficient?proficiency(c):0,bonus=Number(p.attack_bonus)||0;
  announce(c.name+' · '+i.name+' ATTACK '+(raw+mod+prof+bonus)+' (d20 '+raw+(mod?' '+signed(mod)+' ability':'')+(prof?' +'+prof+' proficiency':'')+(bonus?' '+signed(bonus)+' item':'')+')'+(raw===20?' · natural 20':raw===1?' · natural 1':''));
 }else{
  const result=dice(p.damage_dice);
  if(!result){notify('Ask the DM to enter supported dice, e.g. 1d8 + 2.');return}
  const mod=ability(c,p.damage_ability);
  announce(c.name+' · '+i.name+' DAMAGE '+(result.value+mod)+' '+(p.damage_type||'')+' ('+result.detail+(mod?' '+signed(mod)+' ability':'')+'). DM applies damage.');
 }
}
async function useItem(c,i,operation){
 if(!actor(c))return notify('Only the character owner or campaign DM can activate this item.');
 const id=c.id+'|'+i.id;if(pending.has(id))return;pending.add(id);
 try{
  const {data,error}=await api().rpc('terravale_item_action',{target_character:c.id,target_item:i.id,operation});
  if(error||!data?.properties)throw error||new Error('The server did not confirm item changes.');
  c.dmItemProperties??={};c.dmItemProperties[i.id]=data.properties;
  if(typeof persist==='function')persist();
  if(operation==='use')notify(i.name+': '+data.properties.charges+' / '+data.properties.max_charges+' charges remaining.');
  else if(operation==='attune')notify(c.name+' attuned to '+i.name+'.');
  else if(operation==='unattune')notify(c.name+' unattuned from '+i.name+'.');
  else notify('Dawn recharge: '+i.name+' now has '+data.properties.charges+' charges.');
  if(typeof renderPage==='function')renderPage(false);
 }catch(error){notify('Item action failed: '+(error.message||String(error)))}finally{pending.delete(id)}
}
function rechargeLabel(p){
 const rule=p.recovery==='short'?'Short or long rest':p.recovery==='long'?'Long rest':p.recovery==='dawn'?'Dawn · DM confirms':'Manual';
 return 'Recharge: '+rule+(p.recharge_dice?' · '+p.recharge_dice:p.recharge_amount>0?' · +'+p.recharge_amount:' · full')+(p.recharge?' · '+p.recharge:'');
}
function resource(c,i){
 const p=itemProps(c,i),card=node('div','tv-v251-resource-card');
 const head=node('div','tv-v251-resource-title');
 head.append(node('strong','',i.name),node('small','',i.slot?'Equipped':'Backpack'));card.append(head);
 if(charged(p)){
  const current=Math.max(0,Number(p.charges)||0),max=Number(p.max_charges);
  card.append(node('p','tv-v251-count',current+' / '+max+' charges'));
  const bar=node('div','tv-v251-bar'),fill=node('span');fill.style.width=(100*current/Math.max(1,max))+'%';bar.append(fill);card.append(bar);
 }
 const actions=node('div','tv-v251-resource-actions');
 if(p.attunement){
  const b=button(p.attuned?'Unattune':'Attune',p.attuned?'unattune':'attune',c,i);b.disabled=!actor(c);actions.append(b);
  if(!p.attuned)card.append(node('p','tv-v251-warning','Requires attunement. Bonuses and charged effects are inactive.'));
 }
 if(charged(p)){
  const use=button('Activate · '+cost(p)+' charge'+(cost(p)>1?'s':''),'use',c,i);
  use.disabled=!mayUse(c,p)||Number(p.charges)<cost(p);actions.append(use);
  card.append(node('p','tv-v251-rule',rechargeLabel(p)));
  if(p.recovery==='dawn'&&dm(c)){
   const dawn=button('DM: Confirm dawn','dawn',c,i);
   dawn.disabled=Number(p.charges)>=Number(p.max_charges);actions.append(dawn);
  }
 }
 if(actions.children.length)card.append(actions);
 if(p.features){const more=node('details','tv-v251-ability');more.append(node('summary','','Read item ability'),node('p','',p.features));card.append(more)}
 return card;
}
function showResources(c){
 const root=document.querySelector('#pageRoot .sheet20-resource-panel');if(!root)return;
 const eligible=inv(c).filter(i=>{const p=itemProps(c,i);return Object.keys(p).length&&(p.attunement||(charged(p)&&p.resource_tracker!==false))});
 let panel=root.querySelector('#tv-v251-item-resources');
 if(!eligible.length){panel?.remove();return}
 const signature=JSON.stringify([c.id,eligible,eligible.map(i=>itemProps(c,i)),actor(c),dm(c)]);
 if(panel?.dataset.fingerprint===signature)return;
 panel?.remove();panel=node('section','tv-v251-item-resources');panel.id='tv-v251-item-resources';panel.dataset.fingerprint=signature;
 panel.append(node('div','v2-overline','ITEM RESOURCES · REAL CHARGES'),node('h4','','Item charges and attunement'));
 for(const i of eligible)panel.append(resource(c,i));root.append(panel);
}
function showArmour(c){
 const hero=document.querySelector('#pageRoot .sheet20-hero');if(!hero)return;
 const active=inv(c).filter(i=>i.slot&&attuned(itemProps(c,i))&&Number(itemProps(c,i).ac_bonus));
 let panel=document.querySelector('#pageRoot #tv-v251-armour');
 if(!active.length){panel?.remove();return}
 const signature=JSON.stringify([c.id,c.ac,active.map(i=>[i.id,i.name,itemProps(c,i).ac_bonus])]);
 if(panel?.dataset.fingerprint===signature)return;panel?.remove();
 const base=Number(c.ac)||10,total=active.reduce((n,i)=>n+(Number(itemProps(c,i).ac_bonus)||0),base);
 panel=node('section','tv-v251-armour');panel.id='tv-v251-armour';panel.dataset.fingerprint=signature;
 panel.append(node('strong','','Effective AC '+total),node('span','','Base '+base+' · '+active.map(i=>i.name+' '+signed(itemProps(c,i).ac_bonus)).join(' · ')),node('small','','Equipped/attuned bonuses only. DM-assigned base AC remains unchanged.'));
 hero.insertAdjacentElement('afterend',panel);
}
// V2.64: the native Dice & Checks panel owns item actions, instead of a
// second full-width Weapons and Powers grid consuming the session workspace.
const tableUI={mode:'dice',selected:null,manual:false,campaign:null};
function roomActors(){
 if(typeof db==='undefined')return [];
 return chars().filter(c=>c.campaign===db.campaign&&c.status==='Approved'&&
    (c.owner==='You'||(db.role==='dm'&&dm(c))));
}
function actionItems(c){
 return inv(c).filter(i=>{
  const p=itemProps(c,i);
  return Object.keys(p).length&&
   ((i.slot&&(p.weapon_action===true||(p.weapon_action===undefined&&p.damage_dice)))||
    (charged(p)&&p.resource_tracker!==false));
 });
}
function roomCard(c){
 const card=node('section','tv-v264-character-actions');
 const eligible=actionItems(c);
 if(!eligible.length){
  card.append(node('p','tv-v251-muted','No available weapon or item actions on this character.'));
  return card;
 }
 for(const i of eligible){
  const p=itemProps(c,i),row=node('div','tv-v251-weapon-row'),
   name=node('div','tv-v251-weapon-details'),actions=node('div','tv-v251-weapon-actions');
  const title=node('button','tv-v264-item-name',i.name);
  title.type='button';title.dataset.v264Inspect=i.id;title.dataset.characterId=c.id;
  title.title='Inspect '+i.name;
  name.append(title,node('small','',
   [(p.damage_dice||'')+' '+(p.damage_type||''),
    charged(p)?(p.charges||0)+' / '+p.max_charges+' charges':'',
    p.attunement&&!p.attuned?'Not attuned':''].filter(t=>t.trim()).join(' · ')));
  if(i.slot&&(p.weapon_action===true||(p.weapon_action===undefined&&p.damage_dice))){
   const attack=button('Attack','attack',c,i);
   attack.disabled=!mayUse(c,p);actions.append(attack);
   if(p.damage_dice){
    const damage=button('Damage','damage',c,i);
    damage.disabled=!mayUse(c,p);actions.append(damage);
   }
  }
  if(charged(p)&&p.resource_tracker!==false){
   const use=button('Activate ('+cost(p)+')','use',c,i);
   use.disabled=!mayUse(c,p)||Number(p.charges)<cost(p);
   actions.append(use);
  }
  row.append(name,actions);card.append(row);
 }
 return card;
}
function paintRoomTabs(panel,diceArea,actionsPanel,actors){
 const mode=tableUI.mode;
 const tabs=panel.querySelectorAll('[data-v264-room-tab]');
 for(const b of tabs){
  const active=b.dataset.v264RoomTab===mode;
  b.classList.toggle('is-current',active);
  b.setAttribute('aria-selected',String(active));
  b.tabIndex=active?0:-1;
 }
 diceArea.hidden=mode==='actions';
 diceArea.classList.toggle('tv-v264-quick-only',mode==='checks');
 actionsPanel.hidden=mode!=='actions';
 if(mode==='checks'){
  const nativeToggle=diceArea.querySelector('[data-action="toggleQuickChecks"]');
  if(nativeToggle&&nativeToggle.getAttribute('aria-expanded')==='false'){
   // Use the existing native handler, preserving its real ability-score
   // bonuses and existing character selector rather than simulating new rolls.
   nativeToggle.click();
  }
 }
}
function renderRoomActions(actors,signature,host){
 let panel=host.querySelector('#tv-v251-session-items');
 if(panel?.dataset.fingerprint===signature)return panel;
 panel?.remove();
 panel=node('section','tv-v251-session-items tv-v264-session-items');
 panel.id='tv-v251-session-items';panel.dataset.fingerprint=signature;
 const eligible=actors.filter(c=>actionItems(c).length);
 if(!eligible.some(c=>c.id===tableUI.selected)){
  // On first opening, prefer the active combatant when that actor belongs
  // to the user; after manual selection, preserve the player's choice.
  const liveName=document.querySelector('#pageRoot .sr-status-current strong')?.textContent?.trim();
  const active=eligible.find(c=>c.name===liveName);
  tableUI.selected=(active||eligible[0]||actors[0]||{}).id||null;
  tableUI.manual=false;
 }
 if(actors.length>1){
  const group=node('div','tv-v264-character-picker');
  group.setAttribute('role','group');group.setAttribute('aria-label','Choose a character for item actions');
  for(const c of actors){
   const b=node('button','tv-v264-character-button'+(c.id===tableUI.selected?' is-current':''),c.name);
   b.type='button';b.dataset.v264Actor=c.id;
   b.setAttribute('aria-pressed',String(c.id===tableUI.selected));
   group.append(b);
  }
  panel.append(group);
 }else if(actors.length){
  panel.append(node('div','tv-v264-single-name',actors[0].name));
 }
 const chosen=actors.find(c=>c.id===tableUI.selected);
 if(chosen)panel.append(roomCard(chosen));
 else panel.append(node('p','tv-v251-muted','No approved adventurer is assigned to you in this campaign.'));
 const history=node('details','tv-v251-roll-history tv-v264-roll-history');
 const summary=node('summary','','Recent item rolls');
 history.append(summary);
 const lines=node('div','tv-v251-roll-lines');lines.id='tv-v251-roll-lines';
 history.append(lines);panel.append(history);
 host.append(panel);renderLog();
 return panel;
}
function sessionRoom(){
 if(location.hash.replace(/^#/,'').split('?')[0]!=='/party')return;
 const dicePanel=document.querySelector('#pageRoot .sr-dice-panel');
 const diceArea=dicePanel?.querySelector('.sr-dice-area');
 if(!dicePanel||!diceArea)return;
 if(tableUI.campaign!==db.campaign){
  tableUI.campaign=db.campaign;tableUI.mode='dice';
  tableUI.selected=null;tableUI.manual=false;
 }
 const actors=roomActors();
 const signature=JSON.stringify(actors.map(c=>[
   c.id,c.name,actionItems(c).map(i=>[i.id,i.name,i.slot,itemProps(c,i)]),
   c.owner,db.role
 ]));
 let tabs=dicePanel.querySelector('.tv-v264-room-tabs');
 if(!tabs){
  tabs=node('div','tv-v264-room-tabs');
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Dice and character actions');
  const choices=[['dice','Dice'],['checks','Quick Checks'],['actions','Character Actions']];
  for(const [mode,label] of choices){
   const button=node('button','tv-v264-room-tab',label);
   button.type='button';button.dataset.v264RoomTab=mode;button.setAttribute('role','tab');
   tabs.append(button);
  }
  dicePanel.querySelector('.sr-panel-head')?.insertAdjacentElement('afterend',tabs);
 }
 const actionsPanel=renderRoomActions(actors,signature,dicePanel);
 paintRoomTabs(dicePanel,diceArea,actionsPanel,actors);
}
function mount(){
 if(typeof db==='undefined'||!ready())return;
 const m=location.hash.match(/^#\/characters\/([^/?#]+)/);
 if(m){let id='';try{id=decodeURIComponent(m[1])}catch{}const c=char(id);if(c){showResources(c);showArmour(c)}}
 sessionRoom();
}
let queued=false;
const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount()})});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
for(const name of ['hashchange','terravale-characters-synced','terravale-auth-ready'])window.addEventListener(name,()=>setTimeout(mount,65));
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-v264-room-tab]');
 if(tab){
  e.preventDefault();tableUI.mode=tab.dataset.v264RoomTab;
  sessionRoom();return;
 }
 const chosen=e.target.closest('[data-v264-actor]');
 if(chosen){
  e.preventDefault();tableUI.selected=chosen.dataset.v264Actor;tableUI.manual=true;
  const panel=document.querySelector('#pageRoot .sr-dice-panel');
  panel?.querySelector('#tv-v251-session-items')?.remove();
  sessionRoom();return;
 }
 const inspect=e.target.closest('[data-v264-inspect]');
 if(inspect){
  e.preventDefault();
  const c=char(inspect.dataset.characterId);
  const i=inv(c).find(item=>item.id===inspect.dataset.v264Inspect);
  if(!c||!i)return;
  if(window.TerravaleV263Inspector?.open){
   window.TerravaleV263Inspector.open(c.id,i.id);
  }else notify(i.name+' · '+(i.description||'See the character sheet for details.'));
  return;
 }
});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-tv-item-action]');if(!b)return;
 e.preventDefault();e.stopPropagation();
 const c=char(b.dataset.characterId),i=inv(c).find(x=>x.id===b.dataset.itemId);
 if(!c||!i)return;
 if(['attack','damage'].includes(b.dataset.tvItemAction))rollItem(c,i,b.dataset.tvItemAction);
 else if(['use','attune','unattune','dawn'].includes(b.dataset.tvItemAction))useItem(c,i,b.dataset.tvItemAction);
});
// Low-amplitude parallax in the encounter artwork only: controls never move.
let tv264PointerEvent=null,tv264Frame=0;
const tv264MotionAllowed=()=>document.documentElement.dataset.tv265Motion!=='off'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('pointermove',e=>{
 if(!tv264MotionAllowed()||e.pointerType==='touch')return;
 const target=e.target instanceof Element?e.target.closest('#pageRoot .sr-encounter'):null;
 if(!target)return;
 tv264PointerEvent={x:e.clientX,y:e.clientY,target};
 if(tv264Frame)return;
 tv264Frame=requestAnimationFrame(()=>{
  tv264Frame=0;
  const event=tv264PointerEvent;if(!event||!event.target.isConnected)return;
  const rect=event.target.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const x=Math.max(-18,Math.min(18,(event.x-rect.left-rect.width/2)/rect.width*26));
  const y=Math.max(-12,Math.min(12,(event.y-rect.top-rect.height/2)/rect.height*17));
  event.target.style.setProperty('--tv264-mx',x.toFixed(1)+'px');
  event.target.style.setProperty('--tv264-my',y.toFixed(1)+'px');
  event.target.style.setProperty('--tv264-mx-soft',(x/4).toFixed(1)+'px');
  event.target.style.setProperty('--tv264-my-soft',(y/4).toFixed(1)+'px');
 });
},{passive:true});
document.addEventListener('pointerout',e=>{
 const target=e.target instanceof Element?e.target.closest('#pageRoot .sr-encounter'):null;
 if(target&&!(e.relatedTarget instanceof Element&&target.contains(e.relatedTarget))){
  for(const property of ['--tv264-mx','--tv264-my','--tv264-mx-soft','--tv264-my-soft'])
   target.style.removeProperty(property);
 }
},{passive:true});
const restLocks=new Set();
// Native V2.38 handles rest confirmation on DOCUMENT capture and calls
// stopImmediatePropagation(). Listen on WINDOW capture first or the item
// recharge handler never fires. Native HP/class rest is still processed once.
window.addEventListener('click',e=>{
 const b=e.target.closest('[data-v238-confirm-rest]');if(!b||!['short','long'].includes(b.dataset.v238ConfirmRest))return;
 const c=char(b.dataset.id),kind=b.dataset.v238ConfirmRest;
 if(!actor(c)||!c||Number(c.hp)<=0||c.sheetV220?.death?.dead)return;
 if(!inv(c).some(i=>{const p=itemProps(c,i);return charged(p)&&(p.recovery==='short'||(kind==='long'&&p.recovery==='long'))}))return;
 const key=c.id+'|'+kind;if(restLocks.has(key))return;restLocks.add(key);
 // Wait until after the native document capture rest handler returns;
 // this never fires another native rest. If the server fails, report it.
 Promise.resolve().then(async()=>{
  try{
   const {data,error}=await api().rpc('terravale_item_rest',{target_character:c.id,rest_kind:kind});
   if(error||!data?.item_properties)throw error||new Error('Item recharge was not confirmed.');
   c.dmItemProperties=data.item_properties;if(typeof persist==='function')persist();
   if(data.recharged?.length)notify(c.name+': '+data.recharged.length+' item charge pool(s) refreshed after '+kind+' rest.');
   if(typeof renderPage==='function')renderPage(false);
  }catch(err){notify('Rest completed, but item charges could not sync: '+(err.message||String(err)))}finally{restLocks.delete(key)}
 });
},true);
mount();
})();