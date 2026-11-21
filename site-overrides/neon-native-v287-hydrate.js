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
   // The original V2.87 sheet reads db.characters and renders #pageRoot. The
   // approved build is never edited; this is an in-memory clone in a sandbox.
   db.campaigns=[{id:campaignId,name:typeof actor.campaign==="string"?actor.campaign:"Migrated campaign",role:snapshot.access==="dm"?"dm":"player",status:"Ongoing"}];
   db.characters=[ch];db.campaign=campaignId;db.mode="sample";
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
   send("PHASE",{phase:"rendered"});
   const page=document.querySelector("#pageRoot");
   if(!page)throw new TypeError("Native V2.87 character page did not mount");
   const firstCheck=()=>{const sheet=document.querySelector("#pageRoot .sheet20");
     const root=document.querySelector("#pageRoot");
     send("DIAGNOSTIC",{pageRoot:!!root,sheetCount:document.querySelectorAll(".sheet20").length,
       rootHasName:!!root?.textContent.includes(String(ch.name)),
       nativeRoute:typeof route==="function"&&String(route()).startsWith("/characters/")});
     return !!sheet&&sheet.textContent.includes(String(ch.name));};
   setTimeout(()=>{if(firstCheck())send("LOADED",{id,nativeSheet:true});
     else send("ERROR",{id,reason:"Original V2.87 sheet did not render"})},180);
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