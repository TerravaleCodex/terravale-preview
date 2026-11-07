/* Terravale V2.43 browser bridge: cloud campaigns and account-wide Adblockn't.
   Native dashboard, character sheets, lore and Cabinet remain the original V2.39 UI. */
(function(){
  'use strict';
  const members=new Set();
  let syncing=false, adProgress=null;
  const account=()=>window.TerravaleVerifiedAccount;
  const client=()=>account()?.supabase;
  const identity=()=>account()?.state;
  const toastText=(s)=>{if(typeof toast==='function')toast(s);else console.info(s)};
  const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function hasCampaign(id){return members.has(String(id||''))}
  function canCreate(id){
    if(!identity()?.ready || syncing || !id || !hasCampaign(id))return false;
    const current=db.campaigns.find(x=>x.id===id);
    return Boolean(current&&current.status!=='Archived');
  }
  function applyAdProgress(progress){
    if(!progress)return;
    const count=Math.max(0,Number(progress.closed_count)||0);
    db.dismissedAds=count;
    adProgress={count,unlocked:Boolean(progress.unlocked)};
    if(progress.unlocked && !db.unlocked.includes('adblocknt'))db.unlocked.push('adblocknt');
    // Permanent server unlocks are authoritative; never clear other unrelated achievements.
    persist();
    if(route()==='/cabinet-of-curiosities')renderPage(false);
    window.dispatchEvent(new CustomEvent('terravale-adblocknt-progress',{detail:{count,unlocked:Boolean(progress.unlocked)}}));
  }
  async function refreshAdProgress(){
    if(!identity()?.user)return;
    const {data,error}=await client().from('codex_ad_achievements')
      .select('closed_count,unlocked_at').eq('user_id',identity().user.id).maybeSingle();
    if(error){console.warn('Achievement progress sync failed:',error.message);return}
    applyAdProgress({closed_count:data?.closed_count||0,unlocked:Boolean(data?.unlocked_at)});
  }

  function mapCampaign(c){
    const previous=db.campaigns.find(x=>x.id===c.id);
    return {
      id:c.id,name:c.name,description:c.description||'',
      role:c.owner_id===identity().user.id?'dm':'player',
      status:previous?.status==='Archived'?'Archived':c.owner_id===identity().user.id?'Ongoing':'Joined'
    };
  }
  async function syncCampaigns(){
    if(!identity()?.ready)return;
    syncing=true;
    try{
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
      toastText('Campaign joined. You can now create a character.');
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
    if(!identity()?.profile?.is_dm || !path.startsWith('/campaigns/'))return;
    const current=db.campaigns.find(x=>x.id===db.campaign);
    if(!current || current.role!=='dm')return;
    const root=document.getElementById('pageRoot');
    if(!root || root.querySelector('#tv-campaign-invites'))return;
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

  window.TerravaleV2Bridge={
    canCreate,hasCampaign,applyAdProgress,refreshAdProgress,syncCampaigns,joinCampaign,createCampaign,getAdProgress:()=>adProgress
  };
  async function ready(){
    watch();
    await syncCampaigns();
    await refreshAdProgress();
  }
  if(identity()?.ready)ready();
  else window.addEventListener('terravale-auth-ready',ready,{once:true});
})();
