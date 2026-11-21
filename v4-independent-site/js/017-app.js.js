
'use strict';
/* Terravale V2 — wholly offline design sandbox. No accounts, APIs, requests or live writes. */
const $=id=>document.getElementById(id);
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const A=window.TERRAVALE_DATA.achievements;
const CLASS=window.TERRAVALE_DATA.classes.map(r=>({...r,slug:r.id.slice(6),name:r.description.replace(/^Read the /,'').replace(/ class entry\.$/,'')}));
const ANCESTRY=window.TERRAVALE_DATA.ancestries.map(r=>({...r,slug:r.id.slice(9),name:r.description.replace(/^Read the /,'').replace(/ ancestry entry\.$/,'')}));
const world=[]; // V4: worlds belong to each DM campaign, not the platform
const disciplines=[]; // V4: class mechanics are definitions, not platform defaults
const defaultDb=()=>({
 campaigns:[],campaign:'',role:'dm',mode:'empty',theme:'classic',themesTried:[],
 featuredCharacters:{},v229Featured:{},v230MainFeatured:{},
 characters:[],notes:[],saved:[],read:[],unlocked:[],testedDisciplines:[],
 dismissedAds:0,adsEnabled:false,chat:[],queue:[],lastDice:null,activity:[]
});
/* Session Room V2 — autonomous local rooms per campaign; no server or live game writes. */
const CONDITIONS={Blinded:'Cannot see; automatically fails sight-based checks. Attacks against this creature have advantage, while its attacks have disadvantage.',Charmed:'Cannot attack the charmer or target them with harmful abilities. The charmer has advantage on social interaction checks.',Deafened:'Cannot hear and automatically fails checks requiring hearing.',Frightened:'Has disadvantage on attacks and ability checks while the source of fear is visible; cannot willingly move closer to it.',Grappled:'Speed becomes 0. The condition ends when the grappler is incapacitated or the creature escapes.',Incapacitated:'Cannot take actions or reactions.',Invisible:'Cannot be seen without special senses; attacks against it usually have disadvantage and its attacks usually have advantage.',Paralyzed:'Incapacitated, unable to move or speak. Strength and Dexterity saves automatically fail; close hits may be critical.',Petrified:'Transformed into a solid substance, incapacitated and unable to move; gains resistance to all damage and immunity to poison/disease.',Poisoned:'Disadvantage on attack rolls and ability checks.',Prone:'Can crawl or spend movement to stand; melee attacks nearby have advantage, distant attacks have disadvantage.',Restrained:'Speed 0; attacks against have advantage; its attacks and Dexterity saves have disadvantage.',Stunned:'Incapacitated, unable to move, speaks only falteringly; Strength and Dexterity saves automatically fail.',Unconscious:'Incapacitated, drops held items, falls prone and is unaware. Nearby hits can be critical. Death saves may be required at 0 HP.'};
let roomFocusId='',roomDetailOpen=true,roomDMOpen=false,roomQuickOpen=false,roomDiceCount=1,roomLogOpen=false;
function getRoom(){
 db.rooms??={};let r=db.rooms[db.campaign];
 if(!r){
  const old=db.campaign==='frostvale';
  let fresh=old?JSON.parse(JSON.stringify(db.queue||seed.queue)):
   db.characters.filter(c=>c.campaign===db.campaign&&c.status==='Approved').map((c,i)=>({id:c.id,name:c.name,init:17-i*3}));
  r={queue:fresh,chat:old?JSON.parse(JSON.stringify(db.chat||seed.chat)):[],round:old?(db.round||1):1,turnsInRound:old?(db.turnsInRound||0):0,lastDice:old?(db.lastDice||null):null};
  db.rooms[db.campaign]=r;
 }
 r.queue??=[];r.chat??=[];r.events??=[];r.round??=1;r.turnsInRound??=0;
 const turn=r.queue[0];if(!r.turnTrack||r.turnTrack.id!==(turn?.id||null)||r.turnTrack.round!==r.round){r.turnTrack={id:turn?.id||null,round:r.round,flags:{action:false,bonus:false,reaction:false,movement:false}}}
 return r;
}
function roomCharacter(combatant){return db.characters.find(c=>c.id===combatant?.id)}
function roomHP(combatant){const c=roomCharacter(combatant);return {hp:c?c.hp:(combatant.hp??0),max:c?c.maxHp:(combatant.maxHp??1),ac:c?c.ac:(combatant.ac??12)}}
function roomCanManage(p){return db.role==='dm'||roomCharacter(p)?.owner==='You'}
function roomVisibleHP(p){return db.role==='dm'||!p?.hiddenHP}
function roomHealthPercent(p){const h=roomHP(p);return Math.max(0,Math.min(100,Math.round(100*h.hp/Math.max(1,h.max))))}
function roomHealthColor(p){const percent=roomHealthPercent(p);return percent>55?'#81b99d':percent>26?'#d6b679':'#d77b7c'}
function roomCurrentFocus(){let r=getRoom();return r.queue.find(p=>p.id===roomFocusId)||r.queue[0]||null}
function roomSetHealth(p,delta){let h=roomHP(p),c=roomCharacter(p);if(c){c.hp=Math.max(0,Math.min(c.maxHp,c.hp+delta))}else p.hp=Math.max(0,Math.min(h.max,h.hp+delta));if(roomHP(p).hp>0){p.death={success:0,fail:0,stable:false}};const next=roomHP(p).hp;if(next!==h.hp)roomEvent('health',p.name+' '+(delta<0?'takes '+(h.hp-next)+' damage':'recovers '+(next-h.hp)+' HP'),p.name);persist()}
function roomWrite(who,text,type='message',extra={}){
 const player=window.TerravaleVerifiedAccount?.state.profile;
 if(player&&(who==='You'||who==='Dungeon Master')){
  extra={...extra,tvuid:player.tvuid,ownerUid:player.discord_uid,avatar:window.TerravaleVerifiedAccount?.avatarUrl?.(player)||player.discord_avatar_url||''};
  who=player.discord_username;
 }
 const r=getRoom();r.chat.push({id:key('room'),who,text,when:'Just now',type,...extra});r.chat=r.chat.slice(-150);persist()}
function roomEvent(type,text,who='Table'){const r=getRoom();r.events.push({id:key('event'),type,text,who,round:r.round});r.events=r.events.slice(-60);persist()}
function roomRoll(faces=20,mod=0,count=1,label='Dice roll',share=true,attack=null){
 const n=Math.max(2,Math.min(100,Number(faces)||20)),m=Math.max(-30,Math.min(30,Number(mod)||0)),q=Math.max(1,Math.min(12,Number(count)||1));
 const raw=Array.from({length:q},()=>Math.floor(Math.random()*n)+1);let total=raw.reduce((a,b)=>a+b,0)+m;
 const expr=`${q}d${n}${m>=0?' + '+m:' − '+Math.abs(m)}`;
 const r=getRoom();r.lastDice={raw:raw.join(' + '),rolls:raw,mod:m,total,expr,label,attack};
 if(share){roomWrite(db.role==='dm'?'Dungeon Master':'You',`${label}: ${total} (${expr}; dice ${raw.join(', ')})${attack?' · '+attack:''}`,'roll')}else{roomWrite(db.role==='dm'?'Dungeon Master':'You',`${label}: ${total} (${expr})`,'roll',{private:true})}
 if(share)roomEvent('dice',label+' · '+total+' ('+expr+')',db.role==='dm'?'DM':'Player');unlock('dice_first');persist();renderPage(false);return total;
}
function roomDeathRoll(p){const h=roomHP(p);if(h.hp>0){toast('Death saves only apply at 0 HP');return}p.death??={success:0,fail:0,stable:false};if(p.death.stable||p.death.fail>=3){toast('Death-save track has resolved');return}let raw=Math.floor(Math.random()*20)+1;if(raw===20){roomSetHealth(p,1);p.death={success:0,fail:0,stable:false};roomWrite(p.name,`Death save: natural 20 — regains 1 HP!`,'system')}
 else{if(raw===1)p.death.fail=Math.min(3,p.death.fail+2);else if(raw>=10)p.death.success=Math.min(3,p.death.success+1);else p.death.fail=Math.min(3,p.death.fail+1);if(p.death.success===3)p.death.stable=true;roomWrite(p.name,`Death save: ${raw} · ${p.death.success} successes / ${p.death.fail} failures${p.death.stable?' · stable':''}${p.death.fail>=3?' · fatal threshold':''}`,'system')}
 roomEvent('death','Death save recorded for '+p.name,p.name);persist();renderPage(false);
}
function roomConditionNames(p){let arr=Array.isArray(p.conditions)?p.conditions.slice():[];if(roomHP(p).hp===0&&!arr.includes('Unconscious'))arr.push('Unconscious');return arr}

const STORAGE='living-codex-v4.native-ui.v1';
let db;try{db=JSON.parse(localStorage.getItem(STORAGE))||defaultDb()}catch{db=defaultDb()}
const seed=defaultDb();for(const [k,v] of Object.entries(seed))if(db[k]===undefined)db[k]=v;
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(db))}catch{}window.TerravaleV2Bridge?.onLocalPersist?.();window.TerravaleAchievementNotify?.pulse?.()}
/* V2.24: re-map old preview indexes by exact discipline name. Never award an unvisited discipline by index. */
if(!db.disciplineV224Migrated){
 const oldNames=['Compression','Vector','Arsenal','Ballistics','Fortification','Blade','Thorn','Blood Battle','Coagulation','Circulation','Preview discipline XI','Preview discipline XII','Preview discipline XIII'];
 const prior=Array.isArray(db.testedDisciplines)?db.testedDisciplines:[];
 db.testedDisciplines=[...new Set(prior.map(i=>disciplines.indexOf(oldNames[Number(i)])).filter(i=>i>=0))].sort((a,b)=>a-b);
 db.disciplineV224Migrated=true;
}

