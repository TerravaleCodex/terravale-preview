/* V2.59 regression: native feat reader parses, and a verified active grant
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
const tmp=path.join(os.tmpdir(),'terravale-v259-native-syntax.js');
fs.writeFileSync(tmp,nativeScripts[0]);
const parse=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});
fs.rmSync(tmp,{force:true});
assert.equal(parse.status,0,'Native source must parse: '+(parse.stderr||''));
assert.match(nativeScripts[0],/native\.concat\(window\.TerravaleV258Feats\?\.getEntries/);
assert.match(nativeScripts[0],/Feats <span>/);
assert.match(nativeScripts[0],/data-tv259-character/,'Reader must carry actual character id');

/* Regression against the LAST active feature reader (V2.28), not the
   superseded V2.27 featEntries function checked by earlier releases. */
const finalReaders=sources.map(x=>x[1]).filter(src=>src.includes('function readerPage(c){'));
assert.equal(finalReaders.length,1,'Exactly one active V2.28 reader source');
const finalSource=finalReaders[0];
const start=finalSource.indexOf('function readerPage(c){');
const end=finalSource.indexOf('sheetV222FeaturesPage=readerPage;',start);
assert.ok(start>=0&&end>start,'Actual reader function boundaries');
const actualReader=finalSource.slice(start,end);
const htmlEscape=s=>String(s).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
const readerContext={
 view:{character:'test-character',mode:'feats',key:'dm-grant:feat-1',query:''},
 makeEntries:()=>({
  normal:[],deep:[],subclass:[],feats:[{
   key:'ancestry-1',name:'Wingbound Survivor',
   html:'<p>Native ancestry feat</p>',level:0
  }]
 }),
 window:{TerravaleV258Feats:{
  getEntries:()=>[{id:'feat-1',name:'Lack of language',
   html:'<p>DM-granted feat reading rules</p>',custom:true}]
 }},
 esc:htmlEscape,stripTitle:html=>html,
 classSlug:x=>String(x).toLowerCase(),
 lnk:()=>'<a href="#">Class rules</a>',
 v226SpecName:()=>'',v226Class:()=>({sourceVersion:'1.8'})
};
vm.createContext(readerContext);
vm.runInContext(actualReader,readerContext,{filename:'actual-v228-reader.js'});
const rendered=readerContext.readerPage({
 id:'test-character',campaign:'campaign-1',name:'Test',
 ancestry:'Flügel',className:'Bard',level:1
});
assert.match(rendered,/data-v228-tab="feats">Feats <span>2<\/span>/,
 'The visible tab must be Feats and count ancestry + DM feats');
assert.match(rendered,/Lack of language/,'Custom feat enters visible native reader list');
assert.match(rendered,/DM-granted feat reading rules/,'Custom feat opens its complete reading pane');
assert.match(rendered,/data-tv259-character="test-character"/,
 'Real character ID anchors asynchronous refresh');
assert.doesNotMatch(rendered,/Ancestry feats <span>/,
 'Old V2.28 tab must not survive');

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
 // A deliberately different route reproduces the previous V2.58 refresh bug.
 location:{hash:'#/sheet/test-character'},
 db:{characters:[{id:'test-character',campaign:'test-campaign'}]},
 document:{querySelector:sel=>sel==='.sheet227-reader'?{dataset:{tv259Character:'test-character'}}:null},
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
 const previous=reRenders;
 listeners['terravale-auth-ready']?.();
 assert.ok(reRenders>previous,'Discord auth-ready also refreshes alternative sheet routes');
 console.log('PASS: native reader keeps active custom feats across alternative sheet routes');
})().catch(error=>{console.error(error);process.exitCode=1});
