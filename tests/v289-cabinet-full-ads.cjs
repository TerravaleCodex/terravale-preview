"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const catalogue=JSON.parse(fs.readFileSync("site-overrides/approved-ads.json","utf8"));
const v2=fs.readFileSync("site-overrides/v2-ads-atelier.mjs","utf8");
const legacy=fs.readFileSync("site-overrides/terravale-adblocknt.js","utf8");
const sql=fs.readFileSync("site-overrides/sql/v289_ad_categories.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/deploy.yml","utf8");
const overlay=fs.readFileSync("tools/overlay-v239-with-discord.py","utf8");
const categories=["grim-gourmet","food-drink","dating","pets","wellness",
 "magic","tech","games","travel","services","chaos"];
assert.equal(catalogue.length,159,"Must retain all 159 uploaded artworks");
assert.equal(new Set(catalogue.map(x=>x.id)).size,159,"All artwork IDs distinct");
for(let i=1;i<=159;i++){
 const id="zip-"+String(i).padStart(3,"0");
 const item=catalogue[i-1];
 assert.equal(item.id,id,"Preserve original 56 IDs and append new 103");
 assert.ok(item.title.length>=7&&!/^ChatGPT Image|^[0-9a-f]{8}-[0-9a-f-]+/i.test(item.title),
   "Readable artwork name required for "+id);
 assert.ok(categories.includes(item.category),"Unsupported art category: "+item.category);
 assert.ok(item.width>200&&item.height>200);
 const file=path.join("site-overrides/approved-ads",id+".webp");
 assert.ok(fs.existsSync(file),"Missing source artwork "+id);
 const buf=fs.readFileSync(file);
 assert.ok(buf.length>1000&&buf.subarray(0,4).toString()==="RIFF"&&
   buf.subarray(8,12).toString()==="WEBP","Not a valid WebP: "+id);
}
assert.equal(catalogue.filter(x=>x.category==="grim-gourmet").length,19);
assert.equal(catalogue.find(x=>x.id==="zip-037").title,"Grim Meal: Taste the Afterlife");
assert.equal(new Set(catalogue.map(x=>x.category)).size,11);
assert.equal(catalogue.filter(x=>Number(x.id.slice(4))>56).length,103);
assert.match(v2,/GRIM_GOURMET_CATEGORY = "grim-gourmet"/);
assert.ok(v2.includes("ad_categories:[...categoryDraft]"));
assert.ok(v2.includes("categoryDraft=new Set(safeCategories(settings.ad_categories))"));
assert.ok(v2.includes('id="tv-ad-category-options"'));
assert.ok(v2.includes("Only show Grim Gourmet food adverts (19 designs)"));
assert.ok(v2.includes("Search all 159 approved adverts"));
assert.ok(v2.includes("const pool=eligibleArtwork(settings,showing)"));
assert.ok(v2.includes("chooseArtwork(pool,settings)"));
assert.ok(legacy.includes("veiled-codex/ads/"));
assert.ok(legacy.includes("veiled-codex/ads.json"));
assert.ok(legacy.includes("site_ad_settings?select=grim_food_only,ad_categories,ad_priorities"));
assert.ok(legacy.includes("id=\"tv-legacy-ad-count\""));
assert.match(sql,/ADD COLUMN IF NOT EXISTS ad_categories text\[\] NOT NULL DEFAULT '\{\}'::text\[\]/);
assert.ok(sql.includes("site_ad_settings_ad_categories_allowlist"));
assert.ok(!/DROP\s+POLICY|DROP\s+TABLE|GRANT\s+UPDATE/i.test(sql),
 "No new public write paths for DM settings");
assert.ok(overlay.includes('(target.parent / "ads.json").write_text('));
assert.ok(workflow.includes('assert len(list((public.parent/"ads").glob("zip-*.webp")))==159'));
assert.ok(workflow.includes('cp site-overrides/approved-ads/zip-*.webp site/codex-ads/ads/'));
console.log("PASS 159 / 159 named source files, all categories, 19 Grim Gourmet, legacy gallery, safe category allowlist and dual viewer parity.");
