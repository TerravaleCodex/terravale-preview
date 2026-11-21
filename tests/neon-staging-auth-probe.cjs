"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const vm=require("node:vm");
const html=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
const wf=fs.readFileSync(".github/workflows/deploy.yml","utf8");
assert.ok(html.startsWith("<!doctype html>"));
const m=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(m,"Neon staging module is required");
const code=m[1];
const check=spawnSync(process.execPath,["--input-type=module","--check"],{input:code,encoding:"utf8"});
assert.equal(check.status,0,"Neon test module syntax error:\n"+check.stderr);
for(const snippet of [
 "https://ep-young-mode-bg86754w.neonauth.c-9.eu-central-1.aws.neon.tech/terravale/auth",
 "https://terravalecodex.github.io/terravale-preview/neon-staging-auth/",
 'import("https://esm.sh/@neon/auth@0.8.2?bundle")',
 "client.signIn.social({provider:\"discord\",callbackURL:CALLBACK_URL})",
 "await client.getSession()",
 "await client.signOut()",
 "await client.token()",
 "await getSignedStagingJwt()",
 "client.getSession()",
 'AUTH_URL+"/token"',
 'credentials:"include"',
 "function looksLikeJwt(value)",
 "tokenFromAuthResult(payload)",
 "https://ep-young-mode-bg86754w.apirest.c-9.eu-central-1.aws.neon.tech/terravale/rest/v1",
 "DATA_API_URL+\"/rpc/terravale_neon_staging_probe\"",
 "Authorization\":\"Bearer \"+jwt",
 "typeof info.owned_characters",
 'id="permissions"',
 "Verify character access (read-only)",
 "Real Neon permission check passed",
 "data?.user",
 'name="robots" content="noindex,nofollow,noarchive"',
 'name="referrer" content="no-referrer"',
 'Neon staging session active',
 'existing character ownership'
])assert.ok(html.includes(snippet),"Expected staging-only auth behaviour: "+snippet);
assert.ok(!/sb_secret_|service_role|postgres(ql)?:\/\/|clientSecret\s*[:=]|apiKey\s*[:=]|getJWTToken\(/i.test(html),"Staging page must never reveal credentials or bearer tokens");
assert.ok(!/supabase-js|supabase\.auth|supabase\.from|supabase\.rpc/i.test(code),"Staging sign-in must never touch Supabase");
assert.ok(!/innerHTML\s*=|eval\(|new Function\(/.test(code),"User data must be handled safely");
assert.ok(!/localStorage|sessionStorage|console\.log\(jwt\)|textContent\s*=\s*jwt/.test(code),
  "The signed JWT must never be logged, displayed, or persisted by the staging check");
assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(code),
  "The staging probe must never mutate database records");
assert.ok(code.includes('method:"POST"') && code.includes('body:"{}"'),
  "Staging probe should call its designated read-only RPC only");
assert.ok(code.includes('els.permissionResult.textContent='),
  "Staging probe should display aggregate counts only");
for(const marker of [
 'characters table', 'campaigns table', 'ownership RPC',
 'original V2 profile RPC', 'Failed endpoint(s):'
])assert.ok(code.includes(marker),"Staging V2 test must identify each failing read endpoint");
assert.ok(html.includes('No passwords, OAuth secrets, session tokens or database credentials'));
for(const marker of [
 'cp site-overrides/launch-home.html published/index.html',
 'cp site-overrides/launch-home.html published/404.html',
 'cp site-overrides/neon-staging-auth.html published/neon-staging-auth/index.html',
 '"404.html","index.html","neon-staging-auth","veiled-codex"',
])assert.ok(wf.includes(marker),"Unexpected public-site build structure: "+marker);
const built="published/neon-staging-auth/index.html";
if(fs.existsSync(built))assert.equal(fs.readFileSync(built,"utf8"),html);
console.log("PASS: Neon staging sign-in page is isolated, syntactically valid, safe and distinct from the live Supabase app.");
// Unit-test JWT extraction without real accounts, cookies, or live bearer tokens.
const from=code.indexOf("function looksLikeJwt(");
const to=code.indexOf("async function verifyCharacterPermissions(",from);
assert.ok(from>=0&&to>from,"JWT helpers should be independently testable");
const helpers=code.slice(from,to);
const dummyTokens={sdk:"abc.def.ghi",session:"jkl.mno.pqr",endpoint:"stu.vwx.yza"};
async function exercise(client,reply){
 let called=0;
 const ctx={
  client,AUTH_URL:"https://staging-auth.example/terravale/auth",
  fetch:async(url,opts)=>{
   called++;
   assert.equal(url,ctx.AUTH_URL+"/token","JWT fetch must use the fixed Neon Auth origin");
   assert.equal(opts.method,"GET");
   assert.equal(opts.credentials,"include");
   assert.equal(opts.cache,"no-store");
   return reply;
  }
 };
 vm.createContext(ctx);
 vm.runInContext(helpers,ctx);
 const result=await vm.runInContext("getSignedStagingJwt()",ctx);
 return {result,called};
}
(async()=>{
 const sdk=await exercise({
  token:async()=>({data:{token:dummyTokens.sdk}}),
  getSession:async()=>{throw Error("Unnecessary session request")}
 },null);
 assert.equal(sdk.result,dummyTokens.sdk);assert.equal(sdk.called,0);

 const cached=await exercise({
  token:async()=>({data:{session:{token:"opaque-session-id"}}}),
  getSession:async()=>({data:{session:{token:dummyTokens.session}}})
 },null);
 assert.equal(cached.result,dummyTokens.session);assert.equal(cached.called,0);

 const endpoint=await exercise({
  token:async()=>({data:{session:{token:"not-a-jwt"}}}),
  getSession:async()=>({data:{session:{token:"another-opaque-token"}}})
 },{ok:true,json:async()=>({token:dummyTokens.endpoint})});
 assert.equal(endpoint.result,dummyTokens.endpoint);assert.equal(endpoint.called,1);

 const empty={
  token:async()=>({data:{session:{token:"opaque"}}}),
  getSession:async()=>({data:{session:{token:"opaque"}}})
 };
 await assert.rejects(exercise(empty,{ok:true,json:async()=>({token:"opaque"})}),
   /no signed access JWT/);
 await assert.rejects(exercise(empty,{ok:false,status:401}),
   /HTTP 401/);
 console.log("PASS: Neon staging auth JWT fallback (SDK, cached session, direct endpoint) and safe failure.");
})().catch(e=>{console.error(e);process.exitCode=1});
