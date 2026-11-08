const fs=require('node:fs');const s=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const q of ['THE VOICES AT YOUR TABLE','Party chat','Dice & checks','sr-chat-panel','sr-dice-panel','sr-workspace','sr-chat-feed','Welcome back','Your dashboard','dashboard-hero','v229-feature','Featured character','sheet20-hero','sheet20-hero-copy','LORE CODEX','article-reader','lore-article','article-image','codex-reader','codex-article','cabinet-v2-host','appearance','Choose your theme']){
 const indices=[];let pos=0;while((pos=s.toLowerCase().indexOf(q.toLowerCase(),pos))>=0){indices.push(pos);pos+=q.length;}
 console.log('SURFACE '+q+' count '+indices.length);
 for(const pos of indices.slice(0,2))console.log('NEAR '+q+' '+s.slice(Math.max(0,pos-950),pos+1450).replace(/\n/g,' ').slice(0,2300));
}