let timerToast=null;function toast(message){const t=$('toast');t.textContent=message;t.classList.add('visible');clearTimeout(timerToast);timerToast=setTimeout(()=>t.classList.remove('visible'),3400)}
const key=(prefix='entry')=>prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function campaignName(){return db.campaigns.find(c=>c.id===db.campaign)?.name||'No active campaign'}
function activeCharacters(){return db.mode==='empty'?[]:db.characters.filter(c=>c.campaign===db.campaign&&(!window.TerravalePlayerPreview||c.owner==='You'||(c.status==='Approved'&&c.sheetVisibleToParty)))}
function mine(){return activeCharacters().filter(c=>c.owner==='You')}
function found(){return db.unlocked.length}
function addActivity(name,type,route){db.activity=db.activity.filter(a=>a.route!==route);db.activity.unshift({name,type,route});db.activity=db.activity.slice(0,10);persist()}
function unlock(id){if(!db.unlocked.includes(id)){db.unlocked.push(id);persist();const rec=A.find(r=>r.id===id);if(rec)toast('Curiosity discovered · '+rec.title)}}
function checkMilestones(){const classes=CLASS.every(c=>db.read.includes(c.id));const ancestry=ANCESTRY.every(c=>db.read.includes(c.id));if(classes)unlock('classes_complete');if(ancestry)unlock('ancestries_complete');if(classes&&ancestry)unlock('codex_keeper');if(db.testedDisciplines.length>=3)unlock('bloodforger_3');if(db.testedDisciplines.length>=13)unlock('bloodforger_all');if(db.themesTried.length>=5)unlock('theme_five');if(db.notes.some(n=>n.scope==='private'&&!n.updated.includes('Example'))&&db.notes.some(n=>n.scope==='party'&&!n.updated.includes('Example')))unlock('journal_both');if(db.notes.filter(n=>!n.updated.includes('Example')).length>=20)unlock('journal_twenty');if(db.dismissedAds>=25)unlock('adblocknt')}
function markRead(id){if(!db.read.includes(id))db.read.push(id);unlock(id);checkMilestones();persist();renderPage(false)}
function markSaved(id){const i=db.saved.indexOf(id);if(i>=0){db.saved.splice(i,1);toast('Removed from Quick Save')}else{db.saved.push(id);unlock('quicksave_first');toast('Added to Quick Save')}persist();renderPage(false)}
function lnk(route,label,cls='btn ghost small'){return `<a href="#${safe(route)}" class="${cls}">${label}</a>`}
const titles={'/':'Dashboard','/campaigns':'Campaign Hub','/party':'Session Room','/characters':'Characters','/characters/create':'Create Character','/classes':'Classes','/ancestries':'Ancestries & Feats','/codex':'World Codex & Rules','/journal':'Journal','/bookmarks':'Saved References','/cabinet-of-curiosities':'Cabinet of Curiosities','/dm':'DM Chronicle','/appearance':'Appearance','/search':'Search Codex','/help':'Help & Tutorial','/rules-foundation':'Rules Foundation'};
let queryFilter='',journalScope='private',cabFilter='all',cabSort='curated',modeSearch='',currentDetail=null,campaignFilter='all',campaignQuery='',campaignSort='default',campaignDetailTab='overview';
const dashboardMarkup=$('pageRoot').innerHTML;
const route=()=>{let h=decodeURIComponent(location.hash.replace(/^#/,''));return h.startsWith('/')?h:'/'};
function navigate(p){const u='#'+p;if(location.hash===u){renderPage();return}location.hash=u}
function pageHeader(label,title,sub,aside=''){return `<header class="page-intro"><div><div class="eyebrow"><span class="star">✦</span>${safe(label)}</div><h1>${safe(title)}</h1></div><span class="page-intro-note">${aside||safe(sub)}</span></header>`}
function v2Hero(ey,title,desc,buttons=''){return `<section class="v2-hero"><div class="eyebrow">${safe(ey)}</div><h2>${title}</h2><p>${safe(desc)}</p><div class="v2-actions">${buttons}</div></section>`}
function sectionHead(ey,title,desc,action=''){return `<header class="section-head"><div><div class="eyebrow">${safe(ey)}</div><h2>${safe(title)}</h2>${desc?`<p>${safe(desc)}</p>`:''}</div>${action}</header>`}
function foot(){return `<footer class="v2-foot"><span><strong>Terravale · The Living Codex V2</strong> · Discord-connected campaign workspace · Some notes remain browser-local</span><span>Verified identity · Live character and campaign records</span></footer>`}
function empty(title,desc,routePath='',action='Explore'){return `<div class="v2-empty">${icon('star')}<h3>${safe(title)}</h3><p>${safe(desc)}</p>${routePath?lnk(routePath,action,'btn primary'):''}</div>`}
function goBack(path,label='Back to archive'){return lnk(path,'‹ '+safe(label),'v2-link')}
function setTheme(theme){db.theme=theme;window.TerravaleLivePreferences?.queueTheme?.(theme);if(!db.themesTried.includes(theme))db.themesTried.push(theme);unlock('theme_first');checkMilestones();persist();document.body.dataset.theme=theme;toast('Appearance changed to '+({classic:'Classic Codex',shady:'Bone Zone',zero:'Absolute Zero',night:'Night Sky',guildie:'Guildie',verdant:'Verdant Archive',crimson:'Crimson Court',nullmeridian:'Null Meridian',gloamglass:'Gloamglass'}[theme]||theme));renderPage(false)}
function updateNav(p){document.querySelectorAll('#nav .nav-item').forEach(b=>{const nav=b.dataset.path||'';b.classList.toggle('active',nav==='/'?p==='/':p===nav||p.startsWith(nav+'/'));if(b.classList.contains('active')){let g=b.closest('.nav-group');if(g){let it=g.querySelector('.group-items');it.hidden=false;let btn=g.querySelector('.group-label');btn?.setAttribute('aria-expanded','true');let c=btn?.querySelector('.group-chevron');if(c)c.textContent='⌄';}}});$('crumbTitle').textContent=titles[p]||p.split('/').at(-1).replaceAll('-',' ')}
function renderDashboard(){
 $('pageRoot').innerHTML=dashboardMarkup;
 let stats=$('statAchievements').closest('.stat');stats.querySelector('.stat-label').textContent='Journal entries';stats.querySelector('.stat-icon').innerHTML=icon('feather');stats.querySelector('.stat-note').textContent='Private & party notes';
 const chars=activeCharacters(),c=mine().find(x=>x.id===db.featuredCharacters?.[db.campaign])||mine()[0],n=db.mode==='empty'?0:db.notes.filter(x=>x.campaign===db.campaign).length;
 $('statCampaign').textContent=db.mode==='empty'?'No campaign':campaignName().replace(' Chronicle','');$('statCampaignNote').textContent=db.mode==='empty'?'Ready to begin':'A chapter in progress';
 $('statCharacters').textContent=mine().length;$('statCharactersNote').textContent='In your selected campaign';$('statBookmarks').textContent=db.mode==='empty'?0:db.saved.length;$('statAchievements').textContent=n;
 $('cabinetFound').textContent=found()+' of '+A.length;$('cabinetPct').textContent=Math.round(found()/A.length*100)+'%';$('cabinetRing').style.strokeDashoffset=String(219.91*(1-found()/A.length));
 const next=A.find(r=>!db.unlocked.includes(r.id));$('cabinetNext').textContent=next?'Next curiosity: '+next.title:'Every discovery has been found';
 let sel=$('campaignSelect');sel.innerHTML=db.campaigns.filter(c=>c.status!=='Archived').map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('');sel.value=db.campaign;
 let primary=document.querySelector('.hero .btn.primary');primary.dataset.path=db.role==='dm'?'/dm':'/characters';$('heroPrimaryText').textContent=db.role==='dm'?'DM Chronicle':'My characters';
 if(db.mode==='empty'){$('featureArea').innerHTML=empty('Your story has yet to be written.','Create your first character or select a campaign to begin the adventure.','/characters/create','Create a character')}
 else if(db.role==='dm'){$('featureArea').innerHTML=`<article class="character-card"><div class="character-portrait"><svg class="portrait-symbol" viewBox="0 0 110 110" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M55 10 88 29v41L55 97 22 70V29zM55 10v87M22 29l33 25 33-25"/></svg></div><div class="character-info"><div class="status-line"><span class="status-dot"></span> THE DUNGEON MASTER'S DESK</div><h3>${safe(campaignName())}</h3><div class="character-class">${db.characters.filter(c=>c.status==='Pending').length} pending approval · Campaign workspace</div><p class="character-summary">Keep your party, incoming character requests and campaign plans together.</p><div class="char-actions">${lnk('/dm','Open DM Chronicle →','btn primary small')}${lnk('/campaigns','Manage campaigns','btn ghost small')}</div></div></article>`}
 else if(c){$('featureArea').innerHTML=`<article class="character-card"><div class="character-portrait"><svg class="portrait-symbol" viewBox="0 0 110 110" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M55 10 82 24 91 56 76 88 55 99 34 88 19 56 28 24zM28 24 55 43l27-19M55 43v56M19 56l36-13 36 13M34 88l21-45 21 45"/><circle cx="55" cy="55" r="9"/></svg></div><div class="character-info"><div class="status-line"><span class="status-dot"></span> YOUR ADVENTURER <span class="tiny-chip">OFFLINE SAMPLE</span></div><h3>${safe(c.name)}</h3><div class="character-class">${safe(c.ancestry)} · ${safe(c.className)} · Level ${c.level}</div><p class="character-summary">${safe(c.backstory)}</p><div class="char-actions">${lnk('/characters/'+c.id,'Open character sheet →','btn primary small')}${lnk('/journal','View journal','btn ghost small')}</div></div></article>`}
 else{$('featureArea').innerHTML=empty('A new adventurer awaits','No personal character belongs to this campaign yet.','/characters/create','Create a character')}
 const act=db.mode==='empty'?[]:db.activity.slice(0,4);
 $('recentList').innerHTML=act.length?act.map(a=>`<a class="recent-item" href="#${safe(a.route)}"><span class="recent-icon">${icon(a.type.includes('journal')?'feather':a.type.includes('Ancestry')?'runes':'book')}</span><span class="recent-body"><span class="recent-title">${safe(a.name)}</span><span class="recent-meta">${safe(a.type)}</span></span><span class="recent-arrow">↗</span></a>`).join(''):`<p class="caption">There are no recent discoveries in this view. Explore the Codex to begin.</p>`;
 $('partyContent').innerHTML=chars.length?`<div class="recent-list">${chars.map(c=>`<a class="recent-item" href="#/characters/${safe(c.id)}"><span class="recent-icon" style="font:600 14px Georgia,serif;color:#d4b3f0">${safe(c.name[0])}</span><span class="recent-body"><span class="recent-title">${safe(c.name)}</span><span class="recent-meta">${safe(c.className)} · Lv. ${c.level}</span></span><span class="recent-arrow">↗</span></a>`).join('')}</div><p class="caption" style="margin:13px 0 0">A sample roster from the selected campaign.</p>`:`<p class="caption">No party members in this workspace.</p>${lnk('/campaigns','Open Campaign Hub','btn ghost small')}`;
}
/* Campaign Hub V2 — a real connected prototype, entirely browser-local. */
function getCampaign(id){return db.campaigns.find(c=>c.id===id)}
function campaignStats(c){
 const chars=db.characters.filter(x=>x.campaign===c.id);
 const notes=db.notes.filter(x=>x.campaign===c.id);
 return {chars,notes,mine:chars.filter(x=>x.owner==='You'),pending:chars.filter(x=>x.status==='Pending'),party:notes.filter(x=>x.scope==='party'),private:notes.filter(x=>x.scope==='private')};
}
function campaignVisual(c,large=false){
 const keyLetter=(c.name||'T').trim().slice(0,1).toUpperCase();
 const ico=c.id==='frostvale'?'star':c.id==='moon'?'scroll':'shield';
 return `<span class="campaign-emblem ${large?'large':''}" aria-hidden="true"><span class="campaign-emblem-orbit"></span>${icon(ico)}<strong>${safe(keyLetter)}</strong></span>`;
}
function campaignStatus(c){return c.status==='Archived'?'Archived':c.status==='Draft'?'Draft':c.status==='Joined'?'Joined':'Ongoing'}
function campaignCard(c,i){
 const st=campaignStats(c),active=db.campaign===c.id,archived=campaignStatus(c)==='Archived';
 return `<article class="campaign-tile ${active?'is-active':''} ${archived?'is-archived':''}" style="--campaign-index:${i}">
  <div class="campaign-tile-art"><span class="campaign-tile-decor"></span>${campaignVisual(c)}<span class="campaign-tile-sig" aria-hidden="true">✧</span></div>
  <div class="campaign-tile-inner">
   <div class="campaign-tile-top"><span class="v2-overline">${safe(c.role==='dm'?'DUNGEON MASTER':'PARTY MEMBER')}</span><span class="campaign-status ${active?'active':''}">${active?'✦ ACTIVE':safe(campaignStatus(c)).toUpperCase()}</span></div>
   <h3>${safe(c.name)}</h3><p>${safe(c.description||'A story waiting to be written.')}</p>
   <div class="campaign-tile-meta"><span>${icon('user')} ${st.chars.length} adventurer${st.chars.length===1?'':'s'}</span><span>${icon('feather')} ${st.notes.length} journal entr${st.notes.length===1?'y':'ies'}</span></div>
   <div class="campaign-tile-foot"><a class="campaign-card-link" href="#/campaigns/${encodeURIComponent(c.id)}">Explore campaign <span>↗</span></a>${active?`<span class="campaign-current">Currently selected</span>`:`<button type="button" class="campaign-select-link" data-action="selectCampaign" data-id="${safe(c.id)}" ${archived?'disabled title="Restore this campaign before selecting it"':''}>Make active</button>`}</div>
  </div>
 </article>`;
}
function campaignFormPanels(){return `<section class="campaign-entry v2-section" id="campaignEntry">
 <div class="campaign-entry-heading"><div class="v2-overline">THE NEXT CHAPTER</div><h2>Another adventure awaits.</h2><p>Join a table or prepare a new story. Membership is verified against your Discord account.</p></div>
 <div class="campaign-entry-grid">
<div class="campaign-entry-panel"><div class="campaign-entry-icon">${icon('user')}</div><div class="v2-overline">01 · AN INVITATION</div><h3>Join a campaign</h3><p>Have a code from your Dungeon Master? Use <strong>TV-DEMO</strong> to join the live shared demonstration campaign.</p><form id="joinForm" class="v2-form"><label class="v2-field">Demo invitation code<input name="code" placeholder="TV-DEMO" maxlength="35" autocomplete="off" required aria-label="Demo invitation code"></label><button class="btn ghost" type="submit">Join a table →</button></form></div>
  <div class="campaign-entry-panel"><div class="campaign-entry-icon">${icon('star')}</div><div class="v2-overline">02 · A BLANK PAGE</div><h3>Begin a new campaign</h3><p>Name your adventure and open a personal DM workspace. Campaign details are stored against your Terravale account.</p><form id="campaignForm" class="v2-form"><label class="v2-field">Campaign name<input name="name" placeholder="The Ashen Road" minlength="2" maxlength="80" autocomplete="off" required></label><label class="v2-field">A short description <span class="campaign-optional">Optional</span><input name="description" maxlength="220" placeholder="A journey beyond the known borders…"></label><button class="btn primary" type="submit">Create an adventure →</button></form></div>
 </div></section>`}
function renderCampaigns(){
 const visible=db.mode==='empty'?[]:db.campaigns;
 const active=visible.find(c=>c.id===db.campaign&&!['Archived'].includes(c.status))||visible.find(c=>c.status!=='Archived')||visible[0];
 const stats=active?campaignStats(active):null;
 const totalCharacters=visible.reduce((n,c)=>n+campaignStats(c).chars.length,0);
 const totalNotes=visible.reduce((n,c)=>n+campaignStats(c).notes.length,0);
 const query=campaignQuery.toLowerCase().trim();
 let filtered=visible.filter(c=>(campaignFilter==='all'||(campaignFilter==='active'?c.id===db.campaign:campaignFilter==='archived'?c.status==='Archived':c.status!=='Archived'))&&(!query||`${c.name} ${c.description||''} ${c.role} ${c.status}`.toLowerCase().includes(query)));
 if(campaignSort==='az')filtered.sort((a,b)=>a.name.localeCompare(b.name));
 else if(campaignSort==='party')filtered.sort((a,b)=>campaignStats(b).chars.length-campaignStats(a).chars.length||a.name.localeCompare(b.name));
 else filtered.sort((a,b)=>Number(b.id===db.campaign)-Number(a.id===db.campaign));
 const hero=active?`<section class="campaign-feature" aria-label="Active campaign">
  <div class="campaign-feature-copy"><div class="campaign-eyebrow">${icon('star')} YOUR CURRENT CHAPTER <span> / </span> ${safe(campaignStatus(active).toUpperCase())}</div>
   <h2>${safe(active.name)}</h2><p>${safe(active.description||'The first page of a new adventure.')}</p>
   <div class="campaign-feature-pills"><span>${icon('shield')} ${safe(active.role==='dm'?'Dungeon Master':'Player')}</span><span>${icon('user')} ${stats.chars.length} at the table</span><span>${icon('feather')} ${stats.notes.length} journal entries</span></div>
   <div class="campaign-feature-actions">${lnk('/campaigns/'+encodeURIComponent(active.id),'Open campaign overview →','btn primary')}${lnk('/party','Enter Session Room','btn ghost')}</div>
  </div><div class="campaign-feature-ornament">${campaignVisual(active,true)}<div class="campaign-feature-caption"><span>THE LIVING CHRONICLE</span><strong>NO. ${String(visible.findIndex(c=>c.id===active.id)+1).padStart(2,'0')}</strong></div></div>
 </section>`:`<section class="campaign-feature is-vacant"><div class="campaign-feature-copy"><div class="campaign-eyebrow">${icon('star')} THE BEGINNING OF A STORY</div><h2>Your table awaits.</h2><p>There are no campaigns in this view. Create one below, or join the local example with TV-DEMO.</p><div class="campaign-feature-actions"><a href="#campaignEntry" class="btn primary" data-action="scrollCampaignForms">Begin a campaign →</a></div></div><div class="campaign-feature-ornament">${campaignVisual({name:'Terravale'},true)}</div></section>`;
 const filterButtons=[['all','All',visible.length],['active','Active',visible.filter(x=>x.id===db.campaign).length],['other','Others',visible.filter(x=>x.status!=='Archived'&&x.id!==db.campaign).length],['archived','Archived',visible.filter(x=>x.status==='Archived').length]];
 // The "Others" tab excludes the active item, unlike the generic status groups.
 if(campaignFilter==='other')filtered=filtered.filter(c=>c.id!==db.campaign);
 return pageHeader('YOUR WORLD · THE CAMPAIGN ARCHIVE','Campaign Hub','Every table, every chapter, in one place.')+
 hero+`<div class="campaign-metrics" aria-label="Offline campaign summary">
  <div class="campaign-metric"><span class="campaign-metric-icon">${icon('campaign')}</span><span class="campaign-metric-copy"><small>YOUR CHRONICLES</small><strong>${visible.length}</strong><span>Campaign${visible.length===1?'':'s'} in this workspace</span></span></div>
  <div class="campaign-metric"><span class="campaign-metric-icon">${icon('user')}</span><span class="campaign-metric-copy"><small>ADVENTURERS</small><strong>${totalCharacters}</strong><span>Characters across your tables</span></span></div>
  <div class="campaign-metric"><span class="campaign-metric-icon">${icon('feather')}</span><span class="campaign-metric-copy"><small>CHRONICLES WRITTEN</small><strong>${totalNotes}</strong><span>Journal entries recorded</span></span></div>
 </div>
 <section class="campaign-shelf v2-section"><header class="campaign-section-heading"><div><span class="v2-overline">STORIES IN PROGRESS & MEMORIES KEPT</span><h2>The campaign archive</h2><p>Choose a table to see its characters, notes and next steps.</p></div><span class="campaign-shelf-count">${filtered.length} ${filtered.length===1?'campaign':'campaigns'} shown</span></header>
 <div class="campaign-toolbar"><div class="campaign-filters" role="group" aria-label="Filter campaigns">${filterButtons.map(([id,label,count])=>`<button type="button" data-action="campaignFilter" data-value="${id}" class="campaign-filter ${campaignFilter===id?'active':''}" aria-pressed="${campaignFilter===id}">${label}<span>${count}</span></button>`).join('')}</div><div class="campaign-tools"><label class="campaign-search">${icon('search')}<input id="campaignSearch" type="search" placeholder="Find a campaign…" aria-label="Find a campaign" value="${safe(campaignQuery)}"></label><label class="campaign-sort-label"><span>Sort</span><select id="campaignSort" aria-label="Sort campaigns"><option value="default" ${campaignSort==='default'?'selected':''}>Active first</option><option value="az" ${campaignSort==='az'?'selected':''}>Name A–Z</option><option value="party" ${campaignSort==='party'?'selected':''}>Party size</option></select></label></div></div>
 <div class="campaign-card-grid">${filtered.length?filtered.map(campaignCard).join(''):`<div class="campaign-no-match">${icon('search')}<h3>No matching campaigns</h3><p>${visible.length?'Try another filter, or clear your search to see the entire archive.':'Create a campaign or join the demo invitation below.'}</p><button type="button" class="btn ghost small" data-action="campaignClear">Clear filters</button></div>`}</div></section>
 ${campaignFormPanels()}${foot()}`;
}
function renderCampaignDetail(id){
 const c=getCampaign(id);if(!c)return pageHeader('THE ARCHIVE · MISSING CHAPTER','Campaign not found','')+empty('This chapter is missing.','Choose another campaign from the archive.','/campaigns','Back to Campaign Hub')+foot();
 const s=campaignStats(c),active=c.id===db.campaign,canEdit=db.role==='dm'&&!window.TerravaleV2Bridge?.isDemo?.(id);
 const tabs=[['overview','Overview'],['party','Party roster'],['journal','Journal'],['settings','Settings']];
 const row=(n,href)=>`<a class="campaign-detail-row" href="#${safe(href)}"><span class="campaign-detail-monogram">${safe(n.name[0])}</span><span><strong>${safe(n.name)}</strong><small>${safe(n.ancestry)} · ${safe(n.className)} · Level ${n.level} · ${safe(n.status)}</small></span><span class="campaign-detail-arrow">↗</span></a>`;
 const entry=n=>`<div class="campaign-journal-preview"><span class="v2-overline">${n.scope==='party'?'PARTY RECORD':'PERSONAL NOTE'}</span><h3>${safe(n.title)}</h3><p>${safe(n.body).slice(0,260)}${n.body.length>260?'…':''}</p><span>${safe(n.updated)}</span></div>`;
 let content='';
 if(campaignDetailTab==='party')content=`<section class="campaign-detail-section"><div class="campaign-detail-title"><div class="v2-overline">THE PEOPLE AT YOUR TABLE</div><h2>Party roster</h2><p>Characters connected to this campaign in the offline sample.</p></div><div class="campaign-roster">${s.chars.length?s.chars.map(row).join(''):empty('An empty table','No characters belong to this campaign yet.','/characters/create','Create your first character')}</div></section>`;
 else if(campaignDetailTab==='journal')content=`<section class="campaign-detail-section"><div class="campaign-detail-title"><div class="v2-overline">THE WORDS LEFT BEHIND</div><h2>Campaign journal</h2><p>Private notes and party records belong to this chapter.</p></div><div class="campaign-journal-grid">${s.notes.length?s.notes.map(entry).join(''):empty('A quiet chapter','There are no journal entries yet.','/journal','Write an entry')}</div><div class="campaign-detail-end">${lnk('/journal','Open the Journal →','btn primary small')}</div></section>`;
 else if(campaignDetailTab==='settings')content=`<section class="campaign-detail-section"><div class="campaign-detail-title"><div class="v2-overline">KEEP THE CHRONICLE IN ORDER</div><h2>Campaign settings</h2><p>These changes affect local demo data only. Real campaign permissions are not simulated.</p></div>${canEdit?`<form class="campaign-settings-form" id="campaignSettingsForm"><input type="hidden" name="id" value="${safe(c.id)}"><label class="v2-field">Campaign name<input name="name" maxlength="80" minlength="2" value="${safe(c.name)}" required></label><label class="v2-field">Campaign description<textarea name="description" maxlength="500" rows="4">${safe(c.description||'')}</textarea></label><div class="v2-actions"><button class="btn primary" type="submit">Save campaign details</button><button class="btn ghost" type="button" data-action="campaignArchive" data-id="${safe(c.id)}">${c.status==='Archived'?'Restore campaign':'Archive campaign'}</button></div></form>`:`<div class="campaign-settings-locked">${icon('shield')}<h3>Dungeon Master controls</h3><p>Use the DM switch in the offline preview toolbar to try editing names, descriptions and archived status.</p></div>`}</section>`;
 else content=`<div class="campaign-overview-layout"><section class="campaign-detail-section"><div class="campaign-detail-title"><div class="v2-overline">AT THE TABLE</div><h2>Every adventurer has a part.</h2><p>A glimpse of the party travelling through ${safe(c.name)}.</p></div><div class="campaign-roster">${s.chars.length?s.chars.slice(0,4).map(row).join(''):empty('The table is quiet','Create the first adventurer for this story.','/characters/create','Create a character')}</div><div class="campaign-detail-end"><button class="campaign-inline-link" data-action="campaignTab" data-value="party">View the full party ↗</button>${lnk('/characters/create','Create character','btn ghost small')}</div></section><aside class="campaign-overview-aside"><section class="campaign-sidebar-pane"><span class="v2-overline">NOTES FROM THIS CHAPTER</span><h3>Journal fragments</h3>${s.notes.length?s.notes.slice(0,2).map(entry).join(''):`<p class="campaign-aside-empty">No entries for this chapter yet.</p>`}<button class="campaign-inline-link" data-action="campaignTab" data-value="journal">Read the campaign journal ↗</button></section><section class="campaign-sidebar-pane campaign-sidebar-sigil">${icon('book')}<span class="v2-overline">A STORY IN MOTION</span><h3>Keep writing.</h3><p>Return to the table, record a discovery or develop another character.</p>${lnk('/party','Enter Session Room →','btn ghost small')}</section></aside></div>`;
 return pageHeader('THE ARCHIVE · CAMPAIGN RECORD','Campaign Overview','A chapter of Terravale worth remembering.')+
 `<a href="#/campaigns" class="campaign-back-link">‹ All campaigns</a>
 <section class="campaign-detail-hero"><div class="campaign-detail-identity"><div class="campaign-eyebrow">${icon('star')} ${safe(c.role==='dm'?'DUNGEON MASTER CHRONICLE':'PLAYER CAMPAIGN')} <span>/</span> ${safe(campaignStatus(c).toUpperCase())}</div><h2>${safe(c.name)}</h2><p>${safe(c.description||'A chapter awaiting its first words.')}</p><div class="campaign-feature-pills"><span>${icon('user')} ${s.chars.length} adventurers</span><span>${icon('feather')} ${s.notes.length} journal entries</span>${s.pending.length?`<span>${icon('shield')} ${s.pending.length} awaiting approval</span>`:''}</div><div class="v2-actions">${active?'<span class="campaign-active-indicator">✦ This is your active campaign</span>':`<button class="btn primary small" data-action="selectCampaign" data-id="${safe(c.id)}">Set as active campaign</button>`}${lnk('/party','Open Session Room ↗','btn ghost small')}</div></div><div class="campaign-detail-emblem">${campaignVisual(c,true)}</div></section>
 <div class="campaign-detail-tabs" role="tablist" aria-label="Campaign details">${tabs.map(([id,label])=>`<button type="button" role="tab" data-action="campaignTab" data-value="${id}" class="campaign-detail-tab" aria-selected="${campaignDetailTab===id}">${label}</button>`).join('')}</div>
 <div class="campaign-detail-content">${content}</div>${foot()}`;
}
/* V2.15 — Character Ledger. All records and portraits stay offline. */
let ledgerQuery='',ledgerFilter='all',ledgerSort='featured',ledgerView='gallery';
function ledgerOwned(c){return c.owner==='You'||db.role==='dm'}
function ledgerPortrait(c,large=false){
 const src=typeof c.portrait==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(c.portrait)&&c.portrait.length<750000?c.portrait:'';
 return `<span class="ledger-portrait ${large?'ledger-portrait-large':''}" aria-hidden="true">${src?`<img src="${src}" alt="" loading="lazy">`:`<span class="ledger-portrait-monogram">${safe((c.name||'?')[0].toUpperCase())}</span><svg class="ledger-portrait-lines" viewBox="0 0 120 120" fill="none" stroke="currentColor"><circle cx="60" cy="60" r="44"/><path d="M60 11 95 60 60 109 25 60zM60 11v98M25 60h70"/></svg>`}</span>`;
}
function ledgerHP(c){let max=Math.max(1,Number(c.maxHp)||1),hp=Math.max(0,Math.min(max,Number(c.hp)||0)),pct=Math.round(100*hp/max);return `<div class="ledger-hp"><div><span>HIT POINTS</span><strong>${hp} <small>/ ${max}</small></strong></div><div class="ledger-hp-track"><i style="width:${pct}%;background:${pct>50?'#9dceb0':pct>25?'#d8b781':'#db818e'}"></i></div></div>`}
function ledgerStatus(c){let approved=c.status==='Approved';return `<span class="ledger-status ${approved?'is-approved':'is-pending'}"><span></span>${safe(c.status||'Pending')}</span>`}
function ledgerCard(c,spotlight=false){
 const owned=ledgerOwned(c),isMine=c.owner==='You';
 if(spotlight)return `<article class="ledger-feature" data-ledger-id="${safe(c.id)}"><div class="ledger-feature-art">${ledgerPortrait(c,true)}<span class="ledger-art-bottom">${safe(c.ancestry)} <span>·</span> ${safe(c.className)}</span></div><div class="ledger-feature-copy"><div class="ledger-feature-top"><span class="v2-overline">${isMine?'YOUR ADVENTURER':'FROM YOUR PARTY'} / FEATURED RECORD</span>${ledgerStatus(c)}</div><h2>${safe(c.name)}</h2><div class="ledger-classline">${safe(c.ancestry)} <span>✦</span> ${safe(c.className)} <span>✦</span> Level ${Math.max(1,Number(c.level)||1)}</div><p>${safe(c.backstory||'A story waiting to be told.')}</p><div class="ledger-feature-stats">${ledgerHP(c)}<div class="ledger-armour"><span>ARMOUR CLASS</span><strong>${Number(c.ac)||10}</strong></div></div><div class="ledger-actions">${lnk('/characters/'+encodeURIComponent(c.id),'Open character sheet →','btn primary small')}${owned?`<button class="btn ghost small" data-action="ledgerPortrait" data-id="${safe(c.id)}">Portrait</button><button class="btn ghost small" data-action="ledgerExport" data-id="${safe(c.id)}">Export JSON</button>`:''}${db.role==='dm'&&c.status==='Pending'?`<button class="btn primary small" data-action="approveCharacter" data-id="${safe(c.id)}">Approve</button>`:''}</div></div></article>`;
 return `<article class="ledger-card" data-ledger-id="${safe(c.id)}"><div class="ledger-card-top"><span class="v2-overline">${isMine?'YOUR ADVENTURER':'PARTY CHARACTER'}</span>${ledgerStatus(c)}</div><div class="ledger-card-identity">${ledgerPortrait(c)}<div class="ledger-card-copy"><h3>${safe(c.name)}</h3><p>${safe(c.ancestry)} · ${safe(c.className)} <span class="ledger-level">LV. ${Math.max(1,Number(c.level)||1)}</span></p></div></div><p class="ledger-card-story">${safe(c.backstory||'A story waiting to be written.')}</p><div class="ledger-card-vitals">${ledgerHP(c)}<div class="ledger-ac"><span>AC</span><strong>${Number(c.ac)||10}</strong></div></div><div class="ledger-card-bottom">${lnk('/characters/'+encodeURIComponent(c.id),'Open sheet ↗','ledger-open')}${isMine?`<button data-action="ledgerFeature" data-id="${safe(c.id)}" aria-label="Feature ${safe(c.name)} on dashboard">Feature <span>✦</span></button>`:''}</div></article>`;
}
function ledgerMatch(c){const q=ledgerQuery.trim().toLowerCase();return (!q||[c.name,c.className,c.ancestry,c.status,c.backstory].some(v=>String(v||'').toLowerCase().includes(q)))&&(ledgerFilter==='all'||(ledgerFilter==='mine'&&c.owner==='You')||(ledgerFilter==='party'&&c.owner!=='You')||(ledgerFilter==='pending'&&c.status!=='Approved'))}
function renderCharacters(){
 const all=activeCharacters(),matches=all.filter(ledgerMatch);
 const featuredId=db.featuredCharacters?.[db.campaign];
 if(ledgerSort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));
 else if(ledgerSort==='level')matches.sort((a,b)=>b.level-a.level||a.name.localeCompare(b.name));
 else if(ledgerSort==='status')matches.sort((a,b)=>(a.status==='Approved'?1:0)-(b.status==='Approved'?1:0)||a.name.localeCompare(b.name));
 else matches.sort((a,b)=>(a.owner==='You'?0:1)-(b.owner==='You'?0:1)||b.level-a.level);
 const selected=matches.find(c=>c.id===featuredId)||matches[0];
 const others=matches.filter(c=>c.id!==selected?.id);
 const mineCount=all.filter(c=>c.owner==='You').length,pending=all.filter(c=>c.status!=='Approved').length;
 const filters=[['all','All characters',all.length],['mine','My characters',mineCount],['party','Party',all.length-mineCount],['pending','Awaiting approval',pending]];
 return pageHeader('THE ADVENTURER’S ARCHIVE','Character Ledger','The people who walk your Terravale.')+
 `<section class="ledger-heading"><div><div class="v2-overline">THE PEOPLE BEHIND THE STORIES</div><h2>Every hero leaves a <em>mark.</em></h2><p>Keep your adventurers close, see who is ready for the table, and return to the story whenever you wish.</p><div class="ledger-heading-links">${lnk('/characters/create','✦ Create an adventurer','btn primary')}${lnk('/party','Enter Session Room','btn ghost')}</div></div><div class="ledger-heading-sigil" aria-hidden="true"><div class="ledger-sigil-orbit"><span>✧</span></div><span>THE LIVING CODEX</span></div></section>
 <div class="ledger-metrics"><div class="ledger-metric"><span>${icon('campaign')}</span><div><small>ACTIVE CAMPAIGN</small><strong>${safe(campaignName())}</strong></div></div><div class="ledger-metric"><span>${icon('user')}</span><div><small>AT YOUR TABLE</small><strong>${all.length} adventurer${all.length===1?'':'s'}</strong></div></div><div class="ledger-metric"><span>${icon('shield')}</span><div><small>AWAITING APPROVAL</small><strong>${pending}</strong></div></div></div>
 <section class="ledger-archive"><header class="ledger-archive-title"><div><div class="v2-overline">THE CHARACTER COLLECTION</div><h2>Adventurers at your table</h2><p>Browse the selected campaign, or switch to another chapter.</p></div><label class="ledger-campaign-select"><span>YOUR CHAPTER</span><select id="ledgerCampaign" aria-label="Choose campaign">${db.campaigns.filter(c=>c.status!=='Archived').map(c=>`<option value="${safe(c.id)}" ${c.id===db.campaign?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label></header>
 <div class="ledger-toolbar"><label class="ledger-search">${icon('search')}<input id="ledgerSearch" type="search" placeholder="Find a character, class or ancestry…" aria-label="Search characters" value="${safe(ledgerQuery)}" autocomplete="off"></label><label class="ledger-sort"><span>SORT BY</span><select id="ledgerSort" aria-label="Sort characters"><option value="featured" ${ledgerSort==='featured'?'selected':''}>My adventurers first</option><option value="name" ${ledgerSort==='name'?'selected':''}>Name A–Z</option><option value="level" ${ledgerSort==='level'?'selected':''}>Highest level</option><option value="status" ${ledgerSort==='status'?'selected':''}>Pending first</option></select></label></div>
 <div class="ledger-filter-row"><div class="ledger-filters" role="group" aria-label="Character filters">${filters.map(([id,label,count])=>`<button data-action="ledgerFilter" data-value="${id}" type="button" class="${ledgerFilter===id?'active':''}" aria-pressed="${ledgerFilter===id}">${label}<small>${count}</small></button>`).join('')}</div><div class="ledger-view" role="group" aria-label="Character card layout"><button data-action="ledgerView" data-value="gallery" class="${ledgerView==='gallery'?'active':''}" aria-pressed="${ledgerView==='gallery'}" title="Gallery layout">${icon('campaign')} Gallery</button><button data-action="ledgerView" data-value="compact" class="${ledgerView==='compact'?'active':''}" aria-pressed="${ledgerView==='compact'}" title="Compact layout">${icon('book')} Compact</button></div></div>
 <div class="ledger-count" role="status">Showing <strong>${matches.length}</strong> of ${all.length} character${all.length===1?'':'s'} ${ledgerQuery?`for “${safe(ledgerQuery)}”`:''}</div>
 ${selected?`<div class="ledger-display ${ledgerView==='compact'?'is-compact':''}"><div class="ledger-feature-wrap">${ledgerCard(selected,true)}</div><div class="ledger-list-head"><span class="v2-overline">${others.length?'OTHERS IN THIS CHAPTER':'YOUR CHAPTER'}</span><span>${others.length} additional record${others.length===1?'':'s'}</span></div><div class="ledger-roster">${others.length?others.map(c=>ledgerCard(c)).join(''):`<div class="ledger-only"><span>✧</span><strong>One story at a time.</strong><p>There are no other matches. Create another character or explore a different campaign.</p>${lnk('/characters/create','Create another character','btn ghost small')}</div>`}</div></div>`:`<div class="ledger-no-results">${icon('search')}<h3>${all.length?'No characters match':'The first chapter is unwritten'}</h3><p>${all.length?'Try a different search or filter to see more adventurers.':'There are no characters in this campaign yet. Create the first adventurer to begin.'}</p><div class="v2-actions">${all.length?'<button class="btn ghost" data-action="ledgerClear">Clear filters</button>':''}${lnk('/characters/create','Create a character','btn primary')}</div></div>`}
 </section><div class="ledger-after"><div class="ledger-after-icon">${icon('book')}</div><div><strong>Keep the same story across the Codex</strong><p>Featuring one of your characters updates the Dashboard. DM approvals and sample HP are shared with character sheets and the Session Room.</p></div><span>V2 BETA</span></div>`+foot();
}
function renderCreate(){
 const campaign=db.campaigns.find(c=>c.id===db.campaign&&c.status!=='Archived');
 if(!campaign||!window.TerravaleV2Bridge?.canCreate?.(campaign.id)){
  return pageHeader('THE ADVENTURER’S STUDIO','Join a campaign first','A character belongs to a campaign.')+
   empty('Join a campaign to continue','Ask your DM for a campaign invitation.','/campaigns','Choose a campaign')+foot();
 }
 return renderCreatorV2();
}

function renderSheet(id){
 const ch=db.characters.find(x=>x.id===id);
 if(ch && !window.TerravaleV2Bridge?.hasCampaign?.(ch.campaign))
  return pageHeader('CAMPAIGN ACCESS','Rejoin this campaign first','Your character record has not been deleted.')+
   empty('Campaign membership required','You can access this character again after rejoining its campaign.','/campaigns','Choose campaign')+foot();
 return renderSheetV220(id);
}
/* V2.23 enriched Class & Ancestry readers. Source catalogue imported into v2.17 manifest;
 * published condensed descriptions and verified ancestry traits in v2.23 data.
 * No fabricated class mechanics, feat powers, or eligibility exceptions. */
const V223_DATA=window.TERRAVALE_V223_REFERENCE;
const V223_MANIFEST=window.TERRAVALE_RULES_MANIFEST;
const V223_SKILL_GUIDE={STR:'Strength',DEX:'Dexterity',CON:'Constitution',INT:'Intelligence',WIS:'Wisdom',CHA:'Charisma'};
function v223Meta(kind,name){return kind==='class'?V223_MANIFEST.classes.find(c=>c.name===name):V223_MANIFEST.ancestries.find(a=>a.name.toLowerCase()===name.toLowerCase())}
function v223List(values,empty='Not yet imported'){return values?.length?values.map(s=>safe(s)).join(', '):empty}
function v223FeatureRows(name){const core=window.TERRAVALE_V223_PROGRESSIONS[name],special=window.TERRAVALE_SHEET_FEATURES?.[name];return core|| (special?Object.entries(special).map(([n,list])=>[Number(n),list]):[])}
const V223_FIGHTER_DETAILS={
 'Fighting Style':'Choose one eligible Fighting Style, replacing it when advancing or after substantial approved retraining.',
 'Second Wind':'As a bonus action, expend a use to regain 1d10 + Fighter level HP. Uses scale with proficiency bonus.',
 'Weapon Mastery':'Master three weapons at level 1, increasing to four at level 4, five at level 10 and six at level 16.',
 'Action Surge':'Take an additional action on your turn. Terravale retains the classic version, including casting a spell if available; level 17 grants a second use.',
 'Tactical Mind':'After failing an ability check, spend a Second Wind use to add 1d10; if the check still fails the use is not spent.',
 'Extra Attack (2)':'Make two attacks when taking the Attack action at level 5.',
 'Extra Attack (3)':'Make three attacks when taking the Attack action at level 11.',
 'Extra Attack (4)':'Make four attacks when taking the Attack action at level 20.',
 'Tactical Shift':'When using Second Wind as a bonus action, move up to half your speed without provoking opportunity attacks.',
 'Indomitable':'Reroll a failed saving throw, adding Fighter level to the new result. Use the new result.',
 'Tactical Master':'Replace a mastered weapon’s property for one attack with Push, Sap or Slow.',
 'Studied Attacks':'After missing a creature, gain advantage on your next attack against it before the end of your following turn.'
};
/* V2.24: one source-backed reference lookup shared by class pages and character sheets. */
function v224Detail(className,feature){let d=window.TERRAVALE_V224_DETAILS?.features?.[className]||{};
 return d[feature]||(/^(Feat \/ ASI|Feat \/ Ability Score Improvement)$/i.test(feature)?'At this level, select a qualifying feat or apply the Terravale ASI option. Eligibility requires normal rules validation.':null);
}
function v224SubclassLevel(className){if(['Sorcerer','Warlock','Cleric'].includes(className))return 1;if(['Wizard','Druid'].includes(className))return 2;return 3;}
function v224SubclassPanel(className){
 const layer=window.TERRAVALE_V2251, opts=layer?.options(className)||[];
 if(!opts.length){
   if(['Bloodforger','Nullwatcher'].includes(className))return `<section class="v223-section v2251-class-options"><div class="v2-overline">CLASS STRUCTURE</div><h2>Distinct progression system</h2><p>${safe(className)} does not have an imported traditional subclass list. Its class-specific progression is not interchangeable with ordinary subclass options.</p></section>`;
   return '';
 }
 const count=layer.statusCount(className);
 const routeTitle=className.startsWith('Vhaeros Cantor')?'Domain Verse choices':'Paths & specialisations';
 return `<section class="v223-section v224-subclass-section v2251-class-options" id="class-options"><header class="v223-section-head"><div><span class="v2-overline">PUBLISHED CLASS ARTICLE · REFERENCE ONLY</span><h2>${safe(routeTitle)}</h2><p>${count.total} published source sections are indexed here. Previously imported 700-character excerpts are <strong>not complete rules</strong>. Text is for reference; choices remain subject to DM approval.</p></div><span class="v223-count">${count.full}/${count.total} complete sections</span></header>
 <div class="v2251-import-strip"><div><strong>Full-source import</strong><p>The original private Codex articles have more content than the earlier clipped guide file. Import <code>codex.json</code> or your earlier <code>Terravale Open Me</code> prototype HTML once to store the complete class sections locally for offline reading.</p></div><label class="v2251-upload">Import source file<input type="file" accept="application/json,.json,text/html,.html" data-v2251-source-file aria-label="Import published Codex JSON"></label>${layer.fullCount()?'<button type="button" data-v2251-export class="v2251-upload v2251-export">Back up imported rules</button>':''}</div>
 <div class="v224-option-grid">${opts.map(n=>{const rule=layer.lookup(className,n);return `<details class="v224-option v2251-option"><summary><span><strong>${safe(n)}</strong><small>${safe(rule.label)}</small></span><span>⌄</span></summary><div class="v224-option-body">${layer.renderRule(rule)}<p class="v225-rule-note">${rule.status==='complete'?'Full published class-article section · Read-only. Features above a character’s level are not granted.':'This entry is incomplete in the bundled source snapshot. Do not treat it as the complete subclass rules.'}</p></div></details>`}).join('')}</div></section>`;
}
function v223ClassFeatures(name,limit=20){let rows=v223FeatureRows(name);if(!rows.length)return `<div class="v223-empty"><strong>Progression pending</strong><p>This class has a published catalogue profile, but the available offline import has no verified level-by-level feature text. Refer to the Player Primer for its full progression; no features have been invented.</p></div>`;
return `<div class="v223-levels">${rows.filter(([level])=>Number(level)<=limit).map(([level,names])=>`<div class="v223-level"><span class="v223-level-n">${String(level).padStart(2,'0')}</span><div>${names.length?names.map(n=>`<details class="v223-feature-detail"><summary>${safe(n)} <span>⌄</span></summary><div>${v224Detail(name,n)?`<p>${safe(v224Detail(name,n))}</p><small class="v224-source-tag">Source-backed class feature extract · descriptive reference, not automated</small>`:`<p>Feature listed at level ${level}. The full rule text is not included in this snapshot; consult the published class reference before applying its mechanics.</p><small class="v224-unimported">Rules text pending import</small>`}</div></details>`).join(''):`<span class="v2-dim">No new class feature listed at this level</span>`}</div></div>`).join('')}</div>`}
function v223AncestryFeats(name){
 const feats=V223_MANIFEST.feats.filter(f=>f.ancestry===name.toLowerCase());
 const fullCount=feats.filter(f=>!!window.TERRAVALE_V225_FEATS?.[f.id]).length;
 return `<section class="v223-section" id="ancestry-feats"><header class="v223-section-head"><div><span class="v2-overline">CHARACTER OPTIONS · PUBLISHED RULES</span><h2>Ancestry feats</h2><p>Open a feat to read its prerequisites, effects and limitations. These are optional choices, not automatic ancestry traits.</p></div><span class="v223-count">${fullCount} / ${feats.length} complete</span></header><div class="v223-feat-grid">${feats.map(f=>{
 const full=window.TERRAVALE_V225_FEATS?.[f.id];
 const condensed=typeof SHEET_V222_PUBLISHED_FEAT_TEXT!=='undefined'?SHEET_V222_PUBLISHED_FEAT_TEXT[f.id]:null;
 return `<details class="v223-feat v225-feat"><summary><span><strong>${safe(f.name)}</strong><small>${safe(f.prerequisites)}</small></span><span class="v223-chevron">⌄</span></summary><div class="v223-feat-body">${f.bonus?.length?`<div class="v223-meta"><span>Source-listed +1 ability:</span><strong>${safe(f.bonus.join(' / '))}</strong></div>`:''}${full?`<div class="v225-rule-text">${window.TERRAVALE_V225_MD(full)}</div><p class="v225-rule-note">Complete source excerpt · Prerequisites must be verified; reading does not grant this feat or automate its effects.</p>`:condensed?`<p>${safe(condensed)}</p><small>Condensed feat rules only; full text unavailable.</small>`:`<p>${safe(window.TERRAVALE_V223_FEAT_BRIEFS?.[f.id.split(':')[1]]||'Full feat effects unavailable.')}</p><small>Partial rules — consult the Player Primer.</small>`}</div></details>`;
 }).join('')}</div></section>`;
}
function archiveCard(r,kind){const meta=v223Meta(kind,r.name),record=kind==='class'?V223_DATA.classes[r.name]:V223_DATA.ancestries[r.name],id=r.id||('world:'+r.slug),viewed=db.read.includes(id),saved=db.saved.includes(id);let path=(kind==='class'?'/classes/':kind==='ancestry'?'/ancestries/':'/codex/')+r.slug;let info=kind==='class'?(meta?`d${meta.die||'?'} · ${meta.ancestries.length?meta.ancestries.join(' / '):'Open ancestry'}`:'Class profile'):`${meta?.speed||30} ft. · ${V223_MANIFEST.feats.filter(f=>f.ancestry===r.name.toLowerCase()).length} feats`;return `<a class="archive-card v223-archive-card ${viewed?'is-read':''} ${saved?'is-saved':''}" href="#${safe(path)}"><div class="v223-archive-top"><span class="top-symbol">${icon(kind==='class'?'book':kind==='ancestry'?'runes':'globe')}</span><span class="v223-archive-kind">${kind==='class'?(meta?.group==='core'?'CORE CLASS':'TERRAVALE CLASS'):'ANCESTRY'}</span></div><h3>${safe(r.name)}</h3><p>${safe(record?.description||record?.summary||r.description||'Published reference record')}</p><div class="v223-archive-bottom"><small>${safe(info)}</small><span>${viewed?'✓ Read · ':''}Open reference ↗</span></div></a>`}
function archiveFilter(items){let q=queryFilter.trim().toLowerCase();return q?items.filter(r=>{let d=V223_DATA.classes[r.name]||V223_DATA.ancestries[r.name];return `${r.name} ${d?.description||d?.summary||''}`.toLowerCase().includes(q)}):items}
function renderArchive(kind){const isClass=kind==='class',entries=archiveFilter(isClass?CLASS:ANCESTRY),label=isClass?'Classes':'Ancestries & Feats';return pageHeader('THE LIVING ARCHIVE',label,'Published references and character options.')+v2Hero(isClass?'33 CLASS ENTRIES · TERRAVALE REFERENCE':'10 ANCESTRIES · 89 RACIAL FEATS',isClass?'Choose a <em>path.</em>':'Every people has a <em>story.</em>',isClass?'Browse class identities, ancestry restrictions, starting profiles and imported progression. Entries with incomplete mechanics say so.':'Explore the ten peoples of Terravale, their base traits and ancestry-specific feats. All 89 ancestry feat descriptions now include the published wording. Requirements are shown before selection; the rules remain read-only until validated.',lnk('/codex','World Codex','btn ghost')+lnk('/bookmarks','Saved references','btn ghost'))+`<div class="v2-toolbar"><span class="v2-dim">${entries.length} of ${isClass?33:10} ${isClass?'classes':'ancestries'}</span><input id="archiveSearch" class="v2-input" type="search" aria-label="Filter archive entries" value="${safe(queryFilter)}" placeholder="Search names and descriptions…" style="max-width:390px"></div><div class="archive-grid v223-archive-grid">${entries.map(r=>archiveCard(r,kind)).join('')||empty('No results','Try another class or ancestry name.')}</div>${isClass?`<div class="v2-note v2-section"><strong>Bloodforger discipline playground:</strong> The non-spending preview is available inside Bloodforger's reference. No real Discipline Points are spent.</div>`:''}`+foot()}
function v223ClassReference(r,meta){const description=V223_DATA.classes[r.name],features=v223FeatureRows(r.name),verified=features.length>0;return `<div class="v223-reference-body"><section class="v223-section"><header class="v223-section-head"><div><span class="v2-overline">CLASS IDENTITY</span><h2>At a glance</h2></div></header><p>${safe(description||'The source catalogue has no class synopsis for this entry.')}</p><div class="v223-stats-grid"><div><span>Hit die</span><strong>d${meta?.die??'?'}</strong></div><div><span>Saving throws</span><strong>${safe(v223List(meta?.saves))}</strong></div><div><span>Class skills</span><strong>${meta?.skillCount??'DM review'} choices</strong></div><div><span>Ancestry restriction</span><strong>${safe(meta?.ancestries?.length?meta.ancestries.join(' / '):'Open to listed ancestries')}</strong></div></div><div class="v223-profile-grid"><div><h3>Starting skills</h3><p>${meta?.skillAll?'Choose from all skill proficiencies.':safe(v223List(meta?.skills))}</p></div><div><h3>Training</h3><p><strong>Armour:</strong> ${safe(v223List(meta?.armour,'Not verified'))}</p><p><strong>Weapons:</strong> ${safe(v223List(meta?.weapons,'Not verified'))}</p></div></div>${meta?.ancestries?.includes('Draconic')?`<div class="v223-note">Draconic is an overlay rather than an ordinary base ancestry. Eligibility needs DM confirmation.</div>`:''}</section><section class="v223-section"><header class="v223-section-head"><div><span class="v2-overline">LEVEL-BASED CLASS FEATURES</span><h2>Progression · Levels 1–20</h2><p>${verified?'Feature names are from the published progression table; details are shown only where source-backed.':'The full level-feature progression has not yet been imported for this class.'}</p></div><span class="v223-count">${verified?features.filter(([,f])=>f.length).length+' levels':'DM review'}</span></header>${v223ClassFeatures(r.name)}${r.slug==='bloodforger'?renderDiscipline():''}</section>${v224SubclassPanel(r.name)}</div>`}
function v223AncestryReference(r,meta){const info=V223_DATA.ancestries[r.name];if(!info)return `<div class="v223-empty">Ancestry source record unavailable.</div>`;let available=V223_MANIFEST.classes.filter(c=>!c.ancestries.length||c.ancestries.includes(r.name));return `<div class="v223-reference-body"><section class="v223-section"><div class="v2-overline">PEOPLE & ORIGINS</div><h2>About ${safe(r.name)}</h2><p>${safe(info.summary)}</p><div class="v223-stats-grid"><div><span>Walking speed</span><strong>${meta?.speed||30} ft.</strong></div><div><span>Size</span><strong>${safe(meta?.size||'Confirm with DM')}</strong></div><div><span>Racial feats</span><strong>${V223_MANIFEST.feats.filter(f=>f.ancestry===r.name.toLowerCase()).length}</strong></div><div><span>Available classes</span><strong>${available.length} listed</strong></div></div></section><section class="v223-section"><header class="v223-section-head"><div><span class="v2-overline">PUBLISHED BASE TRAITS · ABRIDGED</span><h2>Ancestry traits</h2><p>Condensed from Player Primer v2.0; consult the published entry for exceptions and complete adjudication.</p></div></header><div class="v223-traits">${info.traits.map(([label,text])=>`<details class="v223-trait"><summary>${safe(label)} <span>⌄</span></summary><p>${safe(text)}</p></details>`).join('')}</div></section>${v223AncestryFeats(r.name)}<section class="v223-section"><span class="v2-overline">CLASS PATHS</span><h2>Available classes</h2><p>Eligibility follows the catalogue. Certain lineages, draconic overlays and exceptions still need DM approval.</p><div class="v223-eligible">${available.map(c=>lnk('/classes/'+c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),c.name,'v223-class-link')).join('')}</div></section></div>`}
function renderReference(kind,slug){let r=(kind==='class'?CLASS:ANCESTRY).find(x=>x.slug===slug);if(!r)return empty('Unknown reference','This reference was not found.',kind==='class'?'/classes':'/ancestries','Back');const meta=v223Meta(kind,r.name),id=r.id,read=db.read.includes(id),saved=db.saved.includes(id),identity=kind==='class'?V223_DATA.classes[r.name]:V223_DATA.ancestries[r.name]?.summary;let count=kind==='class'?v223FeatureRows(r.name).filter(([,names])=>names.length).length:V223_MANIFEST.feats.filter(f=>f.ancestry===r.name.toLowerCase()).length;return pageHeader('THE LIVING ARCHIVE · '+(kind==='class'?'CLASSES':'ANCESTRIES'),r.name,'Expanded source reference · offline snapshot')+`<div class="article-hdr v2-hero v223-reader-hero"><div class="v2-overline">${kind==='class'?'CLASS REFERENCE':'ANCESTRY REFERENCE'} · PLAYER PRIMER</div><h1>${safe(r.name)}</h1><p>${safe(identity||'A source-backed entry, with incomplete descriptive text marked as such.')}</p><div class="v2-actions">${goBack(kind==='class'?'/classes':'/ancestries')}<button class="btn ghost small" data-action="bookmark" data-id="${safe(id)}">${saved?'★ Remove from Quick Save':'☆ Add to Quick Save'}</button></div></div><div class="article-layout v223-reader-layout"><article class="article-main v223-article-main">${kind==='class'?v223ClassReference(r,meta):v223AncestryReference(r,meta)}<div class="article-banner"><span class="v2-overline">THE END OF THE ENTRY</span><h3>Record your discovery</h3><p>${read?'This entry has already been marked read in the offline Cabinet.':'Mark the reference as read to record it in your Cabinet of Curiosities.'}</p><div class="v2-actions"><button class="btn ${read?'ghost':'primary'}" data-action="read" data-id="${safe(id)}">${read?'✓ Read in this preview':'Mark as read · Discover'}</button>${lnk('/cabinet-of-curiosities','View Cabinet','btn ghost')}</div></div></article><aside class="article-aside"><div class="v2-card v223-side-card"><div class="v2-overline">ARCHIVE RECORD</div><h3>At a glance</h3><p>${kind==='class'?'Class':'Ancestry'} reference</p><p>${count} ${kind==='class'?'progression levels with features':'ancestry feat options'}</p><p>Read: ${read?'Yes':'Not yet'}</p><p>Quick Save: ${saved?'Saved':'Not saved'}</p></div><div class="v2-card v223-side-card"><div class="v2-overline">CONTINUE READING</div><h3>Related references</h3>${lnk(kind==='class'?'/ancestries':'/classes',kind==='class'?'Browse ancestries':'Browse classes','btn ghost small')}${lnk('/journal','Write in your journal','btn ghost small')}<p class="v2-dim">Ancestry feats are fully imported; subclass rules are clearly labelled by source completeness. A verified index and optional local source import are included. Unsupported features are not treated as automated rules.</p></div></aside></div>`+foot()}
// Feed the expanded reader directly into the sheet; the same IDs and level gates are used on both surfaces.
const v223LegacyClassPanel=sheetV222ClassPanel;
sheetV222ClassPanel=function(c,compact=false){const html=v223LegacyClassPanel(c,compact);return html.replace(/<p>The feature name is source-backed\. Its complete rules text, action cost and effects have not yet been imported into this offline sheet\. Refer to the published class entry and DM before use\.<\/p>/g,`<p>The class reference contains the available imported progression and verified notes. See the class page for details; unverified effects still require DM review.</p>`)};

function renderDiscipline(){return `<section class="v2-section"><div class="v2-overline">BLOODFORGER · SAFE PREVIEW</div><h2>Discipline laboratory</h2><p>Try selecting disciplines to preview how a future skill-tree selection interface could work. This is a non-spending simulation and is available without creating a Bloodforger.</p><div class="v2-grid two">${disciplines.map((n,i)=>{let on=db.testedDisciplines.includes(i);return `<button class="v2-row" style="cursor:pointer;text-align:left" data-action="discipline" data-id="${i}"><span><strong>${safe(n)}</strong><br><small>${({Alteration:31,Arsenal:29,Ballistics:24,'Blood Battle':25,'Blood Debt':20,Compression:29,Fortification:22,Hardening:25,Hunger:20,'Living Weapon':25,Regeneration:15,Thorn:24,Vector:25})[n]} published nodes · non-spending preview</small></span><span class="v2-badge ${on?'success':''}">${on?'✓ Explored':'Explore'}</span></button>`}).join('')}</div><p class="v2-dim" style="margin-top:13px">${db.testedDisciplines.length} / 13 preview slots explored. Discipline names and node totals follow the published Bloodforger catalogue; this remains a non-spending interaction preview.</p></section>`}
function renderWorld(){return pageHeader('THE LIVING WORLD','World Codex & Rules','History, magic, scars and wonders.')+
 v2Hero('THE ARCHIVE OF TERRAVALE','A world full of <em>unfinished answers.</em>','Visit places and worldbuilding subjects drawn from the established Terravale project. This offline reading study contains short summaries, not a complete replacement for the published world reference.',lnk('/classes','Explore classes','btn ghost')+lnk('/ancestries','Explore ancestries','btn ghost'))+
 `<div class="v2-toolbar"><span class="v2-dim">${world.length} sample entries · more to follow</span><input id="archiveSearch" class="v2-input" type="search" value="${safe(queryFilter)}" placeholder="Search locations and lore…" style="max-width:350px"></div><div class="archive-grid">${archiveFilter(world).map(r=>archiveCard(r,'world')).join('')||empty('No entries found','Try another keyword.')}</div>`+foot()}
function renderWorldDetail(slug){let w=world.find(w=>w.id===slug);if(!w)return empty('The record is missing','This archive title was not found.','/codex');let id='world:'+slug,saved=db.saved.includes(id);return pageHeader('WORLD CODEX · '+w.kind.toUpperCase(),w.title,'Exploring the living world.')+
 `<section class="v2-hero article-hdr"><div class="v2-overline">${safe(w.kind)}</div><h1>${safe(w.title)}</h1><p>${safe(w.summary)}</p><div class="v2-actions">${goBack('/codex','All world entries')}<button class="btn ghost small" data-action="bookmark" data-id="${safe(id)}">${saved?'★ Saved':'☆ Quick Save'}</button></div></section><div class="article-layout"><article class="article-main"><div class="v2-overline">TERRAVALE · ARCHIVE NOTE</div><h2>${safe(w.title)}</h2><p>${safe(w.body)}</p><h3>An evolving history</h3><p>This page is a short worldbuilding excerpt for the V2 reader design. The full article, references, maps and source cross-links can be integrated as the archive designs are approved.</p><div class="article-banner">${lnk('/journal','Record your thoughts','btn primary small')} ${lnk('/bookmarks','Browse Quick Save','btn ghost small')}</div></article><aside class="article-aside"><div class="v2-card"><div class="v2-overline">READING DESK</div><h3>More to explore</h3>${lnk('/codex','Return to World Codex','btn ghost small')} ${lnk('/cabinet-of-curiosities','Discoveries','btn ghost small')}</div></aside></div>`+foot()}
function renderJournal(){const notes=db.mode==='empty'?[]:db.notes.filter(n=>n.scope===journalScope&&n.campaign===db.campaign);return pageHeader('YOUR CHRONICLE','Journal','A home for memory, personal and shared.')+
 v2Hero('PRIVATE THOUGHTS · PARTY HISTORIES','Write what the world <em>remembers.</em>','Keep your own thoughts separate from the records everyone at the table may read. This preview stores entries locally.',lnk('/characters','Your characters','btn ghost'))+
 `<div class="v2-layout"><div><div class="v2-toolbar"><div class="v2-tabs" role="tablist"><button class="v2-tab" data-action="journalScope" data-value="private" aria-selected="${journalScope==='private'}">Private journal</button><button class="v2-tab" data-action="journalScope" data-value="party" aria-selected="${journalScope==='party'}">Party journal</button></div><span class="v2-dim">${notes.length} entr${notes.length===1?'y':'ies'}</span></div><div class="v2-stack">${notes.length?notes.map(n=>`<article class="v2-card note-card"><div class="v2-card-top"><span class="v2-overline">${safe(n.scope==='private'?'FOR YOUR EYES':'SHARED WITH THE PARTY')}</span><span class="note-meta">${safe(n.updated)}</span></div><h3>${safe(n.title)}</h3><p>${safe(n.body)}</p><div class="note-actions"><button class="v2-link" data-action="editNote" data-id="${safe(n.id)}">Edit entry</button><button class="v2-link" data-action="deleteNote" data-id="${safe(n.id)}">Delete</button></div></article>`).join(''):empty('A blank page is an invitation','No entries yet in this journal. Write the first one below.')}</div></div><aside class="v2-card" style="align-self:start"><div class="v2-overline">WRITE AN ENTRY</div><h3>Put pen to page</h3><p>${journalScope==='private'?'Only your preview identity can see this section.':'A shared record for the current demo campaign.'}</p><form class="v2-form" id="journalForm"><label class="v2-field">Title<input name="title" placeholder="The day everything changed" maxlength="120" required></label><label class="v2-field">Your entry<textarea name="body" placeholder="Begin writing…" required></textarea></label><input type="hidden" name="scope" value="${safe(journalScope)}"><button class="btn primary" type="submit">Save ${safe(journalScope)} entry</button></form></aside></div>`+foot()}
function resolveSaved(id){const [type,slug]=id.split(':');if(type==='class'){let x=CLASS.find(c=>c.slug===slug);return x?{title:x.name,kind:'Class',route:'/classes/'+slug}:null}if(type==='ancestry'){let x=ANCESTRY.find(c=>c.slug===slug);return x?{title:x.name,kind:'Ancestry',route:'/ancestries/'+slug}:null}if(type==='world'){let x=world.find(c=>c.id===slug);return x?{title:x.title,kind:'World entry',route:'/codex/'+slug}:null}return null}
function renderBookmarks(){let entries=db.mode==='empty'?[]:db.saved.map(id=>({id,...resolveSaved(id)})).filter(x=>x.title);return pageHeader('BOOKMARKED KNOWLEDGE','Saved References','Your Quick Save reading shelf.')+
 v2Hero('YOUR PERSONAL SHELF','Set a page <em>aside.</em>','Collect references you want to revisit, whether they concern a class, ancestry or the lore of the world.',lnk('/codex','Explore the Codex','btn primary')+lnk('/classes','Browse classes','btn ghost'))+
 (entries.length?`<div class="v2-list">${entries.map(x=>`<div class="v2-row"><div><span class="v2-overline">${safe(x.kind)}</span><h3>${safe(x.title)}</h3></div><div class="v2-actions">${lnk(x.route,'Read →','btn ghost small')}<button class="btn ghost small" data-action="bookmark" data-id="${safe(x.id)}">Remove</button></div></div>`).join('')}</div>`:empty('Your shelf is waiting','Use the bookmark action on any reference article to collect it here.','/codex','Browse the Codex'))+foot()}
function achievementProgress(rec){if(!rec.goal)return 0;const counts={classes:db.read.filter(x=>x.startsWith('class:')).length,ancestries:db.read.filter(x=>x.startsWith('ancestry:')).length,reading:db.read.filter(x=>x.startsWith('class:')||x.startsWith('ancestry:')).length,ads:db.dismissedAds,blood:db.testedDisciplines.length,themes:db.themesTried.length,journal:db.notes.filter(n=>!n.updated.includes('Example')).length};return Math.min(rec.goal,Math.max(0,(counts[rec.measure]||0)-((db.achievementProgressBaseline||{})[rec.measure]||0)))}
const rarityRank={common:1,uncommon:2,rare:3,epic:4,legendary:5};
function renderCabinet(){let items=A.filter(x=>{if(cabFilter==='earned'&&!db.unlocked.includes(x.id))return false;if(cabFilter==='locked'&&db.unlocked.includes(x.id))return false;if(cabFilter==='rare'&&rarityRank[x.rarity]<3)return false;if(cabFilter==='progress'&&(db.unlocked.includes(x.id)||!achievementProgress(x)))return false;return true});if(queryFilter)items=items.filter(x=>(x.title+' '+x.description+' '+x.rarity).toLowerCase().includes(queryFilter.toLowerCase()));if(cabSort==='rarity')items.sort((a,b)=>rarityRank[b.rarity]-rarityRank[a.rarity]);if(cabSort==='alpha')items.sort((a,b)=>a.title.localeCompare(b.title));if(cabSort==='progress')items.sort((a,b)=>(achievementProgress(b)/(b.goal||1))-(achievementProgress(a)/(a.goal||1)));
 let goal=A.length,done=found();return pageHeader('A LIVING RECORD · DISCOVERIES','Cabinet of Curiosities','The little wonders that make Terravale yours.')+
 `<section class="v2-hero cab-head"><div><div class="eyebrow"><span class="star">✦</span> THE ARCHIVE OF DISCOVERIES</div><h2>Every curiosity <em>counts.</em></h2><p>Your Adblockn’t progress is recorded on your Discord account. Other V2-only discoveries are still stored locally until migrated.</p><div class="v2-badge">One continuous archive · Account-wide Adblockn’t</div></div><div class="mini-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35"/><circle class="ring-fill" cx="50" cy="50" r="35" style="stroke-dashoffset:${219.91*(1-done/goal)}"/></svg><strong>${Math.round(done/goal*100)}%</strong></div></section>`+
 `<div class="cab-summary"><div class="v2-card"><div><div class="v2-overline">COLLECTION PROGRESS</div><strong>${done} / ${goal}</strong><br><small>Curiosities discovered</small></div></div><div class="v2-card"><div><div class="v2-overline">RARE OR HIGHER</div><strong>${A.filter(x=>rarityRank[x.rarity]>=3&&db.unlocked.includes(x.id)).length}</strong><br><small>Unlocked discoveries</small></div></div><div class="v2-card"><div><div class="v2-overline">NEARLY DISCOVERED</div><strong>${A.filter(x=>!db.unlocked.includes(x.id)&&achievementProgress(x)>0).length}</strong><br><small>Progress underway</small></div></div></div>`+
 `<div class="v2-section">${sectionHead('ONE CONTINUOUS ARCHIVE','Achievements & discoveries','No separate collections. One gallery, differentiated by rarity.')}
 <div class="v2-toolbar"><input id="archiveSearch" class="v2-input" type="search" value="${safe(queryFilter)}" placeholder="Search curiosity titles…" style="max-width:300px"><select id="cabSort" class="v2-input" style="max-width:200px"><option value="curated" ${cabSort==='curated'?'selected':''}>Curated order</option><option value="rarity" ${cabSort==='rarity'?'selected':''}>Highest rarity first</option><option value="progress" ${cabSort==='progress'?'selected':''}>Closest to unlock</option><option value="alpha" ${cabSort==='alpha'?'selected':''}>A to Z</option></select></div><div class="v2-tabs" style="margin-bottom:15px">${[['all','All'],['earned','Discovered'],['locked','Locked'],['rare','Rare +'],['progress','In progress']].map(([key,val])=>`<button class="v2-tab" data-action="cabFilter" data-value="${key}" aria-selected="${cabFilter===key}">${val}</button>`).join('')}</div>
 <div class="v2-grid four cabinet-grid">${items.map((r,i)=>{let earned=db.unlocked.includes(r.id),p=achievementProgress(r);return `<button class="cab-card ${earned?'earned':''} ${r.rarity==='legendary'||(r.rarity==='epic'&&i%4===0)||((r.rarity==='rare')&&i%11===0)?'cab-featured':''}" data-rarity="${safe(r.rarity)}" data-action="achDetails" data-id="${safe(r.id)}"><span class="v2-card-top"><span class="medal">${icon(r.icon==='sigil'?'runes':r.icon==='drop'?'star':r.icon==='laurel'?'crown':r.icon==='block'?'shield':r.icon==='seal'?'shield':r.icon==='feather'?'feather':r.icon==='bookmark'?'bookmark':r.icon==='palette'?'palette':r.icon==='dice'?'dice':r.icon==='book'?'book':'star')}</span><span class="rare-title">${safe(r.rarity)}</span></span><h3 class="cab-title ${r.title.length>28?'cab-title-long':''}" title="${safe(r.title)}">${safe(r.title)}</h3><p>${safe(r.description)}</p>${r.goal?`<div class="cab-progress"><span style="width:${Math.round(100*p/r.goal)}%"></span></div><small class="v2-dim">${p} / ${r.goal}</small>`:''}<div class="state-line"><span>${earned?'✓ DISCOVERED':'◇ LOCKED'}</span><span>Details ↗</span></div></button>`}).join('')||empty('Nothing matches','Try a different filter.')}</div></div><div class="v2-note">Adblockn’t is awarded for dismissing actual Terravale advertisements. <strong>${db.dismissedAds} / 25</strong> closed on this Discord account. The DM controls are in Advertisement Atelier below.</div>`+foot()}
function roomInitiativeCard(p,i,r){
 const c=roomCharacter(p),h=roomHP(p),pct=roomHealthPercent(p),concealed=!roomVisibleHP(p),selected=roomCurrentFocus()?.id===p.id;
 const states=roomConditionNames(p);
 return `<button type="button" class="sr-combatant ${i===0?'is-turn':''} ${selected?'is-inspected':''}" data-action="selectCombatant" data-id="${safe(p.id)}" aria-label="Inspect ${safe(p.name)}, initiative ${p.init}${i===0?', active turn':''}" aria-pressed="${selected}">
 <span class="sr-combatant-top"><span class="sr-turn-tag">${i===0?'✦ ACTIVE TURN':'INITIATIVE '+p.init}</span>${p.npc?`<span class="sr-npc-mark">NPC</span>`:icon('shield')}</span>
 <span class="sr-portrait"><span class="sr-portrait-orbit"></span><span class="sr-portrait-letter">${safe(p.name.slice(0,1))}</span></span>
 <span class="sr-combatant-title">${safe(p.name)}</span><span class="sr-combatant-meta">${c?`${safe(c.ancestry)} · ${safe(c.className)}`:safe(p.kind||'Creature')}</span>
 <span class="sr-combatant-hp-top"><small>${concealed?'HP concealed':h.hp+' / '+h.max+' HP'}</small><small>${states.length?states.length+' condition'+(states.length>1?'s':''):i===0?'Acting now':'Waiting'}</small></span>
 <span class="sr-hp-track ${concealed?'concealed':''}"><span style="width:${concealed?100:pct}%;background:${concealed?'#695773':roomHealthColor(p)}"></span></span>
 </button>`;
}
function roomDetails(p,r){const c=roomCharacter(p),h=roomHP(p),isActive=r.queue[0]?.id===p.id,mayControl=roomCanManage(p),hidden=!roomVisibleHP(p),states=roomConditionNames(p);
 const death=p.death||{success:0,fail:0,stable:false};
 return `<section class="sr-focus ${roomDetailOpen?'':'is-closed'}" aria-label="Combatant details">
 <div class="sr-focus-head"><div class="sr-focus-identity"><span class="sr-focus-sigil">${icon(c?'user':'shield')}</span><div><span class="v2-overline">${isActive?'✦ CURRENTLY ACTING':'COMBATANT INSPECTOR'} · ${safe(c?.owner==='You'?'YOUR CHARACTER':c?'PARTY CHARACTER':'NPC')}</span><h3>${safe(p.name)}</h3><p>${c?safe(c.ancestry)+' · '+safe(c.className)+' · Level '+c.level:safe(p.kind||'Creature')+' · Initiative '+p.init}</p></div></div>
 <div class="sr-focus-controls"><span class="sr-focus-turn ${isActive?'active':''}">${isActive?'Active turn':'Waiting · Initiative '+p.init}</span><button type="button" class="sr-text-button" data-action="toggleRoomDetails" aria-expanded="${roomDetailOpen}">${roomDetailOpen?'Collapse details −':'Expand details +'}</button></div></div>
 ${roomDetailOpen?`<div class="sr-focus-body"><div class="sr-resource-grid">
 <div class="sr-resource"><span>HIT POINTS</span><strong>${hidden?'Hidden':h.hp+' <small>/ '+h.max+'</small>'}</strong><div class="sr-hp-track ${hidden?'concealed':''}"><span style="width:${hidden?100:roomHealthPercent(p)}%;background:${hidden?'#695773':roomHealthColor(p)}"></span></div></div>
 <div class="sr-resource"><span>ARMOUR CLASS</span><strong>${p.npc&&p.hiddenAC&&db.role!=='dm'?'—':h.ac}</strong><small>${p.npc?'Creature defence':'Character sheet'}</small></div>
 <div class="sr-resource"><span>INITIATIVE</span><strong>${p.init>=0?'+':''}${p.init}</strong><small>${isActive?'Currently acting':'In turn order'}</small></div>
 </div>
 <div class="sr-focus-toolbar"><div class="sr-conditions"><span class="sr-mini-label">CONDITIONS</span><div class="sr-condition-list">${states.map(name=>`<button type="button" class="sr-condition-chip" data-action="conditionInfo" data-id="${safe(name)}" title="${safe(CONDITIONS[name]||'Custom demo condition')}">${safe(name)} ${icon('help')}</button>`).join('')||'<span class="sr-no-conditions">None affecting this combatant</span>'}</div></div>${db.role==='dm'?`<div class="sr-inspector-actions"><button type="button" class="btn ghost small" data-action="editConditions" data-id="${safe(p.id)}">Conditions</button><button type="button" class="btn ghost small" data-action="editInitiative" data-id="${safe(p.id)}">Initiative</button>${p.npc?`<button type="button" class="btn ghost small" data-action="toggleCreatureHP" data-id="${safe(p.id)}">${p.hiddenHP?'Reveal HP':'Conceal HP'}</button>`:''}<button type="button" class="sr-remove" data-action="removeCombatant" data-id="${safe(p.id)}" title="Remove from this offline initiative order">Remove</button></div>`:''}</div>
 ${mayControl&&!hidden?`<div class="sr-quick-actions"><span class="sr-mini-label">HEALTH CONTROLS <small>· demo values</small></span><div class="sr-quick-action-row"><button data-action="roomHP" data-id="${safe(p.id)}" data-delta="-5">− 5 HP</button><button data-action="roomHP" data-id="${safe(p.id)}" data-delta="-1">− 1 HP</button><button data-action="roomHP" data-id="${safe(p.id)}" data-delta="1">+ 1 HP</button><button data-action="roomHP" data-id="${safe(p.id)}" data-delta="5">+ 5 HP</button></div></div>`:''}
 ${h.hp===0&&!hidden?`<div class="sr-death"><div><strong>${death.fail>=3?'Three failed saves':death.stable?'Stabilised':'Unconscious · 0 HP'}</strong><p>Demo death-save track · 10 or higher succeeds; a natural 1 counts twice and 20 restores 1 HP.</p></div><div class="sr-death-record"><span>Successes <strong>${'●'.repeat(death.success)}${'○'.repeat(3-death.success)}</strong></span><span>Failures <strong>${'●'.repeat(death.fail)}${'○'.repeat(3-death.fail)}</strong></span></div>${mayControl?`<button class="btn ghost small" data-action="deathSave" data-id="${safe(p.id)}" ${death.stable||death.fail>=3?'disabled':''}>Roll death save</button>`:''}</div>`:''}
 <div class="sr-focus-footer">${c?lnk('/characters/'+encodeURIComponent(c.id),'Open full character sheet ↗','sr-text-link'):'<span>Creature data is local to this room</span>'}<span>${mayControl?'Controls available in this preview':'Inspect only · DM controls protected'}</span></div></div>`:''}</section>`;
}
const TURN_ACTIONS=[['action','Action'],['bonus','Bonus action'],['movement','Movement'],['reaction','Reaction']];
let roomToolsOpen=false;
function roomTurnCompass(r){
 const active=r.queue[0],next=r.queue.length>1?r.queue[1]:null;if(!active)return '';
 const allowed=!!roomCanManage(active),flags=r.turnTrack?.flags||{};
 return `<section class="sr-turn-tools" aria-label="Optional turn tools">
  <div class="sr-turn-tools-head"><div class="sr-turn-tools-label"><span class="v2-overline">TURN UTILITIES</span><span class="sr-turn-tools-upnext">Next: <strong>${safe(next?.name||'New round')}</strong></span></div>
  <button type="button" class="sr-text-button" data-action="toggleRoomTools" aria-expanded="${roomToolsOpen}">${roomToolsOpen?'Hide action tracker −':'Show action tracker +'}</button></div>
  ${roomToolsOpen?`<div class="sr-turn-tools-body"><div class="sr-turn-tools-caption">Optional turn markers · reset each turn. They do not enforce Terravale combat rules.</div><div class="sr-action-slots">${TURN_ACTIONS.map(([name,label])=>`<button type="button" class="sr-action-slot ${flags[name]?'spent':''}" data-action="toggleTurnAction" data-id="${safe(active.id)}" data-value="${name}" aria-pressed="${!!flags[name]}" ${allowed?'':'disabled title="Only the active player or DM can edit"'}><span class="sr-action-indicator">${flags[name]?'✓':'○'}</span><span>${label}</span><small>${flags[name]?'Marked used':'Available'}</small></button>`).join('')}</div></div>`:''}
 </section>`;
}
function roomTablePulse(r){const rows=(r.events||[]).slice(-5).reverse();return `<section class="sr-pulse" aria-label="Combat activity log"><div class="sr-pulse-head"><div class="sr-pulse-label"><span class="sr-pulse-glyph">${icon('clock')}</span><div><span class="v2-overline">THE TABLE REMEMBERS</span><h3>Combat activity</h3></div></div><span class="sr-pulse-last">${rows.length?safe(rows[0].text):'No combat events recorded yet'}</span><button type="button" class="sr-text-button" data-action="toggleRoomLog" aria-expanded="${roomLogOpen}">${roomLogOpen?'Hide history −':'View history +'}</button></div>${roomLogOpen?`<div class="sr-pulse-list">${rows.length?rows.map(x=>`<div class="sr-pulse-item"><span class="sr-pulse-round">ROUND ${x.round}</span><span class="sr-pulse-dot ${safe(x.type)}"></span><span>${safe(x.text)}</span><small>${safe(x.who)}</small></div>`).join(''):'<div class="sr-pulse-none">End a turn, use a tracker or roll the dice to create an entry.</div>'}</div>`:''}</section>`}
function renderParty(){
 const r=getRoom(),q=db.mode==='empty'?[]:r.queue,chat=db.mode==='empty'?[]:r.chat.filter(m=>!m.private||db.role==='dm'||(m.ownerUid&&m.ownerUid===window.TerravaleVerifiedAccount?.state.profile?.discord_uid)||m.who==='You'),active=q[0]||null,focus=q.find(p=>p.id===roomFocusId)||active;
 const activeIsMine=active&&roomCharacter(active)?.owner==='You',canEnd=db.role==='dm'||activeIsMine;
 const chars=activeCharacters().filter(c=>c.status==='Approved');const rollChar=chars.find(c=>c.owner==='You')||chars[0];
 const available=chars.filter(c=>!q.some(p=>p.id===c.id)).length;
 const dmControls=db.role==='dm'?`<button class="btn ghost small" data-action="toggleRoomDM" aria-expanded="${roomDMOpen}">${icon('shield')} DM desk ${roomDMOpen?'−':'+'}</button>`:'';
 return pageHeader('YOUR TABLE · TACTICAL WORKSPACE','Session Room','Session workspace · chat currently stored in this browser')+
 `<section class="sr-statusbar" aria-label="Session overview"><div class="sr-status-campaign"><span class="v2-overline">SESSION ROOM · ACTIVE CAMPAIGN</span><strong>${safe(campaignName())}</strong></div><div class="sr-status-current"><span class="sr-status-live"></span><span>${active?'Now acting: <strong>'+safe(active.name)+'</strong>':'Awaiting initiative'}</span></div><div class="sr-status-links">${lnk('/campaigns/'+encodeURIComponent(db.campaign),'Campaign','sr-text-link')}${lnk('/characters','Characters','sr-text-link')}<span class="sr-local-tag">BETA</span></div><div class="sr-status-metrics"><span>ROUND <strong>${String(r.round).padStart(2,'0')}</strong></span><span>IN QUEUE <strong>${String(q.length).padStart(2,'0')}</strong></span></div></section>
 <div class="sr-workspace"><section class="sr-encounter v2-section"><header class="sr-section-head"><div><span class="v2-overline">THE TURNING OF FATE</span><h2>Initiative order <span class="sr-section-sub">· Round ${r.round}</span></h2><p>The active combatant leads. After ending their turn they move to the back of the queue.</p></div><div class="v2-actions">${dmControls}<button type="button" class="btn primary small" data-action="endTurn" ${!active||!canEnd?'disabled':!canEnd?'disabled':''}>End ${canEnd?'turn':'active turn'} ${icon('chevron')}</button></div></header>
 ${q.length?`<div class="sr-queue" aria-label="Combat turn order">${q.map((p,i)=>roomInitiativeCard(p,i,r)).join('')}</div>${focus?roomDetails(focus,r):''}${roomTurnCompass(r)}`:
 `<div class="sr-empty-combat"><div class="sr-empty-sigil">${icon('swords')}</div><h3>No initiative order yet</h3><p>${db.mode==='empty'?'Switch to Sample mode to preview combat with an example party.':'In DM mode, add your campaign characters or a new creature to begin combat.'}</p>${db.role==='dm'?`<button class="btn primary small" data-action="addRoster">Add party members →</button>`:''}</div>`}
 </section>
 ${db.role==='dm'?`<section class="sr-dm-desk ${roomDMOpen?'':'is-closed'}" aria-label="DM combat desk"><div class="sr-dm-desk-head"><div class="sr-dm-icon">${icon('shield')}</div><div><span class="v2-overline">DUNGEON MASTER CONTROLS</span><h3>The DM desk</h3><p>Local tools for encounter setup and visibility. These do not affect the live table.</p></div><button type="button" data-action="toggleRoomDM" class="sr-text-button" aria-expanded="${roomDMOpen}">${roomDMOpen?'Hide −':'Show +'}</button></div>${roomDMOpen?`<div class="sr-dm-actions"><button class="btn ghost small" data-action="addRoster">${icon('user')} Add party${available?' ('+available+')':''}</button><button class="btn ghost small" data-action="addNpc">${icon('plus')} Add NPC / creature</button><button class="btn ghost small" data-action="initiativePrompt">${icon('dice')} Request initiative</button><button class="btn ghost small" data-action="resetQueue">${icon('clock')} Reset encounter</button><button class="btn ghost small" data-action="clearQueue">Clear initiative</button></div><p class="sr-dm-note">Creature HP can be concealed from player preview; only DMs can change conditions, add combatants, and manage the full initiative queue.</p>`:''}</section>`:''}
 <div class="sr-operations"><div class="sr-lower"><section class="sr-chat-panel" aria-label="Session chat"><header class="sr-panel-head"><div><div class="v2-overline">THE VOICES AT YOUR TABLE</div><h3>Party chat</h3></div><span class="sr-counter">${chat.length} messages</span></header><div class="sr-chat-feed" id="chatFeed" aria-live="polite">${chat.map(m=>`<article class="sr-chat-entry ${m.type==='roll'?'is-roll':''} ${m.type==='system'?'is-system':''}"><span class="sr-chat-avatar">${m.type==='roll'?icon('dice'):m.type==='system'?icon('star'):m.avatar?'<img src="'+safe(m.avatar)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':safe(m.who.slice(0,1))}</span><div class="sr-chat-text"><div class="sr-chat-meta"><strong>${safe(m.who)}</strong>${m.private?'<span class="sr-private">PRIVATE</span>':''}<time>${safe(m.when||'Local demo')}</time></div><p>${safe(m.text)}</p></div></article>`).join('')||`<div class="sr-chat-placeholder">${icon('feather')}<p>There are no messages yet. Your first words can begin the story.</p></div>`}</div><form id="chatForm" class="sr-chat-form" autocomplete="off"><input type="text" name="message" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" data-lpignore="true" class="v2-input" placeholder="Say something to the party…" maxlength="800" required aria-label="Chat message"><button type="submit" class="btn primary small">Send ${icon('chevron')}</button></form></section>
 <section class="sr-dice-panel" aria-label="Session dice roller"><header class="sr-panel-head"><div><div class="v2-overline">THE WILL OF FATE</div><h3>Dice & checks</h3></div>${icon('dice')}</header>
 <div class="sr-dice-area"><div class="sr-dice-description">Choose your die, adjust your modifier and roll. Results appear in the local chat.</div><div class="sr-dice-grid">${[4,6,8,10,12,20,100].map(n=>`<button type="button" class="sr-die" data-action="roll" data-faces="${n}" aria-label="Roll d${n}"><span class="sr-die-symbol">${n===20?'◈':n===100?'◇':'⬡'}</span><strong>d${n}</strong></button>`).join('')}</div>
 <form id="diceForm" class="sr-dice-form"><label class="v2-field">NUMBER OF DICE<select name="count">${[1,2,3,4,5,6,8,10].map(n=>`<option value="${n}">${n} die${n>1?'s':''}</option>`).join('')}</select></label><label class="v2-field">DIE<select name="faces">${[4,6,8,10,12,20,100].map(n=>`<option value="${n}" ${n===20?'selected':''}>d${n}</option>`).join('')}</select></label><label class="v2-field">MODIFIER<input type="number" name="mod" min="-30" max="30" value="0"></label><label class="sr-dice-share"><input type="checkbox" name="share" checked> Post result to party chat</label><button class="btn primary" type="submit">${icon('dice')} Roll dice</button></form>
 ${r.lastDice?`<div class="sr-last-roll"><span>LAST ROLL · ${safe(r.lastDice.label||'Dice roll')}</span><div><strong>${r.lastDice.total}</strong><small>${safe(r.lastDice.expr)} · ${safe(r.lastDice.raw)}</small></div></div>`:`<div class="sr-last-roll idle"><span>YOUR NEXT ROLL</span><strong>—</strong><small>Fate is waiting for you.</small></div>`}
 <div class="sr-quick-checks"><button type="button" data-action="toggleQuickChecks" class="sr-text-button" aria-expanded="${roomQuickOpen}">Character quick checks ${icon('chevron')}</button>${roomQuickOpen?`<div class="sr-quick-inner"><label class="v2-field">Roll as <select id="quickCharacter">${chars.filter(c=>db.role==='dm'||c.owner==='You').map(c=>`<option value="${safe(c.id)}" ${rollChar?.id===c.id?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label><div class="sr-ability-grid">${[['STR','str'],['DEX','dex'],['CON','con'],['INT','int'],['WIS','wis'],['CHA','cha']].map(([name,attr])=>`<button type="button" data-action="quickCheck" data-ability="${attr}" aria-label="Roll ${name} ability check"><strong>${name}</strong><small>d20</small></button>`).join('')}</div><small>Ability-score modifiers only. Proficiency and class-specific bonuses are not simulated.</small></div>`:''}</div>
 <details class="sr-attack"><summary>Attack against AC / damage <span>+</span></summary><form id="attackForm" class="sr-attack-form"><label class="v2-field">TARGET (OPTIONAL)<select name="target" id="attackTarget"><option value="">Manual target AC below</option>${r.queue.filter(p=>!(p.npc&&p.hiddenAC&&db.role!=='dm')).map(p=>`<option value="${safe(p.id)}">${safe(p.name)} · AC ${roomHP(p).ac}</option>`).join('')}</select></label><div class="sr-attack-fields"><label class="v2-field">ATTACK BONUS<input name="bonus" type="number" min="-30" max="30" value="5"></label><label class="v2-field">TARGET AC<input name="ac" type="number" min="1" max="40" value="14"></label><label class="v2-field">DAMAGE DIE<select name="damage">${[4,6,8,10,12].map(n=>`<option value="${n}" ${n===8?'selected':''}>d${n}</option>`).join('')}</select></label><label class="v2-field">DAMAGE BONUS<input name="damageBonus" type="number" min="-20" max="30" value="3"></label></div>${db.role==='dm'?'<label class="sr-inline-check"><input type="checkbox" name="applyDamage"> Apply damage on hit to selected target (DM demo only)</label>':''}<button type="submit" class="btn ghost small">Roll attack & potential damage →</button><p>Demo only: d20 + bonus versus AC. Natural 20 doubles damage dice; natural 1 misses. Target AC is filled from the selected combatant; HP is unchanged unless the DM opts in.</p></form></details>
 </div></section></div>${roomTablePulse(r)}</div></div><div class="sr-offline-note">${icon('shield')} Session Room V2 is a local design sandbox. No real initiative, combat, chat, account or roll information is transmitted.</div>`+foot();
}
function renderDM(){
 if(db.role!=='dm'||!window.TerravaleVerifiedAccount?.state?.profile?.is_dm) return pageHeader('DUNGEON MASTER','DM Chronicle is locked','Switch to DM view with a verified Dungeon Master account.')+foot();
 let pending=db.characters.filter(c=>c.status==='Pending');return pageHeader('DUNGEON MASTER · OPERATIONS','DM Chronicle','Campaign operations and character review.')+
 v2Hero('THE KEEPER OF THE TABLE','The story behind <em>every story.</em>','Manage your local campaign drafts and try the review workflow, without changing the online DM Chronicle.',lnk('/campaigns','Manage campaigns','btn ghost')+lnk('/party','Open Session Room','btn primary'))+
 `${db.role!=='dm'?`<div class="v2-note v2-section"><strong>DM view required.</strong> Switch to DM in the bottom preview controls to test character approvals and global ad settings.</div>`:''}
 <div class="v2-grid three"><div class="v2-card"><div class="v2-overline">ACTIVE CAMPAIGN</div><h3>${safe(campaignName())}</h3><p>${db.campaigns.length} local campaigns</p></div><div class="v2-card"><div class="v2-overline">PENDING APPROVALS</div><h3>${pending.length}</h3><p>Characters submitted for review</p></div><div class="v2-card"><div class="v2-overline">PARTY MEMBERS</div><h3>${activeCharacters().length}</h3><p>Characters in the selected story</p></div></div>
 <div class="v2-layout v2-section"><section><h2 style="font-size:26px">Approval queue</h2><div class="v2-stack" style="margin-top:13px">${pending.length?pending.map(c=>`<div class="v2-row"><div><span class="v2-overline">PENDING · ${safe(c.campaign)}</span><h3>${safe(c.name)}</h3><small>${safe(c.ancestry)} ${safe(c.className)}</small></div><div class="v2-actions">${lnk('/characters/'+c.id,'Inspect','btn ghost small')}${db.role==='dm'?`<button class="btn primary small" data-action="approveCharacter" data-id="${safe(c.id)}">Approve</button>`:''}</div></div>`).join(''):empty('The desk is clear','There are no draft characters awaiting approval. Create a new character to test this workflow.','/characters/create','Create a character')}</div></section><aside class="v2-stack"><div class="v2-card"><div class="v2-overline">ACCOUNT SETTINGS</div><h3>Advertisement Atelier</h3><p>Manage advertisements and Adblockn’t from the DM-exclusive section inside the Cabinet.</p><div class="v2-actions"><a class="btn ghost small" href="#/cabinet-of-curiosities">Open Cabinet →</a></div></div></aside></div>`+foot()}
const themes=[
{id:'classic',name:'Classic Codex',sub:'The original violet-and-ink design',bg:'#0d0c14',a:'#c3a5ff'},
{id:'shady',name:'Bone Zone',sub:'Carved bone, charcoal and antique ivory',bg:'#0d0d0a',a:'#e6d7b6'},
{id:'zero',name:'Absolute Zero',sub:'True black with restrained controls; rarity colours remain visible',bg:'#030303',a:'#d1d1d1'},
{id:'night',name:'Night Sky',sub:'Midnight indigo, distant stars and moonlit blue',bg:'#03081a',a:'#a9cfff'},
{id:'guildie',name:'Guildie',sub:'Royal purple, rich shadow and radiant gold',bg:'#12071a',a:'#c29af5'},
{id:'verdant',name:'Verdant Archive',sub:'Forest canopy, emerald light and old brass',bg:'#06140e',a:'#8fd7a7'},
{id:'crimson',name:'Crimson Court',sub:'Wine-dark velvet, ruby accents and antique gold',bg:'#19090e',a:'#e48b97'},
{id:'nullmeridian',name:'Null Meridian',sub:'Fractured midnight, eerie cyan and broken geometric light',bg:'#04090e',a:'#6dd5e8'},
{id:'gloamglass',name:'Gloamglass',sub:'Petrol-black, iridescent teal and fractured stained-glass light',bg:'#061c20',a:'#70cdbd'}
];
function renderAppearance(){return pageHeader('MAKE IT YOURS','Appearance','Change the mood without changing the story.')+
 v2Hero('THE FACE OF THE CODEX','Every world has <em>an atmosphere.</em>','Preview the V2 themes and save your selection to your Discord account. Appearance and theme variants sync to your verified Discord account.',lnk('/','Return to Dashboard','btn ghost'))+
 `<div class="v2-grid">${themes.map(t=>`<div class="v2-card theme-card ${db.theme===t.id?'active':''}"><div class="v2-overline">APPEARANCE THEME</div><div class="theme-preview" style="background:${t.bg}"><span style="background:${t.a}"></span><span style="background:${t.bg}"></span><span style="background:${t.a}33"></span></div><h3>${t.name}</h3><p>${t.sub}</p><button class="btn ${db.theme===t.id?'primary':'ghost'} small" data-action="theme" data-id="${t.id}" style="margin-top:15px">${db.theme===t.id?'✓ Current theme':'Preview this theme'}</button></div>`).join('')}</div><div class="v2-note v2-section">Appearance changes apply across Terravale and synchronise securely to your Discord account. Unlocking Seeing Red reveals the Crimson Court moon mode.</div>`+foot()}
function searchable(){return [...CLASS.map(r=>({name:r.name,kind:'Class reference',route:'/classes/'+r.slug})),...ANCESTRY.map(r=>({name:r.name,kind:'Ancestry',route:'/ancestries/'+r.slug})),...world.map(r=>({name:r.title,kind:r.kind,route:'/codex/'+r.id})),...Object.entries(titles).filter(([k])=>!['/'].includes(k)).map(([k,n])=>({name:n,kind:'Site page',route:k}))]}
function renderSearch(){let all=searchable(),q=modeSearch.toLowerCase().trim();let results=all.filter(x=>!q||(`${x.name} ${x.kind}`).toLowerCase().includes(q));return pageHeader('THE INDEX OF ALL THINGS','Search Codex','Find a page, place or path.')+
 v2Hero('BEYOND THE MARGINS','What are you <em>looking for?</em>','Find classes, ancestries, world entries and site pages across the offline preview.')+
 `<label class="v2-field"><span>Search the archive</span><input id="siteSearchInput" class="v2-input" type="search" value="${safe(modeSearch)}" placeholder="Try Shaman, Frostvale or Journal…" autocomplete="off" autofocus></label><div class="v2-section">${sectionHead('MATCHES','Search results',results.length+' matching entries')}<div class="v2-list">${results.slice(0,80).map(x=>`<a href="#${safe(x.route)}" class="v2-row" data-search-result="true"><span><span class="v2-overline">${safe(x.kind)}</span><h3>${safe(x.name)}</h3></span><span class="v2-link">Open ↗</span></a>`).join('')||empty('Nothing found','Try a different spelling or a broader topic.')}</div></div>`+foot()}
function renderHelp(){return pageHeader('THE GUIDES','Help & Tutorial','Learn Terravale through the guided player tour. Replay it whenever you like.')+
 v2Hero('WELCOME TO THE LIVING CODEX','Find your way through <em>Terravale.</em>','Your verified Discord profile, campaigns, character sheets and appearance are connected online. Some notes and reference tools remain browser-local while V2 is in beta.')+
 `<div class="v2-grid two"><div class="v2-card"><div class="v2-overline">01 · THE DASHBOARD</div><h3>Choose a starting point</h3><p>Join a campaign to see its live character records, use the dashboard to jump to your adventurer, and navigate the site through the shared sidebar.</p></div><div class="v2-card"><div class="v2-overline">02 · EXPLORE AND COLLECT</div><h3>Keep a record</h3><p>Read a class entry and mark it as read, Quick Save lore pages, journal your travels and see the Cabinet respond.</p></div><div class="v2-card"><div class="v2-overline">03 · THE SESSION ROOM</div><h3>Take a turn</h3><p>Inspect combatants, end your own turn, manage conditions, roll checks or attack against AC, and use the DM desk to add or reset combatants.</p></div><div class="v2-card"><div class="v2-overline">04 · REAL ACCOUNT</div><h3>Reset whenever you want</h3><p>Profile and campaign changes use your signed-in account. The demo reset, when available to the DM, is a separate confirmed online operation.</p></div></div><div class="v2-note v2-section">Keyboard shortcuts: press <strong>Ctrl+B</strong> to collapse or expand the desktop sidebar, or press <strong>/</strong> while not typing to jump to Search. On narrow screens, open the sidebar from the top-left menu.</div>`+foot()}
let lastRoute='',modalTrigger=null;
function renderPage(scroll=true){let p=route();document.body.dataset.theme=db.theme;const root=$('pageRoot');root.classList.remove(...[...root.classList].filter(c=>c.startsWith('page-')));root.classList.add(p==='/'?'page-dashboard':p==='/party'?'page-session':p==='/campaigns'?'page-campaigns':p.startsWith('/campaigns/')?'page-campaign-detail':p==='/characters'?'page-characters':p==='/characters/create'?'page-creator':p.startsWith('/characters/')?'page-sheet':p==='/cabinet-of-curiosities'?'page-cabinet':p==='/classes'||p==='/ancestries'||p==='/codex'?'page-library':p.startsWith('/classes/')||p.startsWith('/ancestries/')||p.startsWith('/codex/')?'page-reference':'page-generic');let out='';if(p==='/')renderDashboard();else{
 if(p==='/campaigns')out=renderCampaigns();else if(p.startsWith('/campaigns/'))out=renderCampaignDetail(p.split('/')[2]);else if(p==='/party')out=renderParty();else if(p==='/characters')out=renderCharacters();else if(p==='/characters/create')out=renderCreate();else if(p.startsWith('/characters/'))out=renderSheet(p.split('/')[2]);else if(p==='/classes')out=renderArchive('class');else if(p.startsWith('/classes/'))out=renderReference('class',p.split('/')[2]);else if(p==='/ancestries')out=renderArchive('ancestry');else if(p.startsWith('/ancestries/'))out=renderReference('ancestry',p.split('/')[2]);else if(p==='/codex')out=renderWorld();else if(p.startsWith('/codex/'))out=renderWorldDetail(p.split('/')[2]);else if(p==='/journal')out=renderJournal();else if(p==='/bookmarks')out=renderBookmarks();else if(p==='/cabinet-of-curiosities')out=renderCabinet();else if(p==='/dm'||p.startsWith('/dm/'))out=renderDM();else if(p==='/appearance')out=renderAppearance();else if(p==='/search')out=renderSearch();else if(p==='/help')out=renderHelp();else if(p==='/rules-foundation')out=renderRulesFoundation();else out=pageHeader('LOST IN THE ARCHIVE','Page not found','')+empty('The path fades here','Choose a location from the sidebar.','/','Return to dashboard');$('pageRoot').innerHTML=out;
 }
 let title=p.startsWith('/campaigns/')?(getCampaign(p.split('/')[2])?.name||'Campaign overview'):(p.startsWith('/characters/')&&p!=='/characters/create'?(db.characters.find(x=>x.id===p.split('/')[2])?.name||'Character Sheet'):(titles[p]||p.split('/').at(-1).replace(/-/g,' ')));document.querySelector('.breadcrumb strong').textContent=title;document.title=title+' · Terravale Codex V2.87';updateNavActive(p);document.querySelectorAll('[data-role]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.role===db.role)));document.querySelectorAll('[data-state]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.state===db.mode)));if(scroll)window.scrollTo({top:0,behavior:'instant'});const label=$('trayRoleLabel');if(label)label.textContent=db.role==='dm'?'DM':'PLAYER';if(p==='/party'){const el=$('chatFeed');if(el)el.scrollTop=el.scrollHeight}if(db.adsEnabled&&scroll&&Math.random()<.12&&!document.querySelector('.preview-ad'))spawnAd();lastRoute=p;}
function updateNavActive(p){let all=[...document.querySelectorAll('#nav [data-path]')];let matches=all.filter(b=>{let x=b.dataset.path;return x==='/'?p==='/':p===x||p.startsWith(x+'/')});let active=matches.sort((a,b)=>b.dataset.path.length-a.dataset.path.length)[0];all.forEach(b=>{let is=b===active;b.classList.toggle('active',is);if(is){let g=b.closest('.nav-group');if(g){let items=g.querySelector('.group-items');items.hidden=false;let button=g.querySelector('.group-label');button.setAttribute('aria-expanded','true');button.querySelector('.group-chevron').textContent='⌄';}}})}
function modal(title,desc,body='',trigger){modalTrigger=trigger||document.activeElement;$('modalTitle').textContent=title;$('modalDesc').textContent=desc;$('modalBody').innerHTML=body;$('modal').hidden=false;document.body.style.overflow='hidden';$('modalClose').focus()}
function closeModal(){$('modal').hidden=true;document.body.style.overflow='';$('modalBody').innerHTML='';if(modalTrigger?.isConnected)modalTrigger.focus()}
function spawnAd(){if(document.querySelector('.preview-ad')){toast('A test pop-up is already open');return}let element=document.createElement('div');element.className='preview-ad';element.innerHTML=`<div class="v2-overline" style="color:#e2b7f4">AN ADVERTISEMENT FROM NOWHERE</div><strong>MAGITECH THERAPY POD</strong><p>For the problem you never knew you had. Strictly an offline placeholder advertisement.</p><button data-action="closeAd">Dismiss advertisement ×</button>`;document.body.appendChild(element)}
function modifyHP(id,delta){let c=db.characters.find(c=>c.id===id);if(!c)return;if(c.owner!=='You'&&db.role!=='dm'){toast('Switch to DM mode to edit another character');return}const beforeHP=c.hp;c.hp=Math.min(c.maxHp,Math.max(0,c.hp+delta));if(beforeHP===0&&c.hp>0&&c.sheetV220)c.sheetV220.death={success:0,fail:0};persist();renderPage(false);if(c.hp===0)toast(c.name+' is at 0 HP · unconscious in this sample')}
function roll(faces,mod=0){roomRoll(faces,mod,1,'Dice roll',true)}
async function handleAction(el){let action=el.dataset.action,id=el.dataset.id,val=el.dataset.value;
 if(action.startsWith('sheet')){sheetV220Handle(el);return;}
 switch(action){
 case 'ledgerFilter':ledgerFilter=val;renderPage(false);break;
 case 'ledgerClear':ledgerQuery='';ledgerFilter='all';renderPage(false);break;
 case 'ledgerView':ledgerView=val==='compact'?'compact':'gallery';renderPage(false);break;
 case 'ledgerFeature':{const c=db.characters.find(x=>x.id===id&&x.campaign===db.campaign);if(!c||c.owner!=='You'){toast('Only your own adventurers can be featured on the Dashboard');return}db.featuredCharacters??={};db.featuredCharacters[db.campaign]=id;persist();renderPage(false);toast('Featured adventurer updated');break;}
 case 'ledgerExport':{
  const c=db.characters.find(x=>x.id===id);if(!c||!ledgerOwned(c)){toast('Only your characters can be exported');return}
  const {portrait,...record}=c;const data={format:'terravale-offline-character-v1',exportedAt:new Date().toISOString(),character:record};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=(c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'character')+'.terravale.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Character JSON exported (portrait excluded)');break;
 }
 case 'ledgerPortrait':{
  const c=db.characters.find(x=>x.id===id);if(!c||!ledgerOwned(c))return;
  modal('Character portrait','Choose a local image. It stays in this browser and is reduced to a small thumbnail.',`<form id="ledgerPortraitForm" class="v2-form"><input type="hidden" name="id" value="${safe(c.id)}"><label class="v2-field">Upload portrait (PNG, JPG or WebP, under 3 MB)<input type="file" name="portrait" accept="image/png,image/jpeg,image/webp" required></label><div class="v2-actions"><button class="btn primary" type="submit">Save portrait</button>${c.portrait?`<button class="btn ghost" type="button" data-action="ledgerRemovePortrait" data-id="${safe(c.id)}">Remove portrait</button>`:''}</div></form>`,el);break;
 }
 case 'ledgerRemovePortrait':{const c=db.characters.find(x=>x.id===id);if(!c||!ledgerOwned(c))return;delete c.portrait;persist();closeModal();renderPage(false);toast('Local portrait removed');break;}
 case 'selectCampaign':{let chosen=getCampaign(id);if(!chosen)return;if(chosen.status==='Archived'){toast('Restore this campaign in DM settings before selecting it');return}db.campaign=id;persist();toast('Active campaign: '+campaignName());renderPage(false);break}
 case 'campaignFilter':campaignFilter=val;renderPage(false);break;
 case 'campaignClear':campaignFilter='all';campaignQuery='';campaignSort='default';renderPage(false);break;
 case 'campaignTab':campaignDetailTab=val;renderPage(false);break;
 case 'scrollCampaignForms':document.getElementById('campaignEntry')?.scrollIntoView({behavior:'smooth'});break;
 case 'campaignArchive':{if(db.role!=='dm'){toast('Switch to DM preview to manage campaign details');return}let c=getCampaign(id);if(!c)return;if(c.status==='Archived'){c.status=c.priorStatus||'Ongoing';delete c.priorStatus;toast('Campaign restored')}else{c.priorStatus=c.status;c.status='Archived';if(db.campaign===c.id){let next=db.campaigns.find(x=>x.id!==c.id&&x.status!=='Archived');if(next)db.campaign=next.id}toast('Campaign archived in offline preview')}persist();renderPage(false);break;}
 case 'bookmark':markSaved(id);break;
 case 'read':markRead(id);break;
 case 'theme':setTheme(id);break;
 case 'journalScope':journalScope=val;renderPage(false);break;
 case 'cabFilter':cabFilter=val;renderPage(false);break;
 case 'achDetails':{let r=A.find(x=>x.id===id);if(!r)return;let progress=r.goal?achievementProgress(r):null,done=db.unlocked.includes(r.id);let extras=r.goal?`<div class="v2-note">Progress: <strong>${progress} / ${r.goal}</strong>. ${done?'Discovered':'Keep exploring the Codex to continue.'}</div>`:'';modal(r.title,r.description,`<div class="v2-badge ${done?'success':''}" style="margin-bottom:15px">${safe(r.rarity)} · ${done?'✓ Discovered':'◇ Locked'}</div>${extras}`,el);break}
 case 'discipline':{let n=Number(id);if(!db.testedDisciplines.includes(n))db.testedDisciplines.push(n);checkMilestones();persist();renderPage(false);break}
 case 'hp':modifyHP(id,Number(el.dataset.delta));break;
 case 'rest':{let c=db.characters.find(x=>x.id===id);if(!c)return;if(c.owner!=='You'&&db.role!=='dm'){toast('Only the owner or DM may restore this character');return}c.hp=c.maxHp;persist();renderPage(false);toast('Sample long rest: HP restored. Real rest rules are not simulated.');break}
 case 'editBackstory':{let c=db.characters.find(x=>x.id===id);if(!c)return;if(c.owner!=='You'&&db.role!=='dm'){toast('Only the owner or DM may edit this story');return}modal('Edit backstory','This edit remains in the local preview.',`<form id="backstoryForm" class="v2-form"><input type="hidden" name="id" value="${safe(c.id)}"><label class="v2-field">Your story<textarea name="backstory" required>${safe(c.backstory)}</textarea></label><button type="submit" class="btn primary">Save backstory</button></form>`,el);break}
 case 'approveCharacter':{if(db.role!=='dm'){toast('Switch to DM mode first');return}if(!window.TerravaleV278Approval?.approveInitial){toast('Character approval service is not ready. No changes were made.');return;}window.TerravaleV278Approval.approveInitial(id,el);break}
 case 'deleteNote':{if(!confirm('Delete this offline journal entry?'))return;db.notes=db.notes.filter(n=>n.id!==id);persist();renderPage(false);toast('Entry deleted');break}
 case 'editNote':{let n=db.notes.find(x=>x.id===id);if(!n)return;modal('Edit journal entry','Update the draft in this offline workspace.',`<form id="editNoteForm" class="v2-form"><input name="id" value="${safe(n.id)}" type="hidden"><label class="v2-field">Title<input name="title" value="${safe(n.title)}" required></label><label class="v2-field">Entry<textarea name="body" required>${safe(n.body)}</textarea></label><button type="submit" class="btn primary">Save changes</button></form>`,el);break}
 case 'endTurn':{let r=getRoom(),active=r.queue[0];if(!active)return;if(!roomCanManage(active)){toast('Only the active player or DM can end this turn');return}const who=active.name;r.queue.push(r.queue.shift());r.turnsInRound++;if(r.turnsInRound>=r.queue.length){r.round++;r.turnsInRound=0}r.turnTrack=null;roomFocusId='';roomEvent('turn',who+' ends their turn; '+(r.queue[0]?.name||'the table')+' acts next',who);persist();renderPage(false);break}
 case 'toggleTurnAction':{const r=getRoom(),active=r.queue[0];if(!active||active.id!==id||!roomCanManage(active))return;if(!TURN_ACTIONS.some(([key])=>key===val))return;r.turnTrack.flags[val]=!r.turnTrack.flags[val];roomEvent('action',active.name+' '+(r.turnTrack.flags[val]?'marks ':'unmarks ')+TURN_ACTIONS.find(([key])=>key===val)[1].toLowerCase(),active.name);persist();renderPage(false);break}
 case 'toggleRoomTools':roomToolsOpen=!roomToolsOpen;renderPage(false);break;
 case 'toggleRoomLog':roomLogOpen=!roomLogOpen;renderPage(false);break;
 case 'toggleRoomDetails':roomDetailOpen=!roomDetailOpen;renderPage(false);break;
 case 'toggleRoomDM':if(db.role==='dm'){roomDMOpen=!roomDMOpen;renderPage(false)}break;
 case 'toggleQuickChecks':roomQuickOpen=!roomQuickOpen;renderPage(false);break;
 case 'resetQueue':{if(db.role!=='dm'){toast('DM preview required');return}if(!confirm('Restore the starting initiative lineup for this campaign? Current encounter order, conditions and NPCs will be reset.'))return;const r=getRoom(),original=db.campaign==='frostvale'?JSON.parse(JSON.stringify(seed.queue)):activeCharacters().filter(c=>c.status==='Approved').map((c,i)=>({id:c.id,name:c.name,init:17-i*3}));r.queue=original;r.round=1;r.turnsInRound=0;r.events=[];r.turnTrack=null;roomFocusId='';persist();renderPage(false);toast('Encounter restored');break}
 case 'clearQueue':{if(db.role!=='dm')return;if(!confirm('Clear this campaign’s local initiative order?'))return;const r=getRoom();r.queue=[];r.round=1;r.turnsInRound=0;r.events=[];r.turnTrack=null;roomFocusId='';persist();renderPage(false);toast('Initiative cleared');break}
 case 'addRoster':{if(db.role!=='dm')return;const r=getRoom(),all=activeCharacters().filter(c=>c.status==='Approved'),available=all.filter(c=>!r.queue.some(p=>p.id===c.id));modal('Add party characters','Choose any approved character from this active campaign. Their existing HP is shown from the local sheet.',available.length?`<form id="rosterForm" class="v2-form"><div class="sr-roster-choices">${available.map(c=>`<label><input type="checkbox" name="members" value="${safe(c.id)}" checked><span><strong>${safe(c.name)}</strong><small>${safe(c.ancestry)} · ${safe(c.className)} · Level ${c.level}</small></span></label>`).join('')}</div><label class="v2-field">Starting initiative for first character<input type="number" name="init" min="-10" max="40" value="16"></label><button type="submit" class="btn primary">Add to initiative</button></form>`:'<div class="v2-note">All approved campaign characters are already in this initiative list.</div>',el);break}
 case 'addNpc':{if(db.role!=='dm'){toast('Switch to DM preview to add NPCs');return}modal('Add NPC or creature','Add a demonstration creature to the current campaign’s turn queue. Its hit points can be concealed from players.',`<form id="npcForm" class="v2-form"><label class="v2-field">Name<input name="name" maxlength="50" placeholder="Hollow Sentinel" required></label><div class="v2-grid two"><label class="v2-field">Initiative<input type="number" name="init" min="-10" max="40" value="10" required></label><label class="v2-field">Armour Class<input type="number" name="ac" min="1" max="40" value="13" required></label></div><label class="v2-field">Hit points<input type="number" name="hp" min="1" max="9999" value="24" required></label><label class="sr-inline-check"><input type="checkbox" name="hiddenHP" checked> Conceal HP from player preview</label><label class="sr-inline-check"><input type="checkbox" name="hiddenAC"> Conceal AC from player preview</label><button class="btn primary" type="submit">Add combatant →</button></form>`,el);break}
 case 'initiativePrompt':{if(db.role!=='dm')return;roomWrite('Dungeon Master','Initiative requested — ask players to roll and add their results to the DM desk. (Offline demonstration)','system');renderPage(false);toast('Sample initiative prompt added to chat');break}
 case 'selectCombatant':roomFocusId=id;roomDetailOpen=true;renderPage(false);break;
 case 'editInitiative':{if(db.role!=='dm')return;const p=getRoom().queue.find(x=>x.id===id);if(!p)return;modal('Initiative · '+p.name,'Update this combatant’s initiative. Saving reorders the queue and restarts the current round progress, without changing the round number.',`<form id="initiativeForm" class="v2-form"><input type="hidden" name="combatant" value="${safe(p.id)}"><label class="v2-field">Initiative value<input type="number" name="init" min="-30" max="100" value="${p.init}" required></label><button class="btn primary" type="submit">Save initiative</button></form>`,el);break}
 case 'removeCombatant':{if(db.role!=='dm')return;const r=getRoom(),p=r.queue.find(x=>x.id===id);if(!p)return;if(!confirm('Remove '+p.name+' from this local initiative order?'))return;r.queue=r.queue.filter(x=>x.id!==id);r.turnsInRound=0;r.turnTrack=null;roomFocusId='';roomEvent('turn',p.name+' removed from initiative',p.name);persist();renderPage(false);toast(p.name+' removed from initiative');break}
 case 'toggleCreatureHP':{if(db.role!=='dm')return;const p=getRoom().queue.find(x=>x.id===id&&x.npc);if(!p)return;p.hiddenHP=!p.hiddenHP;persist();renderPage(false);toast('Creature HP '+(p.hiddenHP?'concealed':'visible')+' in player view');break}
 case 'conditionInfo':modal(id,'Condition reference · baseline tabletop rules',`<div class="v2-note">${safe(CONDITIONS[id]||'Custom local condition')}</div>`,el);break;
 case 'editConditions':{if(db.role!=='dm')return;let p=getRoom().queue.find(x=>x.id===id);if(!p)return;modal('Conditions · '+p.name,'Select conditions to display on this combatant. Automatic Unconscious is shown at 0 HP.',`<form id="conditionsForm" class="v2-form"><input type="hidden" name="combatant" value="${safe(p.id)}"><div class="sr-condition-checklist">${Object.keys(CONDITIONS).filter(x=>x!=='Unconscious').map(name=>`<label><input type="checkbox" name="conditions" value="${safe(name)}" ${(p.conditions||[]).includes(name)?'checked':''}><span title="${safe(CONDITIONS[name])}">${safe(name)}</span></label>`).join('')}</div><button class="btn primary" type="submit">Save conditions</button></form>`,el);break}
 case 'roomHP':{let p=getRoom().queue.find(x=>x.id===id);if(!p)return;if(!roomCanManage(p)){toast('DM or character owner required');return}roomSetHealth(p,Number(el.dataset.delta)||0);renderPage(false);if(roomHP(p).hp===0)toast(p.name+' is at 0 HP');break}
 case 'deathSave':{let p=getRoom().queue.find(x=>x.id===id);if(!p)return;if(!roomCanManage(p))return;roomDeathRoll(p);break}
 case 'roll':roomRoll(Number(el.dataset.faces),0,1,'d'+el.dataset.faces,true);break;
 case 'quickCheck':{const selected=$('quickCharacter')?.value;let c=db.characters.find(ch=>ch.id===selected),a=el.dataset.ability;if(!c||!(a in c)||!(db.role==='dm'||c.owner==='You'))return;const mod=Math.floor((Number(c[a])-10)/2);roomRoll(20,mod,1,c.name+' · '+a.toUpperCase()+' check',true);roomQuickOpen=true;break}
 case 'toggleAds':{if(db.role!=='dm')return;db.adsEnabled=!db.adsEnabled;persist();renderPage(false);toast('Offline test ads '+(db.adsEnabled?'enabled':'disabled'));break}
 case 'spawnAd':spawnAd();break;
 case 'freshAchievements':{if(!confirm('Start the offline Cabinet achievements from 0 / 62? This only clears demo discoveries and the local read/test counters.'))return;db.unlocked=[];db.read=[];db.themesTried=[];db.testedDisciplines=[];db.dismissedAds=0;persist();renderPage(false);toast('Offline achievements now begin at 0 / 62');break}
 case 'closeAd':{el.closest('.preview-ad')?.remove();db.dismissedAds++;checkMilestones();persist();toast('Test advertisement dismissed · '+db.dismissedAds+'/25');if(route()==='/cabinet-of-curiosities')renderPage(false);break}
 case 'reset':{if(!confirm('Reset ALL locally saved V2 demo progress, characters, notes and appearance? The live Codex will not be changed.'))return;db=defaultDb();persist();queryFilter='';journalScope='private';modeSearch='';cabFilter='all';cabSort='curated';campaignFilter='all';campaignQuery='';campaignSort='default';campaignDetailTab='overview';toast('Offline demonstration reset');renderPage(false);break}
 }
}
function closeMenu(){$('sidebar').classList.remove('open');$('overlay').classList.remove('open');$('mobileToggle').setAttribute('aria-expanded','false')}
document.addEventListener('click',e=>{
 const a=e.target.closest('a[href^="#/"]');if(a){if(a.hasAttribute('data-search-result'))unlock('search_first');closeMenu();return}
 const action=e.target.closest('[data-action]');if(action){e.preventDefault();handleAction(action);return}
 const control=e.target.closest('[data-path]');if(control){e.preventDefault();navigate(control.dataset.path);closeMenu();return}
 const role=e.target.closest('[data-role]');if(role){db.role=role.dataset.role;persist();renderPage(false);toast('Preview role: '+(db.role==='dm'?'Dungeon Master':'Player'));return}
 const state=e.target.closest('[data-state]');if(state){db.mode=state.dataset.state;persist();renderPage(false);toast('Workspace sample: '+(db.mode==='empty'?'empty':'populated'));return}
});
document.addEventListener('submit',e=>{const f=e.target;const formId=f?.getAttribute?.('id');if(!formId)return;e.preventDefault();if(formId.startsWith('sheet')){sheetV220Submit(f);return;}let v=Object.fromEntries(new FormData(f).entries());
 if(formId==='ledgerPortraitForm'){
  const c=db.characters.find(x=>x.id===String(v.id));const file=v.portrait;
  if(!c||!ledgerOwned(c)||!(file instanceof File))return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3000000){toast('Choose a PNG/JPG/WebP image under 3 MB');return}
  (async()=>{try{
   const bitmap=await createImageBitmap(file);const width=Math.max(1,bitmap.width),height=Math.max(1,bitmap.height),scale=Math.min(1,360/Math.max(width,height));
   const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
   const portrait=canvas.toDataURL('image/jpeg',.77);if(portrait.length>700000)throw new Error('Portrait too large');
   c.portrait=portrait;persist();closeModal();renderPage(false);toast('Local portrait saved');
  }catch(err){toast('Could not read image. Try a smaller JPEG or PNG.');console.warn(err)}})();return;
 }
 else if(formId==='joinForm'){if(String(v.code).trim().toUpperCase()!=='TV-DEMO'){toast('Only TV-DEMO works in the offline sample');return}let id='demo-guest';if(!db.campaigns.some(c=>c.id===id))db.campaigns.push({id,name:'The Wayfarers’ Table',description:'Created from the local demonstration invitation.',role:'player',status:'Joined'});db.mode='sample';db.campaign=id;campaignFilter='all';campaignQuery='';unlock('campaign_joined');persist();renderPage(false);toast('Demo campaign joined')}
 else if(formId==='campaignForm'){let name=String(v.name||'').trim();if(name.length<2)return;let id=key('campaign');db.campaigns.push({id,name,description:String(v.description||'').trim()||'A new adventure is waiting for its first chapter.',role:'dm',status:'Draft'});db.mode='sample';db.campaign=id;campaignDetailTab='overview';campaignFilter='all';campaignQuery='';persist();navigate('/campaigns/'+id);toast('Offline campaign created')}
 else if(formId==='campaignSettingsForm'){if(db.role!=='dm'){toast('Switch to DM preview to edit campaigns');return}let c=getCampaign(String(v.id));if(!c)return;let name=String(v.name||'').trim();if(name.length<2){toast('Campaign name must have at least two characters');return}c.name=name;c.description=String(v.description||'').trim();persist();renderPage(false);toast('Offline campaign details saved')}
 else if(formId==='characterForm'){toast('Use Character Studio for an actual campaign-owned sheet.');navigate('/characters/create');return;} else if(formId==='journalForm'){let title=String(v.title||'').trim(),body=String(v.body||'').trim();if(!title||!body)return;let scope=v.scope==='party'?'party':'private';db.notes.unshift({id:key('note'),title,body,scope,campaign:db.campaign,updated:'Just now'});unlock(scope==='private'?'journal_private':'journal_party');checkMilestones();persist();renderPage(false);toast('Journal entry saved')}
 else if(formId==='editNoteForm'){let n=db.notes.find(x=>x.id===v.id);if(!n)return;n.title=String(v.title).trim();n.body=String(v.body).trim();n.updated='Just now';persist();closeModal();renderPage(false);toast('Entry updated')}
 else if(formId==='backstoryForm'){let c=db.characters.find(x=>x.id===v.id);if(!c)return;c.backstory=String(v.backstory).trim();unlock('backstory_first');persist();closeModal();renderPage(false);toast('Character backstory updated')}
 else if(formId==='chatForm'){let message=String(v.message||'').trim();if(!message)return;roomWrite(db.role==='dm'?'Dungeon Master':'You',message);renderPage(false)}
 else if(formId==='diceForm'){roomRoll(Number(v.faces),Number(v.mod),Number(v.count),'Dice roll',v.share==='on')}
 else if(formId==='npcForm'){if(db.role!=='dm')return;let name=String(v.name||'').trim(),hp=Math.max(1,Number(v.hp)||10);if(!name)return;const r=getRoom();r.queue.push({id:key('npc'),name,kind:'Creature',init:Number(v.init)||0,npc:true,hp,maxHp:hp,ac:Math.max(1,Number(v.ac)||12),hiddenHP:v.hiddenHP==='on',hiddenAC:v.hiddenAC==='on',conditions:[]});roomEvent('turn',name+' joins initiative',name);persist();closeModal();renderPage(false);toast('Demo creature added to initiative')}
 else if(formId==='rosterForm'){if(db.role!=='dm')return;const r=getRoom(),values=new FormData(f).getAll('members').map(String);let added=0;values.forEach((id,i)=>{let c=activeCharacters().find(x=>x.id===id&&x.status==='Approved');if(c&&!r.queue.some(p=>p.id===c.id)){r.queue.push({id:c.id,name:c.name,init:Number(v.init||16)-i*2});added++}});if(added)roomEvent('turn',added+' party character(s) added to initiative');persist();closeModal();renderPage(false);toast(added+' party character(s) added')}
 else if(formId==='initiativeForm'){if(db.role!=='dm')return;const r=getRoom(),p=r.queue.find(x=>x.id===String(v.combatant));if(!p)return;p.init=Math.max(-30,Math.min(100,Number(v.init)||0));r.queue.sort((a,b)=>b.init-a.init);r.turnsInRound=0;r.turnTrack=null;roomFocusId=p.id;roomEvent('turn',p.name+' initiative changed to '+p.init,p.name);persist();closeModal();renderPage(false);toast('Initiative order updated')}
 else if(formId==='conditionsForm'){if(db.role!=='dm')return;let p=getRoom().queue.find(x=>x.id===String(v.combatant));if(!p)return;p.conditions=new FormData(f).getAll('conditions').map(String).filter(x=>x in CONDITIONS);roomEvent('condition','Conditions updated: '+p.name+(p.conditions.length?' · '+p.conditions.join(', '):' · none'),p.name);persist();closeModal();renderPage(false);toast('Combat conditions updated')}
 else if(formId==='attackForm'){
  const r=getRoom(),target=r.queue.find(p=>p.id===String(v.target||''));
  const raw=Math.floor(Math.random()*20)+1,bonus=Math.max(-30,Math.min(30,Number(v.bonus)||0)),ac=target?roomHP(target).ac:Math.max(1,Math.min(40,Number(v.ac)||10)),faces=Math.max(4,Math.min(12,Number(v.damage)||8)),damageMod=Math.max(-20,Math.min(30,Number(v.damageBonus)||0));
  if(target?.npc&&target.hiddenAC&&db.role!=='dm'){toast('Target AC is concealed. Use a manual AC only when provided by the DM.');return}
  const hit=raw===20||(raw!==1&&raw+bonus>=ac),critical=raw===20;
  const damageRolls=hit?Array.from({length:critical?2:1},()=>Math.floor(Math.random()*faces)+1):[];
  const damage=hit?Math.max(0,damageRolls.reduce((a,b)=>a+b,0)+damageMod):0;
  r.lastDice={raw:String(raw),total:raw+bonus,mod:bonus,expr:'d20 '+(bonus>=0?'+ '+bonus:'− '+Math.abs(bonus)),label:'Attack roll'};
  const apply=!!(target&&hit&&damage&&v.applyDamage==='on'&&db.role==='dm');
  if(apply)roomSetHealth(target,-damage);
  const label=target?' against '+target.name:'';
  roomWrite(db.role==='dm'?'Dungeon Master':'You',`Attack${label}: ${raw+bonus} (d20 ${raw} ${bonus>=0?'+':'−'} ${Math.abs(bonus)}) vs AC ${ac} · ${hit?(critical?'CRITICAL HIT':'HIT')+' · '+damage+' damage ('+(critical?'2':'1')+'d'+faces+')':'MISS'}${apply?' · HP updated':''}`,'roll');
  roomEvent('attack',(hit?'Hit':'Miss')+label+' · '+(hit?damage+' damage':'no damage')+(apply?' applied to HP':''));
  unlock('dice_first');persist();renderPage(false)
 }

});
document.addEventListener('input',e=>{if(e.target.id==='ledgerSearch'){const q=e.target.value,pos=e.target.selectionStart;ledgerQuery=q;renderPage(false);const input=$('ledgerSearch');if(input){input.focus();input.setSelectionRange(pos??q.length,pos??q.length)}return}if(e.target.id==='campaignSearch'){const q=e.target.value;campaignQuery=q;renderPage(false);const input=$('campaignSearch');if(input){input.focus();input.setSelectionRange(q.length,q.length)}return}if(e.target.id==='archiveSearch'||e.target.id==='siteSearchInput'){let id=e.target.id,q=e.target.value;if(id==='siteSearchInput')modeSearch=q;else queryFilter=q;renderPage(false);let input=$(id);if(input){input.focus();input.setSelectionRange(q.length,q.length)}}});
document.addEventListener('change',e=>{if(e.target.id==='attackTarget'){const target=getRoom().queue.find(x=>x.id===e.target.value);const field=document.querySelector('#attackForm [name=ac]');if(target&&field)field.value=String(roomHP(target).ac)}if(e.target.id==='cabSort'){cabSort=e.target.value;renderPage(false)}if(e.target.id==='ledgerSort'){ledgerSort=e.target.value;renderPage(false)}if(e.target.id==='ledgerCampaign'){db.campaign=e.target.value;ledgerFilter='all';ledgerQuery='';persist();renderPage(false);toast('Campaign: '+campaignName())}if(e.target.id==='campaignSort'){campaignSort=e.target.value;renderPage(false)}if(e.target.id==='campaignSelect'){db.campaign=e.target.value;persist();renderPage(false);toast('Campaign: '+campaignName())}});
const SIDEBAR_PREF='terravale.v2.sidebar.rail.v1';
function applyRail(v){const desktop=window.matchMedia('(min-width:761px)').matches;$('sidebar').classList.toggle('collapsed',v&&desktop);document.querySelector('.app').classList.toggle('rail-mode',v&&desktop);$('sidebarToggle').setAttribute('aria-label',v?'Expand sidebar':'Collapse sidebar');$('sidebarToggle').setAttribute('title',v?'Expand sidebar (Ctrl+B)':'Collapse sidebar (Ctrl+B)');$('sidebarToggle').setAttribute('aria-pressed',String(v));document.querySelectorAll('#sidebar .nav-item').forEach(el=>{const label=el.querySelector('.nav-caption')?.textContent?.trim()||el.getAttribute('aria-label')||'Navigation';el.setAttribute('aria-label',label);el.setAttribute('title',v?label:'')});$('sidebarSearch').title=v?'Search Codex (/)':'';}
let preferredRail=false;try{preferredRail=localStorage.getItem(SIDEBAR_PREF)==='true'}catch{}applyRail(preferredRail);
/* Finalised menu transition: Smooth Morph, fixed at the approved 1500ms.
   Removed the transition comparison and speed controls. Old stored motion
   preferences deliberately do not override this finalised behaviour. */
