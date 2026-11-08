const fs=require('fs');const s=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const t of ['sr-workspace','sr-statusbar','sr-dice','sr-pulse','Dice & checks','Dice & Checks','Party chat','Attack against AC / damage','Character quick checks','id="dice','sr-quick','sr-chat','sr-room','sr-rolling','v251-session-items']){
 let pos=0,n=0;while((pos=s.toLowerCase().indexOf(t.toLowerCase(),pos))>=0&&n<4){
 console.log('ROOM_DIAG '+t+' [#'+n+'] '+s.slice(Math.max(0,pos-600),pos+1600).replace(/\n/g,' ').slice(0,2200));
 pos+=t.length;n++;
 } console.log('ROOM_COUNT '+t+' '+n);
}