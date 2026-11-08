/* Terravale V2.63 — compact backpack, native item inspection, no duplicate mechanics list.
   Inventory stays native: do not intercept drag/drop, Move, Unequip, Edit or DM item RPCs. */
(function(){
'use strict';
const page=()=>document.querySelector('#pageRoot .sheet20-content');
const current=()=>{
  const match=location.hash.match(/^#\/characters\/([^/?#]+)/);
  if(!match||typeof db==='undefined')return null;
  let id=match[1];try{id=decodeURIComponent(id)}catch{}
  return (db.characters||[]).find(c=>String(c.id)===id)||null;
};
const node=(tag,cls,content)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(content!==undefined)e.textContent=String(content);
  return e;
};
const openFor=new Map();
const inventory=c=>Array.isArray(c?.inventory)?c.inventory:[];
const props=(c,item)=>c?.dmItemProperties?.[item.id]||{};
const equipped=i=>Boolean(i.slot)&&String(i.location||'equipped')!=='backpack';
const signed=n=>Number(n)>0?'+'+n:String(n);
const capital=s=>String(s||'').replace(/(^|\s)\S/g,m=>m.toUpperCase());
const itemsForZone=c=>inventory(c).filter(i=>!equipped(i)).length;
const allowedSlots=new Set(['main','off','head','chest','gloves','legs','feet','cloak','neck','ring1','ring2','accessory','accessory2','focus']);
function matchItem(c,card){
  const label=card.querySelector('.sheet21-gear-identity strong,.sheet22-equipped strong, :scope > strong');
  const text=(label?.textContent||'').trim();
  if(!text)return null;
  const list=inventory(c).filter(i=>{
    const place=Boolean(card.closest('.sheet21-backpack-zone'));
    return place?!equipped(i):equipped(i);
  });
  return list.find(i=>text===i.name)
    ||list.sort((a,b)=>b.name.length-a.name.length).find(i=>text.startsWith(i.name));
}
function markers(c){
 const root=page();if(!root)return;
 const cards=root.querySelectorAll('.sheet21-gear-item,.sheet21-gear-slot.has-item,.sheet22-equipped');
 for(const card of cards){
  if(card.dataset.tv263ItemId&&(card.querySelector('.tv263-inspect-item')||card.closest('.sheet22-slot')?.querySelector('.tv263-inspect-item')))continue;
  const item=matchItem(c,card);
  if(!item)continue;
  card.dataset.tv263ItemId=item.id;
  card.classList.add('tv263-item-inspectable');
  const target=card.querySelector('.sheet21-gear-identity,.sheet22-equipped strong,:scope > strong');
  if(target&&!target.closest('button')){
   target.setAttribute('title','Click to inspect '+item.name);
   target.classList.add('tv263-clickable-item-name');
   target.tabIndex=0;target.setAttribute('role','button');
   target.setAttribute('aria-label','Inspect '+item.name);
  }
  const inspect=node('button','tv263-inspect-item','Inspect');
  inspect.type='button';inspect.dataset.tv263ItemId=item.id;
  inspect.setAttribute('aria-label','Inspect '+item.name);
  const actions=card.querySelector('.sheet21-item-actions,.sheet22-slot-actions')
     ||card.closest('.sheet22-slot')?.querySelector('.sheet22-slot-actions')
     ||card.querySelector('.sheet21-gear-slot-title')
     ||card;
  actions.append(inspect);
 }
}
function setBackpack(c,open){
 const root=page(),zone=root?.querySelector('.sheet21-backpack-zone');
 const panel=zone?.closest('.sheet20-panel'),heading=panel?.querySelector('.sheet21-backpack-heading');
 if(!zone||!panel||!heading)return;
 openFor.set(c.id,Boolean(open));
 panel.id='tv263-backpack-panel';
 panel.classList.toggle('tv263-backpack-collapsed',!open);
 const toggle=heading.querySelector('.tv263-backpack-toggle');
 if(toggle){
  toggle.textContent=(open?'▾ Hide backpack':'▸ Show backpack')+' · '+itemsForZone(c)+' item'+(itemsForZone(c)===1?'':'s');
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-controls','tv263-backpack-contents');
 }
 zone.id='tv263-backpack-contents';
 zone.hidden=!open;
 // Native add/move/drop controls remain unchanged and accessible on expand.
 const buttons=heading.querySelector('.sheet21-backpack-buttons');
 if(buttons)buttons.hidden=!open;
 const older=panel.querySelector('.sheet21-equipped-list');
 if(older)older.hidden=!open;
}
function mountBackpack(c){
 const root=page(),heading=root?.querySelector('.sheet21-backpack-heading');
 if(!heading)return;
 if(!heading.querySelector('.tv263-backpack-toggle')){
  const toggle=node('button','tv263-backpack-toggle');
  toggle.type='button';
  heading.querySelector('h3')?.insertAdjacentElement('afterend',toggle);
  toggle.addEventListener('click',()=>{
   const value=!(openFor.get(c.id)===true);
   setBackpack(c,value);
  });
 }
 setBackpack(c,openFor.get(c.id)===true);
}
function row(parent,label,value){
 if(value===undefined||value===null||String(value)==='')return;
 const el=node('div','tv263-item-stat');
 el.append(node('span','',label),node('strong','',value));
 parent.append(el);
}
function inspect(c,item){
 document.querySelector('#tv263-item-inspector')?.remove();
 const p=props(c,item);
 const dialog=node('dialog','tv263-item-inspector tv256-rarity-item');
 dialog.id='tv263-item-inspector';
 dialog.dataset.rarity=p.rarity||'Common';
 const shell=node('div','tv263-inspector-shell');
 const head=node('div','tv263-inspector-head');
 const label=node('div','');
 label.append(node('div','v2-overline',capital(item.kind||'Item')+' · '+(equipped(item)?'Equipped':'Backpack')));
 label.append(node('h3','',item.name||'Unnamed item'));
 const close=node('button','tv263-inspector-close','×');
 close.type='button';close.setAttribute('aria-label','Close item preview');
 close.addEventListener('click',()=>dialog.close());
 head.append(label,close);shell.append(head);
 const rarity=node('span','tv263-item-rarity',p.rarity||'Common');
 shell.append(rarity);
 if(item.description) shell.append(node('p','tv263-inspector-description',item.description));
 const basics=node('div','tv263-item-stats');
 row(basics,'Quantity',Math.max(1,Number(item.qty??item.quantity)||1));
 row(basics,'Location',equipped(item)?capital(allowedSlots.has(item.slot)?item.slot:'Equipped'):'Backpack');
 if(item.twoHanded)row(basics,'Grip','Two-handed');
 if(p.ac_bonus!==undefined)row(basics,'Armour Class',signed(Number(p.ac_bonus)||0)+' AC');
 if(p.attack_bonus!==undefined)row(basics,'Attack modifier',signed(Number(p.attack_bonus)||0));
 if(p.damage_dice)row(basics,'Damage',(p.damage_dice||'')+(p.damage_type?' '+capital(p.damage_type):''));
 else if(p.damage_type)row(basics,'Damage type',capital(p.damage_type));
 if(p.attack_ability&&p.attack_ability!=='none')row(basics,'Attack ability',p.attack_ability.toUpperCase());
 if(p.damage_ability&&p.damage_ability!=='none')row(basics,'Damage ability',p.damage_ability.toUpperCase());
 if(typeof p.proficient==='boolean')row(basics,'Proficiency',p.proficient?'Proficient':'Not proficient');
 if(p.max_charges!==undefined&&Number(p.max_charges)>0)
  row(basics,'Charges',String(p.charges??0)+' / '+String(p.max_charges));
 if(p.recovery&&p.recovery!=='none')row(basics,'Recovers',p.recovery==='short'?'Short rest':p.recovery==='long'?'Long rest':p.recovery==='dawn'?'At dawn':capital(p.recovery));
 if(p.recharge_dice)row(basics,'Recharges',p.recharge_dice);
 else if(Number(p.recharge_amount)>0)row(basics,'Recharges',String(p.recharge_amount)+' charges');
 if(Number(p.charge_cost)>0)row(basics,'Cost',String(p.charge_cost)+' charge'+(Number(p.charge_cost)>1?'s':''));
 if(p.attunement)row(basics,'Attunement',p.attuned?'Attuned':'Required');
 if(basics.children.length)shell.append(basics);
 if(p.features||p.recharge){
  const detail=node('section','tv263-inspector-rules');
  detail.append(node('div','v2-overline','RECORDED MECHANICS'));
  if(p.features)detail.append(node('p','',p.features));
  if(p.recharge)detail.append(node('p','', 'Recharge: '+p.recharge));
  shell.append(detail);
 }
 shell.append(node('p','tv263-inspector-note',
  'Read-only preview · displayed mechanics come from this character’s recorded item. Changes to AC or other statistics are controlled by the DM and the sheet rules.'));
 dialog.append(shell);document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
// Shared read-only inspector for Session Room item names. Do not expose
// inventory edit APIs: all actions still go through the existing server RPCs.
window.TerravaleV263Inspector={
 open(characterId,itemId){
  const c=(typeof db==='undefined'?[]:(db.characters||[]))
   .find(x=>String(x.id)===String(characterId));
  const i=c?.inventory?.find(x=>String(x.id)===String(itemId));
  if(!c||!i)return false;
  const sameCampaign=c.campaign===db.campaign;
  const visible=String(c.status).toLowerCase()==='approved'&&
   c.sheetVisibleToParty===true&&
   window.TerravaleV2Bridge?.hasCampaign?.(c.campaign);
  const owner=c.owner==='You';
  const moderator=db.role==='dm'&&
   window.TerravaleVerifiedAccount?.state?.profile?.is_dm&&
   db.campaigns?.some(k=>k.id===c.campaign&&k.role==='dm');
  if(!sameCampaign||!(owner||visible||moderator))return false;
  inspect(c,i);return true;
 }
};
function findItem(id){
 const c=current();return c&&inventory(c).find(i=>String(i.id)===String(id))||null;
}
document.addEventListener('click',event=>{
 const target=event.target;if(!(target instanceof Element))return;
 const openButton=target.closest('[data-tv263-item-id].tv263-inspect-item');
 if(openButton){event.preventDefault();event.stopPropagation();const c=current(),item=findItem(openButton.dataset.tv263ItemId);if(c&&item)inspect(c,item);return}
 if(target.closest('button,a,input,textarea,select,summary,[data-action],[data-tv-item-action]'))return;
 const card=target.closest('.sheet21-gear-item,.sheet21-gear-slot.has-item,.sheet22-equipped');
 if(!card||!card.closest('#pageRoot .sheet20-content'))return;
 const c=current(),item=c&&findItem(card.dataset.tv263ItemId);
 if(c&&item)inspect(c,item);
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 const target=event.target;if(!(target instanceof Element)||!target.matches('.tv263-clickable-item-name[tabindex="0"]'))return;
 const c=current(),card=target.closest('[data-tv263-item-id]'),item=card&&findItem(card.dataset.tv263ItemId);
 if(c&&item){event.preventDefault();inspect(c,item)}
});
function mount(){
 const c=current();
 if(!c||!page()?.querySelector('.sheet21-backpack-zone'))return;
 mountBackpack(c);
 markers(c);
}
let pending=false;
new MutationObserver(()=>{
 if(pending)return;
 pending=true;
 requestAnimationFrame(()=>{pending=false;mount()});
}).observe(document.querySelector('#pageRoot')||document.body,{childList:true,subtree:true});
for(const name of ['hashchange','terravale-characters-synced','terravale-auth-ready'])
 window.addEventListener(name,()=>setTimeout(mount,60));
window.addEventListener('hashchange',()=>document.querySelector('#tv263-item-inspector')?.close());
mount();
})();