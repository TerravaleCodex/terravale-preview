"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
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
