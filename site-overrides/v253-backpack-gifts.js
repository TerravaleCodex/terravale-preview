/* Terravale V2.53 — actual same-campaign item gifts.
   Inventory moves are performed atomically by Supabase; notifications belong
   to the recipient account and remain visible until the recipient dismisses. */
(function(){
'use strict';
const auth=()=>window.TerravaleVerifiedAccount;
const bridge=()=>window.TerravaleV2Bridge;
const state=()=>auth()?.state;
const client=()=>auth()?.supabase;
const chars=()=>typeof db!=='undefined'?db.characters||[]:[];
const inventory=c=>Array.isArray(c?.inventory)?c.inventory:[];
const node=(tag,cls,txt)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(txt!==undefined)n.textContent=String(txt);
  return n;
};
const currentChar=()=>{
  const route=location.hash.match(/^#\/characters\/([^/?#]+)/);
  if(!route)return null;
  let id=route[1];try{id=decodeURIComponent(id)}catch{}
  return chars().find(x=>String(x.id)===String(id))||null;
};
const isCampaignDm=c=>!!(state()?.profile?.is_dm&&typeof db!=='undefined'&&db.campaigns.some(k=>k.id===c.campaign&&k.role==='dm'));
const canSend=c=>!!(state()?.ready&&c&&(c.owner==='You'||isCampaignDm(c)));
const recipients=c=>chars().filter(x=>x.id!==c.id&&x.campaign===c.campaign&&
  x.status==='Approved'&&x.owner==='Party member');
const sendable=c=>inventory(c).filter(item=>
  item?.id&&['','backpack'].includes(String(item.slot||''))&&String(item.location||'backpack')!=='equipped');
let busy=false;
function mountGiftForm(){
 const c=currentChar();
 const backpack=document.querySelector('#pageRoot .sheet20-content .sheet21-backpack-zone');
 const existing=document.getElementById('tv-v253-gift-form');
 if(!backpack||!c||!canSend(c)||!sendable(c).length||!recipients(c).length){
   existing?.remove();
   return;
 }
 if(existing?.dataset.character===String(c.id))return;
 existing?.remove();
 const panel=node('details','tv-v253-gift-form');
 panel.id='tv-v253-gift-form';panel.dataset.character=String(c.id);
 panel.append(node('summary','','Give an item to another player'));
 const help=node('p','tv-v253-gift-help',
   'Send an item from this backpack to another player in the same campaign. Charged or enchanted items keep their current properties, but the recipient must attune again. Equipped items must be unequipped first.');
 panel.append(help);
 const form=node('form','tv-v253-gift-fields');
 const itemLabel=node('label','','Choose an item');
 const itemSelect=node('select');itemSelect.name='item';itemSelect.required=true;
 for(const item of sendable(c)){
   const op=node('option','',item.name+' · '+(Number(item.qty??item.quantity)||1)+' available');
   op.value=String(item.id);itemSelect.append(op);
 }
 itemLabel.append(itemSelect);
 const targetLabel=node('label','','Send to character');
 const targetSelect=node('select');targetSelect.name='recipient';targetSelect.required=true;
 for(const target of recipients(c)){
   const option=node('option','',target.name+' · '+(target.ownerName||'Party member'));
   option.value=String(target.id);targetSelect.append(option);
 }
 targetLabel.append(targetSelect);
 const countLabel=node('label','','Quantity');
 const number=node('input');number.type='number';number.name='quantity';
 number.min='1';number.step='1';number.value='1';number.required=true;
 countLabel.append(number);
 const chosen=()=>sendable(c).find(item=>String(item.id)===String(itemSelect.value));
 const updateMax=()=>{
   const item=chosen();
   const count=Number(item?.qty??item?.quantity)||1;
   const property=c.dmItemProperties?.[item?.id];
   number.max=String(count);
   if(number.value===''||Number(number.value)>count||property&&Number(number.value)<count)
     number.value=property?String(count):'1';
   number.disabled=Boolean(property);
   countLabel.title=property?'DM-powered items move as a whole stack.':'';
 };
 itemSelect.addEventListener('change',updateMax);updateMax();
 const send=node('button','btn primary small','Send item');
 send.type='submit';
 const status=node('p','tv-v253-gift-status','');
 status.setAttribute('role','status');
 form.append(itemLabel,targetLabel,countLabel,send,status);
 form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(busy||!state()?.ready)return;
   const item=chosen(),target=recipients(c).find(x=>String(x.id)===String(targetSelect.value));
   const qty=Number(number.value);
   const available=Number(item?.qty??item?.quantity)||1;
   if(!item||!target||!Number.isInteger(qty)||qty<1||qty>available){
     status.textContent='Please select an available item, another player, and a valid quantity.';return;
   }
   const powers=c.dmItemProperties?.[item.id];
   if(powers&&qty!==available){
     status.textContent='An item with magical properties or charges must be transferred whole.';return;
   }
   busy=true;send.disabled=true;status.textContent='Moving the item securely…';
   try{
     const {data,error}=await client().rpc('terravale_send_backpack_item',{
       source_character:c.id,recipient_character:target.id,
       source_item_id:String(item.id),send_quantity:qty
     });
     if(error||!data?.sent)throw error||new Error('The server did not confirm the transfer.');
     c.inventory=data.source_inventory;
     target.inventory=data.recipient_inventory;
     if(typeof persist==='function')persist();
     await bridge()?.syncCharacters?.();
     if(typeof renderPage==='function')renderPage(false);
     toastStatus(qty+' × '+(data.item_name||item.name)+' sent from '+c.name+' to '+target.name+'.');
   }catch(error){
     status.textContent='Could not send item: '+(error?.message||String(error));
     send.disabled=false;
   }finally{busy=false}
 });
 panel.append(form);
 backpack.insertAdjacentElement('afterend',panel);
}
function toastStatus(message){
 if(typeof toast==='function')toast(message);else console.info('[Terravale]',message);
}
let unread=[],seenUser=null,fetching=false,showingId=null;
function renderNotification(){
 const current=unread[0]||null;
 const existing=document.getElementById('tv-v253-gift-notification');
 if(!current){existing?.remove();showingId=null;return}
 if(existing&&showingId===current.id)return;
 existing?.remove();showingId=current.id;
 const card=node('section','tv-v253-gift-notification');
 card.id='tv-v253-gift-notification';
 card.setAttribute('role','alertdialog');
 card.setAttribute('aria-modal','false');
 card.setAttribute('aria-label','Item received');
 const top=node('div','tv-v253-gift-header');
 const label=node('span','','NEW DELIVERY · BACKPACK');
 const close=node('button','tv-v253-gift-dismiss','×');
 close.type='button';close.setAttribute('aria-label','Dismiss item delivery notification');
 top.append(label,close);
 card.append(top,node('h3','','An item has arrived'));
 const message=node('p','tv-v253-gift-message');
 const player=node('strong','',current.sender_player_name);
 const from=node('strong','',current.source_character_name);
 const item=node('strong','',current.item_quantity+' × '+current.item_name);
 const target=node('strong','',current.target_character_name);
 message.append(player,' playing ',from,' sent ',item,' to your character ',target,'.');
 card.append(message,node('p','tv-v253-gift-small',
   'The item is already in their backpack. Its remaining charges and powers travelled with it. This notice stays until you dismiss it.'));
 const actions=node('div','tv-v253-gift-actions');
 const dismiss=node('button','btn primary small','Got it · Dismiss');
 dismiss.type='button';
 const execute=async()=>{
   if(dismiss.disabled)return;
   dismiss.disabled=true;close.disabled=true;dismiss.textContent='Saving…';
   const {data,error}=await client().from('terravale_item_transfer_notifications')
     .update({dismissed_at:new Date().toISOString()})
     .eq('id',current.id).select('id').single();
   if(error||!data){
     dismiss.disabled=false;close.disabled=false;dismiss.textContent='Got it · Dismiss';
     toastStatus('Could not dismiss delivery: '+(error?.message||'Please retry.'));
     return;
   }
   unread=unread.filter(n=>n.id!==current.id);
   showingId=null;renderNotification();
 };
 dismiss.addEventListener('click',execute);close.addEventListener('click',execute);
 actions.append(dismiss);card.append(actions);
 document.body.append(card);
}
async function pollNotifications(){
 const user=state()?.user?.id;
 if(!state()?.ready||!user){
   if(seenUser){unread=[];showingId=null;renderNotification();}
   seenUser=null;return;
 }
 if(fetching)return;
 fetching=true;
 try{
   const {data,error}=await client().from('terravale_item_transfer_notifications')
     .select('id,created_at,sender_player_name,source_character_name,target_character_name,item_name,item_quantity')
     .is('dismissed_at',null)
     .order('created_at',{ascending:true}).limit(30);
   if(error)throw error;
   seenUser=user;unread=data||[];renderNotification();
 }catch(error){console.warn('Gift notices unavailable:',error?.message||error)}
 finally{fetching=false}
}
let scheduled=false;
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{
   scheduled=false;
   mountGiftForm();
 });
}
const observer=new MutationObserver(schedule);
observer.observe(document.getElementById('pageRoot')||document.body,{subtree:true,childList:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('terravale-characters-synced',schedule);
window.addEventListener('terravale-auth-ready',()=>{
 schedule();
 pollNotifications();
});
window.addEventListener('focus',pollNotifications);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)pollNotifications();
});
// Re-check while connected so a gift can arrive on any page. Do not
// automatically close pending notifications, even if a recheck fails.
setInterval(()=>{if(!document.hidden)pollNotifications()},14000);
schedule();
pollNotifications();
})();