const menuMorphDuration=1500;
let menuMotionBusy=false;
function menuToggleImmediate(){
 preferredRail=!preferredRail;
 try{localStorage.setItem(SIDEBAR_PREF,String(preferredRail))}catch{}
 applyRail(preferredRail);
}
const motionReduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/* V2.10: stable geometry morph, intentionally based on the last working
   V2.8 DOM animator. No native view-transition snapshot compositor. */
const morphEase='cubic-bezier(.34,.06,.17,1)';
const morphVisible=el=>{const r=el.getBoundingClientRect();return r.width>35&&r.height>20&&r.bottom>-100&&r.top<innerHeight+280};
function collectMorphItems(){
 // Shared first-level page sections must morph as well as their inner cards.
// Previously the banner wasn't selected on library, journal, bookmarks,
 // world-codex, appearance, DM and related pages; it snapped instantly.
 // Keep these first in the list so the visible hero never gets dropped by
 // the per-frame DOM snapshot budget on long archives.
 const selectors=[
  '.content>.v2-hero',
  '.content>.article-hdr',
  '.content>.campaign-detail-hero',
  '.content>.page-intro',
  '.content>.v2-toolbar',
  '.content>.v2-section',
  '.content>.v2-note',
  '.content>.article-banner',
  '.page-dashboard>.stats>.stat',
  // Animate whole dashboard sections so their headings, borders and list rows
  // remain attached to the same visual plane throughout the morph.
  '.page-dashboard .dashboard-grid .left-stack>section:first-child',
  '.page-dashboard .dashboard-grid .left-stack>section.panel',
  '.page-dashboard .dashboard-grid .right-stack>section',
  '.page-dashboard>.hero',
  '.page-campaigns .campaign-metrics>*',
  '.page-campaigns .campaign-card-grid>*',
  '.page-campaigns .campaign-feature',
  '.page-campaigns .campaign-shelf',
  '.page-session .sr-statusbar',
  '.page-session .sr-queue>.sr-combatant',
  '.page-session .sr-focus',
  '.page-session .sr-compass',
  '.page-session .sr-chat-panel',
  '.page-session .sr-dice-panel',
  '.page-session .sr-pulse',
  '.page-session .sr-dm-desk',
  '.page-library .archive-grid>*',
  // V2.39: Lore content participates in the same approved 1500ms sidebar morph.
  '.page-library .tv-lore .lore-head',
  '.page-library .tv-lore .lore-tabs',
  '.page-library .tv-lore .lore-controls',
  '.page-library .tv-lore .lore-meta',
  '.page-library .tv-lore .lore-grid>.lore-card:nth-child(-n+16)',
  '.page-library .tv-lore .reader-hero',
  '.page-library .tv-lore .reader-layout>.reader-body',
  '.page-library .tv-lore .reader-layout>.reader-aside',
  '.page-library .tv-lore .heritage-box',
  '.page-library .tv-lore .cal-hero',
  '.page-library .tv-lore .moon-summary',
  '.page-library .tv-lore .calendar-toolbar',
  '.page-library .tv-lore .cal-board>.cal-month:nth-child(-n+3)',
  '.page-characters>.page-intro',
  '.page-characters>.v2-hero',
  '.page-characters>.section-head',
  '.page-characters .ledger-heading',
  '.page-characters .ledger-metrics>*',
  '.page-characters .ledger-feature',
  '.page-characters .ledger-toolbar',
  '.page-characters .ledger-archive-title',
  '.page-characters .ledger-filter-row',
  '.page-characters .ledger-count',
  '.page-characters .ledger-list-head',
  '.page-characters .ledger-card',
  '.page-characters .ledger-only',
  '.page-characters .ledger-no-results',
  '.page-characters .ledger-after',
  '.page-cabinet .cabinet-grid>*',
  // Creator panels contain interactive form controls and scoped typography.
  // Animate their *real* CSS grid as sidebar width changes; cloning them into
  // a root overlay loses their page-creator style scope and breaks mid-morph.
  // The live layout resizes smoothly in both axes without any ghost panels.
  '.page-sheet .v2-layout>*',
  '.page-creator>.page-intro',
  '.page-sheet>.page-intro',
  '.page-session>.page-intro',
  '.page-campaigns>.page-intro',
  '.page-dashboard>.page-intro',
  '.content>.v2-grid>*',
  '.content>.v2-layout>*'
 ];
 return [...new Set(selectors.flatMap(q=>[...document.querySelectorAll(q)]))].filter(morphVisible).slice(0,52);
}
function collectFlowRegions(){
 const selectors=[
  '.page-dashboard>.stats', '.page-dashboard>.dashboard-grid',
  '.page-dashboard .quick-grid', '.page-dashboard .recent-list',
  '.page-campaigns .campaign-metrics', '.page-campaigns .campaign-card-grid',
  '.page-session .sr-encounter','.page-session .sr-queue',
  '.page-session .sr-operations', '.page-session .sr-lower',
  '.page-library .archive-grid', '.page-library .tv-lore .lore-grid', '.page-library .tv-lore .reader-layout', '.page-characters .ledger-roster', '.page-characters .ledger-metrics',
  '.page-cabinet .cabinet-grid', '.page-creator .v2-layout', '.page-creator .creator-shell',
  '.page-sheet .v2-layout'
 ];
 return [...new Set(selectors.flatMap(q=>[...document.querySelectorAll(q)]))].filter(morphVisible);
}
function visualClone(el,rect){
 const shot=el.cloneNode(true),style=getComputedStyle(el);
 shot.removeAttribute('id');shot.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
 shot.inert=true;shot.setAttribute('aria-hidden','true');shot.style.setProperty('visibility','visible','important');
 // Critical: keep endpoint content at its original size. Only the outer
 // border/background frame changes dimensions continuously in both axes.
 shot.style.cssText+=`;position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important;margin:0!important;transform:none!important;transition:none!important;pointer-events:none!important;overflow:hidden!important;background:transparent!important;border-color:transparent!important;box-shadow:none!important`;
 for(const key of ['display','flexDirection','alignItems','justifyContent','gap','padding','color','fontFamily','fontSize','lineHeight'])shot.style[key]=style[key];
 return shot;
}
function promiseDone(anim){return anim?.finished?.catch(()=>{})||Promise.resolve()}
/* V2.11 - One live layout, no duplicate page snapshots.
   The sidebar genuinely changes width over the full 1500 ms. Components
   temporarily travel above their live (but hidden) destination instances.
   No full-page / menu overlays are used, avoiding cropped content and
   duplicated badges during a collapse/expand. */
