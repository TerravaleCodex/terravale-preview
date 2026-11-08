/* V2.58 regression: native feat reader parses, and a verified active grant
   is returned as one native reader entry. No network, credentials or live writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const html=fs.readFileSync('published/veiled-codex/index.html','utf8');
const sources=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const nativeScripts=sources.map(x=>x[1]).filter(s=>s.includes('function featEntries(c){'));
assert.equal(nativeScripts.length,1,'Exactly one native feat parser must be present');
const tmp=path.join(os.tmpdir(),'terravale-v258-native-syntax.js');
fs.writeFileSync(tmp,nativeScripts[0]);
const parse=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});
fs.rmSync(tmp,{force:true});
assert.equal(parse.status,0,'Native source must parse: '+(parse.stderr||''));
assert.match(nativeScripts[0],/native\.concat\(window\.TerravaleV258Feats\?\.getEntries/);
assert.match(nativeScripts[0],/Feats <span>/);
const provider=fs.readFileSync('site-overrides/v255-custom-feat-forge.js','utf8');
const calls=[];
function query(table){
 const q={
  select(){return q},
  eq(){return q},
  in(){return q},
  limit(){return q},
  then(resolve,reject){
   calls.push(table);
   const data=table==='terravale_character_custom_feats'?
    [{feat_id:'feat-1'}]:
    [{id:'feat-1',name:'Lack of language',
      short_description:'Difficulty reading <scripts>',
      rules_text:'Cannot read ancient runes.',
      action_type:'passive',uses_per_rest:0,recovery:'manual',rarity:'Custom'}];
   return Promise.resolve({data,error:null}).then(resolve,reject);
  }
 };
 return q;
}
const listeners={};let reRenders=0;
const context={
 window:{
  TerravaleVerifiedAccount:{state:{ready:true},supabase:{from:query}},
  addEventListener:(name,fn)=>{listeners[name]=fn}
 },
 location:{hash:'#/characters/test-character'},
 db:{characters:[{id:'test-character',campaign:'test-campaign'}]},
 document:{querySelector:sel=>sel==='.sheet227-reader'?{}:null},
 renderPage:()=>{reRenders++},
 requestAnimationFrame:fn=>fn(),
 console,Set,Map,Date,Promise
};
vm.createContext(context);
vm.runInContext(provider,context,{filename:'v255-custom-feat-forge.js'});
assert.ok(context.window.TerravaleV258Feats,'Provider exported');
assert.deepEqual([...context.window.TerravaleV258Feats.getEntries('test-character','test-campaign')],[]);
(async()=>{
 for(let i=0;i<10;i++)await Promise.resolve();
 const found=context.window.TerravaleV258Feats.getEntries('test-character','test-campaign');
 assert.equal(found.length,1,'Existing active grant appears in native entries');
 assert.equal(found[0].name,'Lack of language');
 assert.equal(found[0].custom,true);
 assert.match(found[0].html,/&lt;scripts&gt;/,'Rule markup is escaped');
 assert.ok(calls.includes('terravale_character_custom_feats'));
 assert.ok(calls.includes('terravale_dm_custom_feats'));
 assert.ok(reRenders>=1,'Loaded grant re-renders the native reader');
 console.log('PASS: native V2 reader syntax and active custom-feat round trip');
})().catch(error=>{console.error(error);process.exitCode=1});
