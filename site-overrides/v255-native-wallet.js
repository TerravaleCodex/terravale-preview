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
const validRole=c=>c?.owner==='You'||(db.role==='dm'&&
 window.TerravaleVerifiedAccount?.state?.profile?.is_dm);
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
function displayed(system,amount){
 if(!system?.denominations?.length)return amount.toLocaleString()+' Guild Copper';
 const denominations=[...system.denominations].sort((a,b)=>b.valueGC-a.valueGC);
 const parts=[];let balance=amount;
 for(const d of denominations){
  const count=Math.floor(balance/d.valueGC);
  if(count>0){parts.push(count.toLocaleString()+' × '+d.name);balance-=count*d.valueGC}
 }
 if(balance)parts.push(balance.toLocaleString()+' GC remainder');
 return parts.length?parts.join(' · '):'0 in this currency';
}
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
function viewWallet(host,c,result,refresh,isDm){
 host.replaceChildren();
 if(!result){host.append(el('p','tv254-muted','Loading native holdings…'));return}
 const p=stateFor(c);
 const systems=rules().currencies;
 const total=sumGC(result);
 const info=el('div','tv255-wallet-header');
 info.append(el('div','tv254-eyebrow',isDm?'DM TREASURY · NATIVE CURRENCY':'CHARACTER WALLET · ACTUAL HOLDINGS'),
  el('h3','','Coin Purse'),
  el('p','tv255-wallet-total',total.toLocaleString()+' Guild Copper equivalent'));
 const displayIndex=Math.max(0,systems.findIndex(x=>x.id===p.display));
 const renderConverted=(delta)=>{
  const i=(displayIndex+delta+systems.length)%systems.length;
  p.display=systems[i]?.id||'guild-seals';
  viewWallet(host,c,result,refresh,isDm);
 };
 const shown=systems[displayIndex]||systems[0];
 const converter=el('div','tv256-conversion-carousel');
 converter.setAttribute('aria-label','Display currency conversion');
 const prev=button('‹',()=>renderConverted(-1),'tv256-currency-arrow');
 prev.setAttribute('aria-label','Previous display currency');
 const next=button('›',()=>renderConverted(1),'tv256-currency-arrow');
 next.setAttribute('aria-label','Next display currency');
 const conversion=el('div','tv256-conversion-readout');
 if(shown)conversion.append(el('small','','REFERENCE VALUE · '+shown.name),
  el('strong','',displayed(shown,total)));
 converter.append(prev,conversion,next);
 info.append(converter);
 host.append(info);
 const actual=el('section','tv255-wallet-holdings-section');
 actual.append(sectionHead('What you actually own','These are physical denominations carried on your character, not automatically converted money.'));
 holdingsList(actual,result);host.append(actual);
 const manager=el('details','tv255-wallet-manager');
 manager.open=!isDm;
 manager.append(el('summary','tv256-wallet-manager-toggle','Add or remove physical money'),
  el('p','tv254-muted',isDm?
   'Make an audited DM adjustment for this character.':
   'Track rewards and purchases; only your real physical coins change.'));
 const systemBar=el('div','tv255-wallet-system-list');
 systemBar.setAttribute('role','group');systemBar.setAttribute('aria-label','Currency system');
 const denominationBar=el('div','tv255-wallet-denominations');
 const selection=el('p','tv254-muted');
 const amountRow=el('div','tv255-amount-row');
 const quantityLabel=el('label','tv255-field');
 quantityLabel.append(el('span','','Number of physical coins or notes'));
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
  selection.textContent='Recording this denomination changes physical holdings. The carousel above only displays a converted total.';
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
 const add=button('+ Add money',()=>modify(1),'btn primary');
 const remove=button('− Remove money',()=>modify(-1),'btn ghost tv255-remove');
 actionRow.append(add,remove);
 manager.append(el('h4','','Currency to add or remove'),systemBar,
  el('h4','','Choose denomination'),denominationBar,selection,
  amountRow,actionRow,status);
 host.append(manager);
 drawSystem();
 if(result.ledger?.length){
  const log=el('details','tv255-wallet-history');
  log.append(el('summary','','Recent wallet transactions'));
  for(const record of result.ledger.slice(0,12)){
   const d=denomLookup().get(record.denomination_id);
   log.append(el('p','',new Date(record.created_at).toLocaleDateString()+
    ' · '+(record.delta>0?'+':'')+record.delta+' '+
    (d?.name||record.denomination_id)+' · '+(record.note||record.operation)));
  }host.append(log);
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
 if(!validRole(c)){
  section.replaceChildren(el('p','tv254-muted',
   'This character’s wallet is private. Only the owner and campaign DM can view or change its holdings.'));
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