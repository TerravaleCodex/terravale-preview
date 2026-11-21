import assert from "node:assert/strict";
import {createNeonReadOnlyBridge} from "../site-overrides/neon-readonly-bridge.mjs";

const url="https://ep-young-mode-bg86754w.apirest.c-9.eu-central-1.aws.neon.tech/terravale/rest/v1";
const calls=[];
const fetchStub=async (path,options)=>{
  calls.push({path,options});
  if(path.includes("/rpc/"))return {ok:true,json:async()=>({identity_recognised:true})};
  if(path.includes("/characters"))return {ok:true,json:async()=>[{id:"1",name:"Sample",status:"approved",campaign_id:"2"}]};
  return {ok:true,json:async()=>[{id:"2",name:"Sample Campaign"}]};
};
const jwt="abc.def.ghi";
const api=createNeonReadOnlyBridge({
  dataApiUrl:url,getAccessToken:async()=>jwt,request:fetchStub
});
assert.equal(api.isReadOnly,true);
for(const forbidden of ["insert","update","delete","upsert","remove","storage","auth","channel"]){
 assert.equal(api[forbidden],undefined,"No mutation/auth/storage API should exist");
 assert.equal(api.from("characters")[forbidden],undefined,"No mutation/query escape should exist");
}
const first=await api.from("characters").select("id,name,status,campaign_id")
  .order("name",{ascending:true}).limit(25);
assert.equal(first.error,null);
assert.equal(first.data.length,1);
assert.ok(calls[0].path.startsWith(url+"/characters?"));
assert.match(calls[0].path,/select=id%2Cname%2Cstatus%2Ccampaign_id/);
assert.match(calls[0].path,/order=name.asc/);
assert.match(calls[0].path,/limit=25/);
assert.equal(calls[0].options.method,"GET");
assert.equal(calls[0].options.credentials,"omit");
assert.equal(calls[0].options.headers.Authorization,"Bearer "+jwt);
const second=await api.from("campaigns").select("id,name").limit(25);
assert.equal(second.data.length,1);
const rpc=await api.rpc("terravale_neon_staging_probe");
assert.equal(rpc.data.identity_recognised,true);
assert.equal(calls[2].options.method,"POST");
assert.equal(calls[2].options.body,"{}");
for(const f of [
 ()=>api.from("profiles"),()=>api.from("characters").select("*"),
 ()=>api.from("characters").select("approved_build"),
 ()=>api.from("characters").select("id,owner_id"),
 ()=>api.from("characters").order("owner_id"),
 ()=>api.from("characters").in("id",Array(30).fill("x")),
 ()=>api.from("characters").select("id").limit(10000),
 ()=>createNeonReadOnlyBridge({dataApiUrl:"https://attacker.test",getAccessToken:()=>jwt,request:fetchStub}),
])assert.throws(f,TypeError,"Unsafe request should be rejected");
for(const f of [
 ()=>api.rpc("terravale_delete_character"),
 ()=>api.rpc("terravale_wallet_self_adjust"),
 ()=>api.rpc("terravale_neon_staging_probe",{userId:"fake"}),
])await assert.rejects(f,TypeError,"Disallowed asynchronous RPC must reject");

const badSession=createNeonReadOnlyBridge({
 dataApiUrl:url,getAccessToken:async()=>"opaque-session",request:fetchStub
});
const countBefore=calls.length;
const noToken=await badSession.from("characters").select("id");
assert.ok(noToken.error);
assert.equal(calls.length,countBefore,"Missing JWT cannot trigger network request");

const rejected=createNeonReadOnlyBridge({
 dataApiUrl:url,getAccessToken:async()=>jwt,
 request:async()=>({ok:false,status:403})
});
const noAccess=await rejected.from("characters").select("id");
assert.equal(noAccess.data,null);
assert.match(noAccess.error.message,/403/);
assert.ok(!JSON.stringify(noAccess).includes(jwt),"Never echo JWTs in error payload");

console.log("PASS: staging-only V2-style SELECT/RPC bridge, strict field/table allowlists, JWT-only access, no writes.");
