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
      // Pull freshly joined characters before displaying the roster. This also
      // restores the demo curator labels for Aster and his six companions.
      try{await window.TerravaleV2Bridge?.syncCharacters?.()}catch(error){
        console.warn('Campaign joined; character refresh will retry:',error);
      }
      navigate('/campaigns/'+result.data);
      toastText(isDemo(result.data)?'Joined the demo: you can create your own level-one character.':'Campaign joined. You can now create a character.');
      window.dispatchEvent(new CustomEvent('terravale-campaign-joined',{
        detail:{campaignId:result.data,isDemo:isDemo(result.data)}
      }));
    }else toastText('Joined online, but could not load campaign details.');
  }
  async function createCampaign(name){
    if(!identity()?.profile?.is_dm){toastText('Only the verified DM can create campaigns.');return}
    // Only the name is requested when creating the campaign. All other fields
    // retain their empty defaults and are edited later in Campaign Settings.
    const {data,error}=await client().from('campaigns')
      .insert({name,description:'',owner_id:identity().user.id})
      .select('id,name,description,owner_id').single();
    if(error){toastText('Campaign not created: '+error.message);return}
    await syncCampaigns();
    if(members.has(data.id)){
      db.campaign=data.id;db.mode='sample';persist();navigate('/campaigns/'+data.id);
      toastText('Campaign created. Add its details any time from Campaign Settings.');
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
    createCampaign(name);
  }
  document.addEventListener('submit',submit,true);

  // Campaign creation is intentionally NAME ONLY. The story, tagline, genre
  // and theme can be filled out at any time from Campaign Settings.
  function decorateCampaignCreator(){
    const form=document.getElementById('campaignForm');
    if(form&&!form.dataset.tvMinimalCampaign){
      form.dataset.tvMinimalCampaign='1';
      for(const selector of [
        '[name="description"]','[name="long_description"]',
        '[name="genre"]','[name="theme"]'
      ]){
        const control=form.querySelector(selector);
        if(control)(control.closest('label')||control).remove();
      }
      for(const selector of ['.tv-campaign-story-create-field',
                             '.tv-campaign-story-metadata-editor',
                             '.tv-campaign-tagline-hint']){
        form.querySelectorAll(selector).forEach(node=>node.remove());
      }
      const create=form.querySelector('button[type="submit"]');
      if(create)create.textContent='Create campaign →';
      const panel=form.closest('.campaign-entry-panel');
      const description=panel?.querySelector('h3+p');
      if(description)description.textContent=
        'Just give your campaign a name. Add its quote, genre, themes and full story later in Campaign Settings.';
    }
    const join=document.getElementById('joinForm');
    if(join&&!join.dataset.tvCodeHint){
      join.dataset.tvCodeHint='1';
      const input=join.querySelector('input[name="code"]');
      if(input){
        input.placeholder='TV-XXXXXX';
        input.setAttribute('aria-label','Invitation code');
        const label=input.closest('label');
        if(label){
          // Keep the actual input, so focus and password-manager behaviour work.
          for(const textNode of label.childNodes){
            if(textNode.nodeType===Node.TEXT_NODE&&textNode.textContent.trim()){
              textNode.textContent='Invitation code ';
              break;
            }
          }
        }
      }
    }
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
    const tab=selectedCampaignTab(root);
    const body=root.querySelector('.campaign-detail-content');
    if(!body||!tab)return;
    if(isDemo(campaign.id)){
      if(tab==='settings'){
        // This shared live demo has persistent characters and no local-only
        // DM simulation controls. Remove inherited offline-preview messaging.
        body.querySelector('#campaignSettingsForm')?.remove();
        body.querySelector('.campaign-settings-locked')?.remove();
        const hint=body.querySelector('.campaign-detail-title p');
        if(hint)hint.textContent='The Wayfarers’ Table is a shared live demonstration. Its permanent characters retain their inventories and progress.';
      }
      return;
    }
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
  async function renderCampaignRules(panel,campaign,editable){
    const make=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!=null)el.textContent=value;return el};
    const labels={'2014':'D&D 2014','2024':'D&D 2024',tv5e:'Tv5e',custom:'Custom'};
    const defaults=r=>r==='2014'?['2014']:r==='2024'?['2024']:r==='tv5e'?['2014','2024']:[];
    const state={ruleset:'',override:false,editions:[]};
    let revision=0,loaded=false,dirty=false;
    const over=make('div','v2-overline',editable?'DM EDITOR · CAMPAIGN MECHANICS':'CAMPAIGN MECHANICS · READ ONLY');
    const title=make('h3','','Rules & Content');
    const intro=make('p','tv-campaign-editor-intro','Choose the campaign ruleset and spell catalogues. Characters inherit these settings; existing learned spells are preserved.');
    const options=make('div','tv309-rule-options');
    const catalogues=make('div','tv309-catalogue-options');
    const override=make('button','btn ghost small tv309-toggle');override.type='button';
    const summary=make('p','tv-campaign-story-status');summary.setAttribute('role','status');
    const status=make('p','tv-campaign-story-status','Checking campaign settings…');status.setAttribute('role','status');
    const save=make('button','btn primary small','Save rules & content');save.type='button';save.disabled=true;
    const actions=make('div','tv-campaign-story-actions');actions.append(save);
    const codex=make('div','tv309-catalogue-row');const codexCopy=make('div');codexCopy.append(make('strong','','Codex spells'),make('small','','Custom and published spell content · coming later'));const codexToggle=make('button','btn ghost small','Unavailable');codexToggle.type='button';codexToggle.disabled=true;codex.append(codexCopy,codexToggle);
    function update(){
      options.replaceChildren();catalogues.replaceChildren();
      for(const [id,label] of Object.entries(labels)){
        const b=make('button','btn ghost small',label);b.type='button';b.disabled=!editable;b.setAttribute('aria-pressed',String(state.ruleset===id));
        b.onclick=()=>{state.ruleset=id;state.override=id==='custom';state.editions=defaults(id);dirty=true;update()};options.append(b);
      }
      override.textContent='Override ruleset defaults · '+(state.override?'On':'Off');override.setAttribute('aria-pressed',String(state.override));override.disabled=!editable||!state.ruleset||state.ruleset==='custom';
      for(const id of ['2014','2024']){
        const row=make('div','tv309-catalogue-row'),copy=make('div');copy.append(make('strong','',labels[id]),make('small','',id==='2014'?'System Reference Document 5.1':'System Reference Document 5.2.1'));
        const b=make('button','btn ghost small tv309-toggle',state.editions.includes(id)?'Allowed':'Blocked');b.type='button';b.setAttribute('aria-pressed',String(state.editions.includes(id)));b.disabled=!editable||!state.override;
        b.onclick=()=>{state.editions=state.editions.includes(id)?state.editions.filter(x=>x!==id):[...state.editions,id].sort();dirty=true;update()};row.append(copy,b);catalogues.append(row);
      }
      catalogues.append(codex);
      summary.textContent=state.ruleset?'Character tag: '+labels[state.ruleset]+' · '+(state.editions.length?state.editions.map(x=>labels[x]).join(' + '):'No official spell catalogues'):'Campaign ruleset not configured';
      // Preview only until server authorization is deployed and verified.
      save.disabled=true;
      if(dirty)status.textContent='Unsaved preview · saving is not available until the campaign policy migration is enabled.';
    }
    override.onclick=()=>{state.override=!state.override;if(!state.override)state.editions=defaults(state.ruleset);dirty=true;update()};
    panel.append(over,title,intro,make('strong','','Campaign ruleset'),options,override,catalogues,summary);if(editable)panel.append(actions);panel.append(status);
    // Future settings are explicitly non-authoritative design previews; no fake saves.
    const extras=make('div','tv311-rule-sections');
    const sections=[
      {title:'Starter content',desc:'Choose which built-in collections are available when creating characters. These choices do not delete existing content.',rows:[
        ['2014 classes & subclasses','SRD 5.1 class catalogue'],['2024 classes & subclasses','SRD 5.2.1 class catalogue'],['Tv5e classes & subclasses','Terravale original and adapted classes'],
        ['2014 ancestries','SRD 5.1 ancestry catalogue'],['2024 ancestries','SRD 5.2.1 ancestry catalogue'],['Tv5e ancestries','Terravale ancestry catalogue'],
        ['Feat catalogues','Edition-specific feats and original Terravale feats'],['Campaign and Codex content','Published or campaign-owned classes, ancestries, feats, items and spells; access and pinned versions required']]},
      {title:'Character creation & advancement',desc:'Campaign-wide character creation and progression policies.',rows:[
        ['Starting level','Level-one default; higher starts require complete progression validation'],['Ability score generation','Standard array, point buy or DM-approved rolls'],['Ancestry prerequisites','Enforce Terravale class and ancestry dependencies; DM may approve an exception'],['Multiclassing','Tv5e default: disabled'],['Backgrounds','Tv5e uses backstory benefits instead of standard backgrounds'],['HP advancement','Fixed or rolled hit dice, with DM approval'],['Level-up authorization','DM-controlled availability and approval; existing approved records preserved']]},
      {title:'Spellcasting',desc:'Choose a resource model without changing spell effects, concentration or components.',rows:[
        ['Casting resource','Standard spell slots / DMG spell points / Tv5e spell points'],['Arcane Strain & overcasting','Optional Tv5e stability checks and strain; requires points mode'],['Character exceptions','DM-approved casting resource overrides; Pact Magic and custom class resources remain separate'],['Recovery and conversion','Preserve spent resources when switching; long-rest and high-level casting limits']]},
      {title:'Optional mechanics',desc:'Modules extend the core game and expose their associated settings only when implemented.',rows:[
        ['Divine Favour & Boons','Unlock divine relationships, offers, charges and patron mechanics in Divine and DM Chronicle'],['Additional conditions','Enable Terravale-specific conditions in sheets and Session Room'],['Custom multi-currency','Enable regional denominations, exchange rates and treasury settings in DM Chronicle'],['Grappling & expanded conditions','Tv5e extensions to the core combat rules'],['Inspiration','Tv5e default: disabled']]},
      {title:'Table & session rules',desc:'Mechanical permissions and shared play; campaign administration stays in Settings.',rows:[
        ['Party visibility','DM-controlled character sheet sharing; private records remain private'],['Rest management','DM-controlled recovery in Session Room; class-specific rules retained'],['Dice visibility','Public, private and DM-only roll options'],['Session advancement','Party-specific advancement and milestone permissions; multi-party support pending']]},
    ];
    for(const section of sections){
      const group=make('section','tv311-rule-group');const head=make('div','tv311-rule-heading');head.append(make('h3','',section.title),make('small','tv311-pending','Planned settings'));group.append(head,make('p','tv-campaign-editor-intro',section.desc));
      for(const [name,description] of section.rows){const row=make('div','tv309-catalogue-row'),copy=make('div');copy.append(make('strong','',name),make('small','',description));row.append(copy,make('small','tv311-pending','Not connected'));group.append(row)}
      extras.append(group);
    }
    const core=make('p','tv-campaign-editor-intro','Core feats, training, languages, inventory and basic D&D mechanics are always available; they are not optional modules.');extras.append(core);
    panel.after(extras);
    update();
    if(isDemo(campaign.id)){state.ruleset='tv5e';state.editions=defaults('tv5e');update();status.textContent='Shared demo · read only';return}
    try{
      const {data,error}=await client().from('terravale_campaign_spell_policy').select('ruleset,override_catalogues,editions,revision').eq('campaign_id',campaign.id).maybeSingle();
      if(!panel.isConnected||dirty)return;
      if(error)throw error;
      if(data&&labels[data.ruleset]&&Array.isArray(data.editions)){state.ruleset=data.ruleset;state.override=data.override_catalogues===true;state.editions=data.editions.filter(x=>['2014','2024'].includes(x));revision=data.revision}
      loaded=true;update();status.textContent=editable?'Preview only · server saving is not enabled yet.':data?'Current campaign rules · managed by your DM.':'Your DM has not configured the campaign rules yet.';
    }catch(e){if(panel.isConnected&&!dirty)status.textContent=editable?'Preview only · campaign policy storage is not available on this server yet.':'Campaign rules are not available on this server yet.'}
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

  // Independent Rules tab: retain native tab state and content, without invoking
  // the native delegated action with an unsupported tab identifier.
  function mountCampaignRulesTab(root,campaign){
    const tabs=root.querySelector('.campaign-detail-tabs'),body=root.querySelector('.campaign-detail-content');
    if(!tabs||!body)return false;
    let button=tabs.querySelector('[data-tv310-rules]');
    if(!button){
      button=document.createElement('button');button.type='button';button.textContent='Rules';
      const native=tabs.querySelector('[data-value="settings"]')||tabs.querySelector('button');
      button.className=native?.className||'';button.classList.remove('active','is-active');
      button.dataset.tv310Rules='true';button.setAttribute('role','tab');button.setAttribute('aria-selected','false');
      if(native)native.before(button);else tabs.append(button);
      button.addEventListener('click',()=>{
        if(button.getAttribute('aria-selected')==='true')return;
        for(const tab of tabs.querySelectorAll('[aria-selected]')){
          if(tab===button)continue;
          tab.dataset.tv310Selected=tab.getAttribute('aria-selected');
          tab.setAttribute('aria-selected','false');
        }
        button.setAttribute('aria-selected','true');
        for(const child of [...body.children]){child.dataset.tv310PreviousHidden=String(child.hidden);child.hidden=true}
        const view=document.createElement('section');view.id='tv310-rules-view';view.className='campaign-detail-section';
        const title=document.createElement('div');title.className='campaign-detail-title';title.innerHTML='<h2>Campaign rules</h2><p>Mechanical settings and permitted content for this campaign.</p>';
        const panel=document.createElement('section');panel.id='tv-campaign-rules-settings';panel.className='tv-campaign-story tv-campaign-story-settings';
        view.append(title,panel);body.append(view);
        renderCampaignRules(panel,campaign,Boolean(identity()?.profile?.is_dm&&campaign.role==='dm'&&!isDemo(campaign.id)));
      });
      tabs.addEventListener('click',event=>{
        if(button.getAttribute('aria-selected')!=='true'||button.contains(event.target))return;
        const target=event.target.closest('[data-value]');if(!target||!tabs.contains(target))return;
        button.setAttribute('aria-selected','false');
        body.querySelector('#tv310-rules-view')?.remove();
        for(const child of body.querySelectorAll('[data-tv310-previous-hidden]')){child.hidden=child.dataset.tv310PreviousHidden==='true';delete child.dataset.tv310PreviousHidden}
        for(const tab of tabs.querySelectorAll('[data-tv310-selected]')){tab.setAttribute('aria-selected',tab.dataset.tv310Selected);delete tab.dataset.tv310Selected}
      },true);
    }
    return button.getAttribute('aria-selected')==='true'&&Boolean(body.querySelector('#tv310-rules-view'));
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
    if(mountCampaignRulesTab(root,current))return;
    const currentTab=selectedCampaignTab(root);
    if(currentTab==='settings'&&!root.querySelector('#tv-campaign-membership')){
      const section=document.createElement('section');
      section.id='tv-campaign-membership';section.className='tv-campaign-membership';
      if(isDemo(id)){
        section.innerHTML='<div class="tv-eyebrow">THE WAYFARERS’ TABLE · LIMITED DEMO</div>'+
          '<h3>A permanent demonstration party.</h3>'+
          '<p>Aster and the six Wayfarers are permanent, approved characters. You can create your own level-one character here, but the shared campaign’s story and settings are not editable.</p>';
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