const morphMix=(a,b,t)=>a+(b-a)*t;
const morphCurve=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const morphFrame=(el,from,to,layer)=>{
 const before=visualClone(el,from);
 const after=visualClone(el,to);
 const frame=document.createElement('div');frame.className='menu-morph-card';
 frame.style.cssText=`position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;pointer-events:none;overflow:hidden;box-sizing:border-box;`;
 const css=getComputedStyle(el);
 for(const prop of ['background','border','borderRadius','boxShadow'])frame.style[prop]=css[prop];
 after.style.opacity='0';frame.append(before,after);layer.append(frame);
 // Snap text between endpoint layouts at the halfway point, never show
 // both renderings at once: important for approval badges and controls.
 before.animate([{opacity:1,offset:0},{opacity:1,offset:.49},{opacity:0,offset:.5},{opacity:0,offset:1}],{duration:menuMorphDuration,fill:'forwards'});
 after.animate([{opacity:0,offset:0},{opacity:0,offset:.49},{opacity:1,offset:.5},{opacity:1,offset:1}],{duration:menuMorphDuration,fill:'forwards'});
 const diffX=to.left-from.left,diffY=to.top-from.top;
 frame.animate([{transform:'translate3d(0,0,0)',width:from.width+'px',height:from.height+'px'},{transform:`translate3d(${diffX}px,${diffY}px,0)`,width:to.width+'px',height:to.height+'px'}],{duration:menuMorphDuration,easing:'ease-in-out',fill:'forwards'});
 return frame;
};
// V2.13: the sidebar itself is a live, continuously measured layout.
// Headings grow in height, icons remain in their own row, and captions
// reveal as available width increases. No sidebar screenshots/clones.
const morphSmoothstep=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};
function setSidebarMorphProgress(sidebar,p){
 const set=(key,val)=>sidebar.style.setProperty(key,val);
 set('--sb-pad-x',(6+5*p).toFixed(3)+'px');
 set('--sb-brand-pad',(9+1*p).toFixed(3)+'px');
 set('--sb-brand-size',(30+2*p).toFixed(3)+'px');
 set('--sb-brand-bottom',(13+4*p).toFixed(3)+'px');
 set('--sb-search-pad',(15-3*p).toFixed(3)+'px');
 set('--sb-search-bottom',(10+8*p).toFixed(3)+'px');
 set('--sb-heading-height',(27*p).toFixed(3)+'px');
 set('--sb-group-pad',(6*(1-p)).toFixed(3)+'px');
 set('--sb-group-bottom',(7+6*p).toFixed(3)+'px');
 set('--sb-nav-row',(43-6*p).toFixed(3)+'px');
 set('--sb-nav-pad',(14.5-2.5*p).toFixed(3)+'px');
 set('--sb-icon-size',(19-2*p).toFixed(3)+'px');
 set('--sb-divider-alpha',(1-p).toFixed(3));
 set('--sb-label-alpha',morphSmoothstep(.60,.96,p).toFixed(3));
 set('--sb-heading-alpha',morphSmoothstep(.63,.98,p).toFixed(3));
 set('--sb-kbd-alpha',morphSmoothstep(.85,1,p).toFixed(3));
 set('--sb-text-shift',((1-p)*-5).toFixed(3)+'px');
}
const sidebarMorphKeys=['--sb-pad-x','--sb-brand-pad','--sb-brand-size','--sb-brand-bottom','--sb-search-pad','--sb-search-bottom','--sb-heading-height','--sb-group-pad','--sb-group-bottom','--sb-nav-row','--sb-nav-pad','--sb-icon-size','--sb-divider-alpha','--sb-label-alpha','--sb-heading-alpha','--sb-kbd-alpha','--sb-text-shift'];
function clearSidebarMorphProgress(sidebar){for(const k of sidebarMorphKeys)sidebar.style.removeProperty(k)}
async function menuMorph(){
 const sidebar=$('sidebar');const oldWidth=sidebar.getBoundingClientRect().width;
 // V2.18.2: keep all Creator panels in the real DOM, with their inherited
 // styling and live inputs. Morph the *actual* outer content geometry so
 // switching rail-mode does not snap the centred content into its full-width
 // destination before the sidebar begins moving.
 const creatorPage=document.querySelector('#pageRoot.page-creator');
 const creatorMain=creatorPage?.closest('.main-wrap');
 const contentStart=creatorPage?.getBoundingClientRect();
 const mainStart=creatorMain?.getBoundingClientRect();
 const paddingStart=creatorPage?getComputedStyle(creatorPage):null;
 const creatorFrom=creatorPage?{
   width:contentStart.width,offset:contentStart.left-mainStart.left,
   paddingLeft:parseFloat(paddingStart.paddingLeft),paddingRight:parseFloat(paddingStart.paddingRight)
 }:null;
 // No page-panel screenshots in the Creator: they lose page-scoped styles.
 // The actual guide, form and live preview retain their identities throughout.
 const items=(creatorPage||document.querySelector('#pageRoot')?.classList.contains('page-sheet'))?[]:collectMorphItems();
 const before=items.map(el=>({el,rect:el.getBoundingClientRect(),style:el.style.visibility}));
 menuToggleImmediate();
 const targetWidth=sidebar.getBoundingClientRect().width;
 const creatorDest=creatorPage?.getBoundingClientRect();
 const mainDest=creatorMain?.getBoundingClientRect();
 const paddingDest=creatorPage?getComputedStyle(creatorPage):null;
 const creatorTo=creatorPage?{
   width:creatorDest.width,offset:creatorDest.left-mainDest.left,
   paddingLeft:parseFloat(paddingDest.paddingLeft),paddingRight:parseFloat(paddingDest.paddingRight)
 }:null;
 const applyCreatorGeometry=p=>{
   if(!creatorPage||!creatorFrom||!creatorTo)return;
   const interp=(key)=>morphMix(creatorFrom[key],creatorTo[key],p).toFixed(3)+'px';
   creatorPage.style.setProperty('max-width','none','important');
   creatorPage.style.setProperty('width',interp('width'),'important');
   creatorPage.style.setProperty('margin-left',interp('offset'),'important');
   creatorPage.style.setProperty('margin-right','0px','important');
   creatorPage.style.setProperty('padding-left',interp('paddingLeft'),'important');
   creatorPage.style.setProperty('padding-right',interp('paddingRight'),'important');
 };
 const clearCreatorGeometry=()=>{
   if(!creatorPage)return;
   ['max-width','width','margin-left','margin-right','padding-left','padding-right'].forEach(k=>creatorPage.style.removeProperty(k));
 };
 // Establish the first frame before returning to the rendering pipeline.
 applyCreatorGeometry(0);
 const visible=before.map(entry=>({...entry,target:entry.el.getBoundingClientRect()}));
 // Apply temporary width AFTER measuring the destination. Because the
 // actual sidebar owns the width, the top bar and entire page follow it.
 sidebar.style.setProperty('width',oldWidth+'px','important');
 const opening=targetWidth>oldWidth;
 setSidebarMorphProgress(sidebar,opening?0:1);
 sidebar.classList.add('menu-morph-running');
 const layer=document.createElement('div');layer.className='menu-morph-layer';
 // Keep page-scoped styling on the moving ledger copies while they live above the root.
 // Without this, card text and controls revert to browser defaults mid-transition.
 if(document.querySelector('#pageRoot')?.classList.contains('page-characters'))layer.classList.add('page-characters');
 if(document.querySelector('#pageRoot .tv-lore'))layer.classList.add('tv-lore');
 layer.inert=true;layer.setAttribute('aria-hidden','true');document.body.append(layer);
 const captured=[];
 try{
  for(const entry of visible){
   const a=entry.rect,b=entry.target;
   if(!entry.el.isConnected)continue;
   const change=Math.abs(a.left-b.left)+Math.abs(a.top-b.top)+Math.abs(a.width-b.width)+Math.abs(a.height-b.height);
   if(change<2)continue;
captured.push(entry);
   morphFrame(entry.el,a,b,layer);
   entry.el.style.visibility='hidden';
  }
  const started=performance.now();
  await new Promise(resolve=>{
   let frameId=0;
   const tick=now=>{
    const raw=Math.min(1,Math.max(0,(now-started)/menuMorphDuration));
    const ease=morphCurve(raw);
    sidebar.style.setProperty('width',morphMix(oldWidth,targetWidth,ease)+'px','important');
    applyCreatorGeometry(ease);
    setSidebarMorphProgress(sidebar,opening?ease:1-ease);
    if(raw>=1){resolve();return;}
    frameId=requestAnimationFrame(tick);
   };
   frameId=requestAnimationFrame(tick);
  });
 }finally{
  layer.remove();
  for(const entry of captured)if(entry.el.isConnected)entry.el.style.visibility=entry.style;
  sidebar.style.removeProperty('width');
  clearCreatorGeometry();
  sidebar.classList.remove('menu-morph-running','menu-morph-opening','menu-morph-label-ready');
  clearSidebarMorphProgress(sidebar);
 }
}
async function changeRail(){
 if(menuMotionBusy||!window.matchMedia('(min-width:761px)').matches)return;
 if(motionReduced()){menuToggleImmediate();return;}
 menuMotionBusy=true;
 try{await menuMorph();}
 catch(error){console.warn('Sidebar morph cancelled, restoring live layout',error);document.querySelectorAll('.menu-morph-layer').forEach(el=>el.remove());document.querySelectorAll('.menu-morph-card').forEach(el=>el.remove());document.querySelectorAll('.sidebar, .sidebar *').forEach(el=>{el.style.removeProperty('visibility')});document.querySelector('.sidebar').style.removeProperty('width');document.querySelectorAll('#pageRoot.page-creator').forEach(el=>['max-width','width','margin-left','margin-right','padding-left','padding-right'].forEach(k=>el.style.removeProperty(k)));document.querySelector('.sidebar').classList.remove('menu-morph-running','menu-morph-opening','menu-morph-label-ready');clearSidebarMorphProgress(document.querySelector('.sidebar'));applyRail(preferredRail);}
 finally{menuMotionBusy=false;}
}
$('sidebarToggle').addEventListener('click',changeRail);
window.addEventListener('resize',()=>applyRail(preferredRail));
// Keep the demo-only controls inside the header so they never overlay combat panels.
const previewHost=document.querySelector('.top-right');if(previewHost)previewHost.prepend($('previewTray'));
$('previewTrayToggle').addEventListener('click',()=>{const panel=$('previewTrayContents');panel.hidden=!panel.hidden;$('previewTrayToggle').setAttribute('aria-expanded',String(!panel.hidden));$('previewTray').classList.toggle('is-open',!panel.hidden)});
$('mobileToggle').addEventListener('click',()=>{let v=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',v);$('overlay').classList.toggle('open',v);$('mobileToggle').setAttribute('aria-expanded',String(v))});$('overlay').addEventListener('click',closeMenu);
document.querySelectorAll('.group-label').forEach(b=>b.addEventListener('click',()=>{let el=b.nextElementSibling,open=el.hidden;el.hidden=!open;b.setAttribute('aria-expanded',String(open));b.querySelector('.group-chevron').textContent=open?'⌄':'›'}));
$('topSearch').addEventListener('click',()=>navigate('/search'));
$('sidebarSearch').addEventListener('click',()=>{navigate('/search');closeMenu()});
$('modalClose').addEventListener('click',closeModal);$('modalDismiss').addEventListener('click',closeModal);$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modal').hidden)closeModal();else closeMenu()}if(e.key.toLowerCase()==='b'&&(e.ctrlKey||e.metaKey)&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')){e.preventDefault();if(window.matchMedia('(min-width:761px)').matches){changeRail()}}if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')){e.preventDefault();navigate('/search');setTimeout(()=>$('siteSearchInput')?.focus(),0)}});
window.addEventListener('hashchange',()=>{queryFilter='';renderPage(true);closeMenu()});

