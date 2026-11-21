
/* V2.87 — Actual V2 character resources, not offline lab counters.
   Native resource elements remain connected and are the ONLY action owners.
   Catalog and Quick Access are views which invoke existing real controls. */
(function(){
'use strict';
if(window.TerravaleV287Adaptive)return;
const state={character:null,storageKey:null,stars:new Set(),filter:'all',query:'',signature:'',mode:'',root:null};
const types={spell:'Spellcasting',class:'Class abilities',item:'Item charges',divine:'Divine resources'};
const n=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
function character(){
 const match=location.hash.match(/^#\/characters\/([^/?#]+)/);
 if(!match||typeof db==='undefined')return null;
 let id=match[1];try{id=decodeURIComponent(id)}catch{}
 return(db.characters||[]).find(c=>String(c.id)===id)||null;
}
function identity(){
 const a=window.TerravaleVerifiedAccount;
 return String(a?.state?.user?.id||a?.state?.profile?.id||'current-browser');
}
function keyFor(c){return 'tv287-stars:'+identity()+':'+String(c.campaign||'')+':'+String(c.id)}
function syncCharacter(c){
 const next=keyFor(c);
 if(state.storageKey===next)return;
 state.character=c.id;state.storageKey=next;state.filter='all';state.query='';state.signature='';
 let saved=[];
 try{const parsed=JSON.parse(localStorage.getItem(next)||'[]');if(Array.isArray(parsed))saved=parsed}catch{}
 state.stars=new Set(saved.filter(x=>typeof x==='string').slice(0,500));
}
function saveStars(){
 try{localStorage.setItem(state.storageKey,JSON.stringify(Array.from(state.stars)))}catch{}
}
function safeTitle(el){return String(el?.textContent||'').trim().replace(/\s+/g,' ').slice(0,180)}
function titleFor(el,kind){
 const sel=kind==='spell'||kind==='class'?'.v234-resource-line strong':
  kind==='item'?'.tv-v251-resource-title strong':'.tv285-resource-title';
 return safeTitle(el.querySelector(sel))||'Unnamed resource';
}
function counterFor(el,kind){
 const sel=kind==='spell'||kind==='class'?'.v234-resource-line b':
  kind==='item'?'.tv-v251-count':'.tv285-resource-count';
 const raw=safeTitle(el.querySelector(sel));
 const values=raw.match(/(\d+)\s*\/\s*(\d+)/);
 return {label:values?values[1]+'/'+values[2]:(raw||'—'),
         current:values?Number(values[1]):null,
         max:values?Number(values[2]):null};
}
function recoveryFor(el,kind){
 const sel=kind==='spell'||kind==='class'?'.v234-resource-source':
  kind==='item'?'.tv-v251-rule':'.tv285-resource-recovery';
 return safeTitle(el.querySelector(sel));
}
function controlsFor(el,kind){
 const sel=kind==='spell'||kind==='class'?'.v234-resource-actions button':
  kind==='item'?'.tv-v251-resource-actions button':'.tv285-resource-actions button';
 return Array.from(el.querySelectorAll(sel)).slice(0,4);
}
function collect(){
 const host=document.querySelector('#pageRoot .sheet20-resource-panel');
 if(!host)return[];
 const all=[],ids=new Map();
 function add(el,kind,base){
  if(!el||el.closest('[data-tv287-rendered]'))return;
  const title=titleFor(el,kind),baseKey=kind+':'+String(base||title.toLowerCase());
  const idx=ids.get(baseKey)||0;ids.set(baseKey,idx+1);
  const id=baseKey+(idx?':'+idx:'');
  all.push({id,kind,name:title,counter:counterFor(el,kind),recovery:recoveryFor(el,kind),controls:controlsFor(el,kind),element:el});
 }
 host.querySelectorAll('.v234-resource-item').forEach(el=>add(el,el.closest('.v234-spell-grid')?'spell':'class',el.dataset.v234Resource||''));
 host.querySelectorAll('.tv-v251-resource-card').forEach(el=>add(el,'item',el.dataset.v287ItemId||titleFor(el,'item')));
 host.querySelectorAll('.tv285-resource-card').forEach(el=>add(el,'divine',el.dataset.award||titleFor(el,'divine')));
 return all;
}
function signatureFor(records,mode){
 return JSON.stringify([state.storageKey,mode,records.map(r=>[
   r.id,r.name,r.counter.label,r.recovery,
   r.controls.map(b=>[safeTitle(b),b.disabled,!!b.isConnected])
 ])]);
}
function progress(record){
 const {current,max}=record.counter;
 if(!Number.isFinite(current)||!Number.isFinite(max)||max<=0)return null;
 return Math.min(100,Math.max(0,100*current/max));
}
function invoke(record,index){
 // Always press the native V2 button. Supabase RPCs, ownership, recovery,
 // non-spendable pools and shared divine charges remain owned by V2.
 const source=collect().find(x=>x.id===record.id);
 const button=source?.controls[index];
 if(!button||button.disabled||!button.isConnected)return;
 button.click();
 schedule();
}
function actionLabel(button){
 const text=safeTitle(button),title=String(button.getAttribute('aria-label')||'');
 if(/spend|use|activate/i.test(text+' '+title))return '− Spend';
 if(/restore|refill|recharge|dawn/i.test(text+' '+title))return '+ Restore';
 return text.slice(0,28)||'Action';
}
function card(record,compact){
 const wrap=n('article','tv287-card');
 wrap.dataset.tv287Rendered='1';wrap.dataset.resourceId=record.id;
 const head=n('div','tv287-card-header');
 const name=n('span','tv287-card-name',record.name);
 const count=n('span','tv287-card-count',record.counter.label);
 const star=n('button','tv287-star',state.stars.has(record.id)?'★':'☆');
 star.type='button';star.title=state.stars.has(record.id)?'Remove from Quick Access':'Star for Quick Access';
 star.setAttribute('aria-label',star.title);
 star.setAttribute('aria-pressed',String(state.stars.has(record.id)));
 star.addEventListener('click',()=>{
   if(state.stars.has(record.id))state.stars.delete(record.id);
   else state.stars.add(record.id);
   saveStars();paint(true);
 });
 head.append(name,count,star);wrap.append(head);
 const pct=progress(record);
 if(pct!==null){
  const track=n('div','tv287-track');track.setAttribute('aria-label',record.counter.label+' available');
  const fill=n('span');fill.style.width=pct+'%';track.append(fill);wrap.append(track);
 }
 if(!compact){
  const sub=n('div','tv287-card-sub',record.recovery||types[record.kind]);
  sub.title=record.recovery||types[record.kind];wrap.append(sub);
 }
 if(record.controls.length){
  const actions=n('div','tv287-card-actions');
  record.controls.forEach((original,index)=>{
    const b=n('button','',actionLabel(original));b.type='button';b.disabled=original.disabled;
    b.title=original.title||original.getAttribute('aria-label')||safeTitle(original);
    b.addEventListener('click',()=>invoke(record,index));actions.append(b);
  });
  wrap.append(actions);
 }
 return wrap;
}
function goResources(){
 const btn=document.querySelector('#pageRoot .sheet20-tabs [data-value="resources"]');
 if(btn)btn.click();
}
function quickPanel(records){
 const dashboard=document.querySelector('#pageRoot .sheet20-dashboard'),
   aside=dashboard?.querySelector('.sheet20-secondary-stack');
 if(!aside)return;
 const active=records.filter(r=>state.stars.has(r.id));
 let panel=aside.querySelector('#tv287-quick-panel');
 if(!records.length){
  panel?.remove();dashboard.classList.add('tv287-no-resources');return;
 }
 dashboard.classList.remove('tv287-no-resources');
 if(!panel){panel=n('section','sheet20-panel tv287-quick-panel');panel.id='tv287-quick-panel';aside.append(panel)}
 panel.replaceChildren();
 const top=n('div','tv287-topline');
 const lhs=n('div');lhs.append(n('div','tv287-eyebrow','STARRED RESOURCES'),n('h3','','Quick Access'));
 const more=n('button','tv287-jump','All resources');
 more.type='button';more.addEventListener('click',goResources);
 top.append(lhs,more);panel.append(top);
 if(!active.length){
  panel.append(n('p','tv287-muted','Star the resources you use most often in the Resources tab. They will appear here automatically.'));return;
 }
 const grid=n('div','tv287-quick-stack');
 for(const r of active)grid.append(card(r,true));
 panel.append(grid);
}
function catalog(records){
 const native=document.querySelector('#pageRoot .sheet20-content>.sheet20-resource-panel');
 if(!native)return;
 native.classList.add('tv287-native-source');
 let panel=document.querySelector('#pageRoot #tv287-resource-catalog');
 if(!panel){panel=n('section','sheet20-panel tv287-catalog');panel.id='tv287-resource-catalog';native.after(panel)}
 panel.replaceChildren();
 const head=n('header','tv287-catalog-header'),left=n('div');
 left.append(n('div','tv287-eyebrow','CHARACTER SHEET · ACTIVE MECHANICS'),n('h2','','Resources & tracking'),
  n('p','tv287-muted','Every active, source-backed counter in one place. Star favourites to keep them on Overview.'));
 const tools=n('div','tv287-catalog-tools'),tally=n('span','tv287-muted',records.length+' active');
 const search=n('input','tv287-search');search.type='search';search.placeholder='Find resource or source…';
 search.setAttribute('aria-label','Find resource');search.value=state.query;
 tools.append(tally,search);head.append(left,tools);panel.append(head);
 const filters=n('div','tv287-filters'),grid=n('div','tv287-catalog-grid');
 panel.append(filters,grid);
 const choices=[['all','All'],['spell','Spellcasting'],['class','Class'],['item','Items'],['divine','Divine']];
 function draw(){
  filters.replaceChildren();
  for(const [id,title]of choices){
   const count=id==='all'?records.length:records.filter(r=>r.kind===id).length;
   if(id!=='all'&&!count)continue;
   const b=n('button','tv287-filter',title+' · '+count);
   b.type='button';b.setAttribute('aria-pressed',String(state.filter===id));
   b.addEventListener('click',()=>{state.filter=id;draw()});
   filters.append(b);
  }
  const term=state.query.toLowerCase().trim();
  const matching=records.filter(r=>
   (state.filter==='all'||r.kind===state.filter)&&
   (!term||(r.name+' '+r.recovery+' '+types[r.kind]).toLowerCase().includes(term)));
  grid.replaceChildren();
  if(!matching.length){
   grid.append(n('p','tv287-empty',records.length?'No resources match the current filter.':'No spendable resources are active on this character.'));
   return;
  }
  matching.forEach(r=>grid.append(card(r,false)));
 }
 search.addEventListener('input',()=>{const start=search.selectionStart;state.query=search.value;draw();try{search.setSelectionRange(start,start)}catch{}});
 draw();
}
let pending=false;
function schedule(){
 if(pending)return;pending=true;
 requestAnimationFrame(()=>{pending=false;paint(false)});
}
function paint(force){
 const c=character(),root=document.querySelector('#pageRoot .sheet20');
 if(!c||!root){state.signature='';state.root=null;return}
 syncCharacter(c);
 const nativeTab=root.querySelector('.sheet20-tabs [data-value][aria-selected="true"]');
 const mode=nativeTab?.dataset.value||'';
 if(mode!=='overview'&&mode!=='resources'){state.mode=mode;return}
 const records=collect(),sig=signatureFor(records,mode);
 // Source-node replacement matters: native cards may have been reconstructed
 // with identical charge values after a live character sync.
 const changed=root!==state.root||sig!==state.signature||mode!==state.mode;
 if(!force&&!changed)return;
 state.root=root;state.mode=mode;state.signature=sig;
 if(mode==='overview')quickPanel(records);else catalog(records);
}
const root=document.getElementById('pageRoot')||document.body;
new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,
 attributeFilter:['disabled','aria-selected','class']});
window.addEventListener('hashchange',schedule);
window.addEventListener('terravale-auth-ready',schedule);
window.addEventListener('terravale-characters-synced',schedule);
window.TerravaleV287Adaptive={refresh:()=>paint(true),getStarred:()=>Array.from(state.stars)};
schedule();
})();
