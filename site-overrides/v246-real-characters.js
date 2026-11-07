/* V2.46: real account-owned characters and approved gallery achievements.
   The original character sheet renderer is retained. Character rows are authoritative
   in Supabase; browser state is only a last-mile rendering cache. */
(function(){
 'use strict';
 const bridge=window.TerravaleV2Bridge;
 if(!bridge)return;
 let loaded=false, syncing=false, lastRemote=new Map(), saving=false, tick=null, status={};
 const auth=()=>window.TerravaleVerifiedAccount;
 const current=()=>auth()?.state;
 const client=()=>auth()?.supabase;
 const owned=ch=>!!ch && ch.owner==='You' && (ch.ownerUid===current()?.profile?.discord_uid || (!ch.ownerUid&&!uuid.test(ch.id)));
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const capture=ch=>JSON.stringify(Object.fromEntries(Object.entries(ch||{}).filter(([key])=>!['status','ownerName','ownerUid','owner','remoteStatus'].includes(key))));
 function formatRemote(row){
   const c=row.approved_build?.character||{};
   const mine=row.owner_id===current()?.user?.id;
   return {...c,id:row.id,name:row.name,campaign:row.campaign_id,
     level:Number(row.approved_build?.level)||Number(c.level)||1,
     ancestry:row.approved_build?.ancestry||c.ancestry,
     className:row.approved_build?.class||c.className,
     status:row.status==='approved'?'Approved':'Pending',
     owner:mine?'You':'Party member',
     ownerUid:mine?current().profile.discord_uid:(c.ownerUid||''),
     ownerName:mine?current().profile.discord_username:'Adventurer',
     sheetVisibleToParty:Boolean(row.sheet_visible_to_party),
     hp:row.character_state?.hp??c.hp,
     bloodState:row.character_state?.blood_state??c.bloodState??0,
     inventory:row.character_state?.inventory??c.inventory??[],
     dmItemProperties:Object.fromEntries((row.character_item_properties||[])
       .filter(x=>x?.item_id&&x?.properties&&typeof x.properties==='object')
       .map(x=>[x.item_id,x.properties]))};
 }
 async function createCharacter(ch){
   if(!current()?.ready||!bridge.hasCampaign(ch?.campaign))return {error:'Campaign membership required'};
   const {data,error}=await client().rpc('terravale_create_character',
       {target_campaign:ch.campaign,sheet:ch});
   if(error)return {error:error.message};
   return {id:data.id,status:data.status==='approved'?'Approved':'Pending',isDemo:Boolean(data.is_demo)};
 }
 async function syncCharacters(){
   if(!current()?.ready||syncing)return;
   syncing=true;
   try{
     const {data,error}=await client().from('characters')
      .select('id,campaign_id,owner_id,name,status,sheet_visible_to_party,approved_build,character_state(hp,blood_state,inventory),character_item_properties(item_id,properties)')
      .order('created_at',{ascending:true}).limit(300);
     if(error)throw error;
     const inCampaign=new Set(db.campaigns.map(c=>c.id));
     const characters=(data||[]).filter(c=>inCampaign.has(c.campaign_id)).map(formatRemote);
     const verified=await client().rpc('terravale_character_owner_labels');
     if(!verified.error){
       const names=new Map((Array.isArray(verified.data)?verified.data:[]).map(x=>[x.character_id,x]));
       for(const ch of characters){
         const owner=names.get(ch.id);
         if(owner){ch.ownerName=owner.discord_username;ch.ownerTvUID=owner.tvuid}
       }
     }
     // Curated demo characters have no forged Discord account. Their owner
     // byline comes from a protected server-side demo curator record.
     const curator=await client().rpc('terravale_demo_curator_labels');
     if(!curator.error){
       const credited=new Map((Array.isArray(curator.data)?curator.data:[]).map(x=>[x.character_id,x]));
       for(const ch of characters){
         const credit=credited.get(ch.id);
         if(credit){
           ch.ownerName=credit.display_player;
           ch.owner='Demo Party';
           ch.demoCurator=credit.display_player;
           ch.demoTemplateSlot=credit.template_slot;
           ch.ownerUid='';
           ch.ownerTvUID='';
         }
       }
     }
     const recoveryKey='tv-v246-local-drafts:'+current().user.id;
     let recovered=[];
     try{const saved=JSON.parse(localStorage.getItem(recoveryKey)||'[]');if(Array.isArray(saved))recovered=saved;}
     catch(e){console.warn('Cannot read saved draft recovery cache',e)}
     const local=[...db.characters,...recovered].filter(c=>owned(c)&&inCampaign.has(c.campaign)&&!uuid.test(c.id)
       &&Number(c.level||1)===1&&c.name&&c.className&&c.ancestry&&!String(c.id).startsWith('showcase-'));
     const failures=[];
     const knownNames=new Set(characters.filter(owned).map(c=>c.campaign+'|'+c.name.trim().toLowerCase()));
     for(const ghost of local){
       if(knownNames.has(ghost.campaign+'|'+ghost.name.trim().toLowerCase()))continue;
       const response=await createCharacter(ghost);
       if(response.id){
         const copy={...ghost,id:response.id,status:response.status};
         characters.push(copy);knownNames.add(ghost.campaign+'|'+ghost.name.trim().toLowerCase());
       }else{
         console.warn('Local draft saved to recovery; online import unavailable:',response.error);
         failures.push({...ghost,remoteError:response.error});
       }
     }
     // Never present an unsaved local draft as a real campaign-owned character.
     // Retain it in a recoverable account-scoped cache, and retry on next sync.
     try{
       if(failures.length)localStorage.setItem(recoveryKey,JSON.stringify(failures));
       else localStorage.removeItem(recoveryKey);
     }catch(e){console.warn('Cannot persist character draft recovery cache',e)}
     if(failures.length)toast('Some previous local drafts could not be imported. They were preserved for recovery, not shown as saved characters.');
     db.characters=characters;
     for(const ch of characters)if(uuid.test(ch.id))lastRemote.set(ch.id,capture(ch));
     if(!db.featuredCharacters)db.featuredCharacters={};
     for(const c of db.campaigns){
       const featured=db.featuredCharacters[c.id];
       if(!characters.some(ch=>ch.id===featured&&ch.campaign===c.id)){
         db.featuredCharacters[c.id]=characters.find(ch=>ch.campaign===c.id&&owned(ch))?.id||'';
       }
     }
     loaded=true;
     persist();renderPage(false);
     window.dispatchEvent(new CustomEvent('terravale-characters-synced'));
   }catch(error){console.warn('Online character sync failed:',error);}
   finally{syncing=false}
 }
 async function saveChanges(){
   if(!loaded||syncing||saving||!current()?.ready)return;
   saving=true;
   try{
    for(const c of db.characters.filter(c=>owned(c)&&uuid.test(c.id)&&bridge.hasCampaign(c.campaign))){
      const raw=capture(c);
      if(lastRemote.get(c.id)===raw)continue;
      // Never send server-authoritative DM item mechanics through a player-owned sheet save.
      const {dmItemProperties,...playerSheet}=c;
      const {error}=await client().rpc('terravale_save_character_sheet',{target_character:c.id,sheet:playerSheet});
      if(error){console.warn('Unable to save character',c.name,error.message);continue;}
      lastRemote.set(c.id,raw);
      const blood=Number(c.bloodState??0);
      if((blood<=-40||blood>=40)&&c.ancestry==='Crimsonborn'){
        const unlocked=await refreshUnlocks();
        if(unlocked.includes('seeing_red')&&!document.body.dataset.tvSeeingRedNotified){
          document.body.dataset.tvSeeingRedNotified='1';
          window.dispatchEvent(new CustomEvent('terravale-achievement-unlocked',{detail:{key:'seeing_red'}}));
          toast('Seeing Red discovered · Crimson Court is ready to activate');
        }
      }
    }
   }finally{saving=false}
 }
 function onLocalPersist(){
   if(!loaded||syncing)return;
   clearTimeout(tick);tick=setTimeout(saveChanges,1300);
 }
 async function refreshUnlocks(){
   if(!current()?.ready)return [];
   const {data,error}=await client().from('codex_achievement_unlocks')
       .select('achievement_key').eq('user_id',current().user.id);
   if(error)return [];
   const keys=(data||[]).map(x=>x.achievement_key);
   for(const key of ['roots_in_margins','seeing_red']){
     db.unlocked=db.unlocked.filter(x=>x!==key);
     if(keys.includes(key))db.unlocked.push(key);
   }
   persist();
   if(location.hash.includes('/cabinet-of-curiosities'))renderPage(false);
   return keys;
 }
 let verdantTimer=null;
 function themeWatcher(){
   const active=document.body.dataset.theme==='verdant';
   let vines=document.getElementById('tv-growing-vines');
   if(active&&!vines){vines=document.createElement('div');vines.id='tv-growing-vines';vines.setAttribute('aria-hidden','true');document.body.append(vines)}
   if(vines)vines.hidden=!active;
   clearTimeout(verdantTimer);
   if(active&&current()?.ready){
     verdantTimer=setTimeout(async()=>{
       if(document.body.dataset.theme!=='verdant'||document.hidden)return;
       const {data,error}=await client().rpc('terravale_unlock_verdant_growth');
       if(!error&&data?.unlocked){
         await refreshUnlocks();
         window.dispatchEvent(new CustomEvent('terravale-achievement-unlocked',{detail:{key:'roots_in_margins'}}));
         if(data.new)toast('Curiosity discovered · Roots in the Margins');
       }
     },118000);
   }
 }
 const observer=new MutationObserver(records=>{
    if(records.some(x=>x.attributeName==='data-theme'))themeWatcher();
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['data-theme']});
 window.addEventListener('hashchange',()=>{if(loaded)setTimeout(()=>{if(route()==='/characters')renderPage(false)},30)});
 window.TerravaleV2Bridge={
   ...bridge,createCharacter,syncCharacters,refreshUnlocks,onLocalPersist,
   isSynced:()=>loaded
 };
 window.addEventListener('terravale-auth-ready',async()=>{
   await new Promise(r=>setTimeout(r,300));
   await bridge.syncCampaigns();
   await syncCharacters();
   await refreshUnlocks();
   themeWatcher();
 },{once:true});
 if(current()?.ready)(async()=>{await bridge.syncCampaigns();await syncCharacters();await refreshUnlocks();themeWatcher()})();
})();
