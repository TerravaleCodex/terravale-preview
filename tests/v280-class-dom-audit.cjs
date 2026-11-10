/* Temporary V2.80 native reader inspection for actual markup / event source. */
const fs=require('fs'),html=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const key of ['function v223ClassFeatures','function v224SubclassPanel','function keyClass',
 'function v277UpdateProgression','function v277UpdateOptions','v232-progression-reader',
 'v232-level-grid','data-v232-level','v232-level-content','v233-path-reader',
 'v232-class-reader','function v233']){
  const loc=[];let at=0;while((at=html.indexOf(key,at))>=0){loc.push(at);at+=key.length;if(loc.length>=300)break;}
  const picks=loc.length>6?[...loc.slice(0,2),...loc.slice(-3)]:loc;
  console.log('### '+key+' ('+loc.length+' matches)\n'+picks.map(i=>html.slice(Math.max(i-260,0),i+2400).replace(/[\r\n]+/g,' ').slice(0,2600)).join('\n-----\n'));
}
