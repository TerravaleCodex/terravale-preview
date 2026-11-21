/* Neon-only native V2.87 read facade. NO network, JWT, credentials, storage,
   SQL client, write methods, cross-character reads or fabricated divine RPCs.
   Existing native V2.54/55 tabs use this snapshot-backed SELECT contract. */
(function(){
 "use strict";
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const record=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const failure=message=>({data:null,error:{message}});
 function create(snapshot){
   if(snapshot?.schema!=="terravale.neon.v287.sheet.readonly.v1"||
      snapshot.read_only!==true||!UUID.test(snapshot.id)||
      !UUID.test(snapshot.character?.campaign_id)||
      !["owned","dm"].includes(snapshot.access))throw new TypeError("Not an authorised Neon character snapshot");
   const src=snapshot.sources;
   if(!record(src)||!record(src.proficiencies)||!record(src.training)||
     !Array.isArray(src.wallet)||!Array.isArray(src.wallet_ledger)||
     !Array.isArray(src.bonus_requests)||!Array.isArray(src.custom_feats)||
     !Array.isArray(src.granted_boons)||!Array.isArray(src.canonical_awards)||
     !Array.isArray(src.divine_effects)||!Array.isArray(src.divine_previews)||
     !Array.isArray(src.divine_dispositions)||!record(src.divine_state)||
     !Array.isArray(src.divine_burdens)||!Array.isArray(src.divine_fractures)||
     !Array.isArray(src.divine_offers))
     throw new TypeError("Required saved V2.87 sources not available");
   const id=snapshot.id,campaign=snapshot.character.campaign_id;
   const safe=(table,rows)=>rows.map(x=>({...x,character_id:id,campaign_id:campaign}));
   const active=src.custom_feats.filter(x=>record(x)&&UUID.test(x.feat_id));
   const known=Object.freeze({
     terravale_character_proficiencies: safe("proficiencies",[{
       ...src.proficiencies,tools:src.proficiencies.tools||[],
       languages:src.proficiencies.languages||[],
       dm_bonus:src.proficiencies.dm_bonus||[],
       pending_languages:src.proficiencies.pending_languages||[]
     }]),
     terravale_character_training_overrides: safe("training",[{
       ...src.training,
       hidden_tools:src.training.hidden_tools||[],
       hidden_languages:src.training.hidden_languages||[],
       extra_tools:src.training.extra_tools||[],
       extra_languages:src.training.extra_languages||[],
       language_modes:src.training.language_modes||{}
     }]),
     terravale_proficiency_bonus_choices: safe("requests",src.bonus_requests),
     terravale_character_wallet: safe("wallet",src.wallet),
     terravale_wallet_ledger: safe("ledger",src.wallet_ledger),
     terravale_character_custom_feats: safe("grants",active.map(g=>({
       feat_id:g.feat_id,status:"active"
     }))),
     terravale_dm_custom_feats:active.map(g=>({
       id:g.feat_id,campaign_id:campaign,
       name:g.name,short_description:g.summary||"",
       prerequisites:g.prerequisites||"",rules_text:g.rules||"",
       action_type:g.action_type||"passive",
       uses_per_rest:g.uses_per_rest??0,recovery:g.recovery||"manual",
       rarity:g.rarity||"Custom"
     }))
   });
   function from(table){
     // Builders contain only snapshot-derived arrays and support SELECT syntax.
     // No insert/update/delete/upsert/upload or subscription methods exist.
     const allowed=Object.hasOwn(known,table);
     let fields=null,single=false,max=200,orders=[],filters=[],bad=false;
     const builder={
       select(spec){
         if(fields!==null||typeof spec!=="string"||
            !(spec==="*"||/^[a-z_]+(?:,[a-z_]+)*$/i.test(spec)))bad=true;
         else fields=spec==="*"?null:spec.split(",");
         // Distinguish missing select() from select('*')
         selected=true;return builder;
       },
       eq(col,value){
         if(!["character_id","campaign_id","status"].includes(col))bad=true;
         if(col==="character_id"&&value!==id)bad=true;
         if(col==="campaign_id"&&value!==campaign)bad=true;
         if(col==="status"&&value!=="active"&&value!=="pending")bad=true;
         filters.push([col,value]);return builder;
       },
       in(col,values){
         if(col!=="id"||!Array.isArray(values)||values.length>200||
            !values.every(x=>typeof x==="string"&&UUID.test(x)))bad=true;
         else filters.push(["in_ids",values]);
         return builder;
       },
       order(col,{ascending=true}={}){
         if(!["created_at","granted_at","name"].includes(col))bad=true;
         orders.push([col,ascending]);return builder;
       },
       limit(n){if(!Number.isInteger(n)||n<1||n>200)bad=true;else max=n;return builder},
       maybeSingle(){single=true;return execute()},
       then(resolve,reject){return execute().then(resolve,reject)}
     };
     let selected=false;
     async function execute(){
       if(!selected||bad||!allowed)return failure("Neon staging permits only the verified character's listed read-only tables");
       let rows=known[table].slice();
       for(const [field,value] of filters){
         if(field==="in_ids")rows=rows.filter(x=>value.includes(x.id));
         else rows=rows.filter(x=>x[field]===value);
       }
       for(const [field,asc] of orders.slice().reverse()){
         rows.sort((a,b)=>asc?String(a[field]??"").localeCompare(String(b[field]??"")):
           String(b[field]??"").localeCompare(String(a[field]??"")));
       }
       rows=rows.slice(0,max);
       if(single&&rows.length>1)return failure("Expected one verified character row");
       if(fields)rows=rows.map(x=>Object.fromEntries(fields.map(k=>[k,x[k]??null])));
       return {data:clone(single?(rows[0]||null):rows),error:null};
     }
     return Object.freeze(builder);
   }
   const rpc=async(name,args={})=>{
     // These are NOT database RPC calls. Reconstruct the exact THREE
     // player-visible native Divine tab responses from one already-verified
     // owner/DM sheet snapshot, with no extra access or invented grants.
     const allowed=[
       "terravale_divine_player_state",
       "terravale_divine_canon_player_state",
       "terravale_divine_canon_offers_player_state"
     ];
     if(!allowed.includes(name)||!record(args)||
        Object.keys(args).length!==1||args.target_character!==id)
       return failure("Only the verified character's player-visible divine reads are allowed");
     if(name==="terravale_divine_player_state")
       return {data:clone({
         previews:src.divine_previews,
         dispositions:src.divine_dispositions,
         granted:src.granted_boons
       }),error:null};
     if(name==="terravale_divine_canon_player_state")
       return {data:clone({
         granted:src.canonical_awards,
         divine_state:src.divine_state,
         burdens:src.divine_burdens,
         statuses:src.divine_effects,
         fractures:src.divine_fractures
       }),error:null};
     return {data:clone({offers:src.divine_offers}),error:null};
   };
   const supabase=Object.freeze({from,rpc,isReadOnly:true});
   // No identity is made up: this is an isolated UI compatibility facade,
   // NOT a signed-in Discord/Supabase user session.
   return Object.freeze({supabase,state:Object.freeze({
     ready:true,profile:Object.freeze({is_dm:snapshot.access==="dm"}),user:null
   }),readonly:true});
 }
 window.TerravaleNeonV287ReadOnlyClient=Object.freeze({create});
})();