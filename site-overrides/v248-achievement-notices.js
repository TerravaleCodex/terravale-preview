/* V2.48 — all-player active achievement progress generation and accessible
   bottom-right completion notices. Permanent server unlocks are immutable. */
(function(){
 "use strict";
 const auth=()=>window.TerravaleVerifiedAccount;
 const account=()=>auth()?.state;
 const sb=()=>auth()?.supabase;
 const BASE="tv-achievement-progress-generation:";
 const known=new Set();
 let seeded=false,serverSeeded=false,syncing=false,revisionLoaded=false;
 const notices=new Set();
 function titleFor(key){
   const rec=window.TERRAVALE_DATA?.achievements?.find(x=>x.id===key);
   const presets={
    adblocknt:{title:"Adblockn’t",description:"25 Terravale advertisements dismissed.",rarity:"epic"},
    roots_in_margins:{title:"Roots in the Margins",description:"The Verdant Archive has taken root.",rarity:"rare"},
    seeing_red:{title:"Seeing Red",description:"Reached the critical extreme of the Crimsonborn Blood State.",rarity:"epic"},
    character_first:{title:"And So It Begins…",description:"Your first adventurer has been created.",rarity:"common"},
    character_approved:{title:"A Seat at the Table",description:"Your character was approved by the DM.",rarity:"uncommon"}
   };
   const preset=presets[key]||{};
   const normalized=key.replace(/[_:.-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
   return {title:preset.title||rec?.title||normalized,
      description:preset.description||rec?.description||"Another curiosity joins your Cabinet.",
      rarity:preset.rarity||rec?.rarity||"common"};
 }
 function noticeRoot(){
   let root=document.getElementById("tv-achievement-notifications");
   if(!root){
     root=document.createElement("div");root.id="tv-achievement-notifications";
     root.setAttribute("aria-label","Achievement notifications");
     root.setAttribute("role","region");
     document.body.append(root);
   }
   return root;
 }
 function show(key){
   if(notices.has(key))return;
   notices.add(key);
   const {title,description,rarity}=titleFor(key),root=noticeRoot();
   const box=document.createElement("article");
   box.className="tv-achievement-notice";
   box.dataset.rarity=rarity;
   box.setAttribute("role","status");
   const emblem=document.createElement("span");emblem.className="tv-achievement-emblem";
   emblem.textContent=rarity==="legendary"?"✦":rarity==="epic"?"✧":"✶";
   emblem.setAttribute("aria-hidden","true");
   const section=document.createElement("div");section.className="tv-achievement-content";
   const eyebrow=document.createElement("div");eyebrow.className="tv-achievement-eyebrow";
   eyebrow.textContent="Curiosity discovered · "+rarity;
   const h=document.createElement("h3");h.className="tv-achievement-title";h.textContent=title;
   const p=document.createElement("p");p.className="tv-achievement-desc";p.textContent=description;
   const link=document.createElement("button");link.type="button";
   link.className="tv-achievement-link";link.textContent="View in Cabinet ↗";
   link.addEventListener("click",()=>{location.hash="#/cabinet-of-curiosities";close()});
   section.append(eyebrow,h,p,link);
   const dismiss=document.createElement("button");dismiss.className="tv-achievement-close";
   dismiss.textContent="×";dismiss.type="button";dismiss.setAttribute("aria-label","Dismiss notification");
   box.append(emblem,section,dismiss);
   const close=()=>{
     box.classList.add("tv-exit");
     setTimeout(()=>{box.remove();notices.delete(key)},260);
   };
   dismiss.addEventListener("click",close);
   root.append(box);
   const count=root.querySelectorAll(".tv-achievement-notice");
   if(count.length>3)count[0].remove();
   setTimeout(()=>{if(box.isConnected)close()},9000);
 }
 function pulse(){
   const keys=Array.isArray(db?.unlocked)?db.unlocked:[];
   if(!seeded){keys.forEach(k=>known.add(k));seeded=true;return}
   for(const k of keys){
     if(typeof k!=="string"||known.has(k))continue;
     known.add(k);
     show(k);
   }
 }
 window.TerravaleAchievementNotify={pulse,show};
 window.addEventListener("terravale-achievement-unlocked",e=>{
   const key=e.detail?.key;
   if(typeof key!=="string"||!key)return;
   if(!seeded){pulse();return}
   if(known.has(key))return;
   known.add(key);
   show(key);
 });
 function readProgress(){
   const read=Array.isArray(db.read)?db.read:[];
   return {
     classes:read.filter(x=>x.startsWith("class:")).length,
     ancestries:read.filter(x=>x.startsWith("ancestry:")).length,
     reading:read.filter(x=>x.startsWith("class:")||x.startsWith("ancestry:")).length,
     blood:Array.isArray(db.testedDisciplines)?db.testedDisciplines.length:0,
     themes:Array.isArray(db.themesTried)?db.themesTried.length:0,
     journal:Array.isArray(db.notes)?db.notes.filter(n=>!String(n.updated||"").includes("Example")).length:0,
     ads:0
   };
 }
 async function syncGeneration(){
   const user=account()?.user;
   if(!user||revisionLoaded||!sb())return;
   const {data,error}=await sb().rpc("terravale_current_achievement_revision");
   if(error||!data||typeof data.revision!=="number"){
     console.warn("Achievement revision unavailable:",error?.message||"missing generation");
     return;
   }
   const key=BASE+user.id,value=String(data.revision);
   let last=null;try{last=localStorage.getItem(key)}catch{}
   if(last!==value){
     db.achievementProgressBaseline=readProgress();
     db.achievementProgressRevision=value;
     try{localStorage.setItem(key,value)}catch{}
     // Recompute on the next page render; never erase saved books or journals.
     if(typeof persist==="function")persist();
     if(typeof renderPage==="function")renderPage(false);
   }
   revisionLoaded=true;
 }
 async function syncServerUnlocks(){
   if(syncing||!account()?.user||!sb())return;
   syncing=true;
   try{
     const {data,error}=await sb().from("codex_achievement_unlocks")
       .select("achievement_key").eq("user_id",account().user.id);
     if(error)throw error;
     const keys=(data||[]).map(x=>x.achievement_key).filter(Boolean);
     let changed=false;
     for(const k of keys){
       if(!db.unlocked.includes(k)){db.unlocked.push(k);changed=true}
       if(!serverSeeded){known.add(k);continue}
       if(!known.has(k)){known.add(k);show(k)}
     }
     serverSeeded=true;
     if(changed){persist();window.dispatchEvent(new Event("terravale-achievement-synced"))}
     const ad=await sb().from("codex_ad_achievements")
       .select("closed_count,unlocked_at").eq("user_id",account().user.id).maybeSingle();
     if(!ad.error && ad.data){
       const count=ad.data.unlocked_at?25:Math.max(0,Number(ad.data.closed_count)||0);
       if(db.dismissedAds!==count){db.dismissedAds=count;persist()}
     }
   }catch(e){console.warn("Achievement sync failed:",e.message)}
   finally{syncing=false}
 }
 function ready(){
   if(!account()?.ready)return;
   pulse();
   syncGeneration().then(syncServerUnlocks);
 }
 if(account()?.ready)ready();
 else window.addEventListener("terravale-auth-ready",ready,{once:true});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncServerUnlocks()});
 setInterval(()=>{if(!document.hidden)syncServerUnlocks()},12000);
 window.addEventListener("hashchange",pulse);
})();
