#!/usr/bin/env node
"use strict";
/**
 * Make an isolated COPY of the already-built original V2 renderer, adding
 * only the Neon staging form lock. NEVER patch the live sheet in place.
 */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const src=path.resolve("published/characters/sheet-render-fixed-20261101");
const dst=path.resolve("published/neon-staging-auth/sheet");
const lock=path.resolve("site-overrides/neon-staging-sheet-lock.js");
if(!fs.existsSync(path.join(src,"index.html"))||!fs.existsSync(lock))
 throw Error("Cannot isolate the original V2 renderer; missing source or staging guard");
const original=fs.readFileSync(path.join(src,"index.html"),"utf8");
const before=crypto.createHash("sha256").update(original).digest("hex");
if(!original.includes("</body>")||original.includes("staging-readonly-lock.js"))
 throw Error("Original V2 renderer is not a clean sheet for isolated staging copy");
fs.rmSync(dst,{recursive:true,force:true});
fs.cpSync(src,dst,{recursive:true});
const out=path.join(dst,"index.html");
const updated=original.replace("</body>",'<script src="./staging-readonly-lock.js" defer></script></body>');
fs.writeFileSync(out,updated);
fs.copyFileSync(lock,path.join(dst,"staging-readonly-lock.js"));
const after=crypto.createHash("sha256").update(fs.readFileSync(path.join(src,"index.html"))).digest("hex");
if(before!==after)throw Error("Production V2 renderer changed unexpectedly");
if(!fs.readFileSync(out,"utf8").includes("staging-readonly-lock.js"))throw Error("Staging safety guard missing");
console.log("PASS: original V2 sheet copied into isolated Neon staging with persistent read-only controls; live renderer unchanged.");
