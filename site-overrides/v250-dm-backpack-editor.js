/* V2.50 — DM item workshop integrated into the genuine Equipment / Backpack tab.
   Player inventory movement stays native. Mechanics are server-authoritative and
   follow an item by its stable item ID when moved between slots or backpack. */
(function(){
 'use strict';
 const auth=()=>window.TerravaleVerifiedAccount;
 const api=()=>auth()?.supabase;
 const bridge=()=>window.TerravaleV2Bridge;
 const idFromRoute=()=>{
   const m=location.hash.match(/^#\/characters\/([^/?#]+)/);
   if(!m)return '';
   try{return decodeURIComponent(m[1])}catch{return ''}
 };
 const character=()=>typeof db!=='undefined'?db.characters.find(x=>x.id===idFromRoute()):null;
 const canManage=c=>Boolean(c&&auth()?.state?.ready&&auth()?.state?.profile?.is_dm
   &&bridge()?.hasCampaign?.(c.campaign)
   &&db.campaigns.some(k=>k.id===c.campaign&&k.role==='dm'));
 const inventory=c=>Array.isArray(c.inventory)?c.inventory:[];
 const attributes=c=>c.dmItemProperties&&typeof c.dmItemProperties==='object'?c.dmItemProperties:{};
 const $=(selector,scope=document)=>scope.querySelector(selector);
 const node=(tag,klass,text)=>{
   const element=document.createElement(tag);
   if(klass)element.className=klass;
   if(text!==undefined)element.textContent=String(text);
   return element;
 };
 const signed=v=>v>0?'+'+v:String(v);
 const value=(obj,key)=>obj?.[key]??'';
 function badges(properties){
   const entries=[];
   if(Number(properties.ac_bonus))entries.push(signed(Number(properties.ac_bonus))+' AC');
   if(Number(properties.attack_bonus))entries.push(signed(Number(properties.attack_bonus))+' to hit');
   if(properties.damage_dice)entries.push(properties.damage_dice+(properties.damage_type?' '+properties.damage_type:''));
   if(Number(properties.max_charges)>0)entries.push((properties.charges??0)+' / '+properties.max_charges+' charges');
   if(properties.recovery==='short'||properties.recovery==='long')entries.push(properties.recovery+' rest recharge');
   if(properties.recovery==='dawn')entries.push('recharges at dawn');
   if(properties.attunement===true)entries.push('Attunement');
   if(properties.rarity)entries.push(properties.rarity);
   return entries;
 }
 function propertyList(ch){
   const list=inventory(ch),meta=attributes(ch);
   const wrapper=node('section','tv-item-property-summary');
   const withRules=list.filter(item=>meta[item.id]&&Object.keys(meta[item.id]).length);
   if(!withRules.length)return null;
   wrapper.append(node('div','v2-overline','DM-APPROVED ITEM PROPERTIES'));
   wrapper.append(node('h4','','Items with recorded mechanics'));
   for(const item of withRules){
     const p=meta[item.id],card=node('div','tv-item-property-card');
     const head=node('div','tv-item-property-head');
     head.append(node('strong','',item.name||'Unnamed item'),
                 node('small','',item.slot?'Equipped':'Backpack'));
     card.append(head);
     const chips=node('div','tv-item-property-chips');
     for(const label of badges(p))chips.append(node('span','',label));
     if(chips.children.length)card.append(chips);
     if(p.features||p.recharge){
       const details=node('details','tv-item-feature-reveal');
       const summary=node('summary','','Special effects and recharge');
       const description=node('div','tv-item-property-text');
       description.textContent=[p.features||'',p.recharge?'Recharge: '+p.recharge:''].filter(Boolean).join('\n\n');
       details.append(summary,description);card.append(details);
     }
     wrapper.append(card);
   }
   const small=node('p','tv-item-properties-note','These are DM-recorded properties. Effects are reference text until a specific character rule applies them; equipping an item does not silently change base AC.');
   wrapper.append(small);
   return wrapper;
 }
 function formField(label,name,value,options={}){
   const wrap=node('label','tv-item-form-field');
   wrap.append(node('span','',label));
   let input;
   if(options.rows){
     input=node('textarea');input.rows=options.rows;
   }else if(options.choices){
     input=node('select');
     for(const [v,t] of options.choices){
       const o=node('option','',t);o.value=v;input.append(o);
     }
   }else{
     input=node('input');input.type=options.type||'text';
     if(options.min!==undefined)input.min=options.min;
     if(options.max!==undefined)input.max=options.max;
     if(options.step!==undefined)input.step=options.step;
   }
   input.name=name;
   if(options.type==='checkbox')input.checked=Boolean(value);
   else input.value=value==null?'':String(value);
   if(options.placeholder)input.placeholder=options.placeholder;
   if(options.maxLength)input.maxLength=options.maxLength;
   wrap.append(input);
   return {wrap,input};
 }
 function editor(itemId){
   const ch=character();
   const host=$('#tv-dm-item-workshop');
   if(!ch||!host||!canManage(ch))return;
   const item=inventory(ch).find(x=>x.id===itemId)||null;
   if(itemId&&!item){return}
   const original=attributes(ch)[item?.id]||{};
   const old=host.querySelector('.tv-item-editor');if(old)old.remove();
   const form=node('form','tv-item-editor');
   const title=node('h4','',item?'Edit '+item.name:'Add a DM-issued item');
   const desc=node('p','tv-item-editor-hint','Edit the real inventory entry and its server-protected mechanical properties. Equipped items keep their slot; use the regular Move control to equip or unequip.');
   form.append(title,desc);
   const group=node('div','tv-item-editor-grid');
   const fields={};
   const add=(label,key,val,opts)=>{const f=formField(label,key,val,opts);group.append(f.wrap);fields[key]=f.input;};
   add('Item name','name',item?.name||'',{maxLength:120,placeholder:'Frostbound Blade'});
   add('Item type','kind',item?.kind||'item',{choices:[
     ['item','General item'],['equipment','Equipment'],['weapon','Weapon'],
     ['armour','Armour'],['shield','Shield'],['focus','Focus'],['consumable','Consumable'],['wondrous','Wondrous item']
   ]});
   add('Quantity','qty',item?.qty??item?.quantity??1,{type:'number',min:1,max:999});
   add('Item description','description',item?.description||'',{rows:3,maxLength:2400,placeholder:'Appearance, origin, lore and what it looks like…'});
   add('Two-handed','twoHanded',Boolean(item?.twoHanded),{type:'checkbox'});
   form.append(group);
   form.append(node('h5','tv-item-subhead','Combat and defence'));
   const combat=node('div','tv-item-editor-grid');form.append(combat);
   const combatAdd=(label,key,val,opts)=>{
     const f=formField(label,key,val,opts);combat.append(f.wrap);fields[key]=f.input;
   };
   combatAdd('AC bonus','ac_bonus',value(original,'ac_bonus'),{type:'number',min:-20,max:20,placeholder:'e.g. 2'});
   combatAdd('Attack bonus','attack_bonus',value(original,'attack_bonus'),{type:'number',min:-20,max:20,placeholder:'e.g. 1'});
   combatAdd('Weapon damage','damage_dice',value(original,'damage_dice'),{maxLength:80,placeholder:'1d8 + 2'});
   combatAdd('Damage type','damage_type',value(original,'damage_type'),{maxLength:80,placeholder:'Cold / slashing / fire'});
   combatAdd('Attack ability','attack_ability',value(original,'attack_ability')||'none',{
     choices:[['none','No ability modifier'],['str','Strength'],['dex','Dexterity'],['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']]
   });
   combatAdd('Damage ability','damage_ability',value(original,'damage_ability')||'none',{
     choices:[['none','Use damage as written'],['str','Strength'],['dex','Dexterity'],['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']]
   });
   combatAdd('Character is proficient with this item','proficient',Boolean(original.proficient),{type:'checkbox'});
   combatAdd('Show weapon action in Session Room','weapon_action',original.weapon_action!==undefined?Boolean(original.weapon_action):Boolean(original.damage_dice),{type:'checkbox'});
   const combatHint=node('p','tv-item-editor-hint','Attack rolls use d20 + selected ability + proficiency (only if ticked) + attack bonus. Damage adds the selected modifier only when you choose one; the dice formula stays intact. AC bonuses count only while equipped and attuned where required.');
   combat.append(combatHint);
   form.append(node('h5','tv-item-subhead','Charges and additional features'));
   const extras=node('div','tv-item-editor-grid');form.append(extras);
   const extra=(label,key,val,opts)=>{const f=formField(label,key,val,opts);extras.append(f.wrap);fields[key]=f.input;};
   extra('Current charges','charges',value(original,'charges'),{type:'number',min:0,max:999,placeholder:'0'});
   extra('Maximum charges','max_charges',value(original,'max_charges'),{type:'number',min:0,max:999,placeholder:'5'});
   extra('Activation cost (charges)','charge_cost',value(original,'charge_cost')??1,{type:'number',min:1,max:999,placeholder:'1'});
   extra('Recharge trigger','recovery',value(original,'recovery')||'manual',{
     choices:[['manual','Manual — DM decides'],['short','Short or long rest'],['long','Long rest only'],['dawn','At dawn — DM confirms']]
   });
   extra('Recharge amount (0 = full)','recharge_amount',value(original,'recharge_amount')??0,
     {type:'number',min:0,max:999,placeholder:'0 for full'});
   extra('Recharge dice (overrides amount)','recharge_dice',value(original,'recharge_dice'),{maxLength:60,placeholder:'1d4'});
   extra('Recharge rule — description','recharge',value(original,'recharge'),{maxLength:180,placeholder:'Regains 1d4 charges at dawn'});
   extra('Track item charges in Resources','resource_tracker',original.resource_tracker!==false&&Number(original.max_charges||0)>0,{type:'checkbox'});
   extra('Rarity','rarity',value(original,'rarity'),{maxLength:80,placeholder:'Rare'});
   extra('Requires attunement','attunement',Boolean(original.attunement),{type:'checkbox'});
   const feature=formField('Special abilities, conditions and limitations','features',
     value(original,'features'),{rows:5,maxLength:5000,placeholder:'Describe what it does, activation cost, restrictions, and any DM rulings.'});
   form.append(feature.wrap);fields.features=feature.input;
   const actions=node('div','tv-item-editor-actions');
   const cancel=node('button','btn ghost small','Cancel');cancel.type='button';
   cancel.addEventListener('click',()=>form.remove());
   const save=node('button','btn primary small','Save item online');save.type='submit';
   actions.append(cancel,save);
   if(item){
     const remove=node('button','btn ghost small tv-item-remove','Delete item');
     remove.type='button';remove.addEventListener('click',()=>deleteItem(ch,item));
     actions.prepend(remove);
   }
   const status=node('p','tv-item-editor-status');status.setAttribute('role','status');
   form.append(actions,status);
   form.addEventListener('submit',async e=>{
     e.preventDefault();if(!canManage(ch))return;
     const quantity=Number(fields.qty.value);
     const ac=fields.ac_bonus.value.trim();
     const atk=fields.attack_bonus.value.trim();
     const charges=fields.charges.value.trim();
     const maxCharges=fields.max_charges.value.trim();
     if(!fields.name.value.trim()||!Number.isInteger(quantity)||quantity<1||quantity>999){
       status.textContent='A name and valid quantity are required.';return;
     }
     if(charges!==''&&(!maxCharges||Number(charges)>Number(maxCharges))){
       status.textContent='Current charges cannot exceed the maximum.';return;
     }
     const payload={
       name:fields.name.value.trim(),kind:fields.kind.value,qty:quantity,
       description:fields.description.value.trim(),twoHanded:fields.twoHanded.checked
     };
     const props={};
     for(const [key,val] of Object.entries({
       ac_bonus:ac,attack_bonus:atk,damage_dice:fields.damage_dice.value.trim(),
       damage_type:fields.damage_type.value.trim(),charges,max_charges:maxCharges,
       recharge:fields.recharge.value.trim(),rarity:fields.rarity.value.trim(),
       features:fields.features.value.trim(),
       attack_ability:fields.attack_ability.value==='none'?'':fields.attack_ability.value,
       damage_ability:fields.damage_ability.value==='none'?'':fields.damage_ability.value,
       recovery:fields.recovery.value==='manual'?'':fields.recovery.value,
       recharge_amount:fields.recharge_amount.value.trim(),
       recharge_dice:fields.recharge_dice.value.trim(),
       charge_cost:fields.charge_cost.value.trim()
     }))if(val!=='')props[key]=['ac_bonus','attack_bonus','charges','max_charges','recharge_amount','charge_cost'].includes(key)?Number(val):val;
     if(fields.attunement.checked)props.attunement=true;
     if(fields.proficient.checked)props.proficient=true;
     if(fields.weapon_action.checked)props.weapon_action=true;
     if(fields.resource_tracker.checked&&Number(maxCharges)>0)props.resource_tracker=true;
     if(!maxCharges||Number(maxCharges)===0){
       for(const key of ['charge_cost','recovery','recharge_amount','recharge_dice','resource_tracker'])delete props[key];
     }
     if(props.recharge_dice&&!/^([1-9]|1\d|20)d(4|6|8|10|12|20)(\s*[+-]\s*\d{1,2})?$/i.test(props.recharge_dice)){
       status.textContent='Recharge dice must be like 1d4, 2d6 + 1, etc.';return;
     }
     if(props.damage_dice&&!/^([1-9]|1\d|20)d(4|6|8|10|12|20|100)(\s*[+-]\s*\d{1,2})?$/i.test(props.damage_dice)){
       status.textContent='Weapon damage must be a dice expression such as 1d8 + 2.';return;
     }
     await saveItem(ch,item?.id||'',payload,props,status,save);
   });
   host.append(form);form.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   fields.name.focus({preventScroll:true});
 }
 async function saveItem(ch,itemId,payload,mechanics,status,save){
   save.disabled=true;save.textContent='Saving…';
   try{
     const {data,error}=await api().rpc('terravale_dm_edit_inventory_item',{
       target_character:ch.id,item_id:itemId,item_payload:payload,mechanics,delete_item:false
     });
     if(error||!data?.inventory)throw error||new Error('The server did not return updated inventory.');
     ch.inventory=data.inventory;ch.dmItemProperties=data.item_properties||{};
     persist();renderPage(false);
     if(typeof toast==='function')toast('DM item changes saved online.');
   }catch(error){
     status.textContent='Save failed: '+(error?.message||String(error));
     save.disabled=false;save.textContent='Save item online';
   }
 }
 async function deleteItem(ch,item){
   if(!window.confirm('Delete '+item.name+' from this character’s actual inventory?'))return;
   const form=$('#tv-dm-item-workshop .tv-item-editor');
   const status=form?.querySelector('.tv-item-editor-status');
   if(status)status.textContent='Removing item…';
   const {data,error}=await api().rpc('terravale_dm_edit_inventory_item',{
     target_character:ch.id,item_id:item.id,item_payload:{},mechanics:{},delete_item:true
   });
   if(error||!data?.inventory){
     if(status)status.textContent='Could not delete: '+(error?.message||'Unknown error');
     return;
   }
   ch.inventory=data.inventory;ch.dmItemProperties=data.item_properties||{};
   persist();renderPage(false);
   if(typeof toast==='function')toast('Item removed from the live character inventory.');
 }
 function mount(){
   const ch=character();
   if(!ch)return;
   const selected=$('.sheet20-tabs [data-value="equipment"][aria-selected="true"]');
   if(!selected)return;
   const backpack=$('.sheet20-content .sheet21-backpack-zone');
   if(!backpack)return;
   const parent=backpack.parentElement;
   const fingerprint=JSON.stringify([ch.id,inventory(ch),attributes(ch)]);
   let marker=parent.querySelector('#tv-dm-item-zone');
   if(marker?.dataset.fingerprint===fingerprint)return;
   if(marker)marker.remove();
   marker=node('div','tv-dm-item-zone');marker.id='tv-dm-item-zone';
   marker.dataset.fingerprint=fingerprint;
   const stats=propertyList(ch);
   if(stats)marker.append(stats);
   if(canManage(ch)){
     const workshop=node('details','tv-dm-item-workshop');
     workshop.id='tv-dm-item-workshop';
     const summary=node('summary','','DM item workshop · edit actual equipment, bonuses and charges');
     workshop.append(summary);
     const intro=node('p','tv-item-editor-hint','Item properties follow each item by ID when moved between equipment slots and backpack. Only the verified campaign DM can change these mechanics.');
     workshop.append(intro);
     const add=node('button','btn primary small','+ Add DM item');
     add.type='button';
     add.addEventListener('click',()=>{workshop.open=true;editor('')});
     workshop.append(add);
     const list=node('div','tv-dm-item-list');
     for(const item of inventory(ch)){
       const row=node('div','tv-dm-item-row');
       const label=node('span','',item.name||'Unnamed item');
       const subtitle=node('small','',item.slot?'Equipped: '+item.slot:'In backpack');
       const copy=node('div','tv-dm-item-row-name');copy.append(label,subtitle);
       const btn=node('button','btn ghost small','Edit item & properties');
       btn.type='button';btn.addEventListener('click',()=>{workshop.open=true;editor(item.id)});
       row.append(copy,btn);list.append(row);
     }
     if(inventory(ch).length)workshop.append(list);
     marker.append(workshop);
   }
   backpack.insertAdjacentElement('afterend',marker);
 }
 let pending=false;
 const observer=new MutationObserver(()=>{
   if(pending)return;
   pending=true;requestAnimationFrame(()=>{pending=false;mount()});
 });
 observer.observe(document.getElementById('pageRoot')||document.body,{subtree:true,childList:true});
 window.addEventListener('hashchange',()=>setTimeout(mount,80));
 window.addEventListener('terravale-characters-synced',mount);
 window.addEventListener('terravale-auth-ready',mount);
 mount();
})();
