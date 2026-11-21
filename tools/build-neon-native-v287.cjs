#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),crypto=require("node:crypto"),path=require("node:path");
const source=path.resolve("published/veiled-codex/index.html");
const destination=path.resolve("published/neon-staging-auth/native-v287/index.html");
const prefix=path.resolve("site-overrides/neon-native-v287-bootstrap.js");
const hydrate=path.resolve("site-overrides/neon-native-v287-hydrate.js");
const original=fs.readFileSync(source,"utf8");
const baseline=crypto.createHash("sha256").update(original).digest("hex");
if(original.length<7_000_000||!original.includes('data-source="v287-adaptive-resources.js"')||
  !original.includes('data-source="v2-discord-auth.mjs"')||
  !original.includes('id="tv238-v14-content"')||
  !original.includes("sheet20-resource-panel"))
 throw new Error("Native V2.87 approved source not detected; do not publish an imitation");
let staging=original;
for(const moduleName of ["v2-discord-auth.mjs","v2-ads-atelier.mjs"]){
  const rg=new RegExp('<script[^>]*data-source="'+moduleName.replace(/\./g,"\\.")+'"[^>]*>[\\s\\S]*?<\\/script>','g');
  const matches=[...staging.matchAll(rg)];
  if(matches.length!==1)throw new Error("Unexpected production module count for "+moduleName+": "+matches.length);
  staging=staging.replace(rg,"");
}
// These network and storage blockers run before ANY original V2 script.
const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">";
const firstScript='<script data-source="neon-native-v287-bootstrap.js">\n'+fs.readFileSync(prefix,"utf8")+'\n</script>';
const lastScript='<script data-source="neon-native-v287-hydrate.js">\n'+fs.readFileSync(hydrate,"utf8")+'\n</script>';
if(!staging.includes("<head>")||!staging.includes("</body>"))throw new Error("Native HTML insertion points missing");
staging=staging.replace("<head>","<head>\n"+csp+"\n"+firstScript);
staging=staging.replace("</body>",lastScript+"\n</body>");
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,staging);
if(crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex")!==baseline)
 throw new Error("The actual production V2.87 build was unexpectedly modified");
if(staging.includes('data-source="v2-discord-auth.mjs"')||staging.includes('data-source="v2-ads-atelier.mjs"'))
 throw new Error("Production auth or ads leaked into isolated staging renderer");
console.log("PASS: isolated original V2.87 HTML clone, explicit network CSP, memory-only storage, no original Supabase auth module.");
