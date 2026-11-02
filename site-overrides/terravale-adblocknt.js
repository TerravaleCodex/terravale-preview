/* Terravale Codex · Adblockn't v1.0. Site-wide, fail-closed, Supabase-backed. */
(()=>{'use strict';
if(window.__tvAdblockntMounted)return;window.__tvAdblockntMounted=true;
const BASE='/terravale-preview/', ROOT=BASE+'codex-ads/', API='https://emwlvbmnrrhxhrmlwkhs.supabase.co', KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtd2x2Ym1ucnJoeGhybWx3a2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NjMwMzQsImV4cCI6MjEwODQzOTAzNH0.HAK2OGYfCITRCiGZ2WoIqYhRLQahyXtlUWcMwqBFk-g';
const DEFAULT={enabled:false,auto:true,interval_seconds:25,motion:true,swarm:true};
let settings={...DEFAULT},settingsLoaded=false,user=null,token=null,isDM=false,progress={ads_dismissed:0,adblocknt_unlocked_at:null,personal_adblocker:false,premium_shown:false};
let ads=[],ui=null,layer=null,closeAll=null,widget=null,box=null,tab='cabinet',timer=null,settingsPoll=null,authPoll=null,open=new Map(),serial=0,z=21000,swarmTimer=[],swarmRunning=false,dbBusy=false,pending=0,noticeTimer=null,sessionKey='';
const $=(s,root=document)=>root.querySelector(s), E=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const N=n=>Math.max(0,Math.floor(Number(n)||0));
function access(){
 try{for(let i=0;i<localStorage.length;i++){
  const k=localStorage.key(i)||'';if(!(/^sb-[\w-]+-auth-token$/.test(k)||k.includes('supabase.auth.token')))continue;
  const s=JSON.parse(localStorage.getItem(k)||'null');if(s?.access_token&&s?.user?.id)return {id:s.user.id,token:s.access_token,key:k};
 }}catch{}
 // SSR cookie fallback: only same-project Supabase auth cookies are accepted.
 try{const cookies=Object.fromEntries(document.cookie.split(';').map(pair=>{const at=pair.indexOf('=');return at<0?['','']:[pair.slice(0,at).trim(),pair.slice(at+1).trim()]}));
 const key='sb-emwlvbmnrrhxhrmlwkhs-auth-token';let raw=cookies[key];if(!raw){raw=Object.keys(cookies).filter(k=>k.startsWith(key+'.')).sort().map(k=>cookies[k]).join('')}
 if(raw){let value=decodeURIComponent(raw);if(value.startsWith('base64-'))value=atob(value.slice(7).replace(/-/g,'+').replace(/_/g,'/'));const session=JSON.parse(value);if(session?.access_token&&session?.user?.id)return{id:session.user.id,token:session.access_token,key};}
 }catch{}return null;
}
function headers(auth=true){return {'apikey':KEY,'Authorization':'Bearer '+((auth&&token)||KEY),'Content-Type':'application/json'};}
async function api(path,{method='GET',body,auth=true}={}){
 const res=await fetch(API+'/rest/v1/'+path,{method,headers:headers(auth),body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(!res.ok)throw new Error('Codex data service '+res.status);
 if(res.status===204)return null;
 const raw=await res.text();return raw?JSON.parse(raw):null;
}
function alertUser(title,message){
 if(!document.body)return;let root=$('#tv-ach-toasts');if(!root){root=E('div','tv-ach-toasts');root.id='tv-ach-toasts';document.body.append(root)}
 const note=E('div','tv-ach-toast');const bold=E('strong','',title);note.append(bold,E('span','',message));root.append(note);setTimeout(()=>note.remove(),5600);
}
function hasAchievement(){return Boolean(progress.adblocknt_unlocked_at)}
function clearTimers(){clearTimeout(timer);timer=null;for(const t of swarmTimer)clearTimeout(t);swarmTimer=[];swarmRunning=false;}
function markSettings(newValues){const prior=JSON.stringify(settings),was=settings.enabled;settings={...DEFAULT,...newValues,enabled:newValues?.enabled===true};settingsLoaded=true;
 document.body?.classList.toggle('tv-ad-no-motion',settings.motion===false);
 if(was&&!settings.enabled){clearTimers();clearAds(false)}if(prior!==JSON.stringify(settings))reschedule();paint();}
async function refreshSettings(){
 try{const r=await api('codex_ad_settings?select=enabled,auto,interval_seconds,motion,swarm&id=eq.1',{auth:false});if(!r?.[0])throw Error('Settings missing');markSettings(r[0]);}
 catch(e){markSettings(DEFAULT);if(box&&!box.hidden)alertUser('Ads held off','The global settings could not be checked, so deliveries remain disabled.');}
}
function allow(){return settingsLoaded&&settings.enabled&&Boolean(user)&&!progress.personal_adblocker}
function reschedule(){clearTimeout(timer);timer=null;if(!allow()||!settings.auto||swarmRunning)return;
 const sec=Math.max(5,Math.min(120,Number(settings.interval_seconds)||25));
 timer=setTimeout(()=>{if(allow()&&!document.hidden)spawnAd('normal');reschedule()},sec*1000);
}
function chooseAd(){if(!ads.length)return null;const onscreen=new Set([...open.values()].map(x=>x.ad?.id));const pool=ads.filter(x=>!onscreen.has(x.id));return (pool.length?pool:ads)[Math.floor(Math.random()*(pool.length||ads.length))];}
function sizing(ad,incident=false){const ratio=(Number(ad.width)||800)/(Number(ad.height)||1100), w=window.innerWidth,h=window.innerHeight;
 const b=incident?(ratio>1.3?430:ratio>.9?385:330):(ratio>1.3?460:ratio>.9?400:350);
 return Math.round(Math.min(b*(.88+Math.random()*.30),w-26,Math.max(90,(h-36)*ratio)));
}
function spawnAd(kind='normal',forced=false){if(!ads.length||!settings.enabled||(!forced&&!allow()))return null;if(swarmRunning&&kind==='normal')return null;
 const ad=chooseAd();if(!ad)return null;const id=++serial,card=E('section','tv-ad-popup'+(kind==='swarm'?' tv-ad-swarm':'')),img=E('img','tv-ad-art'),close=E('button','tv-ad-dismiss','×');
 const w=sizing(ad,kind==='swarm'),h=Math.round(w/(ad.width/ad.height));card.dataset.kind=kind;card.style.width=w+'px';card.style.zIndex=++z;
 card.style.left=Math.round(10+Math.random()*Math.max(0,innerWidth-w-22))+'px';card.style.top=Math.round(12+Math.random()*Math.max(0,innerHeight-h-27))+'px';
 img.src=ROOT+'ads/'+ad.id+'.webp';img.alt=ad.title+' — fictional advertisement';img.draggable=false;img.decoding='async';
 close.type='button';close.setAttribute('aria-label','Dismiss '+ad.title);close.onclick=()=>dismiss(id,true);card.onpointerdown=()=>card.style.zIndex=++z;
 card.append(img,close);layer.append(card);open.set(id,{card,ad,kind});renderCounter();return id;
}
function renderCounter(){closeAll.hidden=open.size===0;closeAll.querySelector('b').textContent=String(open.size);if(box&&!box.hidden)paint();}
function dismiss(id,count){const r=open.get(id);if(!r)return;open.delete(id);r.card.remove();renderCounter();if(count&&r.kind==='normal')queueDismissal(1);if(r.kind==='swarm'&&![...open.values()].some(x=>x.kind==='swarm')&&!swarmTimer.length)swarmRunning=false;}
function clearAds(count){let normal=0;for(const [id,item] of open){open.delete(id);item.card.remove();if(count&&item.kind==='normal')normal++;}renderCounter();if(normal)queueDismissal(normal);}
function queueDismissal(n){if(!user||!settings.enabled)return;pending+=n;savePending();void flushDismissals();}
function pendingKey(){return 'tv-adblocknt-pending-'+(user||'guest')}
function savePending(){try{localStorage.setItem(pendingKey(),String(pending))}catch{}}
async function flushDismissals(){if(dbBusy||!token||!user||!pending)return;dbBusy=true;const n=Math.min(pending,100);try{
 const old=N(progress.ads_dismissed),r=await api('rpc/codex_dismiss_ads',{method:'POST',body:{p_count:n}});const data=Array.isArray(r)?r[0]:r;if(!data||!Number.isFinite(Number(data.ads_dismissed)))throw Error('Missing progress');
 pending-=n;savePending();const saved=data;progress={...progress,...saved};if(old<25&&N(saved.ads_dismissed)>=25){alertUser('Achievement unlocked: Adblockn’t','You closed 25 ads. Advertising has taken this personally.');if(settings.swarm&&settings.enabled)launchSwarm();}
 paint();
 }catch(e){console.warn('Terravale ad progress will retry:',e.message)}finally{dbBusy=false;if(pending>0)setTimeout(flushDismissals,2500)}}
function launchSwarm(){if(!settings.enabled||!user)return;if(box&&!box.hidden)closePanel();clearTimeout(timer);timer=null;swarmRunning=true;
 for(let i=0;i<20;i++){
  const t=setTimeout(()=>{swarmTimer=swarmTimer.filter(x=>x!==t);if(settings.enabled&&user)spawnAd('swarm',true);if(i===19)swarmRunning=false;},i*42);
  swarmTimer.push(t);
 }
}
function premium(){const pane=E('div','tv-ad-premium');pane.innerHTML='<span>UNSKIPPABLE FINAL MESSAGE</span><h2>ADBLOCKER PREMIUM+</h2><p>Congratulations. You have upgraded from advertisements to advertisements about not having advertisements.</p><small>Now featuring 0% more ads. Probably.</small>';
 const btn=E('button','','Absolutely not');btn.onclick=()=>pane.remove();pane.append(btn);document.body.append(pane);
}
async function togglePersonal(){if(!hasAchievement()||!user||!token)return;const enable=!progress.personal_adblocker;
 try{const first=enable&&!progress.premium_shown;const rows=await api('codex_achievement_progress?user_id=eq.'+encodeURIComponent(user),{method:'PATCH',body:{personal_adblocker:enable,premium_shown:progress.premium_shown||enable,updated_at:new Date().toISOString()},auth:true});
 // PATCH without representation returns 204, RLS still enforces ownership.
 progress.personal_adblocker=enable;if(enable){clearAds(false);clearTimers();if(first)premium();progress.premium_shown=true;}else reschedule();paint();
 }catch(e){alertUser('Could not change Adblocker','Try again after your session reconnects.');}
}
async function saveDM(){if(!isDM||!token)return;const next={enabled:$('#tv-dm-enabled').checked,auto:$('#tv-dm-auto').checked,interval_seconds:Number($('#tv-dm-interval').value),motion:$('#tv-dm-motion').checked,swarm:$('#tv-dm-swarm').checked,updated_at:new Date().toISOString()};
 try{const r=await fetch(API+'/rest/v1/codex_ad_settings?id=eq.1',{method:'PATCH',headers:{...headers(),'Prefer':'return=representation'},body:JSON.stringify(next)});if(!r.ok)throw Error(String(r.status));const result=await r.json();if(result.length!==1)throw Error('DM permission denied');markSettings(result[0]);alertUser('Global ad controls saved',next.enabled?'Ads are enabled for the Codex.':'Ads remain disabled for everyone.');}
 catch(e){alertUser('Global settings not saved','Only the authenticated site DM can change these settings.');await refreshSettings()}
}
async function renewIdentity(){const s=access(),id=s?.id||null,t=s?.token||null;
 if(id===user&&t===token)return;const changed=id!==user;user=id;token=t;if(!changed)return;clearTimers();clearAds(false);
 if(changed){isDM=false;progress={ads_dismissed:0,adblocknt_unlocked_at:null,personal_adblocker:false,premium_shown:false};pending=0;}
 if(!user){paint();return}if(changed){pending=N(localStorage.getItem(pendingKey()));try{const r=await api('codex_achievement_progress?select=ads_dismissed,adblocknt_unlocked_at,personal_adblocker,premium_shown&user_id=eq.'+encodeURIComponent(user));if(user===id&&r?.[0])progress={...progress,...r[0]};}catch(e){console.warn('Terravale progress load retry:',e.message)}
 try{const result=await api('rpc/codex_am_i_site_dm',{method:'POST',body:{}});if(user===id)isDM=result===true;}catch(e){isDM=false;}
 }
 paint();reschedule();if(pending)void flushDismissals();
}
function progressLabel(){return hasAchievement()?'1 of 1 discovered':'0 of 1 discovered'}
function openPanel(which='cabinet'){if((which==='dm'||which==='adlab')&&!isDM)which='cabinet';tab=which;box.hidden=false;document.body.classList.add('tv-panel-open');paint();}
function closePanel(){box.hidden=true;document.body.classList.remove('tv-panel-open');}
function paint(){if(!ui)return;
 const n=N(progress.ads_dismissed);widget.textContent='✧ '+(hasAchievement()?'1':'0')+'/1';widget.title='Cabinet of Curiosities — '+progressLabel();
 window.dispatchEvent(new CustomEvent('terravale-cabinet-progress',{detail:{ads_dismissed:progress.ads_dismissed,adblocknt_unlocked_at:progress.adblocknt_unlocked_at,personal_adblocker:progress.personal_adblocker}}));
 $('#tv-ach-found').textContent=progressLabel();$('#tv-ach-count').textContent=Math.min(25,n)+'/25';$('#tv-ach-progress').style.width=Math.min(100,n/25*100)+'%';$('#tv-home-found').textContent=progressLabel();$('#tv-home-progress').textContent=Math.min(25,n)+' / 25';$('#tv-ach-progress').parentElement.setAttribute('aria-valuenow',String(Math.min(25,n)));
 $('#tv-ach-card').classList.toggle('unlocked',hasAchievement());$('#tv-ach-name').textContent=hasAchievement()?'Adblockn’t':'Undiscovered Secret';
 $('#tv-ach-desc').textContent=hasAchievement()?'Dismissed 25 suspicious ads. Got 20 more for your trouble.':'A certain number of closed windows will upset the advertising department.';
 $('#tv-ach-state').textContent=hasAchievement()?'DISCOVERED':'LOCKED';
 $('#tv-adblock-toggle').disabled=!hasAchievement();$('#tv-adblock-toggle').textContent=hasAchievement()?(progress.personal_adblocker?'Disable my Adblocker':'Enable my Adblocker'):'Unlock through Adblockn’t';
 $('#tv-adblock-hint').textContent=hasAchievement()?(progress.personal_adblocker?'Regular popups are suppressed for you.':'Your optional Adblocker is currently off.'):'Dismiss 25 genuine ad windows to unlock the optional Adblocker.';
 $('#tv-delivery-state').textContent=!settingsLoaded?'Checking global settings…':!settings.enabled?'Ads disabled by DM':progress.personal_adblocker?'Your Adblocker is on':settings.auto?'Advertisements enabled':'Ads enabled, auto delivery paused';
 const dmButton=$('#tv-tab-dm');dmButton.hidden=!isDM;const labButton=$('#tv-tab-adlab');labButton.hidden=!isDM;if((tab==='dm'||tab==='adlab')&&!isDM)tab='cabinet';if(isDM)populateGallery();
 for(const e of ui.querySelectorAll('[data-tv-tab]'))e.classList.toggle('selected',e.dataset.tvTab===tab);
 for(const e of ui.querySelectorAll('[data-tv-pane]'))e.hidden=e.dataset.tvPane!==tab;
 $('#tv-dm-enabled').checked=Boolean(settings.enabled);$('#tv-dm-auto').checked=Boolean(settings.auto);$('#tv-dm-interval').value=String(settings.interval_seconds);$('#tv-dm-interval-value').textContent=settings.interval_seconds+' seconds';$('#tv-dm-motion').checked=Boolean(settings.motion);$('#tv-dm-swarm').checked=Boolean(settings.swarm);
 $('#tv-preview-one').disabled=!allow();$('#tv-preview-swarm').disabled=!allow();$('#tv-ads-open').textContent=open.size;
}
function settingsForm(){return `<div class="tv-dm-grid"><label><span>Global ad delivery</span><input id="tv-dm-enabled" type="checkbox"></label><label><span>Automatic interruptions</span><input id="tv-dm-auto" type="checkbox"></label><label class="tv-dm-long"><span>Time between ads <output id="tv-dm-interval-value">25 seconds</output></span><input id="tv-dm-interval" type="range" min="5" max="120" step="5" value="25"></label><label><span>Animated pop-ins</span><input id="tv-dm-motion" type="checkbox"></label><label><span>25-close ad swarm</span><input id="tv-dm-swarm" type="checkbox"></label></div><p class="tv-small">These settings affect every player and every page. Initially disabled. Only the site DM can save changes.</p><button class="tv-primary" id="tv-dm-save">Save global settings</button>`}
let galleryPopulated=false;
function populateGallery(){
 if(!isDM||!box||galleryPopulated)return;
 galleryPopulated=true;
 const gallery=$('#tv-gallery');for(const a of ads){const button=E('button','tv-gallery-item');button.type='button';button.title='View '+a.title;const img=E('img');img.src=ROOT+'ads/'+a.id+'.webp';img.loading='lazy';img.alt=a.title;button.append(img,E('small','',a.title));button.onclick=()=>{if(allow())spawnSpecific(a);else alertUser('Ads are disabled','Enable them in DM controls before spawning.');};gallery.append(button)}
}
function mount(){
 if(!document.body||ui)return;layer=E('div','tv-ad-layer');layer.id='tv-ad-layer';closeAll=E('button','tv-ad-close-all');closeAll.type='button';closeAll.hidden=true;closeAll.innerHTML='× &nbsp; Close all ads <b>0</b>';closeAll.onclick=()=>clearAds(true);
 widget=E('button','tv-ach-widget','✧ 0/1');widget.type='button';widget.onclick=()=>openPanel('cabinet');widget.setAttribute('aria-label','Open Cabinet of Curiosities');
 box=E('div','tv-ach-backdrop');box.hidden=true;box.innerHTML=`<section class="tv-ach-window" role="dialog" aria-modal="true" aria-label="Terravale Cabinet of Curiosities"><header><span>✧ TERRAVALE CODEX <small>THE CABINET OF CURIOSITIES</small></span><button id="tv-ach-close" type="button" aria-label="Close Cabinet">×</button></header><nav aria-label="Cabinet sections"><button data-tv-tab="cabinet">Cabinet</button><button data-tv-tab="achievements">Achievements</button><button data-tv-tab="appearance">Unlockables</button><button data-tv-tab="adlab" id="tv-tab-adlab" hidden>Ad Laboratory</button><button id="tv-tab-dm" data-tv-tab="dm" hidden>DM · Ad Controls</button></nav><main>
 <div data-tv-pane="cabinet">
  <div class="tv-eyebrow">THE CABINET OF CURIOSITIES</div>
  <h1>A cabinet of <em>curiosities.</em></h1>
  <p class="tv-small">A home for discoveries, strange milestones and unusual rewards across Terravale. Your achievements are tracked separately from character level and DM-approved advancement.</p>
  <div class="tv-cabinet-summary">
   <div><span class="tv-eyebrow">DISCOVERIES</span><strong id="tv-home-found">0 of 1 discovered</strong><small>One approved achievement is currently available</small></div>
   <div><span class="tv-eyebrow">PROGRESS</span><strong id="tv-home-progress">0 / 25</strong><small>Advertisements dismissed toward Adblockn’t</small></div>
  </div>
  <button type="button" id="tv-view-achievements" class="tv-cabinet-entry">
   <span class="tv-medal" aria-hidden="true">✧</span>
   <span><strong>Achievements</strong><small>Inspect discovered and locked achievements, progress and their rewards.</small></span>
   <span class="tv-cabinet-arrow" aria-hidden="true">›</span>
  </button>
 </div>
 <div data-tv-pane="achievements" hidden>
  <div class="tv-eyebrow">COLLECTION / ACHIEVEMENTS</div><h1>Achievements <em>& discoveries.</em></h1>
  <p class="tv-small">Achievements are tied to your Codex account, not a character sheet. Only achievements approved for the current Codex build appear here.</p>
  <div class="tv-stats"><strong id="tv-ach-found">0 of 1 discovered</strong><span>1 APPROVED · 0 HIDDEN CATEGORIES</span></div>
  <div class="tv-ach-category"><span>✦ MISCHIEF</span><span>1 achievement</span></div>
  <article id="tv-ach-card" aria-label="Adblockn't achievement">
    <div class="tv-medal" aria-hidden="true">▣</div>
    <div class="tv-ach-card-body"><div class="tv-eyebrow">EPIC · MISCHIEF</div><h2 id="tv-ach-name">Undiscovered Secret</h2>
      <p id="tv-ach-desc">A certain number of closed windows will upset the advertising department.</p>
      <small id="tv-ach-state">LOCKED</small>
    </div>
  </article>
  <div class="tv-progress-label"><span>Progress · Advertisement dismissals</span><strong id="tv-ach-count">0/25</strong></div>
  <div class="tv-progress-track" role="progressbar" aria-label="Adblockn't achievement progress" aria-valuemin="0" aria-valuemax="25" aria-valuenow="0"><i id="tv-ach-progress"></i></div>
  <div class="tv-ach-reward"><div class="tv-eyebrow">REWARD / APPEARANCE UNLOCK</div><strong>Terravale Adblocker™</strong><p class="tv-small">Dismiss 25 real ad pop-ups to unlock the optional Adblocker. The 20-ad incident is triggered at the unlock milestone when global ads and swarm mode are enabled.</p><button id="tv-ach-open-unlockables" class="tv-secondary" type="button">View unlockable →</button></div>
 </div>
 <div data-tv-pane="appearance" hidden><div class="tv-eyebrow">APPEARANCE · UNLOCKABLES</div><h1>Terravale <em>Adblocker™.</em></h1><p id="tv-adblock-hint" class="tv-small">Dismiss 25 windows to unlock it.</p><button id="tv-adblock-toggle" class="tv-primary" disabled>Unlock through Adblockn’t</button></div>
 <div data-tv-pane="adlab" hidden><div class="tv-eyebrow">ADVERSE ADVERTISING DIVISION</div><h1>Ad <em>Laboratory.</em></h1><p class="tv-small" id="tv-delivery-state">Checking global settings…</p><p class="tv-small">Approved artwork: 56 ads. Open windows: <strong id="tv-ads-open">0</strong>. The Codex's ad layer follows you from page to page.</p><div class="tv-actions"><button class="tv-primary" id="tv-preview-one">Spawn random ad</button><button id="tv-preview-swarm">Preview 20-ad incident</button></div><div id="tv-gallery" class="tv-gallery"></div></div>
 <div data-tv-pane="dm" hidden><div class="tv-eyebrow">DUNGEON MASTER · GLOBAL SETTINGS</div><h1>Advertisement <em>Controls.</em></h1>${settingsForm()}</div>
 </main><footer>ALL ADVERTISEMENTS ARE FICTIONAL · OFFLINE TEST CHAMBER RETIRED</footer></section>`;
 box.addEventListener('click',ev=>{if(ev.target===box)closePanel()});
 document.body.append(layer,closeAll,widget,box);ui=box;
 $('#tv-ach-close').onclick=closePanel;for(const b of box.querySelectorAll('[data-tv-tab]'))b.onclick=()=>{if((b.dataset.tvTab==='adlab'||b.dataset.tvTab==='dm')&&!isDM)return;tab=b.dataset.tvTab;paint()};
 $('#tv-view-achievements').onclick=()=>openPanel('achievements');
 $('#tv-ach-open-unlockables').onclick=()=>openPanel('appearance');
 $('#tv-adblock-toggle').onclick=togglePersonal;$('#tv-preview-one').onclick=()=>spawnAd('normal');$('#tv-preview-swarm').onclick=()=>launchSwarm();$('#tv-dm-save').onclick=saveDM;
 $('#tv-dm-interval').oninput=e=>{$('#tv-dm-interval-value').textContent=e.target.value+' seconds'};
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!box.hidden)closePanel()});

 paint();
}
function spawnSpecific(ad){const old=chooseAd;const idx=ads.indexOf(ad);if(idx<0)return;const selected=ads.splice(idx,1);ads.unshift(ad);spawnAd('normal');ads.splice(0,1);ads.splice(idx,0,...selected)}
function addNavLinks(){const add=(section,id,label,onClick)=>{const root=$(section);if(!root||$('#'+id,root))return;const btn=E('button','terr-nav-link tv-ach-nav',label);btn.id=id;btn.type='button';btn.onclick=onClick;root.append(btn)};
 add('.terr-nav-section[data-section="settings"] .terr-nav-section-links','tv-nav-cabinet','✧  Cabinet of Curiosities',()=>openPanel('cabinet'));
 if(isDM)add('.terr-nav-section[data-section="dm"] .terr-nav-section-links','tv-nav-dm-ads','▣  Ad Controls',()=>openPanel('dm'));
 else document.querySelectorAll('#tv-nav-dm-ads').forEach(x=>x.remove());
}
async function init(){
 try{const r=await fetch(ROOT+'ads.json',{cache:'force-cache'});if(r.ok){const d=await r.json();if(Array.isArray(d)&&d.length===56)ads=d;}}catch(e){console.warn('Approved ad manifest unavailable',e)}
 mount();await refreshSettings();await renewIdentity();authPoll=setInterval(()=>{renewIdentity();addNavLinks()},4500);settingsPoll=setInterval(refreshSettings,18000);setInterval(()=>{if(pending&&!dbBusy)flushDismissals()},12000);
 addNavLinks();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSettings()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.TerravaleAdblocknt={openCabinet:()=>openPanel('cabinet'),openUnlockables:()=>openPanel('appearance'),openDM:()=>isDM&&openPanel('dm')};
})();