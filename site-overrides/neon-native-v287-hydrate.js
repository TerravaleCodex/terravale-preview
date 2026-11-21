/* Staging only: load an independently owner/DM authorised Neon snapshot
   into the ACTUAL original V2.87 local character store and native renderer.
   This does not create a new sheet UI or a database client. */
(function(){
 "use strict";
 const tag="TV_NEON_NATIVE_V287";
 const originalOrigin=new URL(location.href).origin;
 const isRecord=x=>x&&typeof x==="object"&&!Array.isArray(x);
 const uuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 let loaded=false;
 function send(type,fields={}){window.parent.postMessage({type:tag+"_"+type,...fields},originalOrigin)}
 function load(snapshot){
   if(loaded)throw new TypeError("This isolated frame has already loaded a character");
   const source=snapshot?.sources,actor=snapshot?.character;
   if(snapshot?.schema!=="terravale.neon.v287.sheet.readonly.v1"||
      snapshot.read_only!==true||!uuid(snapshot.id)||!["owned","dm"].includes(snapshot.access)||
      !isRecord(source)||!isRecord(source.approved_build?.character)||
      !isRecord(source.character_state)||!Array.isArray(source.character_state.inventory)||
      !Array.isArray(source.character_state.resources)||!isRecord(actor)||
      actor.id!==snapshot.id||typeof db==="undefined"||
      typeof renderPage!=="function"||typeof navigate!=="function")
     throw new TypeError("Original native V2.87 sources or renderer are unavailable");
   const approved=source.approved_build.character;
   const state=source.character_state;
   const id=snapshot.id;
   const campaignId=actor.campaign_id;
   if(!uuid(campaignId))throw new TypeError("Migrated character lacks an original campaign identifier");
   const ch={
     ...approved,id,name:actor.name??approved.name??"Adventurer",
     campaign:campaignId,level:Number(source.approved_build.level??approved.level)||1,
     className:source.approved_build.class??approved.className,
     ancestry:source.approved_build.ancestry??approved.ancestry,
     status:actor.status==="approved"?"Approved":"Pending",
     owner:snapshot.access==="owned"?"You":"Party member",
     hp:state.hp,tempHp:state.temp_hp,bloodState:state.blood_state,
     inventory:state.inventory,
     sheetV220:approved.sheetV220,
     dmItemProperties:Object.fromEntries((source.item_properties||[])
       .filter(x=>x?.item_id&&isRecord(x.properties))
       .map(x=>[x.item_id,x.properties]))
   };
   // V2.54's original mount is invoked after each native tab repaint, because
   // the older native page replaces its content root and invalidates old DOM
   // observers. Do not reconstruct a wallet or training UI.
   document.addEventListener("click",event=>{
     if(!event.target?.closest?.("#pageRoot .sheet20-tabs [data-value]"))return;
     setTimeout(()=>window.TerravaleNeonNativeMountV254?.(),125);
   },true);
   // Prefetch only already-granted custom feats for the original native
   // Features tab; no extra network read or custom HTML renderer.
   Promise.resolve(window.TerravaleV258Feats?.refresh?.(id,campaignId,true)).catch(()=>{});
   // The original V2.87 sheet reads db.characters and renders #pageRoot. The
   // approved build is never edited; this is an in-memory clone in a sandbox.
   db.campaigns=[{id:campaignId,name:typeof actor.campaign==="string"?actor.campaign:"Migrated campaign",role:snapshot.access==="dm"?"dm":"player",status:"Ongoing"}];
   db.characters=[ch];db.campaign=campaignId;db.mode="sample";
   db.role=snapshot.access==="dm"?"dm":"player";
   // Existing native V2.87 training, feat and wallet modules call the
   // Supabase-shaped reader. This one is entirely in-memory, source-scoped,
   // has no JWT and rejects every RPC/write. Never add a real DB client here.
   if(typeof window.TerravaleNeonV287ReadOnlyClient?.create!=="function")
     throw new TypeError("Native source reader not installed");
   window.TerravaleVerifiedAccount=window.TerravaleNeonV287ReadOnlyClient.create(snapshot);
   // The live V2.87 campaign-access gate reads this runtime bridge.
   // The isolated frame is NOT signed into Supabase and must only recognise
   // the single verified Neon campaign from its approved snapshot.
   const originalBridge=window.TerravaleV2Bridge||{};
   window.TerravaleV2Bridge=Object.freeze({
     ...originalBridge,
     hasCampaign:value=>String(value)===campaignId,
     isDemo:()=>false,
     canCreate:()=>false,
     createCharacter:async()=>({error:"Neon read-only preview"}),
     joinCampaign:async()=>({error:"Neon read-only preview"}),
     createCampaign:async()=>({error:"Neon read-only preview"}),
     syncCampaigns:async()=>{}
   });
   if(!isRecord(db.featuredCharacters))db.featuredCharacters={};
   db.featuredCharacters[campaignId]=id;
   loaded=true;
   send("PHASE",{phase:"store-hydrated"});
   navigate("/characters/"+id);
   send("PHASE",{phase:"navigated"});
   renderPage(false);
   // Mount native panels directly from the existing V2.54 renderer. No
   // synthetic cloud-sync event is necessary (it would clear feat caches).
   window.TerravaleNeonNativeMountV254?.();
   send("PHASE",{phase:"rendered"});
   const page=document.querySelector("#pageRoot");
   if(!page)throw new TypeError("Native V2.87 character page did not mount");
   const firstCheck=()=>{const sheet=document.querySelector("#pageRoot .sheet20");
     const root=document.querySelector("#pageRoot");
     send("DIAGNOSTIC",{pageRoot:!!root,sheetCount:document.querySelectorAll(".sheet20").length,
       rootHasName:!!root?.textContent.includes(String(ch.name)),
       nativeRoute:typeof route==="function"&&String(route()).startsWith("/characters/")});
     return !!sheet&&sheet.textContent.includes(String(ch.name));};
   async function auditNativePanels(){
     // Synthetic CI only. Use the actual old V2 tabs and real native readers;
     // never relay character names, feat text, wallet values or identities.
     const listTabs=()=>[...document.querySelectorAll("#pageRoot .sheet20-tabs [data-value]")];
     const values=listTabs().map(x=>x.dataset.value);
     const view=async value=>{
       // Every native sheetTab action may replace the entire tab DOM.
       const el=listTabs().find(x=>x.dataset.value===value);
       if(!el)return false;
       el.click();await new Promise(r=>setTimeout(r,700));return true;
     };
     await view("abilities");
     const trainEl=document.querySelector("#tv254-sheet-proficiencies");
     const training=!!trainEl?.textContent.includes("smith");
     const trainingMounted=!!trainEl;
     const trainingReady=!!trainEl&&!trainEl.textContent.includes("Loading");
     const abilitySelected=!!document.querySelector('#pageRoot .sheet20-tabs [data-value="abilities"][aria-selected="true"]');
     await view("features");
     const featEl=document.querySelector(".sheet227-reader");
     const feats=!!featEl?.textContent.includes("Audit Feat");
     const featMounted=!!featEl;
     const featuresSelected=!!document.querySelector('#pageRoot .sheet20-tabs [data-value="features"][aria-selected="true"]');
     const inventoryTab=values.find(x=>["inventory","equipment","backpack"].includes(x));
     if(inventoryTab)await view(inventoryTab);
     const walletEl=document.querySelector("#tv254-sheet-wallet");
     const wallet=!!walletEl?.textContent.includes("Coin");
     send("PANEL_AUDIT",{training,feats,wallet,trainingMounted,trainingReady,
       abilitySelected,featMounted,featuresSelected,walletMounted:!!walletEl,
       nativeReadReady:!!window.TerravaleVerifiedAccount?.state?.ready,
       hasRules:!!window.TerravaleRulesV4,
       hasV255Training:!!window.TerravaleV255Training?.renderSheet,
       hasV258FeatReader:!!window.TerravaleV258Feats?.getEntries,
       currentFeats:window.TerravaleV258Feats?.getEntries?.(id,campaignId)?.length??null,
       backpackZone:!!document.querySelector("#pageRoot .sheet20-content .sheet21-backpack-zone"),
       nativeContent:!!document.querySelector("#pageRoot .sheet20-content"),
       hasAbilities:values.includes("abilities"),
       hasFeatures:values.includes("features"),
       hasInventory:!!inventoryTab});
   }
   setTimeout(()=>{
     if(firstCheck()){
       send("LOADED",{id,nativeSheet:true});
       if(new URLSearchParams(location.search).has("audit-native-panels"))
         auditNativePanels().catch(()=>send("PANEL_AUDIT",{training:false,feats:false,wallet:false,error:true}));
     }else send("ERROR",{id,reason:"Original V2.87 sheet did not render"});
   },180);
 }
 window.addEventListener("message",event=>{
   if(event.source!==window.parent||event.data?.type!==tag+"_LOAD")return;
   send("HANDSHAKE",{originMatched:event.origin===originalOrigin});
   if(event.origin!==originalOrigin)return;
   try{load(event.data.snapshot)}catch(err){send("ERROR",{reason:String(err?.message||"Native sheet unavailable").slice(0,130)})}
 });
 function ready(){send("READY")}
 if(document.readyState==="complete")ready();
 else window.addEventListener("load",ready,{once:true});
})();