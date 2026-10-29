const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const rules=JSON.parse(fs.readFileSync(path.join(root,'class-feature-rules.json'),'utf8'));
const published=rules.classes.shaman;
const traditions=published.traditions;
const wild=traditions['The Wild Speaker'];
assert(wild,'Wild Speaker exists in published source');
assert.deepEqual(wild.tiers.map(x=>x.level),[3,6,10,14]);
assert.deepEqual(wild.tiers.map(x=>x.name),['Local Kinship','Borrowed Adaptation','Land Answers','Great Local Pact']);
assert(published.descriptions['Prepare the Dead'].includes('7 days'));
const html=fs.readFileSync(path.join(root,'sheet-live-v091.html'),'utf8');
const i=html.indexOf('function liveFeatureKind(name)'),j=html.indexOf('function classTab(){if(LIVE.enabled)',i);
assert(i>0&&j>i,'Sheet feature-card functions are present');
const source=html.slice(i,j);
const mockLevel=level=>{
 const LIVE={featureGroups:{},published,featureDescriptions:published.descriptions,featureLevels:published.levels};
 const p=()=>({label:'Shaman',level});
 const renderer=new Function('LIVE','p','esc','readableRules','location',source+
  '\nreturn {featureRuleCard,liveFeatureKind,visibleTraditionAbilities};');
 return renderer(LIVE,p,s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),s=>'<p>'+s+'</p>',{pathname:'/terravale-preview/characters/sheet-live/'});
};
for(const level of [3,5,6,9,10,13,14]){
 const r=mockLevel(level),card=r.featureRuleCard('The Wild Speaker');
 assert(card.includes('Local Kinship'),'Level '+level+' should include Lv3 Wild Speaker ability');
 for(const tier of wild.tiers){
  assert.equal(card.includes('<h4>Level '+tier.level+' · '+tier.name+'</h4>'),tier.level<=level,
   'Level '+level+' should '+(tier.level<=level?'include':'hide')+' tier '+tier.level);
 }
 assert(card.includes('APPROVED TRADITION'));
}
const rite=mockLevel(3).featureRuleCard('Prepare the Dead');
assert(rite.includes('Known rite')&&rite.includes('Protect remains'),'Rites are chosen features with source rules');
assert(rite.includes('7 days'),'Full indexed rite text remains readable');
assert(rite.includes('<strong>Prepare the Dead</strong><small>Rite · 10 min'),'Rite description should not duplicate its title');
assert(!rite.includes('This feature has no independently indexed excerpt'));
assert.equal(mockLevel(3).liveFeatureKind('Spirit Lantern'),'rite');
assert.equal(mockLevel(3).liveFeatureKind('Ember'),'bond');
assert.equal(mockLevel(3).liveFeatureKind('The Wild Speaker'),'tradition');
assert(html.includes("name==='Tradition'"),'Generic Shaman advancement marker should not become its own ability');
assert(html.includes("['Known spirit rites'")&&html.includes("['Spirit bonds'"));
console.log('PASS: real Wild Speaker Lv 3/6/10/14 rules, no future unlock leakage, chosen rite and bond categories');
