"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ads=JSON.parse(fs.readFileSync("site-overrides/approved-ads.json","utf8"));
const js=fs.readFileSync("site-overrides/v2-ads-atelier.mjs","utf8");
const css=fs.readFileSync("site-overrides/v2-discord-atelier.css","utf8");
const sql=fs.readFileSync("site-overrides/sql/v288_cabinet_ad_frequency_preferences.sql","utf8");
assert.equal(ads.length,159);
assert.deepEqual(ads.filter(x=>/grim meal/i.test(x.title)).map(x=>x.id),["zip-037"]);
const pure=js.slice(0,js.indexOf("function enabledOnThisPage()"));
assert.ok(pure.length>900,"Ad selection pure functions must remain above DOM launch");
const context={
 document:{getElementById:id=>id==="tv-v2-ads-manifest"?{textContent:JSON.stringify(ads)}:null},
 window:{},
 Math
};
vm.createContext(context);
vm.runInContext(pure+"\nthis.__ad={chooseArtwork,eligibleArtwork,safePriorities,safeCategories,ART,GRIM_MEAL_ID};",context);
const {chooseArtwork,eligibleArtwork,safePriorities,safeCategories,ART,GRIM_MEAL_ID}=context.__ad;
assert.equal(GRIM_MEAL_ID,"zip-037");
assert.equal(ART.length,159);
assert.equal(new Set(ART.map(x=>x.id)).size,159);
assert.deepEqual([...new Set(ART.map(x=>x.category))].sort(),
["chaos","dating","food-drink","games","grim-gourmet","magic","pets","services","tech","travel","wellness"].sort());
assert.equal(eligibleArtwork({ad_categories:["grim-gourmet"]},new Set()).length,19);
assert.equal(eligibleArtwork({ad_categories:["food-drink"]},new Set()).length,19);
assert.equal(eligibleArtwork({ad_categories:["grim-gourmet","food-drink"]},new Set()).length,38);
assert.equal(eligibleArtwork({ad_categories:["not-approved"]},new Set()).length,159,
 "Unrecognised categories cannot produce an unintended all-off state");
assert.equal(eligibleArtwork({grim_food_only:true,ad_categories:["dating"]},new Set()).length,19,
 "Grim Food-only override takes precedence");
assert.equal(safeCategories(["grim-gourmet","grim-gourmet","invalid"]).length,1);
assert.equal(safeCategories([]).length,0);
assert.equal(eligibleArtwork({},new Set()).length,159,"Default includes the full approved catalogue");
const grim=eligibleArtwork({grim_food_only:true},new Set());
assert.equal(grim.length,19,"Grim Food toggle includes all 19 related creative variants");
assert.ok(grim.every(x=>x.category==="grim-gourmet"));
assert.ok(grim.some(x=>x.id==="zip-037"),"Keep original Grim Meal ID");
assert.equal(eligibleArtwork({grim_food_only:true},new Set(["zip-037"])).length,18,
 "Existing duplicate suppression applies to each variant");
assert.equal(eligibleArtwork({grim_food_only:true,repeat_ads:true},new Set(["zip-037"])).length,19);
assert.equal(chooseArtwork(grim,{grim_food_only:true},0.99).category,"grim-gourmet",
 "Forced/test selection must still use exclusive collection");
const pool=[ads[0],ads[36]];
assert.equal(chooseArtwork(pool,{},0.49).id,pool[0].id,"Default weights are even");
assert.equal(chooseArtwork(pool,{ad_priorities:{"zip-037":8}},0.10).id,pool[0].id);
assert.equal(chooseArtwork(pool,{ad_priorities:{"zip-037":8}},0.12).id,"zip-037");
assert.equal(chooseArtwork(pool,{ad_priorities:{"zip-037":8}},0.999).id,"zip-037");
assert.equal(chooseArtwork(pool,{ad_priorities:{"zip-037":3}},0.26).id,"zip-037");
const filtered=safePriorities({"zip-037":8,"zip-001":3,"not-approved":8,"zip-002":200,"zip-003":"8"});
assert.equal(filtered["zip-037"],8);assert.equal(filtered["zip-001"],3);
assert.equal(Object.keys(filtered).length,2);
assert.ok(!("zip-002" in filtered));
assert.ok(js.includes('const pool=eligibleArtwork(settings,showing)'));
assert.ok(js.includes('const art=chooseArtwork(pool,settings)'));
assert.ok(js.includes('data-ad-setting="grim_food_only"'));
assert.ok(js.includes('id="tv-ad-category-options"'));
assert.ok(js.includes('id="tv-ad-category-all"'));
assert.ok(js.includes('ad_categories:[...categoryDraft]'));
assert.ok(js.includes('ad_priorities:safePriorities(priorityDraft)'));
assert.ok(js.includes("settings=data;beginSchedule();fillForm()"));
assert.ok(js.includes('auth()?.state.profile?.is_dm'));
assert.ok(js.includes('auth().supabase.from("site_ad_settings")'));
assert.ok(js.includes('id="tv-ad-priority-list"'));
assert.ok(js.includes('id="tv-ad-frequency-search"'));
assert.ok(js.includes('id="tv-ad-show-all"'));
assert.ok(js.includes("showAllPriorityRows?selected:selected.slice(0,12)"));
assert.ok(!css.includes("max-height:355px"),"No intrusive nested advert scrollbar");
assert.ok(css.includes(".tv-ad-priority-row"));
assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS grim_food_only boolean NOT NULL DEFAULT false"));
assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS ad_priorities jsonb NOT NULL DEFAULT '{}'::jsonb"));
assert.ok(sql.includes("jsonb_typeof(ad_priorities) = 'object'"));
assert.ok(!/UPDATE\s+public\.site_ad_settings|DROP\s+POLICY|CREATE\s+POLICY|ALTER\s+TABLE\s+public\.site_ad_settings\s+DISABLE/i.test(sql),
 "Never turn ads on or widen RLS within a preference migration");
console.log("PASS Cabinet DM adverts: 159 designs, 19 Grim Gourmet, category allowlist, duplicate suppression and 1×/3×/8× weighting.");
