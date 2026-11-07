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
 const owned=ch=>!!ch && ch.owner==='You' && ch.ownerUid===current()?.profile?.discord_uid;
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
     ownerName:mine?current().profile.discord_username:(c.ownerName||'Party member'),
     hp:row.character_state?.hp??c.hp,
     bloodState:row.character_state?.blood_state??c.bloodState??0,
     inventory:row.character_state?.inventory??c.inventory??[]};
 }
 async function createCharacter(ch){
   if(!current()?.ready||!bridge.canCreate(ch?.campaign))return {error:'Campaign membership required'};
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
      .select('id,campaign_id,owner_id,name,status,approved_build,character_state(hp,blood_state,inventory)')
      .order('created_at',{ascending:true}).limit(300);
     if(error)throw error;
     const inCampaign=new Set(db.campaigns.map(c=>c.id));
     const characters=(data||[]).filter(c=>inCampaign.has(c.campaign_id)).map(formatRemote);
     const local=db.characters.filter(c=>owned(c)&&inCampaign.has(c.campaign)&&!uuid.test(c.id)
       &&Number(c.level||1)===1&&c.name&&c.className&&c.ancestry&&!String(c.id).startsWith('showcase-'));
     const knownNames=new Set(characters.filter(owned).map(c=>c.campaign+'|'+c.name.trim().toLowerCase()));
     for(const ghost of local){
       if(knownNames.has(ghost.campaign+'|'+ghost.name.trim().toLowerCase()))continue;
       const response=await createCharacter(ghost);
       if(response.id){
         const copy={...ghost,id:response.id,status:response.status};
         characters.push(copy);knownNames.add(ghost.campaign+'|'+ghost.name.trim().toLowerCase());
       }else{
         console.warn('Local sheet retained; cloud import unavailable:',response.error);
         characters.push({...ghost,remoteError:response.error});
       }
     }
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
      const {error}=await client().rpc('terravale_save_character_sheet',{target_character:c.id,sheet:c});
      if(error){console.warn('Unable to save character',c.name,error.message);continue;}
      lastRemote.set(c.id,raw);
      const blood=Number(c.bloodState??0);
      if((blood<=-40||blood>=40)&&c.ancestry==='Crimsonborn'){
        const unlocked=await refreshUnlocks();
        if(unlocked.includes('seeing_red')&&db.theme!=='crimson'&&!document.body.dataset.tvCrimsonSeen){
          document.body.dataset.tvCrimsonSeen='1';
          setTheme('crimson');
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
   return keys;
 }
 let verdantTimer=null;
 function themeWatcher(){
   const active=document.body.dataset.theme==='verdant';
   let vines=document.getElementById('tv-growing-vines');
   if(active&&!vines){vines=document.createElement('div');vines.id='tv-growing-vines';vines.setAttribute('aria-hidden','true');document.body.append(vines)}
   if(vines)vines.hidden=!active;
   clearTimeout(verdantTimer);
   if(active&&current()?.ready&&!window.matchMedia('(prefers-reduced-motion:reduce)').matches){
     verdantTimer=setTimeout(async()=>{
       if(document.body.dataset.theme!=='verdant'||document.hidden)return;
       const {data,error}=await client().rpc('terravale_unlock_verdant_growth');
       if(!error&&data?.unlocked){
         await refreshUnlocks();
         window.dispatchEvent(new CustomEvent('terravale-achievement-unlocked',{detail:{key:'roots_in_margins'}}));
         if(data.new)toast('Curiosity discovered · Roots in the Margins');
       }
     },11000);
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
