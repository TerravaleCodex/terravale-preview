import assert from "node:assert/strict";
import fs from "node:fs";
import {buildV2ReadOnlyAccountContext,loadVerifiedV2AccountProfile} from "../site-overrides/neon-v2-account-context.mjs";
const original="11111111-1111-4111-8111-111111111111";
const verified={
 verified:true,profile_exists:true,read_only:true,
 user_id:original,tvuid:"00007",discord_uid:"556677889900",
 discord_username:"Test Adventurer",discord_avatar_url:"https://cdn.example.test/avatar.png",
 custom_avatar_path:null,is_dm:true
};
const context=buildV2ReadOnlyAccountContext(verified);
assert.equal(context.readOnly,true);
assert.equal(context.state.ready,true);
assert.equal(context.state.user.id,original);
assert.equal(context.state.profile.user_id,original);
assert.equal(context.state.profile.tvuid,"00007");
assert.equal(context.state.profile.discord_uid,"556677889900");
assert.equal(context.state.profile.is_dm,true);
assert.equal(context.state.profile.custom_avatar_path,null);
assert.equal(context.supabase,undefined,"No Supabase or privileged network client");
assert.equal(context.state.supabase,undefined);
assert.ok(Object.isFrozen(context)&&Object.isFrozen(context.state)&&Object.isFrozen(context.state.profile));
for(const mutate of [
 {...verified,verified:false},
 {...verified,profile_exists:false},
 {...verified,read_only:false},
 {...verified,is_dm:"true"},
 {...verified,user_id:"new-Neon-id-not-a-UUID"},
 {...verified,discord_uid:""},
 {...verified,discord_username:""},
 {...verified,tvuid:""},
 {...verified,discord_avatar_url:10},
 null,{},[],{...verified,user_id:undefined},
])assert.throws(()=>buildV2ReadOnlyAccountContext(mutate),TypeError,
  "Only verified server-bootstrapped legacy accounts can become V2 identities");
const sql=fs.readFileSync("site-overrides/sql/neon_staging_v2_identity_bootstrap.sql","utf8");
for(const item of [
 "SECURITY DEFINER","SET search_path TO ''","actor := auth.uid()",
 'a."providerId"=\'discord\'', 'a."userId"=auth.neon_request_user_id()',
 "p.user_id=actor AND p.discord_uid=oauth_discord_id",
 "'user_id',profile_row.user_id","'tvuid',profile_row.tvuid",
 "'discord_uid',profile_row.discord_uid","'is_dm',authz.is_site_dm()",
 "REVOKE ALL ON FUNCTION public.terravale_neon_staging_account_bootstrap() FROM PUBLIC",
 "GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_account_bootstrap() TO authenticated",
])assert.ok(sql.includes(item),"Missing verified owner-only SQL rule: "+item);
const actualDefinition=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION"),sql.indexOf("\nREVOKE ALL"));
assert.doesNotMatch(actualDefinition,/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)\b/i,
  "Profile bootstrap must not write to user/campaign tables");
console.log("PASS: signed Neon Discord account preserves original V2 user.id, TvUID, role and identity without writes.");


let attempts=0;
const onlyPreview={
 async rpc(name){
   attempts++;
   assert.equal(name,"terravale_neon_staging_character_preview",
     "Only the already-approved preview RPC may be used as fallback");
   return {data:{read_only:true,characters:[],account:verified},error:null};
 }
};
const staleRpc={data:null,error:{status:404,message:"Neon read denied (HTTP 404)"}};
const resolved=await loadVerifiedV2AccountProfile(onlyPreview,staleRpc);
assert.equal(attempts,1);
assert.equal(resolved.usedFallback,true);
assert.equal(buildV2ReadOnlyAccountContext(resolved.data).state.user.id,original);

const direct=await loadVerifiedV2AccountProfile(onlyPreview,{data:verified,error:null});
assert.equal(direct.usedFallback,false);
assert.equal(attempts,1,"A successful direct route must not call fallback");

for(const status of [400,401,403,500,503]){
 const denied=await loadVerifiedV2AccountProfile(onlyPreview,
   {data:null,error:{status,message:"Denied (HTTP "+status+")"}});
 assert.equal(denied.usedFallback,false,"Only 404 may use a fallback");
 assert.equal(denied.error.status,status);
}
assert.equal(attempts,1,"No fallback for forbidden or server failures");

for(const payload of [
 {read_only:true,characters:[],account:{verified:false,profile_exists:false}},
 {read_only:true,characters:[],account:null},
 {read_only:false,characters:[],account:verified},
 {read_only:true,characters:[],account:{...verified,user_id:"bad"}},
]){
 const untrusted=await loadVerifiedV2AccountProfile(
   {rpc:async()=>({data:payload,error:null})},staleRpc
 ).catch(e=>e);
 assert.ok(untrusted instanceof TypeError || Boolean(untrusted.error),
   "No forged/unverified account can be accepted from the fallback");
}
const fallbackFailed=await loadVerifiedV2AccountProfile(
 {rpc:async()=>({data:null,error:{message:"Denied (HTTP 403)",status:403}})},staleRpc);
assert.equal(fallbackFailed.data,null);
assert.match(fallbackFailed.error.message,/fallback failed/);

