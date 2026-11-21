import assert from "node:assert/strict";
import {buildV2ReadOnlyAccountContext} from "../site-overrides/neon-v2-account-context.mjs";
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
console.log("PASS: signed Neon Discord account preserves original V2 user.id, TvUID, role and identity without writes.");
