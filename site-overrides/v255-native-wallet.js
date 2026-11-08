/* Terravale V2.55: physical denomination wallets, now fully editable by owners.
   All +/- actions use atomic, audited server RPCs. Currency tabs are display-only. */
(function(){
'use strict';
const api=()=>window.TerravaleVerifiedAccount?.supabase;
const rules=()=>window.TerravaleRulesV4||{currencies:[]};
const el=(tag,cls,text)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(text!==undefined)x.textContent=String(text);return x;
};
const button=(label,fn,cls='btn ghost small')=>{
 const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;
};
const preferences=new Map();
const busy=new Set();
const cashCache=new Map();
const denomLookup=()=>new Map(rules().currencies.flatMap(c=>c.denominations.map(d=>
 [d.id,{...d,system:c.name,system_id:c.id}])));
const ready=()=>!!window.TerravaleVerifiedAccount?.state?.ready;
// Authorised editing and public-facing viewing are separate permissions.
// In Player preview, even the site DM sees another character's purse read-only.
const validRole=c=>c?.owner==='You'||!!(
 db.role==='dm'&&window.TerravaleVerifiedAccount?.state?.profile?.is_dm&&
 db.campaigns?.some(k=>k.id===c?.campaign&&k.role==='dm'));
const canRead=c=>validRole(c)||!!(
  ready()&&c&&String(c.status).toLowerCase()==='approved'&&
  c.sheetVisibleToParty===true&&
  window.TerravaleV2Bridge?.hasCampaign?.(c.campaign)
);
const title=c=>c?.name||'Adventurer';
const stateFor=c=>{
 const k=c.id;
 if(!preferences.has(k))preferences.set(k,{system:'guild-seals',display:'guild-seals',denom:null,count:1,note:'',view:'wallet'});
 return preferences.get(k);
};
function allHoldings(result){return result?.holdings||[]}
function sumGC(result){
 const lookup=denomLookup();
 return allHoldings(result).reduce((sum,row)=>
  sum+Number(row.quantity||0)*(lookup.get(row.denomination_id)?.valueGC||0),0);
}
// Display equivalent amounts in one unit when a currency uses numbered
// denominations of that same unit. Actual denomination holdings remain separate.
const unitSummaries={
 'human-civics':{value:2,singular:'Civic',plural:'Civics'},
 'kharithen-witness-tallies':{value:4,singular:'Tally',plural:'Tallies'},
 'thalassari-tiderings':{value:2,singular:'Tidering',plural:'Tiderings'},
 'fl-gel-currents':{value:2,singular:'Current',plural:'Currents'},
 'null-city-meridian-notes':{value:2,singular:'Meridian Note',plural:'Meridian Notes'},
 'crimsonborn-ledger-notes':{value:10,singular:'Ledger Note',plural:'Ledger Notes'},
 'daemon-concord-marks':{value:5,singular:'Concord Mark',plural:'Concord Marks'},
 'oni-burden-marks':{value:5,singular:'Burden Mark',plural:'Burden Marks'}
};
function displayedParts(system,amount){
 if(!system?.denominations?.length)return [amount.toLocaleString()+' Guild Copper'];
 const simple=unitSummaries[system.id];
 // Verify all denominations are multiples of the published monetary unit;
 // never infer conversion values from the labels themselves.
 if(simple&&system.denominations.every(d=>Number.isInteger(d.valueGC/simple.value))){
  const quantity=Math.floor(amount/simple.value),remainder=amount%simple.value;
  const unit=quantity===1?simple.singular:simple.plural;
  const output=[quantity.toLocaleString()+' '+unit];
  if(remainder)output.push(remainder.toLocaleString()+' Guild Copper left over');
  return output;
 }
 // Half-Measure and Half-Note exist, but are still fractions of their
 // own named currency; keep them as readable remainders, not as mixed coin bags.
 const halves={
  'dvergr-measures':{whole:10,half:5,one:'Measure',many:'Measures',halfName:'Half Measure'},
  'crimsonborn-ledger-notes':{whole:10,half:5,one:'Ledger Note',many:'Ledger Notes',halfName:'Half Ledger Note'}
 };
 const split=halves[system.id];
 if(split){
  const whole=Math.floor(amount/split.whole),half=Math.floor(amount%split.whole/split.half);
  const residue=amount%split.half,parts=[];
  if(whole)parts.push(whole.toLocaleString()+' '+(whole===1?split.one:split.many));
  if(half)parts.push(half+' '+split.halfName);
  if(residue)parts.push(residue.toLocaleString()+' Guild Copper left over');
  return parts.length?parts:['0 '+split.many];
 }
 // Tri-Crown has a fractional third-unit. Show Crownrings and a remaining
 // Third Crownring instead of treating five-ring notes as separate units.
 if(system.id==='tri-crown-crownrings'){
  const crown=system.denominations.find(d=>d.name==='Crownring');
  const third=system.denominations.find(d=>d.name==='Third Crownring');
  if(crown?.valueGC===12&&third?.valueGC===4){
   const full=Math.floor(amount/12),thirds=Math.floor(amount%12/4);
   const extra=amount%4,parts=[];
   if(full)parts.push(full.toLocaleString()+' '+(full===1?'Crownring':'Crownrings'));
   if(thirds)parts.push(thirds.toLocaleString()+' '+(thirds===1?'Third Crownring':'Third Crownrings'));
   if(extra)parts.push(extra.toLocaleString()+' Guild Copper left over');
   return parts.length?parts:['0 Crownrings'];
  }
 }
 // Distinctly named coin families still use their explicit denomination mix.
 const denominations=[...system.denominations].sort((a,b)=>b.valueGC-a.valueGC);
 const parts=[];let balance=amount;
 for(const d of denominations){
  const count=Math.floor(balance/d.valueGC);
  if(count>0){parts.push(d.name+' × '+count.toLocaleString());balance-=count*d.valueGC}
 }
 if(balance)parts.push(balance.toLocaleString()+' Guild Copper left over');
 return parts.length?parts:['0 '+denominations[denominations.length-1].name];
}
function displayed(system,amount){return displayedParts(system,amount).join(' · ')}
function holdingsList(section,result){
 const data=allHoldings(result).filter(r=>Number(r.quantity)>0);
 if(!data.length){section.append(el('p','tv254-muted','Your coin purse is empty. Record money below when your character receives it.'));return}
 const lookup=denomLookup();
 const list=el('div','tv255-coin-holdings');
 for(const record of data.sort((a,b)=>{
  const x=lookup.get(a.denomination_id),y=lookup.get(b.denomination_id);
  return (x?.system||'').localeCompare(y?.system||'') ||
   (y?.valueGC||0)-(x?.valueGC||0);
 })){
  const coin=lookup.get(record.denomination_id);
  const pill=el('div','tv255-coin-held');
  pill.append(el('strong','',Number(record.quantity).toLocaleString()+' × '+(coin?.name||record.denomination_id)),
   el('small','',coin?.system||'Unknown currency'));
  list.append(pill);
 }
 section.append(list);
}
function sectionHead(text,sub){
 const head=el('div','tv255-section-heading');
 const x=el('div');
 x.append(el('h3','',text),el('p','tv254-muted',sub));head.append(x);return head;
}
function viewTreasurySimple(host,c,result){
 host.replaceChildren();host.classList.remove('tv257-dm-wallet');
 host.classList.add('tv258-treasury-root');
 if(!result){host.append(el('p','tv254-muted','Loading treasury…'));return}
 const p=stateFor(c),systems=rules().currencies,total=sumGC(result);
 if(!systems.length){host.append(el('p','tv254-muted','Currency rules unavailable.'));return}
 const head=el('div','tv258-treasury-head');
 head.append(el('span','tv254-eyebrow','CHARACTER BALANCE'),
  el('strong','',total.toLocaleString()+' Guild Copper'),
  el('small','','Physical holdings converted for reference only'));
 host.append(head);
 const controls=el('div','tv258-treasury-controls');
 const header=el('h3','','Give or take coins');
 controls.append(header);
 const selectedLine=el('div','tv258-treasury-currency-line');
 const denominations=el('div','tv258-treasury-denominations');
 const number=el('label','tv258-treasury-amount');
 number.append(el('span','','Quantity'));
 const qty=el('input','tv255-input');
 qty.type='number';qty.min='1';qty.max='1000000';qty.step='1';
 qty.value=String(p.count);qty.addEventListener('input',()=>{p.count=Number(qty.value)||1});
 number.append(qty);
 const reason=el('input','tv255-input tv258-treasury-reason');
 reason.maxLength=240;reason.placeholder='Reason (optional)';
 reason.value=p.note||'';reason.setAttribute('aria-label','Transaction reason (optional)');
 reason.addEventListener('input',()=>{p.note=reason.value});
 const actions=el('div','tv255-money-actions tv258-treasury-actions');
 const status=el('p','tv255-inline-message tv258-treasury-status',p.lastMessage||'');
 status.setAttribute('role','status');p.lastMessage='';
 function paint(){
  let selected=systems.find(x=>x.id===p.system)||systems[0];
  p.system=selected.id;
  if(!selected.denominations.some(d=>d.id===p.denom))
   p.denom=selected.denominations[0]?.id||null;
  const i=systems.findIndex(x=>x.id===selected.id);
  const step=delta=>{
   const next=systems[(i+delta+systems.length)%systems.length];
   if(!next)return;
   p.system=next.id;p.denom=next.denominations[0]?.id||null;paint();
  };
  selectedLine.replaceChildren();
  const prev=button('‹',()=>step(-1),'tv256-currency-arrow');
  const next=button('›',()=>step(1),'tv256-currency-arrow');
  prev.setAttribute('aria-label','Previous currency');
  next.setAttribute('aria-label','Next currency');
  selectedLine.append(prev,el('strong','',selected.name),next);
  denominations.replaceChildren();
  for(const d of selected.denominations){
   const owned=Number(allHoldings(result).find(x=>x.denomination_id===d.id)?.quantity)||0;
   const b=button(d.name+(owned?' ('+owned+' owned)':''),()=>{
    p.denom=d.id;paint();
   },'tv255-denom-chip'+(d.id===p.denom?' chosen':''));
   b.setAttribute('aria-pressed',String(d.id===p.denom));
   b.title=d.valueGC+' Guild Copper per '+d.name;
   denominations.append(b);
  }
 }
 async function change(sign){
  if(!ready()||busy.has(c.id))return;
  const n=Number(qty.value),id=p.denom;
  if(!Number.isInteger(n)||n<1||n>1000000){
   status.textContent='Enter a whole number from 1 to 1,000,000.';return;
  }
  if(!id){status.textContent='Choose a coin or note first.';return}
  const held=Number(allHoldings(result).find(x=>x.denomination_id===id)?.quantity)||0;
  if(sign<0&&held<n){
   status.textContent='Only '+held+' of this denomination are available.';return;
  }
  busy.add(c.id);status.textContent='Saving…';
  try{
   const {error}=await api().rpc('terravale_wallet_adjust',{
    target_character:c.id,target_denomination:id,delta_quantity:n*sign,
    purpose:p.note.trim()||'DM treasury adjustment'
   });
   if(error)throw error;
   p.lastMessage=(sign>0?'Given ':'Taken ')+n+' '+(denomLookup().get(id)?.name||'coins')+'.';
   cashCache.delete(c.id);
   const fresh=await fetchMoney(c,true);
   if(host.isConnected)viewTreasurySimple(host,c,fresh);
  }catch(error){status.textContent='Could not save: '+(error.message||String(error))}
  finally{busy.delete(c.id)}
 }
 actions.append(button('+ Give',()=>change(1),'btn primary'),
  button('− Take',()=>change(-1),'btn ghost tv255-remove'));
 const fields=el('div','tv258-treasury-fields');
 fields.append(number,reason,actions);
 controls.append(el('span','tv258-small-label','Currency'),selectedLine,
  el('span','tv258-small-label','Denomination'),denominations,
  fields,status);
 host.append(controls);
 paint();
 const details=el('details','tv258-treasury-history');
 details.append(el('summary','','Holdings & transaction history'));
 const held=el('div','tv258-treasury-physical');
 holdingsList(held,result);details.append(held);
 if(result.ledger?.length){
  const log=el('div','tv258-treasury-ledger');
  for(const txn of result.ledger.slice(0,10)){
   const d=denomLookup().get(txn.denomination_id);
   log.append(el('p','',new Date(txn.created_at).toLocaleDateString()+
    ' · '+(txn.delta>0?'+':'')+txn.delta+' '+(d?.name||'coins')+
    (txn.note?' · '+txn.note:'')));
  }details.append(log);
 }
 host.append(details);
}
function viewWallet(host,c,result,refresh,isDm){
 if(isDm){viewTreasurySimple(host,c,result);return}
 host.replaceChildren();
 if(!result){host.append(el('p','tv254-muted','Loading native holdings…'));return}
 const p=stateFor(c);
 const systems=rules().currencies;
 const total=sumGC(result);
 const info=el('div','tv255-wallet-header');
 info.append(el('div','tv254-eyebrow',isDm?'DM TREASURY · NATIVE CURRENCY':'CHARACTER WALLET · ACTUAL HOLDINGS'),
  el('h3','',isDm?'Treasury · '+title(c):'Coin Purse'));
 const displayIndex=Math.max(0,systems.findIndex(x=>x.id===p.display));
 const renderConverted=(delta)=>{
  const i=(displayIndex+delta+systems.length)%systems.length;
  p.display=systems[i]?.id||'guild-seals';
  viewWallet(host,c,result,refresh,isDm);
 };
 const shown=systems[displayIndex]||systems[0];
 const converter=el('div','tv256-conversion-carousel');
 converter.title='Display only · actual holdings total '+total.toLocaleString()+' Guild Copper';
 converter.setAttribute('aria-label','Display currency conversion');
 const prev=button('‹',()=>renderConverted(-1),'tv256-currency-arrow');
 prev.setAttribute('aria-label','Previous display currency');
 const next=button('›',()=>renderConverted(1),'tv256-currency-arrow');
 next.setAttribute('aria-label','Next display currency');
 const conversion=el('div','tv256-conversion-readout');
 if(shown){
  conversion.append(el('small','','EQUIVALENT IN '+shown.name));
  const values=el('div','tv258-conversion-values');
  for(const part of displayedParts(shown,total))values.append(el('span','',part));
  conversion.append(values);
 }
 converter.append(prev,conversion,next);
 info.append(converter);
 host.append(info);
 const breakdown=el('details','tv257-wallet-breakdown');
 breakdown.open=!!p.detailsOpen;
 breakdown.addEventListener('toggle',()=>{p.detailsOpen=breakdown.open});
 breakdown.append(el('summary','tv257-wallet-breakdown-toggle',
  isDm?'View physical holdings & transactions':validRole(c)?
   'Show actual coins and wallet controls':'View physical coins (read-only)'));
 host.classList.add(isDm?'tv257-dm-wallet':'tv257-player-wallet');
 const actual=el('section','tv255-wallet-holdings-section');
 actual.append(sectionHead('What you actually own','These are physical denominations carried on your character, not automatically converted money.'));
 holdingsList(actual,result);breakdown.append(actual);
 const manager=el(isDm?'section':'details','tv255-wallet-manager');
 if(isDm){
  manager.append(el('h4','tv257-treasury-label','Give or take money'));
 }else{
  manager.open=false;
  manager.append(el('summary','tv256-wallet-manager-toggle','Add or remove coins'));
 }
 const systemBar=el('div','tv255-wallet-system-list');
 systemBar.setAttribute('role','group');systemBar.setAttribute('aria-label','Currency system');
 const denominationBar=el('div','tv255-wallet-denominations');
 const selection=el('p','tv254-muted');
 const amountRow=el('div','tv255-amount-row');
 const quantityLabel=el('label','tv255-field');
 quantityLabel.append(el('span','','Quantity'));
 const amount=el('input','tv255-input');amount.type='number';amount.min='1';amount.max='1000000';
 amount.step='1';amount.value=String(p.count);
 amount.addEventListener('input',()=>{p.count=Number(amount.value)||1});
 quantityLabel.append(amount);
 const noteLabel=el('label','tv255-field');
 noteLabel.append(el('span','','Reason (optional)'));
 const note=el('input','tv255-input');note.maxLength=240;
 note.placeholder='Reward, purchase, sale, correction…';note.value=p.note;
 note.addEventListener('input',()=>{p.note=note.value});
 noteLabel.append(note);
 amountRow.append(quantityLabel,noteLabel);
 const actionRow=el('div','tv255-money-actions');
 const status=el('p','tv255-inline-message');
 status.setAttribute('role','status');
 const drawSystem=()=>{
  const selected=systems.find(c=>c.id===p.system)||systems[0];
  p.system=selected?.id||'guild-seals';
  systemBar.replaceChildren();
  const index=systems.findIndex(s=>s.id===p.system);
  const selectNext=delta=>{
   const target=systems[(index+delta+systems.length)%systems.length];
   if(!target)return;
   p.system=target.id;p.denom=target.denominations[0]?.id||null;
   drawSystem();
  };
  const back=button('‹',()=>selectNext(-1),'tv256-currency-arrow');
  back.setAttribute('aria-label','Previous currency to record');
  const forward=button('›',()=>selectNext(1),'tv256-currency-arrow');
  forward.setAttribute('aria-label','Next currency to record');
  const current=el('strong','tv256-record-currency',selected?.name||'Currency');
  systemBar.append(back,current,forward);
  denominationBar.replaceChildren();
  if(!selected)return;
  if(!selected.denominations.some(d=>d.id===p.denom))p.denom=selected.denominations[0]?.id;
  for(const denomination of selected.denominations){
   const owned=Number(allHoldings(result).find(x=>x.denomination_id===denomination.id)?.quantity)||0;
   const coin=button(denomination.name+' · '+denomination.valueGC+' GC'+
    (owned?' · '+owned+' owned':''),
    ()=>{p.denom=denomination.id;drawSystem()},
    'tv255-denom-chip'+(p.denom===denomination.id?' chosen':''));
   coin.setAttribute('aria-pressed',String(p.denom===denomination.id));
   denominationBar.append(coin);
  }
  selection.textContent='Changes real coins. The top carousel is for display only.';
 };
 const modify=async sign=>{
  if(!ready()||!validRole(c)||busy.has(c.id))return;
  const count=Number(amount.value);
  if(!Number.isInteger(count)||count<1||count>1000000){status.textContent='Choose a whole amount between 1 and 1,000,000.';return}
  const delta=count*sign;
  const id=p.denom;
  const held=Number(allHoldings(result).find(x=>x.denomination_id===id)?.quantity)||0;
  if(delta<0&&held<count){
   status.textContent='You only have '+held+' of this denomination. You cannot spend coins you do not have.';return;
  }
  busy.add(c.id);status.textContent='Recording transaction…';
  const request=isDm?
   api().rpc('terravale_wallet_adjust',{
    target_character:c.id,target_denomination:id,delta_quantity:delta,
    purpose:p.note||'DM treasury adjustment'
   }):
   api().rpc('terravale_wallet_self_adjust',{
    target_character:c.id,target_denomination:id,delta_quantity:delta,
    purpose:p.note||'Player wallet adjustment'
   });
  try{
   const {error}=await request;if(error)throw error;
   cashCache.delete(c.id);
   status.textContent=(sign>0?'Added ':'Removed ')+count+' physical '+(denomLookup().get(id)?.name||id)+'.';
   if(isDm){
    await fetchMoney(c,true);const newMoney=cashCache.get(c.id);
    if(host.isConnected)viewWallet(host,c,newMoney,refresh,isDm);
   }else refresh?.();
  }catch(e){status.textContent='Could not record: '+(e.message||String(e))}
  finally{busy.delete(c.id)}
 };
 const add=button(isDm?'+ Give coins':'+ Add coins',()=>modify(1),'btn primary');
 const remove=button(isDm?'− Take coins':'− Remove coins',()=>modify(-1),'btn ghost tv255-remove');
 actionRow.append(add,remove);
 manager.append(el('h4','','Currency'),systemBar,
  el('h4','','Coin or note'),denominationBar,selection,
  amountRow,actionRow,status);
 if(isDm)host.append(manager);
 else if(validRole(c))breakdown.append(manager);
 host.append(breakdown);
 drawSystem();
 if(validRole(c)&&result.ledger?.length){
  const log=el('details','tv255-wallet-history');
  log.append(el('summary','','Recent wallet transactions'));
  for(const record of result.ledger.slice(0,12)){
   const d=denomLookup().get(record.denomination_id);
   log.append(el('p','',new Date(record.created_at).toLocaleDateString()+
    ' · '+(record.delta>0?'+':'')+record.delta+' '+
    (d?.name||record.denomination_id)+' · '+(record.note||record.operation)));
  }breakdown.append(log);
 }
}
async function fetchMoney(c,force=false){
 if(!force&&cashCache.has(c.id))return cashCache.get(c.id);
 const [held,ledger]=await Promise.all([
  api().from('terravale_character_wallet').select('denomination_id,quantity')
   .eq('character_id',c.id),
  api().from('terravale_wallet_ledger').select('id,denomination_id,delta,note,operation,created_at')
   .eq('character_id',c.id).order('created_at',{ascending:false}).limit(12)
 ]);
 if(held.error)throw held.error;
 const value={holdings:held.data||[],ledger:ledger.error?[]:ledger.data||[]};
 cashCache.set(c.id,value);return value;
}
function render(section,c,result,refresh){
 if(!ready())return;
 if(!canRead(c)){
  section.replaceChildren(el('p','tv254-muted',
   'This wallet is private unless the character owner or DM shares an approved sheet.'));
  return;
 }
 // Our single view replaces the old selects but uses the old verified wallet read.
 const isDm=c.owner!=='You'&&db.role==='dm'&&
  window.TerravaleVerifiedAccount?.state?.profile?.is_dm;
 viewWallet(section,c,result,refresh,!!isDm);
}
function renderTreasury(host,campaign,chars){
 host.replaceChildren();
 if(!chars.length){host.append(el('p','tv254-muted','No characters in the campaign.'));return}
 const chosen=chars.find(c=>c.id===renderTreasury.selected)||chars[0];
 renderTreasury.selected=chosen.id;
 const picker=el('section','tv255-party-picker');
 picker.append(el('div','tv254-eyebrow','SELECT RECIPIENT'));
 const chips=el('div','tv255-chip-row');
 for(const c of chars){
  const b=button(c.name,()=>{
   renderTreasury.selected=c.id;renderTreasury(host,campaign,chars);
  },'tv255-choice-chip'+(c.id===chosen.id?' chosen':''));
  b.setAttribute('aria-pressed',String(c.id===chosen.id));chips.append(b);
 }
 picker.append(chips);host.append(picker);
 const content=el('section','tv254-panel tv255-finance-compact');
 host.append(content);
 content.append(el('p','tv254-muted','Loading '+chosen.name+'’s wallet…'));
 fetchMoney(chosen,true).then(data=>{
  if(content.isConnected) viewWallet(content,chosen,data,null,true);
 }).catch(error=>{
  if(content.isConnected) content.textContent='Wallet unavailable: '+(error.message||String(error));
 });
}
window.TerravaleV255Wallet={render,renderTreasury};
})();