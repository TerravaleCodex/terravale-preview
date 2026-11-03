/* Terravale Cabinet V2 — production viewer of the approved offline layout. */
(()=>{'use strict';
const records=JSON.parse(document.getElementById('tv-cabinet-records').textContent);
if(records.length!==62||new Set(records.map(r=>r.id)).size!==62)throw Error('Incorrect Cabinet catalogue');
const $=s=>document.querySelector(s),cards=$('#collection'),search=$('#searchInput'),feature=$('#featureToggle');
const rank={common:1,uncommon:2,rare:3,epic:4,legendary:5};
const colours={common:'#9eabbb',uncommon:'#9fc1ac',rare:'#89b4ec',epic:'#c39aef',legendary:'#e6bd7d'};
const featured=new Set(['codex_keeper','classes_complete','ancestries_complete','bloodforger_all','adblocknt']);
let state={ready:false,authenticated:false,earnedKeys:[],events:[],adsDismissed:0},earnedKeys=new Set(),lastSig='',filter='all',lastFocus=null;
const svg=n=>'<svg aria-hidden="true"><use href="#i-'+n+'"></use></svg>';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const earned=r=>earnedKeys.has(r.id);
const count=k=>new Set((state.events||[]).filter(e=>e.kind===k).map(e=>e.subject)).size;
function progress(r){
 if(!r.goal)return 0;
 const n=r.measure==='classes'?count('read_class'):r.measure==='ancestries'?count('read_ancestry'):r.measure==='reading'?count('read_class')+count('read_ancestry'):r.measure==='blood'?count('bloodforger_discipline'):r.measure==='themes'?count('theme_changed'):r.measure==='journal'?count('journal_written'):r.measure==='ads'?Number(state.adsDismissed)||0:0;
 return Math.max(0,Math.min(r.goal,n));
}
const percent=r=>r.goal?100*progress(r)/r.goal:0;
function items(){
 const term=search.value.trim().toLowerCase();
 const results=records.filter(r=>{
  if(term&&!(r.title+' '+r.description+' '+r.rarity+' '+r.id).toLowerCase().includes(term))return false;
  if(filter==='earned'&&!earned(r)||filter==='locked'&&earned(r))return false;
  if(filter==='rare'&&rank[r.rarity]<3)return false;
  if(filter==='progress'&&(earned(r)||!r.goal||!progress(r)))return false;
  return true;
 });
 const sort=$('#sortSelect').value;
 if(sort==='rarity')results.sort((a,b)=>rank[b.rarity]-rank[a.rarity]||a.order-b.order);
 else if(sort==='alphabetical')results.sort((a,b)=>a.title.localeCompare(b.title));
 else if(sort==='progress')results.sort((a,b)=>(earned(a)?1:0)-(earned(b)?1:0)||percent(b)-percent(a)||a.order-b.order);
 else results.sort((a,b)=>a.order-b.order);
 return results;
}
function card(r){
 const unlocked=earned(r),val=progress(r),big=feature.checked&&featured.has(r.id);
 const meter=r.goal?'<div class="card-progress"><div class="progress-copy"><span>Discovery progress</span><strong>'+val+' / '+r.goal+'</strong></div><div class="track"><div class="fill" style="width:'+Math.round(percent(r))+'%"></div></div></div>':'';
 return '<button type="button" class="ach-card '+(unlocked?'is-earned':'is-locked')+(big?' is-featured':'')+'" data-rarity="'+r.rarity+'" data-id="'+esc(r.id)+'" aria-label="'+esc(r.title)+', '+(unlocked?'discovered':'locked')+'"><span class="rarity-line"></span><span class="watermark">'+svg(r.icon)+'</span><span class="card-top"><span class="icon-medal">'+svg(r.icon)+'</span><span class="rarity-tag">'+r.rarity+'</span></span><span class="card-title">'+esc(r.title)+'</span><span class="card-desc">'+esc(r.description)+'</span>'+meter+'<span class="card-footer"><span class="state '+(unlocked?'earned':'')+'">'+svg(unlocked?'check':'lock')+(unlocked?'DISCOVERED':'LOCKED')+'</span><span class="inspect">View details ›</span></span></button>';
}
function reportHeight(){
 try{
  const shell=$('.shell');
  const height=Math.ceil(shell.getBoundingClientRect().height)+16;
  parent.postMessage({type:'terravale-cabinet-v2-size',height:Math.max(360,height)},location.origin);
 }catch(e){}
}
function paintSummary(){
 const found=records.filter(earned).length,pct=100*found/records.length;
 $('#heroCount').innerHTML=found+' <span>/ '+records.length+'</span>';
 $('#pct').textContent=Math.round(pct)+'%';
 $('#progressRing').style.strokeDashoffset=String(339.29*(1-pct/100));
 $('#rareCount').innerHTML=records.filter(r=>earned(r)&&rank[r.rarity]>=3).length+' <span>found</span>';
 $('#legendaryCount').innerHTML=records.filter(r=>earned(r)&&r.rarity==='legendary').length+' <span>/ 1</span>';
 $('#allCount').textContent=records.length;
 $('#earnedCount').textContent=found;
 $('#liveNote').textContent=state.ready?(state.authenticated?'Account progress synced':'Sign in to save discoveries'):'Connecting to your Codex account…';
 $('#collectionStatus').textContent=!state.ready?'Checking your discoveries':!state.authenticated?'Account not connected':found?found+' discoveries recorded':'Not yet begun';
 const near=records.filter(r=>!earned(r)&&r.goal&&progress(r)>0).sort((a,b)=>percent(b)-percent(a));
 $('#nearCount').textContent=near.length+' achievement'+(near.length===1?'':'s');
 $('#nextLabel').textContent=near.length?near[0].title:found?'Keep exploring the Codex':'Your first discovery awaits';
 $('#nextSub').textContent=near.length?progress(near[0])+' of '+near[0].goal+' steps completed':'Read a class entry, change a theme, or explore the Codex.';
}
function render(){
 paintSummary();
 const list=items();
 $('#resultCount').innerHTML='<strong>'+list.length+'</strong> of '+records.length+' achievements';
 if(list.length)cards.innerHTML=list.map(card).join('');
 else{
  cards.innerHTML='<div class="empty"><h3>No curiosities found</h3><p>No achievements match these filters.</p><button type="button" id="clearFilters">Clear filters</button></div>';
  $('#clearFilters').onclick=()=>{filter='all';search.value='';$('#sortSelect').value='curated';chips();render();};
 }
 requestAnimationFrame(reportHeight);
}
function chips(){for(const c of document.querySelectorAll('[data-filter]'))c.setAttribute('aria-pressed',String(c.dataset.filter===filter))}
function sync(){
 try{
  const next=parent.TerravaleAchievementState;if(!next)return;
  const signature=JSON.stringify(next);if(lastSig===signature)return;
  lastSig=signature;state={...state,...next};
  earnedKeys=new Set((state.earnedKeys||[]).filter(key=>records.some(r=>r.id===key)));
  render();
 }catch(e){console.warn('Cabinet account progress could not be read:',e)}
}
function details(id,el){
 const rec=records.find(r=>r.id===id);if(!rec)return;
 lastFocus=el;
 $('#detail').style.setProperty('--rarity',colours[rec.rarity]);
 $('#detail').style.setProperty('--tint',colours[rec.rarity]+'18');
 $('#detailIcon').innerHTML=svg(rec.icon);
 $('#detailRarity').textContent=rec.rarity+' · Cabinet record';
 $('#detailTitle').textContent=rec.title;
 $('#detailDescription').textContent=rec.description;
 $('#detailStatus').textContent=earned(rec)?'✓ Discovered':'◇ Not yet discovered';
 $('#detailFoot').textContent=rec.goal?'Account progress: '+progress(rec)+' / '+rec.goal+'.':'This discovery is awarded when its action is completed in the Codex.';
 const modal=$('#modal');modal.hidden=false;
 try{
  const frame=parent.document.getElementById('tv-cabinet-v2-frame');
  const offset=frame?frame.getBoundingClientRect().top:0;
  modal.style.position='absolute';modal.style.top=Math.max(0,-offset)+'px';
  modal.style.height=parent.innerHeight+'px';
  parent.document.body.style.overflow='hidden';
 }catch(e){}
 $('#modalClose').focus();
}
function close(){
 $('#modal').hidden=true;
 try{parent.document.body.style.overflow='';}catch(e){}
 lastFocus?.focus();
}
for(const chip of document.querySelectorAll('[data-filter]'))chip.onclick=()=>{filter=chip.dataset.filter;chips();render()};
search.addEventListener('input',render);
$('#sortSelect').addEventListener('change',render);
feature.addEventListener('change',render);
cards.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)details(b.dataset.id,b)});
$('#modalClose').onclick=close;$('#dismissDetail').onclick=close;
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)close()});
try{parent.addEventListener('terravale-achievements-changed',sync);}catch(e){}
window.addEventListener('resize',reportHeight);
if(typeof ResizeObserver==='function')new ResizeObserver(reportHeight).observe($('.shell'));
setInterval(sync,3500);
sync();render();setTimeout(reportHeight,400);setTimeout(reportHeight,1400);
})();
