const fs=require('fs'),s=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const token of ['sheet21-backpack-zone','sheet21-backpack','sheet21-equip','function sheet21','function renderSheetV220','function sheet21Inventory','Backpack · drop','data-item-id','item-preview','sheet21-inventory','sheet21-gear']){
 let idx=0,n=0;while((idx=s.indexOf(token,idx))!==-1&&n<3){console.log('EXCERPT '+token+' '+n+' '+s.slice(Math.max(0,idx-1200),idx+3300));idx+=token.length;n++}
 console.log('COUNT '+token+' '+n);
}