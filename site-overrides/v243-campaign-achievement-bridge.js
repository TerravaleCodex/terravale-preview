/* Terravale V2.43 browser bridge: cloud campaigns and account-wide Adblockn't.
   Native dashboard, character sheets, lore and Cabinet remain the original V2.39 UI. */
(function(){
  'use strict';
  const members=new Set();
  let syncing=false, adProgress=null, demoCampaignId=null;
  const account=()=>window.TerravaleVerifiedAccount;
  const client=()=>account()?.supabase;
  const identity=()=>account()?.state;
  const toastText=(s)=>{if(typeof toast==='function')toast(s);else console.info(s)};
  const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function hasCampaign(id){return members.has(String(id||''))}
  function isDemo(id){return Boolean(id && demoCampaignId && id===demoCampaignId)}
  function canCreate(id){
    if(!identity()?.ready || syncing || !id || !hasCampaign(id))return false;
    const current=db.campaigns.find(x=>x.id===id);
    if(!current || current.status==='Archived')return false;
    if(isDemo(id)){
      const owner=identity()?.profile?.discord_uid;
      if(db.characters.some(c=>c.campaign===id && (c.ownerUid===owner || (c.owner==='You' && !c.ownerUid))))return false;
    }
    return true;
  }
  function applyAdProgress(progress){
    if(!progress)return;
    const count=Math.max(0,Number(progress.closed_count)||0);
    db.dismissedAds=count;
    adProgress={count,unlocked:Boolean(progress.unlocked),
      enabled:progress.adblock_enabled == null ? Boolean(adProgress?.enabled) : Boolean(progress.adblock_enabled)};
    db.unlocked=db.unlocked.filter(x=>x!=='adblocknt');
    if(progress.unlocked)db.unlocked.push('adblocknt');
    // Permanent server unlocks are authoritative; never clear other unrelated achievements.
    persist();
    if(route()==='/cabinet-of-curiosities')renderPage(false);
    window.dispatchEvent(new CustomEvent('terravale-adblocknt-progress',{detail:{count,unlocked:Boolean(progress.unlocked)}}));
  }
  async function refreshAdProgress(){
    if(!identity()?.user)return;
    const {data,error}=await client().from('codex_ad_achievements')
      .select('closed_count,unlocked_at,adblock_enabled').eq('user_id',identity().user.id).maybeSingle();
    if(error){console.warn('Achievement progress sync failed:',error.message);return}
    applyAdProgress({closed_count:data?.closed_count||0,unlocked:Boolean(data?.unlocked_at),adblock_enabled:Boolean(data?.adblock_enabled)});
  }

  async function setPersonalAdblocker(enabled){
    if(!identity()?.ready || !adProgress?.unlocked)return {error:'Achievement locked'};
    const {data,error}=await client().rpc('terravale_set_personal_adblocker',{desired_enabled:Boolean(enabled)});
    if(error){toastText('Could not update personal adblocker: '+error.message);return {error:error.message}}
    applyAdProgress({closed_count:data.count,unlocked:true,adblock_enabled:data.enabled});
    return {enabled:Boolean(data.enabled)};
  }
  function mapCampaign(c){
    const previous=db.campaigns.find(x=>x.id===c.id);
    return {
      id:c.id,name:c.name,description:c.description||'',isDemo:isDemo(c.id),
      role:c.owner_id===identity().user.id?'dm':'player',
      status:previous?.status==='Archived'?'Archived':c.owner_id===identity().user.id?'Ongoing':'Joined'
    };
  }
  async function syncCampaigns(){
    if(!identity()?.ready)return;
    syncing=true;
    try{
      if(!demoCampaignId){
        const demo=await client().rpc('terravale_demo_campaign_id');
        if(demo.error)throw demo.error;
        demoCampaignId=demo.data||null;
      }
      const {data,error}=await client().from('campaigns')
        .select('id,name,description,owner_id').order('created_at',{ascending:true});
      if(error)throw error;
      const serverIds=new Set((data||[]).map(x=>x.id));
      members.clear();for(const id of serverIds)members.add(id);
      db.campaigns=(data||[]).map(mapCampaign);
      if(!serverIds.has(db.campaign))db.campaign=data?.[0]?.id||'';
      db.mode=data?.length?'sample':'empty';
      persist();renderPage(false);
    }catch(e){console.error('Unable to load verified campaigns:',e);toastText('Could not synchronise your campaign memberships.')}
    finally{syncing=false;if(route()==='/characters/create')renderPage(false)}
  }
  async function joinCampaign(code){
    const sb=client(),acct=identity();
    if(!acct?.ready){toastText('Discord sign-in required');return}
    const value=String(code||'').trim().toUpperCase();
    let result;
    if(value==='TV-DEMO')result=await sb.rpc('terravale_join_demo_campaign');
    else result=await sb.rpc('join_campaign_by_code',{given_code:value});
    if(result.error){toastText('Cannot join campaign: '+result.error.message);return}
    await syncCampaigns();
    if(members.has(result.data)){
      db.campaign=result.data;db.mode='sample';persist();
      navigate('/campaigns/'+result.data);
      toastText(isDemo(result.data)?'Joined the demo: one level-one test character.':'Campaign joined. You can now create a character.');
    }else toastText('Joined online, but could not load campaign details.');
  }
  async function createCampaign(name,description){
    if(!identity()?.profile?.is_dm){toastText('Only the verified DM can create campaigns.');return}
    const {data,error}=await client().from('campaigns')
      .insert({name,description,owner_id:identity().user.id})
      .select('id,name,description,owner_id').single();
    if(error){toastText('Campaign not created: '+error.message);return}
    await syncCampaigns();
    if(members.has(data.id)){
      db.campaign=data.id;db.mode='sample';persist();navigate('/campaigns/'+data.id);
      toastText('Campaign saved online.');
    }
  }
  async function leaveCampaign(id){
    const current=db.campaigns.find(x=>x.id===id);
    if(!current || !hasCampaign(id))return;
    if(current.role==='dm'){toastText('Campaign owners cannot leave their own campaigns.');return;}
    const promptText='Leave '+current.name+'? You will lose access to its campaign and character records until you are invited back. Your characters will not be deleted.';
    if(!window.confirm(promptText))return;
    const {data,error}=await client().rpc('terravale_leave_campaign',{target_campaign:id});
    if(error){toastText('Could not leave campaign: '+error.message);return;}
    await syncCampaigns();
    if(db.campaign===id){db.campaign=db.campaigns[0]?.id||'';persist();}
    navigate('/campaigns');
    toastText('You have left the campaign. Your character records were preserved.');
  }
  function submit(e){
    const form=e.target;
    if(!form || (form.id!=='joinForm'&&form.id!=='campaignForm'))return;
    e.preventDefault();e.stopImmediatePropagation();
    const data=new FormData(form);
    if(form.id==='joinForm'){joinCampaign(data.get('code'));return}
    const name=String(data.get('name')||'').trim();
    if(name.length<2){toastText('Enter a campaign name of at least two characters');return}
    createCampaign(name,String(data.get('description')||'').trim());
  }
  document.addEventListener('submit',submit,true);

  // Adjust the existing dashboard link rather than rendering a fake second dashboard.
  function decoratePage(){
    const path=route();
    if(path==='/' && !hasCampaign(db.campaign)){
      for(const a of document.querySelectorAll('#pageRoot a[href="#/characters/create"]')){
        a.href='#/campaigns';
        if(/create/i.test(a.textContent))a.textContent='Join a campaign';
      }
    }
    if(path==='/cabinet-of-curiosities')mountPersonalAdblocker();
    if(!path.startsWith('/campaigns/'))return;
    const id=path.split('/')[2],current=db.campaigns.find(x=>x.id===id);
    if(!current || !hasCampaign(id))return;
    const root=document.getElementById('pageRoot');
    if(!root)return;
    if(!root.querySelector('#tv-campaign-membership')){
      const section=document.createElement('section');
      section.id='tv-campaign-membership';section.className='tv-campaign-membership';
      if(isDemo(id)){
        section.innerHTML='<div class="tv-eyebrow">THE WAYFARERS’ TABLE · LIMITED DEMO</div>'+
          '<h3>Practice without changing a real campaign.</h3>'+
          '<p>One level-one test character per player. No campaign editing, DM invitations or permanent session management. This is a shared practice table, not a full adventure campaign.</p>';
      }else{
        section.innerHTML='<div class="tv-eyebrow">CAMPAIGN MEMBERSHIP</div>'+
          '<h3>Your place at the table</h3><p>You can leave this campaign without deleting your character records.</p>';
      }
      if(current.role!=='dm'){
        const button=document.createElement('button');
        button.type='button';button.className='btn ghost small tv-leave-btn';
        button.textContent='Leave campaign';
        button.onclick=()=>leaveCampaign(id);
        section.append(button);
      }else if(isDemo(id)){
        const hint=document.createElement('small');
        hint.textContent='The demo’s owner account cannot leave this protected shared campaign.';
        section.append(hint);
      }
      root.append(section);
    }
    if(!identity()?.profile?.is_dm || current.role!=='dm' || isDemo(id))return;
    if(root.querySelector('#tv-campaign-invites'))return;
    const panel=document.createElement('section');
    panel.id='tv-campaign-invites';
    panel.className='tv-live-invites';
    panel.innerHTML='<div class="v2-overline">REAL CAMPAIGN INVITATIONS</div><h3>Invite players</h3>'+
      '<p>Create a secure invitation, valid for seven days (up to 100 joins).</p>'+
      '<button type="button" class="btn ghost small" id="tv-invite-create">Create join code</button>'+
      '<code class="tv-code" id="tv-invite-result" aria-live="polite"></code>';
    root.append(panel);
    panel.querySelector('#tv-invite-create').onclick=async ()=>{
      const {data,error}=await client().rpc('create_campaign_join_code',{
        target_campaign:current.id,days_valid:7,allowed_uses:100});
      panel.querySelector('#tv-invite-result').textContent=error?error.message:data;
    };
  }
  let observer=null,queued=false;
  function watch(){
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;decoratePage()});
    });
    observer.observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',()=>setTimeout(decoratePage,50));
    decoratePage();
  }

  function mountPersonalAdblocker(){
    const root=document.getElementById('pageRoot');
    if(!root)return;
    let panel=root.querySelector('#tv-personal-adblocker');
    if(!panel){
      panel=document.createElement('section');panel.id='tv-personal-adblocker';
      panel.className='tv-personal-adblocker';
      const summary=root.querySelector('.cab-summary');
      if(summary)summary.insertAdjacentElement('afterend',panel);
      else root.prepend(panel);
    }
    const state=adProgress;
    const unlocked=Boolean(state?.unlocked),on=Boolean(state?.enabled);
    const html='<div><div class="tv-eyebrow">ADBLOCKN’T · EARNED REWARD</div>'+
      '<h3>Personal advertisement blocker</h3><p>'+
      (unlocked?'Achievement unlocked. Choose whether automatic advertisements appear for your Discord account. DM test pop-ups remain available.':
        'Dismiss 25 actual advertisement pop-ups to unlock the personal blocker.')+
      '</p><small>'+(state?Math.min(state.count,25)+' / 25 advertisements dismissed':'Loading account progress…')+'</small></div>';
    if(panel.dataset.unlocked===String(unlocked) && panel.dataset.enabled===String(on) && panel.dataset.count===String(state?.count??-1))return;
    panel.dataset.unlocked=String(unlocked);panel.dataset.enabled=String(on);panel.dataset.count=String(state?.count??-1);
    panel.innerHTML=html;
    const toggle=document.createElement('button');toggle.type='button';
    toggle.className='tv-adblock-toggle'+(on?' is-active':'');
    toggle.disabled=!unlocked;
    toggle.setAttribute('aria-pressed',String(on));
    toggle.textContent=!unlocked?'Locked':on?'Adblocker ON · Click to disable':'Turn ON adblocker';
    toggle.addEventListener('click',async()=>{
      toggle.disabled=true;toggle.textContent='Saving…';
      await setPersonalAdblocker(!on);
      panel.dataset.enabled='';
      mountPersonalAdblocker();
    });
    panel.append(toggle);
  }
  window.addEventListener('terravale-adblocknt-progress',()=>{if(route()==='/cabinet-of-curiosities')mountPersonalAdblocker()});
  window.TerravaleV2Bridge={
    canCreate,hasCampaign,isDemo,leaveCampaign,setPersonalAdblocker,
    applyAdProgress,refreshAdProgress,syncCampaigns,joinCampaign,createCampaign,getAdProgress:()=>adProgress
  };
  async function ready(){
    watch();
    await syncCampaigns();
    await refreshAdProgress();
  }
  if(identity()?.ready)ready();
  else window.addEventListener('terravale-auth-ready',ready,{once:true});
})();
