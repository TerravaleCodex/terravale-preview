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
      id:c.id,name:c.name,description:c.description||'',longDescription:c.long_description||'',theme:c.theme||'',genre:c.genre||'',isDemo:isDemo(c.id),
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
        .select('id,name,description,long_description,theme,genre,owner_id').order('created_at',{ascending:true});
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
  async function createCampaign(name,description,longDescription='',theme='',genre=''){
    const story=String(longDescription||'').trim();
    if(story.length>12000){toastText('Campaign description must be 12,000 characters or fewer.');return}
    if(theme.length>240||genre.length>240){toastText('Theme and Genre must be under 240 characters.');return}
    if(!identity()?.profile?.is_dm){toastText('Only the verified DM can create campaigns.');return}
    const {data,error}=await client().from('campaigns')
      .insert({name,description,long_description:story,theme:theme.trim(),genre:genre.trim(),owner_id:identity().user.id})
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
    if(current.role==='dm'&&!isDemo(id)){toastText('Transfer or delete a regular campaign before leaving ownership.');return;}
    const promptText=isDemo(id)&&current.role==='dm' ? 'Leave The Wayfarers’ Table demo? This will remove it from your active campaigns without deleting the shared demo. Your DM identity remains reserved so the demo can continue. Rejoin later using TV-DEMO.' : 'Leave '+current.name+'? You will lose access to its campaign and character records until you are invited back. Your characters will not be deleted.';
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
    createCampaign(name,String(data.get('description')||'').trim(),String(data.get('long_description')||'').trim(),String(data.get('theme')||'').trim(),String(data.get('genre')||'').trim());
  }
  document.addEventListener('submit',submit,true);

  // The short existing "description" is deliberately a tagline/quote; it must
  // not be overwritten by the longer player-facing campaign introduction.
  function decorateCampaignCreator(){
    const form=document.getElementById('campaignForm');
    if(!form||form.dataset.tvStoryFields==='1')return;
    form.dataset.tvStoryFields='1';
    const short=form.querySelector('[name="description"]');
    if(short){
      short.setAttribute('placeholder','e.g. Not every soul buried beneath the ice is dead.');
      short.setAttribute('maxlength','320');
      // Only rename a real label when it explicitly labels this field.
      const labels=Array.from(form.querySelectorAll('label'));
      const oldLabel=labels.find(x=>x===short.closest('label')||
        (short.id&&x.getAttribute('for')===short.id));
      if(oldLabel){
        const text=Array.from(oldLabel.childNodes).find(n=>n.nodeType===3&&/description/i.test(n.textContent));
        if(text)text.textContent=text.textContent.replace(/description/i,'Tagline / quote');
      }
      const hint=document.createElement('small');
      hint.className='tv-campaign-tagline-hint';
      hint.textContent='This is the short quote shown beneath the campaign title.';
      short.insertAdjacentElement('afterend',hint);
    }
    const field=document.createElement('label');
    field.className='tv-campaign-story-create-field';
    const heading=document.createElement('span');
    heading.textContent='Full campaign description';
    const help=document.createElement('small');
    help.textContent='The real introduction to your adventure: premise, setting, tone and what the party should expect. Optional; 12,000 characters maximum.';
    const area=document.createElement('textarea');
    area.name='long_description';
    area.rows=8;
    area.maxLength=12000;
    area.placeholder='Beyond the opening quote, what awaits your players? Set the scene, describe the starting situation, and introduce the adventure…';
    const meter=document.createElement('small');
    meter.className='tv-campaign-story-count';
    meter.textContent='0 / 12,000';
    area.addEventListener('input',()=>{meter.textContent=area.value.length.toLocaleString()+' / 12,000'});
    field.append(heading,help,area,meter);
    const metadata=document.createElement('div');
    metadata.className='tv-campaign-story-metadata-editor';
    for(const [key,label,placeholder] of [
      ['genre','Genre','Dark fantasy · supernatural mystery'],
      ['theme','Theme','Isolation · grief · endurance']
    ]){
      const labelNode=document.createElement('label');labelNode.className='tv-campaign-story-create-field';
      const span=document.createElement('span');span.textContent=label;
      const input=document.createElement('input');input.name=key;input.type='text';input.maxLength=240;input.placeholder=placeholder;
      labelNode.append(span,input);metadata.append(labelNode);
    }
    const submit=form.querySelector('button[type="submit"],input[type="submit"]');
    const before=submit?.closest('.v2-actions,.form-actions,.actions')||submit;
    if(before&&before.parentElement){
      before.insertAdjacentElement('beforebegin',metadata);
      before.insertAdjacentElement('beforebegin',field);
    }else form.append(metadata,field);
  }

  // Campaign details belong WITHIN their native tabs, never below the page footer.
  // All members can read Overview; only a verified campaign DM sees Settings editor.
  function selectedCampaignTab(root){
    return root.querySelector('.campaign-detail-tabs [data-value="settings"][aria-selected="true"]')?'settings':
      root.querySelector('.campaign-detail-tabs [data-value="overview"][aria-selected="true"]')?'overview':null;
  }
  // Small reading cards for the right-hand dossier rail. Never infer campaign
  // tone or write prose on the DM's behalf: show only saved metadata and stats.
  function makeInfo(label,value){
    const item=document.createElement('section');
    item.className='tv-campaign-story-meta tv-campaign-dossier-card';
    const head=document.createElement('h3');
    head.textContent=label;
    const content=document.createElement('p');
    content.textContent=value||'Not specified';
    if(!value)item.classList.add('is-empty');
    item.append(head,content);
    return item;
  }
  function campaignDossier(campaign){
    const aside=document.createElement('aside');
    aside.className='tv-campaign-story-aside';
    aside.setAttribute('aria-label','Campaign details and chapter information');

    // Only real DM-entered genre and themes appear here, never placeholder lore.
    aside.append(
      makeInfo('Genre',campaign.genre),
      makeInfo('Theme',campaign.theme)
    );
    const summary=document.createElement('section');
    summary.className='tv-campaign-dossier-card tv-campaign-chapter-card';
    const heading=document.createElement('h3');
    heading.textContent='At a glance';
    const intro=document.createElement('p');
    intro.className='tv-campaign-chapter-caption';
    intro.textContent='A quick look at this chapter';
    summary.append(heading,intro);
    const list=document.createElement('dl');
    list.className='tv-campaign-chapter-facts';
    let stats=null;
    try{
      if(typeof campaignStats==='function')stats=campaignStats(campaign);
    }catch(error){console.warn('Campaign overview statistics unavailable:',error)}
    const facts=[
      ['Status',campaign.status||'Not specified'],
      ['Adventurers',Array.isArray(stats?.chars)?String(stats.chars.length):'—'],
      ['Journal entries',Array.isArray(stats?.notes)?String(stats.notes.length):'—']
    ];
    for(const [label,value] of facts){
      const row=document.createElement('div');
      const dt=document.createElement('dt');dt.textContent=label;
      const dd=document.createElement('dd');dd.textContent=value;
      row.append(dt,dd);list.append(row);
    }
    summary.append(list);
    aside.append(summary);
    return aside;
  }
  function decorateCampaignStory(root,campaign){
    if(isDemo(campaign.id))return;
    const tab=selectedCampaignTab(root);
    const body=root.querySelector('.campaign-detail-content');
    if(!body||!tab)return;
    if(tab==='overview'){
      if(body.querySelector('#tv-campaign-story'))return;
      const panel=document.createElement('section');
      panel.id='tv-campaign-story';
      panel.className='tv-campaign-story tv-campaign-story-overview tv-campaign-dossier';
      const over=document.createElement('div');
      over.className='v2-overline';
      over.textContent='THE STORY YOU ARE STEPPING INTO';
      const h=document.createElement('h2');
      h.textContent='About this campaign';

      const layout=document.createElement('div');
      layout.className='tv-campaign-story-layout';
      const reading=document.createElement('div');
      reading.className='tv-campaign-story-reading';

      const quote=document.createElement('blockquote');
      quote.className='tv-campaign-story-quote';
      quote.textContent=campaign.description||'A chapter awaiting its first words.';
      const intro=document.createElement('div');
      intro.className='tv-campaign-story-content';
      intro.textContent=campaign.longDescription||'';
      if(!campaign.longDescription){
        intro.classList.add('tv-empty');
        intro.textContent='The Dungeon Master has not yet published the full campaign introduction.';
      }
      reading.append(quote,intro);
      layout.append(reading,campaignDossier(campaign));
      panel.append(over,h,layout);
      body.prepend(panel);
    }else{
      // The original native settings form saves only a local preview. On the live
      // site it MUST NOT be offered alongside the database-backed editor.
      const offlineForm=body.querySelector('#campaignSettingsForm');
      if(offlineForm)offlineForm.remove();
      const hint=body.querySelector('.campaign-detail-title p');
      if(hint)hint.textContent='Campaign details are saved to your verified Terravale account.';
      if(body.querySelector('#tv-campaign-story-settings'))return;
      const allowed=Boolean(identity()?.profile?.is_dm&&campaign.role==='dm');
      if(allowed)body.querySelector('.campaign-settings-locked')?.remove();
      if(!allowed){
        const locked=body.querySelector('.campaign-settings-locked p');
        if(locked)locked.textContent='Only this campaign’s verified Dungeon Master can edit the campaign story.';
        return;
      }
      const area=body.querySelector('.campaign-detail-section')||body;
      const panel=document.createElement('section');
      panel.id='tv-campaign-story-settings';panel.className='tv-campaign-story tv-campaign-story-settings';
      area.append(panel);
      renderCampaignEditor(panel,campaign);
    }
  }
  function renderCampaignEditor(panel,campaign){
    panel.replaceChildren();
    const over=document.createElement('div');over.className='v2-overline';
    over.textContent='DM EDITOR · VISIBLE TO CAMPAIGN PLAYERS';
    const title=document.createElement('h3');title.textContent='Your campaign’s story';
    const subtitle=document.createElement('p');subtitle.className='tv-campaign-editor-intro';
    subtitle.textContent='Changes appear in the Overview tab for every campaign member. The quote, genre, theme and full introduction are independent fields.';
    const form=document.createElement('form');form.className='tv-campaign-story-editor';
    function field(label,key,value,rows,max,placeholder){
      const wrap=document.createElement('label');
      const head=document.createElement('span');head.textContent=label;
      const control=rows?document.createElement('textarea'):document.createElement('input');
      control.name=key;control.maxLength=max;control.value=value||'';
      if(rows)control.rows=rows;else control.type='text';
      control.placeholder=placeholder;
      wrap.append(head,control);
      return {wrap,control};
    }
    const tagline=field('Tagline / opening quote','tagline',campaign.description,2,320,'Not every soul buried beneath the ice is dead.');
    const genre=field('Genre','genre',campaign.genre,0,240,'Dark fantasy · survival horror · mystery');
    const theme=field('Theme','theme',campaign.theme,0,240,'Loss · isolation · hope · sacrifice');
    const story=field('Full campaign description','long_description',campaign.longDescription,12,12000,'The real campaign introduction, with the premise, setting and what awaits the players…');
    const counter=document.createElement('small');counter.className='tv-campaign-story-count';
    const tally=()=>{counter.textContent=story.control.value.length.toLocaleString()+' / 12,000 characters'};
    story.control.addEventListener('input',tally);tally();
    story.wrap.append(counter);
    const actions=document.createElement('div');actions.className='tv-campaign-story-actions';
    const save=document.createElement('button');save.type='submit';save.className='btn primary small';
    save.textContent='Save campaign details';
    const message=document.createElement('p');message.className='tv-campaign-story-status';
    message.setAttribute('role','status');
    actions.append(save);
    form.append(tagline.wrap,genre.wrap,theme.wrap,story.wrap,actions,message);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const values={
        description:tagline.control.value.trim(),
        genre:genre.control.value.trim(),
        theme:theme.control.value.trim(),
        long_description:story.control.value.trim()
      };
      if(values.long_description.length>12000||values.genre.length>240||values.theme.length>240){
        message.textContent='The description is limited to 12,000 characters and Theme/Genre to 240 each.';return;
      }
      save.disabled=true;save.textContent='Saving…';message.textContent='Saving to your campaign…';
      try{
        const {data,error}=await client().from('campaigns').update(values)
          .eq('id',campaign.id).select('id,description,long_description,theme,genre').single();
        if(error||!data)throw error||new Error('Campaign details were not returned by the server.');
        message.textContent='Saved. Everyone in your campaign can now read the updated Overview.';
        await syncCampaigns();
        toastText('Campaign details saved online.');
      }catch(error){
        message.textContent='Unable to save: '+(error.message||String(error));
        save.disabled=false;save.textContent='Save campaign details';
      }
    });
    panel.append(over,title,subtitle,form);
  }

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
    // The native creator can be presented from several campaign routes.
    decorateCampaignCreator();
    if(!path.startsWith('/campaigns/'))return;
    const id=path.split('/')[2],current=db.campaigns.find(x=>x.id===id);
    if(!current || !hasCampaign(id))return;
    const root=document.getElementById('pageRoot');
    if(!root)return;
    const currentTab=selectedCampaignTab(root);
    if(currentTab==='settings'&&!root.querySelector('#tv-campaign-membership')){
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
      if(current.role!=='dm'||isDemo(id)){
        const button=document.createElement('button');
        button.type='button';button.className='btn ghost small tv-leave-btn';
        button.textContent='Leave campaign';
        button.onclick=()=>leaveCampaign(id);
        section.append(button);
      }
      (root.querySelector('.campaign-detail-content')||root).append(section);
    }
    decorateCampaignStory(root,current);
    if(currentTab!=='settings'||!identity()?.profile?.is_dm || current.role!=='dm' || isDemo(id))return;
    if(root.querySelector('#tv-campaign-invites'))return;
    const panel=document.createElement('section');
    panel.id='tv-campaign-invites';
    panel.className='tv-live-invites';
    panel.innerHTML='<div class="v2-overline">REAL CAMPAIGN INVITATIONS</div><h3>Invite players</h3>'+
      '<p>New invites use short <strong>TV-XXXXXX</strong> codes, valid for seven days (up to 100 joins).</p>'+
      '<button type="button" class="btn ghost small" id="tv-invite-create">Create short join code</button>'+
      '<code class="tv-code" id="tv-invite-result" aria-live="polite"></code>'+
      '<button type="button" class="btn ghost small" id="tv-invite-copy" hidden>Copy invite code</button>';
    (root.querySelector('.campaign-detail-content')||root).append(panel);
    panel.querySelector('#tv-invite-create').onclick=async ()=>{
      const {data,error}=await client().rpc('create_campaign_join_code',{
        target_campaign:current.id,days_valid:7,allowed_uses:100});
      panel.querySelector('#tv-invite-result').textContent=error?error.message:data;
      const copy=panel.querySelector('#tv-invite-copy');
      copy.hidden=Boolean(error||!data);
      if(!error&&data){
        copy.textContent='Copy invite code';
        copy.onclick=async()=>{
          try{
            await navigator.clipboard.writeText(String(data));
            copy.textContent='Copied!';
          }catch{
            copy.textContent='Select the code above to copy';
          }
        };
      }
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