/* V2.26 · existing V2.25.1 update, not an alternative application */
const v226OriginalRenderPage=renderPage;renderPage=function(...args){const res=v226OriginalRenderPage(...args);document.title=document.title.replace('V2.24','V2.26');return res;};
window.TERRAVALE_V226_RULES=JSON.parse(document.getElementById('v226-full-source').textContent);
function v226Class(name){return window.TERRAVALE_V226_RULES.classes.find(x=>x.name.toLowerCase()===String(name||'').toLowerCase())||null;}
function v226Sanitize(html){
 const template=document.createElement('template');template.innerHTML=String(html||'');
 const ban=['script','style','iframe','object','embed','link','meta','form','input','button','audio','video','svg','math'];
 template.content.querySelectorAll('*').forEach(el=>{
  if(ban.includes(el.tagName.toLowerCase())){el.remove();return;}
  for(const a of [...el.attributes])if(/^on/i.test(a.name)||['style','srcdoc'].includes(a.name)||a.name==='href'&&!/^(#|https?:|mailto:)/.test(a.value)){el.removeAttribute(a.name)}
 });return template.innerHTML;
}
function v226Pieces(html){
 const template=document.createElement('template');template.innerHTML=v226Sanitize(html);
 const elements=[...template.content.children],parts=[];let content='';let group=[];
 function add(){if(group.length){parts.push(group.map(e=>e.outerHTML).join(''));group=[];}}
 for(const el of elements){const tag=el.tagName?.toLowerCase();if(['h2','h3','h4','h5','h6'].includes(tag)){add();}group.push(el);}
 add();return '<div class="sheet226-rule-blocks">'+(parts.length?parts:['<p>Refer to the published source reference.</p>']).map(x=>'<div class="sheet226-rule-block">'+x+'</div>').join('')+'</div>';
}
function v226Features(name,upTo){const x=v226Class(name);if(!x)return [];const all=[];
 for(let level=1;level<=Math.min(20,Number(upTo)||20);level++){
  let fs=x.featureByLevel?.[String(level)]||[];
  if(!fs.length){
   const legacy=window.TERRAVALE_SHEET_FEATURES?.[x.name]?.[String(level)]||
       (window.TERRAVALE_V223_PROGRESSIONS?.[x.name]||[]).find(r=>Number(r[0])===level)?.[1]||[];
   fs=legacy.filter(n=>!/^feat \/ asi$/i.test(n)).map(n=>{
    const title=String(n).toLowerCase().replace(/[^a-z0-9]/g,'');
    const doc=document.createElement('template');doc.innerHTML=v226Sanitize(x.html);
    const headings=[...doc.content.querySelectorAll('h1,h2,h3,h4,h5')];
    const matched=headings.find(h=>h.textContent.toLowerCase().replace(/[^a-z0-9]/g,'').includes(title));
    let blocks=[],node=matched?.nextElementSibling;
    while(node&&blocks.length<40&&!/^H[123]$/.test(node.tagName)){blocks.push(node.outerHTML);node=node.nextElementSibling;}
    return {name:n,html:blocks.length?('<h3>'+safe(n)+'</h3>'+blocks.join('')):'<h3>'+safe(n)+'</h3><p>This feature is listed in the published progression. Read the complete class chapter below for its mechanics and any exceptions.</p>'};
   });
  }
  if(fs.length)all.push({level,features:fs});
 }return all;
}
function v226SpecOptions(c){const src=v226Class(c.className);if(!src)return [];
 if(['Disciplines','Skill trees'].includes(src.optionsLabel)||['Bloodforger','Nullwatcher'].includes(c.className))return [];
 return(src.options||[]).map(o=>o.name);
}
function v226SpecName(c){return String(c.progression?.subclass||c.progression?.tradition||c.subclass||'').trim();}
function v226FeatureTile(f,level){return `<details class="sheet226-feature-card"><summary><strong>${safe(f.name)}</strong><span>⌄</span></summary><div class="sheet226-feature-detail"><p class="sheet226-source-note">Level ${level} · Published Player Primer · reference only</p>${v226Pieces(f.html)}</div></details>`;}
// Replace feature-name only cards with a responsive grid of distinct, expandable source-backed feature cards.
sheetV222ClassPanel=function(c){const levels=v226Features(c.className,c.level), count=levels.reduce((n,r)=>n+r.features.length,0);return `<section class="sheet20-panel sheet226-class-panel"><div class="sheet20-panel-heading"><span>YOUR CLASS FEATURES</span><span class="sheet20-source">LEVEL ${Math.max(1,Number(c.level)||1)} · ${count} FEATURES</span></div><h3>${safe(c.className)} abilities</h3><p class="sheet20-note">Each feature is its own card. Open only the ones you need; complex rules are separated into shorter sections rather than one long column.</p>${levels.map(r=>`<div class="sheet226-level-group"><div class="sheet226-level-title">LEVEL ${r.level}</div><div class="sheet226-rule-grid">${r.features.map(f=>v226FeatureTile(f,r.level)).join('')}</div></div>`).join('')||'<div class="sheet22-empty-features">No class features indexed from this source.</div>'}<p class="sheet226-source-note">Rules are read-only references. Equipping, combat triggers and resource spending are not inferred from the text.</p><p class="sheet22-reading-link">${lnk('/classes/'+String(c.className).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),'Open full class reference ↗','v2-link')}</p><details class="sheet226-full-source"><summary>Complete ${safe(c.className)} chapter · shared mechanics and exceptions</summary><div class="sheet226-class-rule">${v226Pieces(v226Class(c.className)?.html||'')}</div></details></section>`};
// Keep ancestry feats intact; improve their card placement only.
const v226OldFeatPanel=sheetV222FeatPanel;
sheetV222FeatPanel=function(c){return v226OldFeatPanel(c).replace('sheet22-feats-panel','sheet22-feats-panel sheet226-feat-panel')};
sheetV224SubclassPanel=function(c){const src=v226Class(c.className),options=src?.options||[];if(!options.length)return '';
 const sel=v226SpecName(c),selected=options.find(x=>x.name===sel),dis=src.optionsLabel==='Disciplines';
 return `<section class="sheet20-panel sheet226-subclass-panel"><div class="sheet20-panel-heading"><span>${dis?'BLOODFORGER DISCIPLINES':'PATHS & SPECIALISATIONS'}</span><span class="sheet20-source">${options.length} OPTIONS</span></div><h3>${safe(selected?.name||(dis?'Your disciplines':'Your path'))}</h3><p class="sheet20-note">${sel?'Your recorded choice is highlighted below.':'These are reference options, not automatically selected abilities.'}</p><div class="sheet226-subclass-picker">${options.map(o=>`<span class="${sel===o.name?'selected':''}">${safe(o.name)}</span>`).join('')}</div>${selected?`<details class="sheet226-feature-card" open><summary>${safe(selected.name)}<span>⌄</span></summary><div class="sheet226-feature-detail">${v226Pieces(selected.html)}</div></details>`:`<p class="sheet226-source-note">Open the class article to read all ${options.length} full source references.</p>`}<p class="sheet22-reading-link">${lnk('/classes/'+String(c.className).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),'Read specialisation rules ↗','v2-link')}</p></section>`;};
sheetV222FeaturesPage=function(c){return `<div class="sheet226-feature-layout">${sheetV222ClassPanel(c)}${sheetV222FeatPanel(c)}${sheetV224SubclassPanel(c)}</div>`};
// Overview: remove the redundant Class & Abilities metadata panel; class/race/level/path already live in the header.
sheetV220Overview=function(c){let main=`${sheetV220Health(c)}${sheetV220ConditionsPanel(c)}<section class="sheet20-panel"><div class="sheet20-panel-heading"><span>THE STORY SO FAR</span></div><h3>${safe(c.name)}’s Chronicle</h3><p class="sheet20-story">${safe(c.backstory||'A story not yet written.')}</p>${sheetV220CanEdit(c)?`<button data-action="editBackstory" data-id="${safe(c.id)}" class="v2-link">Edit backstory ↗</button>`:''}</section>`;return `<div class="sheet20-dashboard"><div class="sheet20-main-stack">${main}</div><aside class="sheet20-secondary-stack">${sheetV220ResourcesPanel(c)}</aside></div>`;};
// Uniform slot height in every row. Two-handed equipment occupies the full hands row, not a smaller "reserved" offhand box.
sheetV220Equipment=function(c){sheetV221EnsureIds(c);const can=sheetV221GearOwner(c),items=sheetV220Inventory(c),carried=items.filter(i=>!i.slot),equipped=items.filter(i=>!!i.slot),slots=SHEET_V220_GEAR_SLOTS.filter(([s])=>s);
 const twoHand=equipped.find(i=>i.slot==='main'&&i.twoHanded);
 const slot=(k,label,item,two=false)=>`<div class="sheet21-gear-slot sheet22-slot sheet226-slot ${item?'has-item':''} ${two?'is-twohanded':''}" data-sheet-slot="${k}" data-character-id="${safe(c.id)}"><div class="sheet21-gear-slot-title"><span>${two?'Main hand + off hand':safe(label)}</span>${item?`<span class="sheet22-slot-filled">${two?'Both hands':'Equipped'}</span>`:''}</div>${item?`<div class="sheet22-equipped" ${can?`draggable="true" data-sheet-drag="${safe(item.id)}" data-character-id="${safe(c.id)}"`:''}><strong>${sheetV221ItemTitle(item)}</strong><small>${Math.max(1,Number(item.qty)||1)} owned${two?` · Two-handed`:''}</small>${can?`<div class="sheet22-slot-actions"><button data-action="sheetUnequip" data-id="${safe(c.id)}" data-value="${safe(item.id)}">Backpack</button><button data-action="sheetMoveGear" data-id="${safe(c.id)}" data-value="${safe(item.id)}">Move</button><button data-action="sheetEditGear" data-id="${safe(c.id)}" data-value="${safe(item.id)}">Edit</button></div>`:''}</div>`:`<small>Empty slot · drop an eligible item here</small>`}</div>`;
 let areas='';for(const [k,label] of slots){if(k==='main'&&twoHand){areas+=slot('main',label,twoHand,true);continue}if(k==='off'&&twoHand)continue;areas+=slot(k,label,equipped.find(i=>i.slot===k));}
 return `<div class="sheet20-columns sheet21-equipment-columns sheet22-equipment-columns"><section class="sheet20-panel"><div class="sheet20-panel-heading"><span>ON YOUR PERSON</span><span class="sheet20-source">${equipped.length} EQUIPPED</span></div><h3>Equipped gear</h3><p class="sheet20-note">Every slot has the same row height, whether occupied or empty. Two-handed weapons and tools span both hands. Drag items to compatible slots or use Move.</p><div class="sheet20-slots sheet21-gear-slots sheet226-gear-slots">${areas}</div></section><section class="sheet20-panel"><div class="sheet20-panel-heading"><span>UNEQUIPPED INVENTORY</span><span class="sheet20-source">${carried.length} IN BACKPACK · ${items.length} TOTAL</span></div><div class="sheet21-backpack-heading"><h3>Backpack</h3>${can?`<div class="sheet21-backpack-buttons"><button class="btn primary small" data-action="sheetAddGear" data-id="${safe(c.id)}">+ Add item</button>${db.role==='dm'?`<button class="btn ghost small" data-action="sheetDMGear" data-id="${safe(c.id)}">DM starting gear</button>`:''}</div>`:''}</div><div class="sheet21-backpack-zone" data-sheet-slot="" data-character-id="${safe(c.id)}"><span class="sheet21-drop-label">BACKPACK · DROP EQUIPMENT HERE TO UNEQUIP</span>${carried.length?`<div class="sheet20-item-list">${carried.map(i=>sheetV221GearItem(c,i)).join('')}</div>`:'<div class="sheet22-backpack-empty">Your backpack is empty. Equipped items are shown on your person, not duplicated here.</div>'}</div><div class="sheet20-source-note">The DM decides starting gear and mechanical effects. Inventory remains fully interactive in this offline preview.</div></section></div>`;};
// Full class article source in the existing class pages, with separate accordions per level and specialisation.
v223ClassFeatures=function(name,limit=20){const src=v226Class(name);if(!src)return '<div class="v223-empty">No complete source imported.</div>';
 const lv=v226Features(name,limit);
 return `<div class="sheet226-progress-table">${v226Sanitize(src.progression?.html||'')}</div><div class="sheet226-class-levels">${Array.from({length:Math.min(20,limit)},(_,i)=>i+1).map(level=>{let fs=src.featureByLevel?.[String(level)]||[];return `<details class="sheet226-class-level-card" ${level===1?'open':''}><summary><span>Level ${level}</span><small>${fs.length?fs.length+' source feature'+(fs.length>1?'s':''):'No new section indexed'} ⌄</small></summary><div class="sheet226-rule-grid">${fs.length?fs.map(f=>`<div class="sheet226-class-feature"><h4>${safe(f.name)}</h4>${v226Pieces(f.html)}</div>`).join(''):'<p class="v2-dim">Refer to the progression table above for continuing features, ASIs and spell slots.</p>'}</div></details>`}).join('')}</div>`;
};
v224SubclassPanel=function(name){const src=v226Class(name);if(!src)return '';const options=src.options||[];
 return `<section class="v223-section v224-subclass-section" id="class-options"><header class="v223-section-head"><div><span class="v2-overline">PUBLISHED CLASS ARTICLE</span><h2>${safe(src.optionsLabel||'Paths & specialisations')}</h2><p>${options.length} complete source sections are embedded here. Open individual cards for their actual mechanics.</p></div><span class="v223-count">${options.length}/${options.length} source sections</span></header>${options.length?`<div class="sheet226-class-option-grid">${options.map(o=>`<details class="sheet226-class-option"><summary>${safe(o.name)} <span>⌄</span></summary><div class="sheet226-class-rule">${v226Pieces(o.html)}</div></details>`).join('')}</div>`:'<p class="v2-dim">This class has no traditional specialisation section in the supplied source.</p>'}<details class="sheet226-full-source"><summary>Read complete class chapter — including shared rules, limitations and examples</summary><div class="sheet226-class-rule">${v226Pieces(src.html)}</div></details></section>`;};
// Use a clean, compact hero and focus important actions. Leave Portrait and Export available under More.
renderSheetV220=function(id){if(sheetV220LastId!==id){sheetV220LastId=id;sheetV220Tab='overview';}const c=db.characters.find(x=>x.id===id);if(!c)return pageHeader('CHARACTER RECORD','Not found','')+empty('Unknown character','This record is not available.','/characters','Back to characters');const sections=[['overview','Overview'],['resources','Resources'],['abilities','Abilities & skills'],['features','Features & feats'],['equipment','Equipment'],['chronicle','Chronicle & review']];const tab=sections.some(x=>x[0]===sheetV220Tab)?sheetV220Tab:'overview',species=c.className==='Shaman'?'shaman':c.className==='Bloodforger'?'bloodforger':'general',path=v226SpecName(c),hasPaths=v226SpecOptions(c).length>0;let status=c.status==='Pending'?'Awaiting DM approval':'Approved record';
 let pathLabel=path?`<strong>Path:</strong> ${safe(path)}`:hasPaths?'<strong>Specialisation:</strong> Not yet selected':c.className==='Bloodforger'?'<strong>Discipline trees:</strong> See Features & feats':'<strong>Class progression:</strong> See Features & feats';
 return `<div class="sheet20" data-sheet-class="${species}">${pageHeader('THE ADVENTURER’S RECORD','Character Sheet','Your character, ready for the table.')}<section class="sheet20-hero sheet226-hero"><div class="sheet20-hero-left">${ledgerPortrait(c,true)}<div class="sheet20-hero-copy"><div class="sheet226-classline">${safe(c.ancestry)} <span aria-hidden="true">·</span> ${safe(c.className)}</div><h2>${safe(c.name)}</h2><div class="sheet226-pathline">${pathLabel}</div><p>${c.pronouns?safe(c.pronouns)+' · ':''}${c.concept?safe(c.concept):'Level '+Number(c.level||1)+' adventurer'}</p><div class="sheet20-badges"><span class="sheet20-badge">LEVEL ${Math.max(1,Number(c.level)||1)}</span><span class="sheet20-badge ${c.status==='Pending'?'pending':'approved'}">${safe(status)}</span><span class="sheet20-badge">${safe(db.campaigns.find(x=>x.id===c.campaign)?.name||'Campaign')}</span></div></div></div><div class="sheet226-hero-actions">${lnk('/characters','← Ledger','btn ghost small')}${lnk('/party','Session Room ↗','btn primary small')}${sheetV220CanEdit(c)?`<button data-v226-edit="${safe(c.id)}" type="button" class="btn ghost small">Edit character</button><details class="sheet226-more"><summary>More ···</summary><div class="sheet226-more-items"><button data-action="ledgerPortrait" data-id="${safe(c.id)}">Change portrait</button><button data-action="ledgerExport" data-id="${safe(c.id)}">Export character JSON</button></div></details>`:''}</div></section><div class="sheet20-tabs" role="tablist" aria-label="Character sheet sections">${sections.map(([key,name])=>`<button role="tab" aria-selected="${key===tab}" class="${key===tab?'active':''}" data-action="sheetTab" data-value="${key}">${name}</button>`).join('')}</div><div class="sheet20-content">${tab==='abilities'?sheetV220Abilities(c):tab==='features'?sheetV222FeaturesPage(c):tab==='equipment'?sheetV220Equipment(c):tab==='chronicle'?sheetV220Chronicle(c):tab==='resources'?sheetV220ResourcesPanel(c):sheetV220Overview(c)}</div><p class="sheet20-footer-note">Character records are saved online to your verified campaign. Some reference rules remain text-only pending the final import.</p></div>${foot()}`;};
// Edit character form with two explicit HP methods instead of a dropdown.
function v226Edit(c,trigger){const path=v226SpecName(c),opts=v226SpecOptions(c),die=Number(v226Class(c.className)?.stats?.['Hit die']?.match(/\d+/)?.[0])||Number(sheetV220Meta(c)?.die)||8,mod=Math.floor((Number(c.con||10)-10)/2);
 const choices=opts.length?`<label class="v2-field">Specialisation (optional)<select name="subclass"><option value="">Not yet selected</option>${opts.map(o=>`<option value="${safe(o)}" ${o===path?'selected':''}>${safe(o)}</option>`).join('')}</select></label>`:'<p class="sheet226-source-note">This class uses a separate discipline/advancement system. No traditional subclass is forced.</p>';
 modal('Edit character · '+c.name,'Edit the character’s displayed details and optional level advancement. All changes stay in this offline preview.',`<form id="sheet226EditForm" data-die="${die}" data-mod="${mod}" data-current="${Number(c.level)||1}"><input name="id" value="${safe(c.id)}" type="hidden"><div class="sheet226-edit-fields"><label class="v2-field">Character name<input name="name" required maxlength="90" value="${safe(c.name)}"></label><label class="v2-field">Pronouns (optional)<input name="pronouns" maxlength="60" value="${safe(c.pronouns||'')}"></label></div><label class="v2-field">Character concept<input name="concept" maxlength="160" value="${safe(c.concept||'')}"></label>${choices}<div class="sheet226-edit-fields"><label class="v2-field">Level<input name="targetLevel" type="number" min="${Math.max(1,Number(c.level)||1)}" max="20" value="${Math.max(1,Number(c.level)||1)}"></label><div class="v2-field"><span>Current maximum HP</span><div class="sheet226-hp-preview"><strong>${Math.max(1,Number(c.maxHp)||1)} HP</strong><small>HP increases apply only when you level up.</small></div></div></div><div class="sheet226-hp" data-v226-hp><div class="v2-overline">HIT POINTS ON LEVEL UP</div><div class="sheet226-hp-choice"><label><input type="radio" name="hpMethod" value="fixed" checked><span>Fixed average</span></label><label><input type="radio" name="hpMethod" value="roll"><span>Roll hit die</span></label></div><div class="sheet226-hp-preview" data-v226-preview></div><div class="sheet226-hp-actions"><button class="btn ghost small" type="button" data-v226-roll hidden>Roll now</button><small class="v2-dim" data-v226-rolls></small></div></div><button class="btn primary" type="submit">Save changes</button></form>`,trigger);v226UpdateHPForm();const frm=document.getElementById('sheet226EditForm');if(frm)frm.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();v226SaveEdit(frm);});}
