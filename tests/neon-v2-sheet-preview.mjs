import assert from "node:assert/strict";
import fs from "node:fs";
import {toV2ReadOnlySheet} from "../site-overrides/neon-v2-sheet-preview.mjs";
const id="11111111-1111-4111-8111-111111111111";
const base={read_only:true,character:{
  id,name:"Original",access:"owned",approved_build:{className:"Gatewarden",
    character:{className:"Gatewarden",ancestry:"Dvergr",level:4,maxHp:36,ac:17,speed:25,
      str:16,dex:12,con:14,int:10,wis:13,cha:8,features:["Feature One"],
      skills:["Athletics"],inventory:[{id:"old",name:"Fallback item"}]}}
},state:{hp:0,temp_hp:4,blood_state:0,inventory:[{id:"a",name:"Shield",quantity:2}],resources:[],conditions:[]},wallet:[],item_properties:[]};
const x=toV2ReadOnlySheet(base,id);
assert.equal(x.id,id);assert.equal(x.name,"Original");assert.equal(x.className,"Gatewarden");
assert.equal(x.ancestry,"Dvergr");assert.deepEqual(x.stats,[16,12,14,10,13,8]);
assert.equal(x.hp,0,"Zero HP must not be replaced by maximum HP");
assert.equal(x.tempHp,4);assert.equal(x.pb,2);assert.equal(x.inventory[0].qty,2);
assert.deepEqual(x.skills,["Athletics"]);assert.equal(x.readOnly,true);
assert.equal(x.canDM,false);assert.equal(x.portraitUrl,"");
assert.equal(x.token,undefined);assert.equal(x.wallet,undefined);
assert.ok(Object.isFrozen(x));
for(const invalid of [
  {...base,read_only:false},
  {...base,character:{...base.character,access:"shared"}},
  {...base,character:{...base.character,id:"different"}},
  {...base,character:{...base.character,approved_build:{character:{...base.character.approved_build.character,str:null}}}},
  {...base,state:null}
])assert.throws(()=>toV2ReadOnlySheet(invalid,id));
assert.throws(()=>toV2ReadOnlySheet(base,"not-a-uuid"));
const legacy=fs.readFileSync("site-overrides/sheet-live-v091.html","utf8");
assert.match(legacy,/if\(LIVE\.readOnly\)/);
assert.match(legacy,/type:'TV_SHEET_LOAD'/);
assert.match(legacy,/type:'TV_SHEET_READY'/);
const html=fs.readFileSync("site-overrides/neon-staging-auth.html","utf8");
assert.match(html,/sheet-render-fixed-20261101\/\?live=1/);
assert.match(html,/toV2ReadOnlySheet\(v,characterId\)/);
assert.match(html,/type:"TV_SHEET_LOAD",character:verifiedSheetPayload/);
assert.match(html,/ev\.origin!==location\.origin/);
assert.match(html,/ev\.source!==els\.sheetFrame\.contentWindow/);
assert.match(html,/verifiedSheetPayload=null/);
assert.ok(!/\.innerHTML\s*=|console\.log\(\s*jwt|localStorage|sessionStorage/.test(html));
console.log("PASS: original V2 renderer receives validated owner/DM-only read-only Neon character payload.");
