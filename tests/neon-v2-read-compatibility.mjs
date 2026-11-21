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
const bootstrap=await api.rpc("terravale_neon_staging_account_bootstrap");
assert.equal(bootstrap.error,null,"Profile RPC should use audited authenticated endpoint");
assert.ok(calls.some(call=>call.path.endsWith("/rpc/terravale_neon_staging_account_bootstrap")));
const rpc=await api.rpc("terravale_neon_staging_probe");
assert.equal(rpc.data.identity_recognised,true);
assert.equal(calls[3].options.method,"POST");
assert.equal(calls[3].options.body,"{}");
const sampleId="12345678-1234-4234-8234-123456789abc";
const sheet=await api.rpc("terravale_neon_staging_sheet_read",{p_character_id:sampleId});
assert.equal(sheet.error,null,"Audited sheet fetch should be allowed for a UUID");
assert.equal(calls[4].path,url+"/rpc/terravale_neon_staging_sheet_read");
assert.equal(calls[4].options.method,"POST");
assert.equal(calls[4].options.body,JSON.stringify({p_character_id:sampleId}));
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
 ()=>api.rpc("terravale_neon_staging_sheet_read"),
 ()=>api.rpc("terravale_neon_staging_sheet_read",{p_character_id:"not-an-uuid"}),
 ()=>api.rpc("terravale_neon_staging_sheet_read",{p_character_id:sampleId,user_id:sampleId}),
 ()=>api.rpc("terravale_neon_staging_sheet_read",{owner_id:sampleId}),

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

// 404 diagnostics distinguish missing table cache (205) and missing RPC
// cache (202), exposing only the standardized code, not backend prose.
const rejectedTable=createNeonReadOnlyBridge({
 dataApiUrl:url,getAccessToken:async()=>jwt,
 request:async()=>({ok:false,status:404,json:async()=>({
   code:"PGRST205",message:"PRIVATE BACKEND DETAIL",hint:"Sensitive hint"
 })})
});
const missingTable=await rejectedTable.from("characters").select("id");
assert.equal(missingTable.error.code,"PGRST205");
assert.equal(missingTable.error.status,404);
assert.match(missingTable.error.message,/HTTP 404, PGRST205/);
assert.ok(!JSON.stringify(missingTable).includes("PRIVATE BACKEND DETAIL"));
assert.ok(!JSON.stringify(missingTable).includes("Sensitive hint"));
const rejectedRpc=createNeonReadOnlyBridge({
 dataApiUrl:url,getAccessToken:async()=>jwt,
 request:async()=>({ok:false,status:404,json:async()=>({
   code:"PGRST202",message:"Private schema metadata"
 })})
});
const missingRpc=await rejectedRpc.rpc("terravale_neon_staging_account_bootstrap");
assert.match(missingRpc.error.message,/HTTP 404, PGRST202/);
assert.ok(!JSON.stringify(missingRpc).includes("Private schema metadata"));
const proxyNotJson=createNeonReadOnlyBridge({
 dataApiUrl:url,getAccessToken:async()=>jwt,
 request:async()=>({ok:false,status:404,json:async()=>{throw new SyntaxError("HTML")}})
});
const proxyError=await proxyNotJson.from("campaigns").select("id");
assert.match(proxyError.error.message,/HTTP 404/);
assert.equal(proxyError.error.code,null);
const invalidErrorCode=createNeonReadOnlyBridge({
 dataApiUrl:url,getAccessToken:async()=>jwt,
 request:async()=>({ok:false,status:404,json:async()=>({code:"secret_token"})})
});
const invalid=await invalidErrorCode.rpc("terravale_neon_staging_probe");
assert.ok(!JSON.stringify(invalid).includes("secret_token"));
assert.equal(invalid.error.code,null);

console.log("PASS: staging-only V2 read adapter, safe 404 source/code diagnostics, JWT-only access and no writes.");