function v226UpdateHPForm(){const f=document.getElementById('sheet226EditForm');if(!f)return;const lvl=Math.max(1,Math.min(20,Number(f.elements.targetLevel.value)||1)),old=Number(f.dataset.current),n=Math.max(0,lvl-old),die=Number(f.dataset.die),mod=Number(f.dataset.mod),method=f.elements.hpMethod.value,per=Math.max(1,Math.floor(die/2)+1+mod);const p=f.querySelector('[data-v226-preview]'),roll=f.querySelector('[data-v226-roll]');
 f.dataset.gainCount=String(n);if(!n){p.innerHTML='<strong>No level increase</strong><small>HP stays unchanged. Choose a higher level to preview an increase.</small>';roll.hidden=true;return;}
 if(method==='fixed'){p.innerHTML=`<strong>+${n*per} maximum HP</strong><small>${n} level${n===1?'':'s'} × (${Math.floor(die/2)+1} fixed on d${die} ${mod>=0?'+':'−'} ${Math.abs(mod)} CON modifier), minimum 1 HP per level.</small>`;roll.hidden=true;}
 else{const saved=Number(f.dataset.rolledCount)===n&&f.dataset.rolledMethod==='roll'?Number(f.dataset.rolledGain):null;p.innerHTML=saved!==null?`<strong>+${saved} maximum HP · Rolled</strong><small>Roll result is retained until you change level or method.</small>`:`<strong>Roll ${n} × d${die} + CON</strong><small>Tap Roll now to generate and review your result before saving (minimum 1 per level).</small>`;roll.hidden=false;}
}
document.addEventListener('click',function(e){const b=e.target.closest('[data-v226-edit]');if(b){e.preventDefault();e.stopImmediatePropagation();const c=db.characters.find(x=>x.id===b.dataset.v226Edit);if(c&&sheetV220CanEdit(c))v226Edit(c,b);return;}
 const roll=e.target.closest('[data-v226-roll]');if(roll){e.preventDefault();e.stopImmediatePropagation();const f=document.getElementById('sheet226EditForm');if(!f)return;const n=Number(f.dataset.gainCount),die=Number(f.dataset.die),mod=Number(f.dataset.mod);if(!n)return;const nums=Array.from({length:n},()=>Math.floor(Math.random()*die)+1);const gain=nums.reduce((sum,v)=>sum+Math.max(1,v+mod),0);f.dataset.rolledGain=String(gain);f.dataset.rolledCount=String(n);f.dataset.rolledMethod='roll';f.querySelector('[data-v226-rolls]').textContent=nums.map(v=>'d'+die+': '+v).join(' · ');v226UpdateHPForm();}
},true);
document.addEventListener('input',e=>{if(e.target.closest('#sheet226EditForm')&&e.target.name==='targetLevel'){const f=e.target.form;delete f.dataset.rolledGain;delete f.dataset.rolledCount;v226UpdateHPForm();}},true);
document.addEventListener('change',e=>{if(e.target.closest('#sheet226EditForm')&&['hpMethod','targetLevel'].includes(e.target.name))v226UpdateHPForm()},true);
function v226SaveEdit(f){const fd=new FormData(f),c=db.characters.find(x=>x.id===String(fd.get('id')));if(!c||!sheetV220CanEdit(c))return;const name=String(fd.get('name')||'').trim(),newLevel=Number(fd.get('targetLevel')),oldLevel=Math.max(1,Number(c.level)||1);if(!name||name.length>90||!Number.isInteger(newLevel)||newLevel<oldLevel||newLevel>20){toast('Check the character name and new level.');return}
 let gain=0;if(newLevel>oldLevel){const n=newLevel-oldLevel,die=Number(f.dataset.die),mod=Number(f.dataset.mod);if(fd.get('hpMethod')==='roll'){if(Number(f.dataset.rolledCount)!==n||f.dataset.rolledGain==null){toast('Roll the hit die before saving the level increase.');return}gain=Number(f.dataset.rolledGain)}else gain=n*Math.max(1,Math.floor(die/2)+1+mod);}
 c.name=name;c.pronouns=String(fd.get('pronouns')||'').trim().slice(0,60);c.concept=String(fd.get('concept')||'').trim().slice(0,160);if(v226SpecOptions(c).length){c.subclass=String(fd.get('subclass')||'').trim();if(c.progression&&typeof c.progression==='object'){c.progression.subclass=c.subclass;c.progression.tradition=c.subclass;}}if(gain){c.maxHp=Math.max(1,(Number(c.maxHp)||1)+gain);c.hp=Math.min(c.maxHp,Math.max(0,Number(c.hp)||0)+gain);c.level=newLevel;}
 persist();closeModal();renderPage(false);toast(gain?`Level ${newLevel} · +${gain} maximum HP saved locally`:'Character updated');
}

persist();renderPage(false);

