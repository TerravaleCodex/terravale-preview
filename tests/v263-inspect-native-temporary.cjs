const fs=require('fs'),s=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const token of ['function sheetV220Equipment(c)','function sheet21','sheet21-backpack-heading','function sheetV220Handle','function sheetV220CanEdit']){
  let matches=[],pos=0;while((pos=s.indexOf(token,pos))>=0){matches.push(pos);pos+=token.length}
  console.log('COUNT '+token+' '+matches.length);
  for(const [i,at] of matches.slice(-3).entries())console.log('EXCERPT '+token+' last-'+i+' '+s.slice(Math.max(0,at-350),at+10500));
}