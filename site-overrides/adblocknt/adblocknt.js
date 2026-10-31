/* Terravale Codex · Approved Adblockn't (the only live achievement)
 * Approved ADS.zip artwork; global ad delivery is read-only from RLS-protected Supabase.
 * No changes to character/campaign records. */
(()=>{
'use strict';
if(window.TCAdsLive)return;
const BASE='/terravale-preview/';
const API='https://emwlvbmnrrhxhrmlwkhs.supabase.co/rest/v1/site_ad_settings?id=eq.1&select=*';
const PUBLIC_KEY='sb_publishable_4kf7TddSu-mzjRGr2J5ACA_OrNFF_5T';
const KEY='terravale.adblocknt.progress.v1';
const DIMENSIONS=[0.75, 0.8, 2.151, 1.0, 0.8, 0.8, 1.2, 0.75, 0.8, 0.8, 0.8, 0.8, 0.75, 0.8, 0.667, 1.066, 0.75, 0.8, 0.8, 0.75, 0.75, 0.8, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 1.777, 0.75, 0.8, 1.777, 0.75, 1.777, 1.0, 1.777, 1.777, 1.066, 2.0, 1.0, 1.011, 1.0, 1.777, 1.5, 1.777, 1.0, 1.9, 1.777, 1.0, 1.776, 1.777, 1.5, 1.0, 1.777];
const ADS=DIMENSIONS.map((ratio,i)=>({id:i+1,ratio,url:BASE+'adblocknt/ads/zip-'+String(i+1).padStart(3,'0')+'.webp'}));
let progress={dismissed:0,unlocked:false,swarmTriggered:false,adblocker:false,premiumShown:false};
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object')progress={...progress,...s}}catch{}
let settings={enabled:false,automatic:false,interval_seconds:25,animations:true,incident_enabled:true};
let loaded=false,autoTimer=0,pollTimer=0,swarmTimers=new Set(),swarmInProgress=false,z=25000,serial=0,bag=[],toaster;
const active=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(progress))}catch{}};
const random=(a,b)=>a+Math.random()*(b-a);
const $=(selector)=>document.querySelector(selector);
const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=String(content);return n};
const css=`
#tc-ad-layer{position:fixed;inset:0;z-index:214000;pointer-events:none;overflow:hidden}
.tc-live-ad{position:absolute;pointer-events:auto;line-height:0;border:1px solid #e8add7a6;border-radius:7px;background:#180d1d;box-shadow:0 14px 45px #000d,0 0 20px #d34a993c;isolation:isolate;transform-origin:center;animation:tc-pop .45s cubic-bezier(.18,1.45,.28,1) both}
.tc-live-ad.swarm{box-shadow:0 17px 55px #000d,0 0 25px #e258a24b}.tc-live-ad img{display:block;width:100%;height:auto;border-radius:6px;cursor:zoom-in;user-select:none}
.tc-live-close{position:absolute;top:-10px;right:-10px;display:grid;place-items:center;width:28px;height:28px;line-height:1;border-radius:50%;background:#28182f;color:white;border:1px solid #ffc8e9;font:21px Arial,sans-serif;cursor:pointer;box-shadow:0 3px 14px #000a}
.tc-live-close:hover{background:#9f2d66}.tc-live-ad.leaving{animation:tc-out .2s ease-in forwards;pointer-events:none}
@keyframes tc-pop{0%{opacity:0;transform:translateY(25px) scale(.66) rotate(-5deg)}65%{opacity:1;transform:translateY(-7px) scale(1.065)}100%{transform:translateY(0) scale(1)}}
@keyframes tc-out{to{opacity:0;transform:scale(.72) rotate(4deg)}}
#tc-close-all-live{position:fixed;left:16px;bottom:16px;z-index:214005;border:1px solid #e3b0d2;background:#26172e;color:white;border-radius:9px;padding:12px 17px;font:700 12px system-ui;box-shadow:0 8px 28px #000b;cursor:pointer}
#tc-close-all-live[hidden]{display:none!important}
#tc-ach-widget{position:fixed;right:18px;bottom:16px;z-index:213999;display:flex;gap:7px;align-items:center;color:#eeddf4;background:#1a1420;border:1px solid #715577;border-radius:12px;padding:9px 13px;text-decoration:none;box-shadow:0 8px 25px #000a;font:600 12px system-ui}
#tc-ach-widget:hover{border-color:#ce9acc}#tc-ach-widget strong{color:#eeb4e0}
#tc-ach-toast{position:fixed;right:17px;bottom:70px;z-index:214020;background:#25152c;border:1px solid #bd78a4;border-radius:12px;padding:15px 18px;color:#fff;font:13px/1.55 system-ui;box-shadow:0 16px 48px #000c;max-width:350px}
#tc-ach-toast[hidden]{display:none!important}#tc-ach-toast b{display:block;color:#f6aad9;font-size:13px}
#tc-ad-preview-lightbox{position:fixed;inset:0;z-index:214030;background:#050407eb;display:grid;place-items:center;padding:25px;cursor:zoom-out}
#tc-ad-preview-lightbox img{max-height:90vh;max-width:90vw;object-fit:contain}
.tc-premium-content{padding:16px 25px 20px;background:linear-gradient(145deg,#3b164c,#0e1020);border-radius:7px;text-align:center;line-height:1.4;color:#fff;font-family:system-ui}.tc-premium-content small{font-size:10px;letter-spacing:.13em;color:#ffbadd}.tc-premium-content h2{font-size:29px;line-height:1;margin:14px 0;color:#ffbadf}.tc-premium-content p{font-size:13px}.tc-premium-content strong{color:#ffbadd}.tc-premium-content em{display:block;font-style:normal;background:#f3a9d1;color:#281029;padding:9px;margin:13px 0;border-radius:6px;font-weight:800;font-size:12px}
#tc-adblocker-unlock{margin:18px 0;padding:18px;background:#1c1525;border:1px solid #5d496a;border-radius:12px;color:#eee;font:13px system-ui}
#tc-adblocker-unlock h3{margin:0 0 8px;font-size:17px}#tc-adblocker-unlock p{opacity:.8;line-height:1.5}#tc-adblocker-unlock button{border:1px solid #a985bd;color:#fff;background:#3c2850;border-radius:8px;padding:10px 14px;cursor:pointer}
@media(prefers-reduced-motion:reduce){.tc-live-ad,.tc-live-ad.leaving{animation:none!important}}
@media(max-width:690px){#tc-ach-widget{right:10px;bottom:10px;padding:8px}#tc-close-all-live{left:10px;bottom:10px}.tc-live-close{width:27px;height:27px}}
`;
const style=el('style');style.textContent=css;document.head.append(style);
const layer=el('div');layer.id='tc-ad-layer';document.body.append(layer);
const all=el('button',null,'×  Close all ads');all.id='tc-close-all-live';all.type='button';all.hidden=true;document.body.append(all);
const widget=el('a');widget.id='tc-ach-widget';widget.href=BASE+'cabinet-of-curiosities/';widget.innerHTML='✧ <span>The Cabinet</span> <strong id="tc-ach-state">0 / 1</strong>';document.body.append(widget);
const toastBox=el('div');toastBox.id='tc-ach-toast';toastBox.hidden=true;document.body.append(toastBox);
function toast(t,m){toastBox.replaceChildren(el('b',null,t),el('span',null,m));toastBox.hidden=false;clearTimeout(toaster);toaster=setTimeout(()=>toastBox.hidden=true,6500)}
function update(){all.hidden=!active.size;all.textContent='×  Close all ads  '+active.size;const n=$('#tc-ach-state');if(n)n.textContent=(progress.unlocked?'1':'0')+' / 1';window.dispatchEvent(new CustomEvent('tc-adblocknt-update',{detail:{...progress,settings:{...settings}}}));}
function popWidth(kind,a){const vw=innerWidth,vh=innerHeight,ratio=a.ratio;const big=kind==='swarm';const base=big?(ratio>1.3?random(380,495):ratio>.9?random(330,430):random(285,380)):(ratio>1.3?random(425,525):ratio>.9?random(350,440):random(295,375));return Math.round(Math.max(55,Math.min(base,vw-24,(vh-42)*ratio)))}
function bounds(w,h){const m=12,xmax=Math.max(m,innerWidth-w-m),ymax=Math.max(m,innerHeight-h-m);return{x:random(m,xmax),y:random(m,ymax),w,h}}
function nextAd(){if(!bag.length)bag=[...ADS].sort(()=>Math.random()-.5);return bag.pop()}
function hideItem(rec,animate=true){active.delete(rec.id);if(animate&&settings.animations&&!reduced){rec.node.classList.add('leaving');setTimeout(()=>rec.node.remove(),210)}else rec.node.remove()}
function dismiss(id,count=true){const rec=active.get(id);if(!rec)return;hideItem(rec);if(count&&rec.kind==='normal'){
 progress.dismissed++;if(progress.dismissed>=25&&!progress.swarmTriggered){progress.unlocked=true;progress.swarmTriggered=true;toast('ACHIEVEMENT UNLOCKED: ADBLOCKN’T','You closed 25 ads. Marketing has taken this personally.');if(settings.enabled&&settings.incident_enabled)setTimeout(()=>swarm(),400)}persist();
}update()}
function clear(count=true){const records=[...active.values()];for(const r of records)dismiss(r.id,count);if(swarmInProgress){for(const t of swarmTimers)clearTimeout(t);swarmTimers.clear();swarmInProgress=false}update()}
function inspect(a){const light=el('div');light.id='tc-ad-preview-lightbox';const image=el('img');image.src=a.url;image.alt='Full fictional advertisement';light.append(image);light.addEventListener('click',()=>light.remove());document.body.append(light)}
function popup(a,kind='normal'){
 if(!settings.enabled||(progress.adblocker&&kind==='normal'))return;
 const id=++serial,w=popWidth(kind,a),h=Math.round(w/a.ratio),p=bounds(w,h),node=el('section','tc-live-ad '+(kind==='swarm'?'swarm':''));node.style.cssText=`left:${p.x}px;top:${p.y}px;width:${w}px;z-index:${++z}`;if(!settings.animations||reduced)node.style.animation='none';
 if(kind==='premium'){const content=el('div','tc-premium-content');content.innerHTML='<small>ONE FINAL IMPORTANT MESSAGE</small><h2>ADBLOCKER<br>PREMIUM+</h2><p>You blocked every ad.<br><strong>Except this one.</strong></p><p>Upgrade your Adblocker to remove ads in your Adblocker!</p><em>BUY NOW! (ABSOLUTELY NOT)</em><small>NO LINKS. NO PURCHASES. JUST DISAPPOINTMENT.</small>';node.append(content)}
 else{const img=el('img');img.src=a.url;img.alt='Fictional Terravale advertisement '+a.id;img.decoding='async';img.addEventListener('click',()=>inspect(a));node.append(img)}
 const close=el('button','tc-live-close','×');close.type='button';close.setAttribute('aria-label','Close fictional advertisement');close.addEventListener('click',()=>dismiss(id,true));node.append(close);node.addEventListener('pointerdown',()=>node.style.zIndex=String(++z));layer.append(node);active.set(id,{id,node,kind});update();return id;
}
function spawn(){if(!settings.enabled||progress.adblocker||swarmInProgress)return;popup(nextAd())}
function swarm(){if(!settings.enabled||!settings.incident_enabled)return;swarmInProgress=true;for(let i=0;i<20;i++){const t=setTimeout(()=>{swarmTimers.delete(t);if(!settings.enabled)return;popup(nextAd(),'swarm');if(!swarmTimers.size)swarmInProgress=false},settings.animations?i*90:0);swarmTimers.add(t)}}
function schedule(){clearTimeout(autoTimer);if(!settings.enabled||!settings.automatic||progress.adblocker)return;autoTimer=setTimeout(()=>{if(!document.hidden)spawn();schedule()},Math.max(3000,settings.interval_seconds*1000*random(.75,1.3)))}
async function refresh(){try{const response=await fetch(API,{headers:{apikey:PUBLIC_KEY,'Accept':'application/json'},cache:'no-store'});if(!response.ok)throw Error('Settings '+response.status);const rows=await response.json();if(!Array.isArray(rows)||!rows.length)throw Error('No settings row');const s=rows[0];const before=settings.enabled;settings={enabled:!!s.enabled,automatic:!!s.automatic,interval_seconds:Math.max(5,Math.min(120,Number(s.interval_seconds)||25)),animations:s.animations!==false,incident_enabled:s.incident_enabled!==false};loaded=true;if(before&&!settings.enabled)clear(false);schedule();update()}catch(e){console.warn('Terravale ad settings unavailable; advertising paused.',e);settings.enabled=false;clear(false);schedule();}}
function toggleAdblocker(){if(!progress.unlocked)return;progress.adblocker=!progress.adblocker;if(progress.adblocker){clear(false);if(!progress.premiumShown){progress.premiumShown=true;popup({ratio:1.1},'premium')}toast('Adblocker enabled','Regular advertisements are now suppressed.')}else{toast('Adblocker disabled','The adverts may return.')}persist();schedule();update()}
function mountAppearance(){if(!location.pathname.includes('/appearance'))return;if($('#tc-adblocker-unlock'))return;const box=el('section');box.id='tc-adblocker-unlock';const h=el('h3',null,'Unlockables · Adblocker');const p=el('p');const b=el('button');b.type='button';b.onclick=toggleAdblocker;box.append(h,p,b);(document.querySelector('main')||document.body).after(box);function repaint(){p.textContent=progress.unlocked?'Unlocked by dismissing 25 fake ads. Toggle on to suppress your personal ads.':'Locked. Dismiss 25 fake advertisements to unlock it.';b.disabled=!progress.unlocked;b.textContent=!progress.unlocked?'Locked':progress.adblocker?'Enabled · Turn off':'Disabled · Turn on'}repaint();window.addEventListener('tc-adblocknt-update',repaint)}
function dmLink(){if(!/^\/terravale-preview\/dm(\/|$)/.test(location.pathname)||location.pathname.includes('ad-controls'))return;const main=document.querySelector('main');if(!main||$('#tc-dm-ads-link'))return;const link=el('a',null,'⚙ Ad delivery controls');link.id='tc-dm-ads-link';link.href=BASE+'dm/ad-controls/';link.style.cssText='display:inline-block;margin:12px 0;padding:9px 13px;border:1px solid #92709f;border-radius:8px;color:inherit;text-decoration:none;';document.body.append(link);link.style.position='fixed';link.style.right='16px';link.style.top='72px';link.style.zIndex='214005'}
all.addEventListener('click',()=>clear(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.TCAdsLive={state:()=>({...progress}),policy:()=>({...settings}),refresh,spawn,swarm,closeAll:clear,toggleAdblocker,resetForTest:()=>{clear(false);progress={dismissed:0,unlocked:false,swarmTriggered:false,adblocker:false,premiumShown:false};persist();schedule();update()}};
mountAppearance();dmLink();update();refresh();pollTimer=setInterval(refresh,60000);
})();