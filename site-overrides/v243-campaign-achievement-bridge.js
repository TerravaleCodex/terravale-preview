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
    const editionHelp={'2014':'The original fifth-edition rules released in 2014. Choose this if your group uses the older rulebooks and character options.','2024':'The revised fifth-edition rules released in 2024, with updated character creation, classes, spells and combat mechanics.',tv5e:'Terravale’s own fifth-edition ruleset, combining selected rules from both editions with original classes, ancestries and mechanics.',custom:'Start with your own selection of content and mechanics rather than a preset. You are responsible for choosing compatible rules.'};
    const editionExplanation=make('p','tv313-setting-help','Select a game version to see what it means. Changing versions resets the other preview settings to that version’s proposed defaults.');
    const defaults=r=>r==='2014'?['2014']:r==='2024'?['2024']:r==='tv5e'?['2014','2024']:[];
    const state={ruleset:'',override:false,editions:[],codexSpells:false,extra:{}};
    const initialExtras=r=>{
      const tv=r==='tv5e',a=r==='2014'||tv,b=r==='2024'||tv;
      return {classes14:a,classes24:b,classesTv:tv,ancestry14:a,ancestry24:b,ancestryTv:tv,feats14:a,feats24:b,featsTv:tv,codexContent:false,startingLevel:1,abilityScores:'choice',prerequisites:true,multiclass:!tv&&r!=='custom',backgrounds:tv?'backstory':'standard',hp:'choice',advancement:'dm',casting:'slots',strain:tv,overcast:tv,castingExceptions:false,recovery:'preserve',divine:tv,conditions:tv,currency:tv,grapple:tv,inspiration:!tv&&r!=='custom',visibility:'dm',rests:'dm',dice:'choice',milestones:'party'};
    };
    state.extra=initialExtras('');
    let drawExtras=()=>{},activeCategory=0;
    let revision=0,loaded=false,dirty=false;
    const over=make('div','v2-overline',editable?'DM EDITOR · CAMPAIGN MECHANICS':'CAMPAIGN MECHANICS · READ ONLY');
    const title=make('h3','','Campaign rules');
    const intro=make('p','tv-campaign-editor-intro',editable?'Experiment with the settings below. This preview does not change your campaign.':'View the rules configured by your Dungeon Master.');
    const options=make('div','tv309-rule-options');
    const catalogues=make('div','tv309-catalogue-options');
    const override=make('button','btn ghost small tv309-toggle');override.type='button';
    const summary=make('p','tv-campaign-story-status');summary.setAttribute('role','status');
    const status=make('p','tv-campaign-story-status','Checking campaign settings…');status.setAttribute('role','status');
    const save=make('button','btn primary small','Save unavailable');save.type='button';save.disabled=true;
    const actions=make('div','tv-campaign-story-actions');actions.append(save);
    const codex=make('div','tv309-catalogue-row');const codexCopy=make('div');codexCopy.append(make('strong','','Codex spells'),make('small','','Allow spells created by your campaign or shared through the Codex. This will require access and version checks; it is a preview option only for now.'));const codexToggle=make('button','btn ghost small','Unavailable');codexToggle.type='button';codexToggle.disabled=!editable;codexToggle.onclick=()=>{state.codexSpells=!state.codexSpells;dirty=true;update()};codex.append(codexCopy,codexToggle);
    function update(){
      options.replaceChildren();catalogues.replaceChildren();
      for(const [id,label] of Object.entries(labels)){
        const b=make('button','btn ghost small',label);b.type='button';b.disabled=!editable;b.setAttribute('aria-pressed',String(state.ruleset===id));
        b.onclick=()=>{if(state.ruleset===id)return;state.ruleset=id;state.override=id==='custom';state.editions=defaults(id);state.extra=initialExtras(id);state.codexSpells=false;dirty=true;update()};options.append(b);
      }
      editionExplanation.textContent=(editionHelp[state.ruleset]||'Choose a version to start with a suggested set of rules.')+' Changing versions resets the preview settings to the new defaults.';
      override.textContent='Override ruleset defaults · '+(state.override?'On':'Off');override.setAttribute('aria-pressed',String(state.override));override.disabled=!editable||!state.ruleset||state.ruleset==='custom';
      for(const id of ['2014','2024']){
        const row=make('div','tv309-catalogue-row'),copy=make('div');copy.append(make('strong','',labels[id]),make('small','',id==='2014'?'The openly available spell list from the original fifth edition (SRD 5.1). Players can choose these versions when learning or replacing spells.':'The openly available revised spell list (SRD 5.2.1). Some spells have different effects, ranges or requirements from their 2014 versions.'));
        const b=make('button','btn ghost small tv309-toggle',state.editions.includes(id)?'Allowed':'Blocked');b.type='button';b.setAttribute('aria-pressed',String(state.editions.includes(id)));b.disabled=!editable||!state.override;
        b.onclick=()=>{state.editions=state.editions.includes(id)?state.editions.filter(x=>x!==id):[...state.editions,id].sort();dirty=true;update()};row.append(copy,b);catalogues.append(row);
      }
      codexToggle.textContent=state.codexSpells?'Allowed · preview':'Blocked';codexToggle.setAttribute('aria-pressed',String(state.codexSpells));catalogues.append(codex);
      summary.textContent=state.ruleset?'Character tag: '+labels[state.ruleset]+' · '+(state.editions.length?state.editions.map(x=>labels[x]).join(' + '):'No official spell catalogues'):'Campaign ruleset not configured';
      // Preview only until server authorization is deployed and verified.
      save.disabled=true;
      drawExtras();if(dirty)status.textContent='Unsaved preview · changes are not applied to the campaign.';
    }
    override.onclick=()=>{state.override=!state.override;if(!state.override)state.editions=defaults(state.ruleset);dirty=true;update()};
    const workspace=make('div','tv313-workspace'),nav=make('nav','tv313-navigation'),main=make('div','tv313-main'),corePanel=make('section','tv313-core');
    nav.setAttribute('aria-label','Rules categories');
    const coreTitle=make('h3','','Core ruleset'),coreIntro=make('p','tv-campaign-editor-intro','Choose a rules foundation. You can adjust each content collection independently.');
    const coreHeading=make('div','tv313-section-title');coreHeading.append(coreTitle,coreIntro);
    corePanel.append(coreHeading,make('strong','','Game version'),options,editionExplanation,make('strong','','Spell catalogues'),make('p','tv313-setting-help','A catalogue is a collection of spells players may choose from. Allowing both editions does not mean a character can learn two versions of the same spell. Previously learned spells are retained for DM review.'),override,make('p','tv313-setting-help','Turn this on to choose official spell editions yourself instead of following the game version preset. Turning it off restores that preset’s spell catalogues.'),catalogues,summary);
    main.append(corePanel);workspace.append(nav,main);
    panel.append(over,title,intro,status,workspace);if(editable)panel.append(actions);
    panel.classList.add('tv313-rules-shell');
    const extras=make('div','tv311-rule-sections tv313-extras');main.append(extras);
    const toggle=(key,name,desc,dependency)=>({key,name,desc,dependency});
    const choice=(key,name,desc,values,dependency)=>({key,name,desc,values,dependency});
    const sections=[
      {title:'Starter content',desc:'Independently choose the collections available during character creation.',rows:[
        toggle('classes14','2014 classes & subclasses','SRD 5.1'),toggle('classes24','2024 classes & subclasses','SRD 5.2.1'),toggle('classesTv','Tv5e classes & subclasses','Terravale class catalogue'),
        toggle('ancestry14','2014 ancestries','SRD 5.1'),toggle('ancestry24','2024 ancestries','SRD 5.2.1'),toggle('ancestryTv','Tv5e ancestries','Terravale ancestry catalogue'),
        toggle('feats14','2014 feats','SRD 5.1'),toggle('feats24','2024 feats','SRD 5.2.1'),toggle('featsTv','Tv5e feats','Terravale feat catalogue'),toggle('codexContent','Campaign & Codex content','Published and campaign-owned content; future access checks')]},
      {title:'Character creation & advancement',desc:'Character generation and progression rules.',rows:[
        {key:'startingLevel',name:'Starting level',desc:'Higher starts require progression validation',number:true},
        choice('abilityScores','Ability score generation','Permitted generation method',[['choice','Player choice'],['array','Standard array'],['point','Point buy'],['roll','Rolled']]),
        toggle('prerequisites','Ancestry prerequisites','Enforce class and ancestry dependencies'),toggle('multiclass','Multiclassing','Allow multiple classes'),
        choice('backgrounds','Backgrounds','Character origin benefits',[['standard','Standard'],['backstory','Backstory benefits'],['none','None']]),
        choice('hp','HP advancement','Hit die method',[['choice','Player choice'],['fixed','Fixed'],['roll','Rolled']]),
        choice('advancement','Level-up authorization','DM approval is retained',[['dm','DM unlock'],['request','Player request']])]},
      {title:'Spellcasting',desc:'Resource model, strain and recovery.',rows:[
        choice('casting','Casting resource','Pact Magic and class resources remain separate',[['slots','Spell slots'],['dmg','DMG points'],['tv','Tv5e points']]),
        toggle('strain','Arcane Strain','Tv5e stability penalties',x=>x.casting==='tv'),toggle('overcast','Overcasting & stability','Permit casting beyond available points',x=>x.casting==='tv'&&x.strain),
        toggle('castingExceptions','Character exceptions','DM-approved resource model overrides'),
        choice('recovery','Resource conversion','Preserve spent resources when changing models',[['preserve','Preserve usage'],['rest','Change after long rest']])]},
      {title:'Optional mechanics',desc:'Modules unlock connected settings when implemented.',rows:[
        toggle('divine','Divine Favour & Boons','Divine tab and DM Chronicle'),toggle('conditions','Additional conditions','Sheets and Session Room'),toggle('currency','Custom multi-currency','Wallets and DM Treasury'),toggle('grapple','Expanded grappling','Terravale combat extensions'),toggle('inspiration','Inspiration','Enable inspiration tracking')]},
      {title:'Table & session rules',desc:'Shared play and mechanical permissions.',rows:[
        choice('visibility','Party visibility','Private records remain private',[['dm','DM controlled'],['shared','Shared sheets'],['private','Private']]),
        choice('rests','Rest management','Class recovery rules retained',[['dm','DM controlled'],['player','Player initiated']]),
        choice('dice','Dice visibility','Roll disclosure defaults',[['choice','Player choice'],['public','Public'],['dm','DM only']]),
        choice('milestones','Session advancement','Multi-party support pending',[['party','Per party'],['campaign','Campaign-wide']])]}
    ];
    const settingHelp={"classes14":"Allow the openly licensed 2014 class and subclass options when creating or advancing a character. These use the original fifth-edition progression.","classes24":"Allow revised 2024 class and subclass options, including their updated features and progression. Choose this for characters built using the newer rules.","classesTv":"Allow Terravale’s original and adapted classes and specializations. Some have ancestry requirements or unique resources.","ancestry14":"Allow the playable peoples and racial traits from the 2014 open rules. These determine part of a character’s starting abilities.","ancestry24":"Allow revised playable species from the 2024 open rules, including their updated traits.","ancestryTv":"Allow Terravale’s playable ancestries, such as Dvergr and other setting-specific peoples, with their own traits and restrictions.","feats14":"Allow openly licensed 2014 feats: optional special abilities characters may gain when eligible. This is not the entire commercial rulebook collection.","feats24":"Allow openly licensed 2024 feats. Eligibility may depend on level, prerequisites or feat category.","featsTv":"Allow original Terravale feats, including ancestry-linked and other custom character benefits.","codexContent":"Allow eligible content created for this campaign or published by other creators. Shared content will need access checks and a fixed version to avoid unexpected changes.","startingLevel":"The level at which new characters enter the campaign, from 1 to 20. Higher levels require choosing all earlier features, spells and other benefits. Existing characters are not reset.","abilityScores":"Determines how players choose Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma. Standard array uses fixed numbers; point buy spends a budget; rolled scores use dice. Player choice permits any supported method.","prerequisites":"Require a character to meet ancestry restrictions for content such as ancestry-specific classes. Turning this off would allow combinations normally restricted by the campaign.","multiclass":"Allow a character to gain levels in more than one class, such as Fighter and Wizard. This adds complexity to prerequisites, resources and spell progression. Tv5e normally disables it.","backgrounds":"Standard backgrounds grant the benefits defined by the selected edition. Backstory benefits let the DM award benefits based on the character’s history instead. None removes this source of benefits.","hp":"When leveling up, fixed HP uses the class’s fixed hit die value; rolled HP uses a die result. Constitution modifiers still apply. Player choice lets the player select either method.","advancement":"DM unlock means the DM opens advancement before players make choices. Player request lets players ask to advance. Both retain DM approval before the new level becomes official.","casting":"Spell slots spend a use of a particular spell level. DMG points use a shared pool to pay for spells. Tv5e points build on that pool with optional strain and overcasting. Pact Magic and other class resources remain separate.","strain":"Tracks magical exhaustion as a spellcaster exceeds safe limits. Increasing strain can reduce casting stability and eventually restrict spellcasting. Available only with Tv5e points.","overcast":"Lets a caster attempt a spell when they lack enough points, at the cost of strain and a stability check. Failure can waste the attempt and cause DM-defined consequences. Requires Arcane Strain.","castingExceptions":"Permit the DM to authorize a different casting resource system for a particular character when their class or story needs an exception.","recovery":"Controls when a resource model can change. Preserve usage carries spent resources into the new model; change after long rest waits until recovery. Neither should grant free additional casting.","divine":"Enables relationships with patrons and gods, divine offers, awarded boons, charges and consequences. The DM manages these through the Divine tools and DM Chronicle.","conditions":"Adds Terravale-specific status effects beyond the chosen edition’s ordinary conditions. These would appear on character sheets and in the Session Room.","currency":"Allows several named currencies and denominations, regional wallets and exchange rates instead of only standard coin types. The DM manages the economy.","grapple":"Uses Terravale’s expanded rules for grabbing, restraining and escaping opponents instead of relying solely on the base edition’s grappling rules.","inspiration":"Tracks inspiration, a reward a DM can grant for roleplay or other notable actions. Its benefit follows the chosen ruleset. Tv5e normally leaves this disabled.","visibility":"Controls whether players can view fellow party members’ shared character sheets. DM controlled uses individual permissions; shared sheets allows party access; private limits access to owners and authorized DMs. Private records stay protected.","rests":"DM controlled requires the DM to authorize recovery. Player initiated allows players to start their own rests. Each class and resource still follows its short-rest or long-rest rules.","dice":"Player choice lets players select roll visibility. Public shows results to the table; DM only limits player roll results to the roller and DM. Private DM rolls remain protected.","milestones":"Per party allows separate groups to advance at different story milestones. Campaign-wide applies progression milestones across the campaign. Multi-party support is still planned."};
    drawExtras=()=>{
      nav.replaceChildren();extras.replaceChildren();corePanel.hidden=activeCategory!==0;extras.hidden=activeCategory===0;
      const names=['Core ruleset','Starter content','Character creation','Spellcasting','Optional mechanics','Table & session rules'];
      const hints=['Game version & spells','Classes, ancestries & feats','Creation & level-up','Casting & recovery','Terravale modules','Shared play & permissions'];
      names.forEach((name,i)=>{const b=make('button','tv313-nav-button');b.type='button';b.setAttribute('aria-current',activeCategory===i?'page':'false');b.append(make('strong','',name),make('small','',hints[i]));b.onclick=()=>{activeCategory=i;drawExtras()};nav.append(b)});
      for(const [index,section] of sections.entries()){
        if(activeCategory!==index+1)continue;
        const group=make('section','tv311-rule-group'),head=make('div','tv311-rule-heading');head.append(make('h3','',section.title));group.append(head,make('p','tv-campaign-editor-intro',section.desc));
        for(const item of section.rows){
          const row=make('div','tv309-catalogue-row tv312-rule-row'),copy=make('div');copy.append(make('strong','',item.name),make('small','tv313-setting-help',settingHelp[item.key]||item.desc));row.append(copy);
          const enabled=editable&&(!item.dependency||item.dependency(state.extra));
          if(editable&&item.dependency&&!enabled)copy.append(make('small','tv313-dependency',item.key==='overcast'?'Requires Tv5e spell points and Arcane Strain.':'Requires Tv5e spell points.'));
          const control=make('div','tv312-rule-controls');
          const change=value=>{state.extra[item.key]=value;dirty=true;update()};
          if(!editable){control.append(make('small','tv311-pending','Not connected'))}
          else if(item.number){const input=make('input','');input.type='number';input.min='1';input.max='20';input.value=String(state.extra[item.key]);input.disabled=!enabled;input.setAttribute('aria-label',item.name);input.onchange=()=>change(Math.max(1,Math.min(20,Math.trunc(Number(input.value)||1))));control.append(input)}
          else if(item.values){for(const [value,label] of item.values){const b=make('button','btn ghost small',label);b.type='button';b.disabled=!enabled;b.setAttribute('aria-pressed',String(state.extra[item.key]===value));b.onclick=()=>change(value);control.append(b)}}
          else{const on=Boolean(state.extra[item.key])&&(!item.dependency||item.dependency(state.extra));const b=make('button','tv313-switch');b.type='button';b.disabled=!enabled;b.setAttribute('role','switch');b.setAttribute('aria-label',item.name);b.setAttribute('aria-checked',String(on));b.append(make('span','tv313-switch-track'),make('span','',on?'On':'Off'));b.onclick=()=>change(!on);control.append(b)}
          row.append(control);group.append(row);
        }
        extras.append(group);
      }
      const core=make('p','tv-campaign-editor-intro','Core feats, training, languages, inventory and basic D&D mechanics are not optional modules. Preview choices are not applied to characters.');extras.append(core);
    };
    // The category content lives inside the shared settings workspace.
    if(editable){
      const reset=make('button','btn ghost small','Reset preview');reset.type='button';reset.onclick=()=>{state.editions=defaults(state.ruleset);state.override=state.ruleset==='custom';state.extra=initialExtras(state.ruleset);state.codexSpells=false;dirty=true;update()};actions.prepend(reset);
      const bottom=make('div','tv312-preview-footer');bottom.append(make('strong','','Unsaved preview'),make('small','','All six sections are included. No settings are applied or persisted.' ));panel.append(bottom);
    }
    update();
    if(isDemo(campaign.id)){state.ruleset='tv5e';state.extra=initialExtras('tv5e');state.editions=defaults('tv5e');update();status.textContent='Shared demo · read only';return}
    try{
      const {data,error}=await client().from('terravale_campaign_spell_policy').select('ruleset,override_catalogues,editions,revision').eq('campaign_id',campaign.id).maybeSingle();
      if(!panel.isConnected||dirty)return;
      if(error)throw error;
      if(data&&labels[data.ruleset]&&Array.isArray(data.editions)){state.ruleset=data.ruleset;state.extra=initialExtras(data.ruleset);state.override=data.override_catalogues===true;state.editions=data.editions.filter(x=>['2014','2024'].includes(x));revision=data.revision}
      loaded=true;update();status.textContent=editable?'Preview only · server saving is not enabled yet.':data?'Current campaign rules · managed by your DM.':'Your DM has not configured the campaign rules yet.';
    }catch(e){if(panel.isConnected&&!dirty)status.textContent=editable?'Preview mode · try any setting; saving is not connected.':'Campaign rules are not available on this server yet.'}
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

  // Dedicated Tv5e reference, opened from the native dashboard.
  const tvGuideSections=[
    ['start','Getting started','What is Tv5e?',[
      ['A familiar foundation','Tv5e is Terravale’s tabletop ruleset. It builds on the original 2014 fifth edition, incorporates selected 2024 revisions and adds original mechanics for the setting. It is not simply the 2024 rules with a different name.'],
      ['The basic loop','Describe what your character wants to do. The Dungeon Master decides whether a roll is needed, resolves the outcome and describes what happens next. A d20 check generally adds the relevant ability modifier and proficiency when applicable.'],
      ['Your campaign comes first','Ask your DM which ruleset, content and optional systems are in use. The campaign Rules tab is intended to centralize these choices; its current preview does not apply settings.']]],
    ['creation','Character creation','Build your adventurer',[
      ['Ancestry and class','Ancestry describes your character’s people and inherited traits. Class describes their training, abilities and progression. Some Terravale classes have ancestry restrictions. Check the relevant class and ancestry entries before choosing.'],
      ['Backstory benefits','Tv5e replaces standard backgrounds with benefits agreed with the DM based on your character’s history. Discuss training, languages and other appropriate benefits rather than assuming a fixed package.'],
      ['Ability scores and feats','The six ability scores describe physical and mental strengths. Feats grant additional abilities; class advancement and ancestry-specific feats have their own eligibility rules. Multiclassing is normally disabled in Tv5e.'],
      ['Approval and progression','Submit your character for DM approval. When advancing, use your class’s level progression and resolve HP, features and choices with your DM. Automated level-up and spell selection are still being developed.']]],
    ['play','Playing the game','Checks, combat and recovery',[
      ['Checks and saves','Ability checks resolve uncertain actions; saving throws resist danger or other effects. Advantage generally means rolling two d20s and using the higher result; disadvantage uses the lower.'],
      ['Combat','Initiative determines turn order. Movement, actions, bonus actions and reactions follow the relevant rules. Terravale expands grappling and conditions; use the specific rule or DM ruling when an effect changes normal combat.'],
      ['Health and resources','Hit points track your ability to withstand harm. Class abilities, item charges and other resources may recover on a short rest, long rest or another specified trigger. Do not assume that every resource resets at the same time.'],
      ['Inspiration','Standard inspiration is disabled by default in Tv5e. The DM can still reward creative play through the campaign’s agreed rules.']]],
    ['magic','Magic & spellcasting','How magic works at the table',[
      ['Spell slots','The familiar spellcasting system spends a slot of the appropriate level. Cantrips normally cost no slot. Spell descriptions determine casting time, range, components, duration and concentration.'],
      ['Learning and preparing','Known casters learn a limited selection; prepared casters choose from eligible spells according to their class. A Wizard uses a spellbook. Different class features can grant additional spells. Check your class rather than assuming all spellcasters work alike.'],
      ['Spell points — in development','A shared pool of points replaces ordinary spell slots in the proposed alternative. The DMG-style and Tv5e variants are being developed. Pact Magic and separate class resources are not automatically converted.'],
      ['Arcane Strain — in development','The proposed Tv5e system allows some casters to attempt overcasting when short of points, risking strain and a stability check. Increasing strain can impair casting. This is not yet an active campaign-wide rule.']]],
    ['world','Terravale mechanics','What makes the system different',[
      ['Divine favour and boons','Gods and patrons can grant blessings, abilities, resources and consequences. The DM determines access and awards; a boon is not automatically available simply because it appears in the Codex.'],
      ['Tools, languages and training','Proficiencies describe learned skills and training. Terravale includes setting-specific tools and languages; use the character sheet and DM-approved training options.'],
      ['Currency and equipment','Terravale supports regional currencies, denominations, item charges and equipment properties. Ask the DM which economy applies to your campaign; do not assume every coin has a universal exchange value.'],
      ['Original classes and ancestries','Some options use unique systems such as Gatewarden defenses or Bloodforger exertion. Their own class and ancestry descriptions take precedence over general examples.']]],
    ['platform','Using the Codex','Where to find everything',[
      ['Characters','Create and inspect your adventurer, manage inventory, resources, conditions and spell references. Your approved character and DM permissions determine what you can edit.'],
      ['Session Room','Use the shared play tools for rolls, checks, combat and character actions. The DM manages the table and authorized changes.'],
      ['Library & Notes','Browse classes, ancestries, feats, spells and lore. Save useful references and keep private or party journal entries. A reference entry does not automatically grant an ability.'],
      ['Campaign Rules and DM Chronicle','Campaign Rules is the intended home for mechanical settings; configuration is currently preview-only. The DM Chronicle provides existing tools for approvals, items, divine awards and other campaign management.']]]
  ];
  // Additional handbook chapters and worked examples. Proposed mechanics never
  // become authoritative merely by appearing in this reference.
  tvGuideSections.push(
    ['differences','Tv5e at a glance','What changes from ordinary fifth edition?',[
      ['Rules foundation','Tv5e uses the 2014 rules as its foundation with selected 2024 revisions. Do not assume every revised rule automatically applies. The campaign’s agreed rules and specific Terravale features determine the result.'],
      ['Character origins','Standard backgrounds are replaced by DM-agreed backstory benefits. Ancestry-specific feats are handled separately from class advancement feats. Some ancestry and class combinations are restricted.'],
      ['Progression','Multiclassing and standard inspiration are disabled by default. Characters progress within their chosen class. Original class resources and features follow their own descriptions.'],
      ['Combat and magic','Expanded grappling and additional conditions are Terravale systems. A universal change to how many spells can be cast per turn is not finalized. Do not treat the proposed spell point system as active by default.'],
      ['Optional systems','Divine favour, regional currencies and additional conditions have dedicated tools. Campaign-wide switches are still previews; ask your DM which systems apply.']]],
    ['examples','Worked examples','Learn through play',[
      ['Making an ability check','Example: you try to force open a stuck door. Your DM asks for a Strength check with difficulty 13. You roll 11 and add a Strength modifier of +3, reaching 14. You succeed. Add proficiency only when the relevant proficiency applies.'],
      ['Attacking a target','Example: a weapon attack uses a +3 ability modifier and +2 proficiency. A roll of 12 gives a total of 17. Against AC 15, the attack hits; then roll the weapon’s damage according to its rules.'],
      ['Advantage and disadvantage','Example: with advantage you roll 6 and 15, then use 15 before adding modifiers. With disadvantage you use 6. These are not extra damage dice.'],
      ['Spending resources','Example: your ability has three uses and says it recovers on a short rest. After using it twice you have one left. Only recover it when the specified trigger occurs. A different ability may need a long rest.'],
      ['Choosing a spell','Example: your class allows you to learn a new first-level spell. Check its class list, the permitted edition and the spell’s requirements. A spell in the public reference library is not automatically available to your character.'],
      ['Overcasting — proposed example','Under the proposed Tv5e points model, a first-level spell costs 2 points. If you have 1 point, the deficit is 1 and would add 1 strain. A stability check determines whether the spell succeeds. This is a design example, not an active campaign rule.']]],
    ['reference','Quick reference','Common terms and formulas',[
      ['Ability modifier','Floor((ability score − 10) ÷ 2). Example: Strength 16 gives +3. Strength 9 gives −1.'],
      ['Proficiency bonus (PB)','A bonus based on character level. Add it when a rule says you are proficient; do not add it twice unless a specific feature changes that rule.'],
      ['Difficulty Class (DC)','The target number for a check or saving throw. Meeting or exceeding the DC normally succeeds.'],
      ['Armour Class (AC)','The target number an attack roll normally needs to meet or exceed to hit.'],
      ['HP and temporary HP','Hit points measure remaining health. Temporary hit points are a separate buffer and do not normally stack. Follow the effect that grants them.'],
      ['Action economy','The set of actions, bonus actions, movement and reactions available under the applicable combat rules. A feature must authorize a bonus action or reaction.'],
      ['Concentration','Some spells require ongoing concentration. You normally maintain only one concentration spell at a time; damage or other effects may end it.'],
      ['Known, prepared and granted spells','Known spells are learned choices; prepared spells are available selections under a class’s preparation rules; granted spells come from a feature or other source. These are distinct categories.'],
      ['Rest and recovery','A short or long rest restores only what the applicable rule specifies. Some resources recover on different schedules or need DM authorization.']]],
    ['roadmap','Rules in development','What is established, and what is coming?',[
      ['Established Tv5e decisions','2014-based hybrid rules, no standard backgrounds, no multiclassing, no standard inspiration, ancestry-specific options, and expanded combat conditions. Exact class and ancestry mechanics belong in their respective entries.'],
      ['Available tools','The live Codex includes class references, character resources, training, divine awards, currencies, spell references and Session Room tools. Availability depends on permissions and character data.'],
      ['Campaign Rules preview','The campaign settings interface currently lets DMs experiment with presets and toggles. Saving and mechanical enforcement are not yet connected.'],
      ['Spellcasting under development','Spell point conversion, Arcane Strain, overcasting and server-validated spell selection are being developed. Wordcasting and alternate casting-time systems are not part of this release.'],
      ['Content still being refined','The Terravale Artificer is being reworked. Class-specific spellcasting, exact grapple rules and other detailed mechanics should be taken from their approved sources rather than inferred from this introductory guide.']]]
  );
  let tvGuideOpen=false,tvGuideCategory='start';
  function mountTvGuide(root){
    if(!root)return;
    if(tvGuideOpen){
      if(root.querySelector('#tv314-guide'))return;
      const wrap=document.createElement('section');wrap.id='tv314-guide';wrap.className='tv314-guide';
      const make=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!=null)el.textContent=value;return el};
      const back=make('button','btn ghost small','‹ Dashboard');back.type='button';back.onclick=()=>{tvGuideOpen=false;renderPage(false)};
      const hero=make('header','tv314-guide-hero');hero.append(make('div','v2-overline','THE LIVING CODEX · SYSTEM REFERENCE'),make('h1','','The Tv5e Handbook'),make('p','','Learn how Terravale’s rules work, from creating your first character to exploring its original mechanics.'),back);
      const layout=make('div','tv313-workspace'),nav=make('nav','tv313-navigation'),main=make('article','tv313-main');nav.setAttribute('aria-label','Handbook chapters');layout.append(nav,main);wrap.append(hero,layout);
      const search=make('input','tv315-guide-search');search.type='search';search.placeholder='Search the handbook…';search.setAttribute('aria-label','Search handbook');
      const searchWrap=make('div','tv315-guide-search-wrap');searchWrap.append(search);hero.append(searchWrap);
      const quick=make('div','tv315-guide-links');
      for(const [label,id] of [['New player','start'],['What’s different?','differences'],['Worked examples','examples'],['Glossary','reference']]){
        const b=make('button','btn ghost small',label);b.type='button';b.onclick=()=>{search.value='';tvGuideCategory=id;draw()};quick.append(b)
      }
      hero.append(quick);
      search.addEventListener('input',draw);
      function draw(){
        nav.replaceChildren();main.replaceChildren();
        for(const [id,name] of tvGuideSections){const b=make('button','tv313-nav-button',name);b.type='button';b.setAttribute('aria-current',id===tvGuideCategory?'page':'false');b.onclick=()=>{search.value='';tvGuideCategory=id;draw()};nav.append(b)}
        const query=search.value.trim().toLowerCase();
        if(query){
          const matches=tvGuideSections.flatMap(ch=>ch[3].filter(([t,d])=>(ch[1]+' '+t+' '+d).toLowerCase().includes(query)).map(([t,d])=>({id:ch[0],chapter:ch[1],t,d})));
          main.append(make('h2','','Search results'),make('p','tv314-guide-note',matches.length+' matching entries'));
          for(const m of matches){const result=make('section','tv314-guide-section');const b=make('button','tv315-search-result',m.t);b.type='button';b.onclick=()=>{search.value='';tvGuideCategory=m.id;draw()};result.append(make('div','v2-overline',m.chapter),b,make('p','',m.d));main.append(result)}
          if(!matches.length)main.append(make('p','','No matching entries. Try a term such as spell, ancestry, rest or proficiency.'));
          return;
        }
        const chapter=tvGuideSections.find(x=>x[0]===tvGuideCategory)||tvGuideSections[0];main.append(make('div','v2-overline','TV5E · '+chapter[1].toUpperCase()),make('h2','',chapter[2]));
        for(const [title,description] of chapter[3]){const section=make('section','tv314-guide-section');section.append(make('h3','',title),make('p','',description));main.append(section)}
        const note=make('p','tv314-guide-note','Reference guide · This overview does not replace detailed class rules, spell descriptions or your DM’s rulings. Planned systems are marked explicitly.');main.append(note);
        const index=tvGuideSections.indexOf(chapter),pager=make('div','tv315-guide-pager');
        for(const [offset,prefix] of [[-1,'‹ '],[1,'Next: ']]){const next=tvGuideSections[index+offset];if(!next)continue;const b=make('button','btn ghost small',prefix+next[1]);b.type='button';b.onclick=()=>{tvGuideCategory=next[0];draw();wrap.scrollIntoView({block:'start'})};pager.append(b)}
        main.append(pager);
      }
      // Keep the native dashboard intact while displaying the dedicated reading view.
      for(const child of [...root.children]){child.dataset.tv314Hidden=String(child.hidden);child.hidden=true}
      root.append(wrap);draw();return;
    }
    for(const child of root.querySelectorAll('[data-tv314-hidden]')){child.hidden=child.dataset.tv314Hidden==='true';delete child.dataset.tv314Hidden}
    root.querySelector('#tv314-guide')?.remove();
    if(root.querySelector('[data-tv314-entry]'))return;
    const heading=[...root.querySelectorAll('h2,h3,h4')].find(x=>x.textContent.trim()==='Recently explored');
    if(!heading)return;
    const card=heading.closest('section,article')||heading.parentElement?.parentElement;
    if(!card||!root.contains(card))return;
    // Temporarily clear the former Recently explored / handbook dashboard area.
    // Keep the handbook source available for a future dedicated reference.
    card.dataset.tv314Entry='true';
    card.hidden=true;
    card.style.setProperty('display','none','important');
    return;
    const eyebrow=card.querySelector('.v2-overline');if(eyebrow)eyebrow.textContent='LEARN THE SYSTEM';
    heading.textContent='The Tv5e Handbook';
    const links=[...card.querySelectorAll('a,button')];const link=links.find(x=>/view journal/i.test(x.textContent));
    if(link){const b=document.createElement('button');b.type='button';b.className=link.className;b.textContent='Read handbook ›';b.onclick=()=>{tvGuideOpen=true;mountTvGuide(root);window.scrollTo(0,0)};link.replaceWith(b)}
    else{const b=document.createElement('button');b.type='button';b.className='btn ghost small';b.textContent='Read handbook ›';b.onclick=()=>{tvGuideOpen=true;mountTvGuide(root)};card.append(b)}
    const p=card.querySelector('p');if(p)p.textContent='New to Terravale? Discover character creation, combat, magic and the rules that make Tv5e unique.';
  }

  // Adjust the existing dashboard link rather than rendering a fake second dashboard.
  function decoratePage(){
    const path=route();
    if(path==='/')mountTvGuide(document.getElementById('pageRoot'));else tvGuideOpen=false;
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
