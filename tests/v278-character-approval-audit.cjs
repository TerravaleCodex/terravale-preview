/* Temporary V2.78 read-only approval handler audit. */
const fs=require('fs');
const html=fs.readFileSync('published/veiled-codex/index.html','utf8');
const needles=['case \x27approveCharacter\x27','approveCharacter','level_notices','approval_requests',
 'Pending','Level up','levelUp','level-up','approveCharacter','sheetTab'];
for(const needle of needles){
 let pos=-1,c=0,parts=[];
 while((pos=html.indexOf(needle,pos+1))!==-1){
  c++;
  if(parts.length<8){
   const a=Math.max(0,pos-530),b=Math.min(html.length,pos+1250);
   parts.push(html.slice(a,b).replace(/[\n\r]+/g,' ').slice(0,1750));
  }
 }
 console.log('AUDIT '+JSON.stringify({needle,count:c,samples:parts}));
}
