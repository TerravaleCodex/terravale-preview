/* Terravale Codex — approved 62-achievement catalogue and account-wide activity bridge.
 * Additive overlay: preserves the existing Cabinet, Adblockn't and DM ad controls.
 */
(()=>{'use strict';
if(window.__tvApprovedAchievements)return;window.__tvApprovedAchievements=true;
const ROOT='/terravale-preview/',API='https://emwlvbmnrrhxhrmlwkhs.supabase.co/rest/v1/';
const KEY='sb_publishable_4kf7TddSu-mzjRGr2J5ACA_OrNFF_5T';
const classes=['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard','Ashheir','Bloodforger','Chaos Arsenal','Crimson Conduit','Dream-Eater','Echo-Bearer','Gatewarden','Lineage Adept','Nullwatcher','Oracle of the Two Waters','Pressurebearer','Ripperbound','Scarlet Masque','Seal-Maintainer','Shadowforger','Shaman','Summoner','Ventweaver','Vhaeros Cantor (v1.10)','Vitaeforge (v1.10)'];
const ancestries=['Beastfolk','Crimsonborn','Daemon','Dvergr','Elf','Kharithen','Thalassari','Flugel','Human','Oni'];
const disciplines=['Alteration','Arsenal','Ballistics','Blood Battle','Blood Debt','Compression','Fortification','Hardening','Hunger','Living Weapon','Regeneration','Thorn','Vector'];
const themes=['dark','night-sky','shotxo','shady','absolute-zero','sanguine','verdant','dragonforge','astral','null-meridian'];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const classTitles={"Artificer":"Measure Twice, Enchant Once","Barbarian":"The Art of Anger","Bard":"One More Verse","Cleric":"A Prayer Answered?","Druid":"The World Still Breathes","Fighter":"Steel Has No Secrets","Monk":"A Thousand Quiet Strikes","Paladin":"An Oath Has Weight","Ranger":"Reading the Trail","Rogue":"Nothing to See Here","Sorcerer":"Born of the Spark","Warlock":"Read the Fine Print","Wizard":"Knowledge Is a Weapon","Ashheir":"From Ash, We Inherit","Bloodforger":"The Shape of Blood","Chaos Arsenal":"Armed with Chaos","Crimson Conduit":"A Second Heart, Shared","Dream-Eater":"The Dream Bites Back","Echo-Bearer":"Echoes of Another Life","Gatewarden":"Not One Step Further","Lineage Adept":"Instinct Remembers","Nullwatcher":"Silence the Spell","Oracle of the Two Waters":"Where Two Waters Meet","Pressurebearer":"Under Pressure","Ripperbound":"The Hunt Never Ends","Scarlet Masque":"Behind the Scarlet Smile","Seal-Maintainer":"The Seal Holds","Shadowforger":"Shadows Have Shape","Shaman":"The Spirits Are Listening","Summoner":"A Pact of Two Souls","Ventweaver":"Between Breath and Boundary","Vhaeros Cantor (v1.10)":"The Domain Answers","Vitaeforge (v1.10)":"Flesh Remade in Vitae"};
const ancestryTitles={"Beastfolk":"Older Than Instinct","Crimsonborn":"The Second Heart Beats","Daemon":"A Will Without Shape","Dvergr":"Built to Outlast","Elf":"Memory Without End","Kharithen":"Bound by Twilight","Thalassari":"What the Deep Remembers","Flugel":"The Sky Remembers","Human":"Against All Odds","Oni":"The World Does Not Yield"};
const entry=(key,title,rarity,description,measure)=>({key,title,rarity,description,measure});
const collection=[
 ...classes.map(c=>entry('class:'+slug(c),classTitles[c]||('Studied: '+c),'Common','Read the '+c+' class entry.')),
 ...ancestries.map(a=>entry('ancestry:'+slug(a),ancestryTitles[a]||('Discovered: '+a),'Common','Read the '+a+' ancestry entry.')),
 entry('classes_complete','Many Paths, One Scholar','Epic','Read all 33 class entries.','classes'),
 entry('ancestries_complete','Peoples of a Broken World','Epic','Read all 10 ancestry entries.','ancestries'),
 entry('codex_keeper','Keeper of the Living Codex','Legendary','Read every class and ancestry entry.','all'),
 entry('bloodforger_3','A Thousand Ways to Bleed','Rare','Explore three different Bloodforger disciplines in the preview.','disciplines3'),
 entry('bloodforger_all','Blood Knows No Limits','Epic','Explore all 13 Bloodforger disciplines in the preview.','disciplines13'),
 entry('character_first','And So It Begins…','Common','Save your first new character.'),
 entry('character_approved','Officially Someone Else’s Problem','Uncommon','Have your newly created character approved by the DM.'),
 entry('journal_private','Dear Diary, Don’t Judge Me','Common','Write and save a private journal entry.'),
 entry('journal_party','For the Record','Uncommon','Write and save a party journal entry.'),
 entry('quicksave_first','I’ll Read That Later','Common','Add a Codex page to Quick Save.'),
 entry('theme_first','A New Coat of Paint','Common','Change your website appearance theme.'),
 entry('journal_both','Two Sides of the Story','Rare','Save both private and party journal entries.'),
 entry('theme_five','Identity Crisis','Uncommon','Try five different appearance themes.','themes5'),
 entry('backstory_first','The Plot Thickens','Uncommon','Save an update to your character’s backstory.'),
 entry('search_first','What’s This Button Do?','Common','Open a result from Codex Search.'),
 entry('dice_first','The Dice Have Spoken','Common','Save your first Session Room dice roll.'),
 entry('campaign_joined','A Seat at the Table','Uncommon','Join a campaign as a player.'),
 entry('journal_twenty','Chronic Chronicler','Rare','Create 20 individual journal entries.','journal20'),
 entry('adblocknt','Adblockn’t','Epic','Dismiss 25 actual pop-up advertisements.','ads25')
];
if(collection.length!==62)throw new Error('Approved achievement count changed: '+collection.length);
let identity=null,snapshot={events:[],unlocks:[],adProgress:null},fetching=false,loaded=false,lastData='',lastPage='',lastTheme=null,lastRender='',known=new Set(),lastRead='';
const seenClicks=new Set(),toast=(heading,detail)=>{
 const parent=document.getElementById('tv-ach-toasts')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'tv-ach-toasts',className:'tv-ach-toasts'}));
 const t=document.createElement('div');t.className='tv-ach-toast';const strong=document.createElement('strong');strong.textContent=heading;const label=document.createElement('span');label.textContent=detail;t.append(strong,label);parent.append(t);setTimeout(()=>t.remove(),5000);
};
function parseStoredSession(value){
 try{
  if(!value)return null;
  let session=value;
  if(typeof session==='string'){
   session=decodeURIComponent(session);
   if(session.startsWith('base64-')){
    const raw=session.slice(7).replace(/-/g,'+').replace(/_/g,'/');
    const bytes=atob(raw.padEnd(Math.ceil(raw.length/4)*4,'='));
    session=JSON.parse(decodeURIComponent(Array.from(bytes,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
   }else session=JSON.parse(session);
  }
  if(session&&typeof session==='object'&&!Array.isArray(session))session=session.currentSession||session.session||session.data?.session||session;
  const token=Array.isArray(session)?session[0]:session?.access_token;
  if(typeof token!=='string'||token.split('.').length!==3)return null;
  let uid=Array.isArray(session)?null:session?.user?.id;
  if(!uid){
   const segment=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const claims=JSON.parse(atob(segment.padEnd(Math.ceil(segment.length/4)*4,'=')));
   uid=claims?.sub;
  }
  if(typeof uid==='string'&&/^[a-f0-9-]{36}$/i.test(uid))return {uid,token};
 }catch(e){}
 return null;
}
function getAuth(){
 const base='sb-emwlvbmnrrhxhrmlwkhs-auth-token';
 try{
  for(const key of [base,'supabase.auth.token']){
   const auth=parseStoredSession(localStorage.getItem(key));
   if(auth)return auth;
  }
 }catch(e){}
 try{
  const pairs=new Map(document.cookie.split(';').map(s=>{
   const pos=s.indexOf('=');
   return pos<0?['','']:[s.slice(0,pos).trim(),s.slice(pos+1).trim()];
  }));
  const whole=pairs.get(base);
  if(whole){const auth=parseStoredSession(whole);if(auth)return auth;}
  const chunks=[...pairs.entries()].filter(([k])=>new RegExp('^'+base+'\\.[0-9]+$').test(k)).sort(([a],[b])=>Number(a.slice(base.length+1))-Number(b.slice(base.length+1)));
  if(chunks.length&&chunks.every(([k],i)=>Number(k.slice(base.length+1))===i)){
   const auth=parseStoredSession(chunks.map(([,v])=>v).join(''));if(auth)return auth;
  }
 }catch(e){}
 return null;
}
async function request(path,method='GET',body){
 const auth=getAuth();if(!auth)return null;
 const res=await fetch(API+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(!res.ok)throw new Error('Achievement service '+res.status);
 if(res.status===204)return null;
 return res.json();
}
const list=(kind)=>snapshot.events.filter(e=>e.kind===kind).map(e=>e.subject);
const count=(kind)=>new Set(list(kind)).size;
function progress(key){
 const n=(x,max)=>Math.min(max,x)+' / '+max;
 switch(key){
  case 'classes_complete':return n(count('read_class'),33);
  case 'ancestries_complete':return n(count('read_ancestry'),10);
  case 'codex_keeper':return n(count('read_class')+count('read_ancestry'),43);
  case 'bloodforger_3':return n(count('bloodforger_discipline'),3);
  case 'bloodforger_all':return n(count('bloodforger_discipline'),13);
  case 'theme_five':return n(count('theme_changed'),5);
  case 'journal_twenty':return n(count('journal_written'),20);
  case 'adblocknt':return n(snapshot.adProgress?.ads_dismissed||0,25);
  default:return '';
 }
}
function unlockedSet(){
 const keys=new Set(snapshot.unlocks.map(x=>x.achievement_key));
 if(snapshot.adProgress?.adblocknt_unlocked_at)keys.add('adblocknt');
 return keys;
}
function summary(){return unlockedSet().size+' / '+collection.length+' discovered'}
function mount(){
 const modal=document.querySelector('[data-tv-pane="achievements"]');
 if(modal&&!modal.querySelector('#tv-approved-catalog-modal')){
  const wrapper=document.createElement('section');wrapper.id='tv-approved-catalog-modal';wrapper.className='tv-approved-catalog';wrapper.setAttribute('aria-label','All approved achievements');
  const intro=document.createElement('p');intro.className='tv-approved-intro';intro.textContent='All approved achievements are permanent, account-wide and begin fresh. Reading, preview exploration and real site actions count; no DM-only tasks or retroactive unlocks.';
  const status=document.createElement('p');status.className='tv-approved-summary';wrapper.append(intro,status);
  const grid=document.createElement('div');grid.className='tv-approved-list';wrapper.append(grid);
  modal.append(wrapper);
  const old=modal.querySelector('.tv-ach-category');if(old)old.hidden=true;
 }
 const page=document.querySelector('[data-cabinet-full-page]');
 if(page&&!page.querySelector('#tv-approved-catalog-page')){
  const section=document.createElement('section');section.id='tv-approved-catalog-page';section.className='tv-approved-catalog tv-approved-page';section.setAttribute('aria-label','Approved Codex achievements');
  const h=document.createElement('h2');h.textContent='All approved achievements';
  const intro=document.createElement('p');intro.className='tv-approved-intro';intro.textContent='Your permanent, account-wide discoveries. Progress starts from the new achievement launch; earlier activity is not counted.';
  const status=document.createElement('p');status.className='tv-approved-summary';
  const grid=document.createElement('div');grid.className='tv-approved-list';
  section.append(h,intro,status,grid);page.append(section);
 }
}
function render(){
 mount();
 const keys=unlockedSet(),signature=JSON.stringify([identity,loaded,[...keys].sort(),snapshot.events.map(e=>[e.kind,e.subject]),snapshot.adProgress?.ads_dismissed]);
 const info=loaded?summary():(identity?'Loading account achievements…':'Sign in to track achievements');
 for(const host of document.querySelectorAll('.tv-approved-catalog')){
  const label=host.querySelector('.tv-approved-summary'),grid=host.querySelector('.tv-approved-list');
  if(label&&label.textContent!==info)label.textContent=info;
  if(!grid||grid.dataset.signature===signature)continue;
  grid.dataset.signature=signature;grid.replaceChildren();
  for(const item of collection){
   // Adblockn't retains its original live card, counter and reward in the Cabinet modal.
   if(host.id==='tv-approved-catalog-modal'&&item.key==='adblocknt')continue;
   const active=keys.has(item.key),article=document.createElement('article');
   article.className='tv-approved-item'+(active?' is-earned':'');
   article.dataset.achievementKey=item.key;
   const head=document.createElement('div');head.className='tv-approved-item-head';
   const name=document.createElement('strong');name.textContent=item.title;
   const rarity=document.createElement('small');rarity.textContent=item.rarity.toUpperCase();
   head.append(name,rarity);
   const desc=document.createElement('p');desc.textContent=item.description;
   const footer=document.createElement('div');footer.className='tv-approved-item-foot';
   const state=document.createElement('span');state.textContent=active?'DISCOVERED':'LOCKED';footer.append(state);
   const value=progress(item.key);if(value){const counter=document.createElement('span');counter.textContent=value;footer.append(counter);}
   article.append(head,desc,footer);grid.append(article);
  }
 }
 const widget=document.getElementById('tv-ach-widget');
 if(widget&&loaded){const label='✧ '+keys.size+'/'+collection.length;if(widget.textContent!==label)widget.textContent=label;widget.title='Cabinet of Curiosities — '+summary();}
 const found=document.getElementById('tv-ach-found');
 if(found&&loaded&&found.textContent!==summary())found.textContent=summary();
 const home=document.getElementById('tv-home-found');if(home&&loaded&&home.textContent!==summary())home.textContent=summary();
 const stat=document.querySelector('[data-tv-pane="achievements"] .tv-stats > span');if(stat)stat.textContent=collection.length+' APPROVED · ACCOUNT-WIDE';
}
async function refresh(){
 if(fetching)return;const current=getAuth(),uid=current?.uid||null;
 if(identity!==uid){identity=uid;snapshot={events:[],unlocks:[],adProgress:null};known.clear();loaded=false;lastData='';render();}
 if(!uid){loaded=false;render();return;}
 fetching=true;
 try{
  const enc=encodeURIComponent(uid);
  const data=await Promise.all([
   request('codex_achievement_events?select=kind,subject,created_at&user_id=eq.'+enc+'&order=created_at.asc&limit=500'),
   request('codex_achievement_unlocks?select=achievement_key,unlocked_at&user_id=eq.'+enc+'&order=unlocked_at.asc&limit=500'),
   request('codex_achievement_progress?select=ads_dismissed,adblocknt_unlocked_at&user_id=eq.'+enc)
  ]);
  if(getAuth()?.uid!==uid)return;
  snapshot={events:data[0]||[],unlocks:data[1]||[],adProgress:data[2]?.[0]||null};
  const keys=unlockedSet();
  if(loaded)for(const key of keys)if(!known.has(key)){const item=collection.find(x=>x.key===key);if(item)toast('Achievement unlocked: '+item.title,item.description);}
  known=keys;loaded=true;render();
 }catch(e){console.warn('Terravale achievements will retry:',e.message);render();}
 finally{fetching=false;}
}
async function record(kind,subject){
 if(!getAuth())return;
 const cache=kind+'|'+subject;if(seenClicks.has(cache))return;seenClicks.add(cache);
 try{const awards=await request('rpc/codex_record_activity','POST',{p_kind:kind,p_subject:subject});await refresh();}
 catch(e){seenClicks.delete(cache);console.warn('Achievement activity not saved:',kind,e.message);}
}
function currentPath(){return decodeURIComponent(location.pathname).replace(/^\/terravale-preview\/?/,'/').replace(/\/+$/,'')||'/'}
function lookForReads(){
 const path=currentPath(),parts=path.split('/').filter(Boolean),main=document.querySelector('main')||document.querySelector('[role="main"]');
 if(!main||main.textContent.trim().length<220)return;
 const headers=[...main.querySelectorAll('h1')].map(n=>n.textContent.trim().toLowerCase());
 let kind='',subject='';
 if(parts[0]==='classes'&&parts.length===2){
  const value=classes.find(x=>slug(x)===parts[1]||slug(x).replace(/-v1-10$/,'')===parts[1]);
  if(value){kind='read_class';subject=value;}
 }else if(parts[0]==='ancestries'&&parts.length===2){
  const value=ancestries.find(x=>slug(x)===parts[1]||(x==='Flugel'&&parts[1]==='fluegel'));
  if(value){kind='read_ancestry';subject=value;}
 }else if(parts.length===1&&['classes','ancestries'].includes(parts[0])){
  const source=parts[0]==='classes'?classes:ancestries;
  const value=source.find(x=>headers.includes(x.toLowerCase()));
  if(value){kind=parts[0]==='classes'?'read_class':'read_ancestry';subject=value;}
 }
 if(subject){const id=kind+'|'+subject;if(id!==lastRead){lastRead=id;void record(kind,subject);}}
}
function clicked(ev){
 const target=ev.target;if(!(target instanceof Element))return;
 const el=target.closest('button,a,[role="button"],[role="tab"],[data-discipline],.tree-node');
 if(!el)return;
 const path=currentPath(),label=(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,150);
 if(path.startsWith('/classes/bloodforger/trees')||path.startsWith('/bloodforger-tree-v2')){
  const combined=[el.getAttribute('data-discipline')||'',el.closest('[data-discipline]')?.getAttribute('data-discipline')||'',label].join(' ');
  const name=disciplines.find(d=>new RegExp('(^|[^a-z])'+d.replace(/\s+/g,'\\s+')+'([^a-z]|$)','i').test(combined));
  if(name)void record('bloodforger_discipline',name);
 }
 if(path==='/search'&&el.tagName==='A'&&!!el.closest('main,[role="main"],.search-results')&&!el.closest('nav,aside,header')){
  try{const url=new URL(el.href,location.href);const ref=url.pathname.replace(/^\/terravale-preview\/?/,'/');
   if(url.origin===location.origin&&ref!=='/search'&&ref.length>2)void record('search_result',ref);
  }catch{}
 }
 if(/\b(quick\s*save|bookmark|add to saved|save reference|save page|save to quick\s*save)\b/i.test(label)&&!/remove|unsave|saved already/i.test(label)){
  if(path!=='/search'&&path!=='/bookmarks'&&path.length>2)setTimeout(()=>void record('quick_save',path),350);
 }
}
function themeChange(){
 const next=document.documentElement.dataset.appTheme;
 if(!themes.includes(next))return;
 if(lastTheme===null){lastTheme=next;return;}
 if(next!==lastTheme){lastTheme=next;void record('theme_changed',next);}
}
function boot(){
 lastTheme=document.documentElement.dataset.appTheme||localStorage.getItem('terravale.unified.theme.v2')||localStorage.getItem('terravale.cosmetic.site.v1')||'dark';
 document.addEventListener('click',clicked,true);
 const observer=new MutationObserver(records=>{if(records.some(x=>x.target===document.documentElement&&x.attributeName==='data-app-theme'))themeChange();});
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-app-theme']});
 document.addEventListener('change',ev=>{if(ev.target?.matches?.('select[aria-label="Website theme"],select[aria-label="Website and character-sheet theme"]'))setTimeout(themeChange,150);},true);
 setInterval(()=>{mount();lookForReads();render();if(currentPath()!==lastPage){lastPage=currentPath();void refresh();}},2300);
 setInterval(refresh,18000);
 window.addEventListener('terravale-cabinet-progress',()=>setTimeout(refresh,700));
 mount();void refresh();setTimeout(lookForReads,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
