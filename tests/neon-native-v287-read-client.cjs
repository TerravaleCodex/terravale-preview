"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("site-overrides/neon-native-v287-read-client.js","utf8");
const w={};vm.runInNewContext(source,{window:w,JSON,Object,Map,Set,Promise,TypeError},{timeout:1500});
const make=w.TerravaleNeonV287ReadOnlyClient.create;
const id="11111111-1111-4111-8111-111111111111";
const campaign="22222222-2222-4222-8222-222222222222";
const feat="33333333-3333-4333-8333-333333333333";
const snapshot={
  schema:"terravale.neon.v287.sheet.readonly.v1",read_only:true,id,access:"owned",
  character:{id,campaign_id:campaign},
  sources:{
    proficiencies:{tools:[{id:"smith",source:"Starting training"}],
      languages:[{id:"common",source:"Ancestry"}],submitted:true,
      pending_languages:[],dm_bonus:[]},
    training:{extra_tools:[],extra_languages:[],hidden_tools:[],hidden_languages:[],language_modes:{}},
    bonus_requests:[{id:"request",kind:"tool",status:"pending",choice_count:1,note:"GM grant"}],
    wallet:[{denomination_id:"cp",quantity:0},{denomination_id:"gp",quantity:3}],
    wallet_ledger:[{id:"txn",denomination_id:"gp",delta:-2,note:"Bought shield",operation:"adjust",created_at:"2026-11-01T00:00:00Z"}],
    custom_feats:[{id:"grant",feat_id:feat,name:"Guardian",
      summary:"Shield once",rules:"Use \u003cshield\u003e",prerequisites:"Dvergr",
      action_type:"bonus_action",uses_per_rest:1,recovery:"long",rarity:"Custom"}],
    granted_boons:[],
    canonical_awards:[{id:"44444444-4444-4444-8444-444444444444",
      name:"Neon Gift",kind:"divine",patron:"Pae",mechanics:"Granted only",
      slot:"divine",max_charges:3,charges_remaining:0,recovery:"long",
      source_kind:"canonical"}],
    divine_effects:[{key:"sacred_aura",stacks:2,note:"Player-visible effect"}],
    divine_previews:[{key:"pae",name:"Pae",rank:"major",hint:"Public only"}],
    divine_dispositions:[{key:"pae",disposition:"watchful"}],
    divine_state:{entanglement:0,divine_pressure:0,minor_intercession_remaining:0},
    divine_burdens:[],
    divine_fractures:[],
    divine_offers:[{id:"55555555-5555-4555-8555-555555555555",
      status:"offered",title:"Disclosed offer",certain_price:"Disclosed consequence"}]
  }
};
(async()=>{
 const facade=make(snapshot),sb=facade.supabase;
 assert.equal(facade.state.ready,true);
 assert.equal(facade.state.profile.is_dm,false);
 assert.equal(facade.state.user,null,"No fake Discord identity");
 assert.equal(sb.isReadOnly,true);
 for(const method of ["insert","update","delete","upsert","channel","storage"])
   assert.equal(sb[method],undefined,"No write or storage method: "+method);
 const one=await sb.from("terravale_character_proficiencies").select("*")
   .eq("character_id",id).maybeSingle();
 assert.equal(one.error,null);assert.equal(one.data.tools[0].id,"smith");
 assert.equal(one.data.submitted,true);
 const bonus=await sb.from("terravale_proficiency_bonus_choices").select("*")
   .eq("character_id",id).limit(30);
 assert.equal(bonus.data.length,1);
 const holdings=await sb.from("terravale_character_wallet").select("denomination_id,quantity")
   .eq("character_id",id);
 assert.deepEqual(JSON.parse(JSON.stringify(holdings.data)),
   [{denomination_id:"cp",quantity:0},{denomination_id:"gp",quantity:3}]);
 const ledger=await sb.from("terravale_wallet_ledger")
   .select("id,denomination_id,delta,note,operation,created_at").eq("character_id",id)
   .order("created_at",{ascending:false}).limit(7);
 assert.equal(ledger.data[0].delta,-2);assert.equal(ledger.data[0].note,"Bought shield");
 const grants=await sb.from("terravale_character_custom_feats").select("feat_id")
   .eq("character_id",id).eq("status","active").limit(200);
 assert.equal(grants.data[0].feat_id,feat);
 const meta=await sb.from("terravale_dm_custom_feats")
   .select("id,name,short_description,prerequisites,rules_text,action_type,uses_per_rest,recovery,rarity")
   .in("id",[feat]).limit(200);
 assert.equal(meta.data[0].name,"Guardian");
 assert.equal(meta.data[0].rules_text,"Use <shield>");
 assert.equal(meta.data[0].uses_per_rest,1);
 const noOther=await sb.from("terravale_character_wallet").select("*")
   .eq("character_id","99999999-9999-4999-8999-999999999999");
 assert.ok(noOther.error&&noOther.data===null,"Cross-character reads must fail");
 const noOtherCampaign=await sb.from("terravale_dm_custom_feats").select("*")
   .eq("campaign_id","99999999-9999-4999-8999-999999999999");
 assert.ok(noOtherCampaign.error);
 const noTable=await sb.from("terravale_divine_favour").select("*");
 assert.ok(noTable.error);
 const noUnscoped=await sb.from("characters").select("*");
 assert.ok(noUnscoped.error);
 const noWrite=await sb.rpc("terravale_save_character_sheet",{target_character:id});
 assert.ok(noWrite.error&&noWrite.data===null);
 const divine=await sb.rpc("terravale_divine_canon_player_state",{target_character:id});
 assert.equal(divine.error,null);
 assert.equal(divine.data.granted.length,1);
 assert.equal(divine.data.granted[0].charges_remaining,0,"Depleted charges must never refill");
 assert.equal(divine.data.divine_state.minor_intercession_remaining,0);
 assert.equal(divine.data.statuses[0].stacks,2);
 assert.equal(divine.data.granted[0].patron,"Pae");
 const patrons=await sb.rpc("terravale_divine_player_state",{target_character:id});
 assert.equal(patrons.error,null);
 assert.equal(patrons.data.previews[0].name,"Pae");
 assert.equal(patrons.data.dispositions[0].disposition,"watchful");
 assert.equal(patrons.data.dispositions[0].score,undefined,"No raw favour");
 const offered=await sb.rpc("terravale_divine_canon_offers_player_state",{target_character:id});
 assert.equal(offered.data.offers[0].title,"Disclosed offer");
 assert.equal(offered.data.offers[0].dm_note,undefined,"No DM-only notes");
 for(const rpcName of ["terravale_divine_canon_use","terravale_divine_dm_state",
   "terravale_divine_canon_dm_refill","terravale_divine_canon_rest"]){
   const blocked=await sb.rpc(rpcName,{target_character:id});
   assert.ok(blocked.error&&blocked.data===null,"Mutation/admin RPC blocked: "+rpcName);
 }
 const cross=await sb.rpc("terravale_divine_canon_player_state",
   {target_character:"99999999-9999-4999-8999-999999999999"});
 assert.ok(cross.error&&cross.data===null,"Another character's data denied");
 meta.data[0].name="mutated";
 assert.equal((await sb.from("terravale_dm_custom_feats").select("name").in("id",[feat])).data[0].name,"Guardian");
 const dm=make({...snapshot,access:"dm"});
 assert.equal(dm.state.profile.is_dm,true);
 assert.throws(()=>make({...snapshot,read_only:false}),/authorised/);
 assert.throws(()=>make({...snapshot,character:{id,campaign_id:"invalid"}}),/authorised/);
 console.log("PASS native V2.87 read-only facade: training, feats, wallet, divine player views, depleted charges, RLS scope, denied writes and cross-account access.");
})().catch(e=>{console.error(e);process.exitCode=1});