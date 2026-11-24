"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ads=JSON.parse(fs.readFileSync("site-overrides/approved-ads.json","utf8"));
const js=fs.readFileSync("site-overrides/v2-ads-atelier.mjs","utf8");
const css=fs.readFileSync("site-overrides/v2-discord-atelier.css","utf8");
const sql=fs.readFileSync("site-overrides/sql/v288_cabinet_ad_frequency_preferences.sql","utf8");
assert.equal(ads.length,56);
assert.deepEqual(ads.filter(x=>/grim meal/i.test(x.title)).map(x=>x.id),["zip-037"]);
const pure=js.slice(0,js.indexOf("function enabledOnThisPage()"));
assert.ok(pure.length>900,"Ad selection pure functions must remain above DOM launch");
const context={
 document:{getElementById:id=>id==="tv-v2-ads-manifest"?{textContent:JSON.stringify(ads)}:null},
 window:{},
 Math
};
vm.createContext(context);
vm.runInContext(pure+"\nthis.__ad={chooseArtwork,eligibleArtwork,safePriorities,ART,GRIM_MEAL_ID};",context);
const {chooseArtwork,eligibleArtwork,safePriorities,ART,GRIM_MEAL_ID}=context.__ad;
assert.equal(GRIM_MEAL_ID,"zip-037");
assert.equal(ART.length,56);
assert.equal(eligibleArtwork({},new Set()).length,56,"Default remains all artwork");
assert.equal(eligibleArtwork({grim_food_only:true},new Set()).length,1);
assert.equal(eligibleArtwork({grim_food_only:true},new Set())[0].id,"zip-037");
assert.equal(eligibleArtwork({grim_food_only:true},new Set(["zip-037"])).length,0,
 "No duplicates when existing repeat setting is off");
assert.equal(eligibleArtwork({grim_food_only:true,repeat_ads:true},new Set(["zip-037"])).length,1);
assert.equal(chooseArtwork(eligibleArtwork({grim_food_only:true},new Set()),{grim_food_only:true},0.99).id,"zip-037",
 "Forced/test selection must still use exclusive pool");
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
console.log("PASS Cabinet DM adverts: Grim Meal-only, no duplicate leakage, 1×/3×/8× weighting, unknown IDs filtered, searchable UI, safe default SQL and unchanged existing access controls.");
