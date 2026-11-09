/* Terravale V2.78 — one-time initial approvals and explicit level-up requests.
   The native bundle delegates "Approve character" here. Server status is authoritative.
   No local mutation is treated as an approval; ordinary sheet editing stays independent.
*/
(function(){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pendingApprovals=new Set();
const busyRequests=new Set();
const account=()=>window.TerravaleVerifiedAccount;
const client=()=>account()?.supabase;
const verified=()=>Boolean(account()?.state?.ready&&account()?.state?.profile);
const hasDM=()=>Boolean(verified()&&account().state.profile.is_dm&&
  typeof db!=='undefined'&&db.role==='dm');
const campaign=()=>typeof db!=='undefined'?db.campaign:null;
const characters=()=>typeof db!=='undefined'?(db.characters||[]):[];
const el=(tag,cls,text)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=String(text);
 return n;
};
function button(label,handler,cls='btn ghost small'){
 const n=el('button',cls,label);n.type='button';
 n.addEventListener('click',handler);return n;
}
function notify(message){
 if(typeof toast==='function')toast(message);
 else if(typeof window.TerravaleToast==='function')window.TerravaleToast(message);
 else console.info('[Terravale approvals]',message);
}
async function refresh(){
 await window.TerravaleV2Bridge?.syncCharacters?.();
}
async function approveInitial(id,original){
 if(!UUID.test(String(id||''))||!hasDM()||!client()){
  notify('Verified DM access is required. No character was changed.');
  return false;
 }
 if(pendingApprovals.has(id))return false;
 const c=characters().find(ch=>ch.id===id);
 if(!c){notify('Character not found.');return false}
 if(c.status==='Approved'){notify('This character is already approved.');return true}
 const chosen=original?.closest?.('[data-action="approveCharacter"]')||original;
 pendingApprovals.add(id);
 if(chosen){chosen.disabled=true;chosen.dataset.tv278Busy='1';chosen.textContent='Approving…'}
 try{
  const {data,error}=await client().rpc('terravale_dm_approve_initial_character',
    {target_character:id});
  if(error)throw error;
  if(!data?.approved)throw Error('The server did not confirm approval.');
  // Only reflect a server-confirmed change locally, never the reverse.
  if(c)c.status='Approved';
  notify(data.already_approved?'Character already approved.':'Initial character approval saved.');
  await refresh();
  if(typeof renderPage==='function')renderPage(false);
  return true;
 }catch(e){
  notify('Approval failed; character remains pending: '+(e.message||String(e)));
  return false;
 }finally{
  pendingApprovals.delete(id);
  if(chosen?.isConnected){
   chosen.disabled=false;chosen.textContent='Approve';
   delete chosen.dataset.tv278Busy;
  }
 }
}
function activeSheet(){
 const hash=location.hash.match(/^#\/characters\/([^/?#]+)/);
 if(!hash)return null;
 let id=hash[1];try{id=decodeURIComponent(id)}catch{}
 if(!UUID.test(id))return null;
 const ch=characters().find(c=>String(c.id)===id);
 if(!ch||ch.status!=='Approved'||ch.owner!=='You'||ch.demoCurator)return null;
 const shell=document.querySelector('#pageRoot .sheet20');
 if(!shell)return null;
 const chronicle=shell.querySelector('.sheet20-tabs [data-value="chronicle"][aria-selected="true"]');
 if(!chronicle)return null;
 const content=shell.querySelector('.sheet20-content');
 if(!content)return null;
 return {id,ch,content};
}
async function showPlayerLevelRequest(panel,id,lv){
 const status=panel.querySelector('[data-tv278-status]');
 const slot=panel.querySelector('[data-tv278-actions]');
 if(!status||!slot)return;
 status.textContent='Checking requests against the campaign record…';
 try{
  const {data,error}=await client().from('approval_requests')
    .select('id,status,proposed_changes')
    .eq('character_id',id).eq('status','pending')
    .order('created_at',{ascending:false}).limit(20);
  if(error)throw error;
  if(!panel.isConnected||activeSheet()?.id!==id)return;
  const existing=(data||[]).find(r=>r.proposed_changes?.kind==='level_up');
  slot.replaceChildren();
  if(existing){
   status.textContent='A level-up request is already awaiting the DM. Your approved level stays unchanged until the decision.';
   return;
  }
  status.textContent='Level changes require a separate DM decision. Ordinary edits never reopen character approval.';
  if(lv>=20){status.textContent='Level 20 is the maximum.';return}
  const request=button('Request level '+(lv+1),async()=>{
   if(busyRequests.has(id))return;
   busyRequests.add(id);request.disabled=true;
   status.textContent='Submitting the level-up request…';
   try{
    const {data:result,error:requestError}=await client().rpc(
     'terravale_request_character_level_up',{target_character:id});
    if(requestError)throw requestError;
    if(!result?.pending)throw Error('Request was not accepted.');
    slot.replaceChildren();
    status.textContent='Level '+(lv+1)+' requested. Awaiting DM review; your current level remains '+lv+'.';
   }catch(e){
    status.textContent='Could not request advancement: '+(e.message||String(e));
    request.disabled=false;
   }finally{busyRequests.delete(id)}
  },'btn ghost small tv278-request-btn');
  slot.append(request);
 }catch(e){
  status.textContent='Could not check advancement requests: '+(e.message||String(e));
 }
}
function mountPlayer(){
 const active=activeSheet();
 if(!active||!verified())return;
 const {id,ch,content}=active;
 if(content.querySelector('[data-tv278-player-level]'))return;
 const lv=Math.min(20,Math.max(1,Number(ch.level)||1));
 const panel=el('section','sheet20-panel tv278-player-level');
 panel.dataset.tv278PlayerLevel=id;
 panel.append(el('div','v2-overline','ADVANCEMENT · DM REVIEW'));
 panel.append(el('h3','','Level '+lv+' progression'));
 const status=el('p','tv278-status');status.dataset.tv278Status='1';
 const actions=el('div','tv278-actions');actions.dataset.tv278Actions='1';
 panel.append(status,actions);
 content.append(panel);
 showPlayerLevelRequest(panel,id,lv);
}
async function mountDmRequests(panel,selectedCampaign,ids){
 const state=panel.querySelector('[data-tv278-state]'),list=panel.querySelector('[data-tv278-list]');
 if(!state||!list)return;
 try{
  if(!ids.length){panel.remove();return}
  const {data,error}=await client().from('approval_requests')
    .select('id,character_id,proposed_changes,status,created_at')
    .eq('status','pending')
    .in('character_id',ids)
    .order('created_at',{ascending:true}).limit(200);
  if(error)throw error;
  if(!panel.isConnected||campaign()!==selectedCampaign)return;
  const rows=(data||[]).filter(r=>r.proposed_changes?.kind==='level_up');
  if(!rows.length){panel.remove();return}
  state.textContent=rows.length+' pending level-up request'+(rows.length===1?'':'s')+'. Initial character approval is separate.';
  list.replaceChildren();
  for(const req of rows){
   const ch=characters().find(c=>c.id===req.character_id);
   if(!ch||ch.campaign!==selectedCampaign)continue;
   const from=Number(req.proposed_changes?.from_level),to=Number(req.proposed_changes?.to_level);
   const row=el('div','tv278-request-row');
   const title=el('div','tv278-request-text');
   title.append(el('strong','',ch.name),el('small','','Level '+from+' → '+to));
   const actions=el('div','tv278-actions');
   const makeDecision=(approve)=>{
    const label=approve?'Approve level '+to:'Decline';
    return button(label,async()=>{
     if(busyRequests.has(req.id))return;
     busyRequests.add(req.id);
     for(const b of actions.querySelectorAll('button'))b.disabled=true;
     state.textContent=approve?'Approving level '+to+'…':'Declining level-up request…';
     try{
      const {data:result,error:saveError}=await client().rpc(
       'terravale_dm_decide_character_level_up',
       {target_request:req.id,approve_level:approve});
      if(saveError)throw saveError;
      if(!['approved','rejected'].includes(result?.status))
       throw Error('The server did not confirm the decision.');
      notify(result.status==='approved'?'Level-up approved and saved.':'Level-up request declined.');
      await refresh();
      if(typeof renderPage==='function')renderPage(false);
     }catch(e){
      state.textContent='Could not record decision: '+(e.message||String(e));
      for(const b of actions.querySelectorAll('button'))b.disabled=false;
     }finally{busyRequests.delete(req.id)}
    },approve?'btn primary small':'btn ghost small');
   };
   actions.append(makeDecision(true),makeDecision(false));
   row.append(title,actions);list.append(row);
  }
 }catch(e){
  state.textContent='Could not load level-up requests: '+(e.message||String(e));
 }
}
function mountDm(){
 if(!hasDM()||!client()||!/^#\/dm(?:\/|$)/.test(location.hash))return;
 const root=document.getElementById('tv254-dm-vault');
 const anchor=root?.querySelector('.tv255-overview-stats');
 const campaignId=campaign();
 if(!anchor||!UUID.test(String(campaignId||''))||
    root.querySelector('[data-tv278-dm-levels]'))return;
 const ids=characters().filter(c=>c.campaign===campaignId&&UUID.test(String(c.id)))
  .map(c=>c.id);
 if(!ids.length)return;
 const panel=el('section','tv254-panel tv278-dm-levels');
 panel.dataset.tv278DmLevels=campaignId;
 panel.append(el('div','tv254-eyebrow','ADVANCEMENT APPROVALS'),
   el('h2','','Level-up requests'));
 const state=el('p','tv278-status','Checking pending level-up requests…');state.dataset.tv278State='1';
 const list=el('div','tv278-requests');list.dataset.tv278List='1';
 panel.append(state,list);
 anchor.after(panel);
 mountDmRequests(panel,campaignId,ids);
}
let queued=false;
function mount(){
 if(!verified())return;
 if(hasDM())mountDm();
 mountPlayer();
}
const observer=new MutationObserver(()=>{
 if(!/^#\/(?:characters\/|dm(?:\/|$))/.test(location.hash)||queued)return;
 queued=true;requestAnimationFrame(()=>{queued=false;mount()});
});
observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,60));
window.addEventListener('terravale-auth-ready',()=>setTimeout(mount,80));
window.addEventListener('terravale-characters-synced',()=>setTimeout(mount,30));
window.TerravaleV278Approval={approveInitial,mount};
mount();
})();