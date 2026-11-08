const fs=require('fs');const s=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const t of [
 'function renderDashboard(','function dashboardPage(','function renderHome(',
 'function renderLore(','function renderLoreCodex(','function renderCodex(',
 'function renderAppearance(','function renderSettings(','function renderCharacterSheet(',
 'page-dashboard','dash-welcome','home-hero','dashboard-welcome','dash-hero','featured-character',
 'lore-cover','codex-illustration','tv238-article','tv238-reader','lore-reader','lore-entry',
 'page-lore','codex-content','page-appearance','page-settings','settings-appearance',
 'sr-chat-panel,.sr-dice-panel','sr-lower','sr-chat-feed']){
 let at=[],i=0;while((i=s.indexOf(t,i))>=0){at.push(i);i+=t.length}
 console.log('FIND '+t+' '+at.length);
 for(const pos of at.slice(-2))console.log('CODE '+t+' '+s.slice(Math.max(0,pos-300),pos+2400).replace(/\n/g,' ').slice(0,2650));
}