
/* Terravale V2.31 — extends the approved offline V2.30, preserving existing readers, inventory and DM controls. */
(function(){
'use strict';
const GRAPH=JSON.parse(document.getElementById('v231-bloodforger-source').textContent);
const E=x=>safe(String(x??''));
const tierLevel={I:3,II:5,III:9,IV:13,Crown:17};
const stateBands=[[-40,-40,'Critical Hunger','critical'],[-39,-31,'Hunger III','danger'],[-30,-21,'Hunger II','danger'],[-20,-11,'Hunger I','warning'],[-10,10,'Stable','stable'],[11,20,'Well-Fed I','fed'],[21,30,'Well-Fed II','fed'],[31,39,'Well-Fed III','fed'],[40,40,'Saturation Limit','critical']];
let currentDiscipline='Alteration',selectedNode='A01',treeZoom=1;
function cState(c){return Math.max(-40,Math.min(40,Math.round(Number(c.bloodState??0)||0)));}
function stateInfo(v){return stateBands.find(b=>v>=b[0]&&v<=b[1])||stateBands[4];}
function manage(c){return typeof sheetV220CanEdit==='function'&&sheetV220CanEdit(c);}
function bloodStateHTML(c){
 const v=cState(c),b=stateInfo(v),can=manage(c),pct=Math.round((v+40)/80*100);
 const fmt=x=>x>0?'+'+x:String(x);
 const action=(x)=>`<button type="button" data-v231-hunger="${x}" data-v231-character="${E(c.id)}" ${!can?'disabled':''}>${fmt(x)}</button>`;
 return `<section class="sheet20-panel v231-hunger-panel" data-v231-hunger-panel="${E(c.id)}"><div class="sheet20-panel-heading"><span>CRIMSONBORN · SECOND HEART</span><span class="sheet20-source">BLOOD STATE</span></div><h3>Hunger & saturation</h3><div class="v231-hunger-top"><strong>${fmt(v)}</strong><div><b class="v231-state-${b[3]}">${b[2]}</b><small>Published Blood State scale · −40 to +40</small></div></div><div class="v231-hunger-scale"><span aria-hidden="true" class="v231-hunger-track"><span class="v231-hunger-needle" style="left:${pct}%"></span></span><div><span>−40 · Critical hunger</span><span>0 · Stable</span><span>+40 · Saturated</span></div></div>${can?`<div class="v231-hunger-controls">${action(-5)}${action(-1)}${action(1)}${action(5)}<label>Set state<input type="number" data-v231-hunger-exact="${E(c.id)}" min="-40" max="40" value="${v}" aria-label="Blood State value"></label><button type="button" class="v231-hunger-set" data-v231-hunger-apply="${E(c.id)}">Apply</button></div>`:''}<p class="v231-hunger-caption">Feeding, deprivation and saturation follow the Crimsonborn rules. The tracker records the state; it does not assume an automatic feeding effect.</p></section>`;
}
function source(c){return GRAPH.disciplines[currentDiscipline]||GRAPH.disciplines.Alteration;}
function purchases(c){if(!c.v231BloodPurchases||typeof c.v231BloodPurchases!=='object')c.v231BloodPurchases={};return c.v231BloodPurchases;}
function points(c){return Number(GRAPH.dp[Math.min(20,Math.max(1,Number(c.level)||1))]||0);}
function sumSpent(c){return Object.values(purchases(c)).reduce((n,x)=>n+(Number(x)||0),0);}
function key(tree,node){return tree+':'+node.id;}
function isOwned(c,tree,id){return Object.hasOwn(purchases(c),tree+':'+id);}
function nodePrice(c,tree,node){if(node.tier!=='Crown')return 1;const count=source(c).nodes.filter(n=>n.tier==='Crown'&&isOwned(c,tree,n.id)).length;return 3+count;}
function unlockCheck(c,tree,node){
 if((Number(c.level)||1)<tierLevel[node.tier])return `Requires Bloodforger level ${tierLevel[node.tier]}`;
 if(node.lockOther&&isOwned(c,tree,node.lockOther))return 'Mutually exclusive route already chosen';
 const other=source(c).nodes.find(n=>n.lockOther===node.id);
 if(other&&isOwned(c,tree,other.id))return 'Mutually exclusive route already chosen';
 if(node.parents.length&&!node.parents.some(id=>isOwned(c,tree,id)))return 'Requires an upstream node';
 if(sumSpent(c)+nodePrice(c,tree,node)>points(c))return 'Not enough Discipline Points';
 return '';
}
function descendantsOwned(c,tree,id){const n=source(c).nodes.find(q=>q.id===id);return n?.children?.some(next=>isOwned(c,tree,next))||false;}
function renderBloodTree(c){
 const tree=source(c),selected=tree.nodes.find(n=>n.id===selectedNode)||tree.nodes[0],owned=purchases(c),is=manage(c);
 if(!tree.nodes.some(n=>n.id===selectedNode))selectedNode=tree.nodes[0].id;
 const available=Math.max(0,points(c)-sumSpent(c)), price=nodePrice(c,tree,selected),own=isOwned(c,currentDiscipline,selected.id),blocked=unlockCheck(c,currentDiscipline,selected);
 const graphWidth=tree.width+150, graphHeight=tree.height+130;
 const centers=Object.fromEntries(tree.nodes.map(n=>[n.id,n]));const edges=tree.edges.map(([a,b])=>{const p=centers[a],q=centers[b];if(!p||!q)return '';const x=p.x+70,y=p.y+60,X=q.x+70,Y=q.y+60,m=(x+X)/2;return `<path d="M ${x} ${y} C ${m} ${y},${m} ${Y},${X} ${Y}" class="${isOwned(c,currentDiscipline,a)&&isOwned(c,currentDiscipline,b)?'owned':''}"/>`;}).join('');
 const cards=tree.nodes.map(n=>{const on=isOwned(c,currentDiscipline,n.id),disabled=!on&&!!unlockCheck(c,currentDiscipline,n),active=n.id===selectedNode;return `<button type="button" class="v231-node ${on?'owned':disabled?'locked':'ready'} ${active?'active':''} ${n.tier==='Crown'?'crown':''}" style="left:${n.x+70}px;top:${n.y+60}px" data-v231-node="${E(n.id)}" aria-pressed="${active}"><small>${E(n.id)} · TIER ${E(n.tier)}</small><strong>${E(n.name)}</strong><span>${on?'✓ Planned':n.tier==='Crown'?'★ Crown':'Select for rules'}</span></button>`;}).join('');
 const status=own?'Planned':blocked||`Available · ${price} DP`;
 const control= is?own?`<button class="btn ghost v231-node-control" data-v231-refund="${E(selected.id)}" ${descendantsOwned(c,currentDiscipline,selected.id)?'disabled':''}>${descendantsOwned(c,currentDiscipline,selected.id)?'Remove downstream nodes first':`Undo planned node · refund ${owned[key(currentDiscipline,selected)]||1} DP`}</button>`:`<button class="btn primary v231-node-control" data-v231-buy="${E(selected.id)}" ${blocked?'disabled':''}>${blocked?'Locked · '+E(blocked):`Plan this node · ${price} DP`}</button>`:'';
 return `<section class="sheet20-panel v231-tree-panel" data-v231-tree-root="${E(c.id)}"><div class="sheet20-panel-heading"><span>BLOODFORGER · DISCIPLINE ATLAS</span><span class="sheet20-source">LEVEL ${Number(c.level)||1}</span></div><div class="v231-tree-intro"><div><h3>Bloodforger skill trees</h3><p>Explore connected techniques and their published rules. Nodes respect prerequisites, branch locks and level tiers.</p></div><div class="v231-dp"><span>DISCIPLINE POINTS</span><strong>${available}<small> / ${points(c)}</small></strong><span>${sumSpent(c)} planned</span></div></div><div class="v231-discipline-tabs">${Object.keys(GRAPH.disciplines).map(name=>`<button data-v231-discipline="${E(name)}" class="${currentDiscipline===name?'active':''}">${E(name)} <small>${tree===GRAPH.disciplines[name]?tree.nodes.length:GRAPH.disciplines[name].nodes.length}</small></button>`).join('')}</div><div class="v231-tier-key"><span>Tier I · Lv3</span><span>Tier II · Lv5</span><span>Tier III · Lv9</span><span>Tier IV · Lv13</span><span>Crown · Lv17</span></div><div class="v231-tree-workspace"><div class="v231-tree-canvas-outer"><div class="v231-tree-toolbar"><span>Scroll to explore branches</span><div><button data-v231-zoom="-1" aria-label="Zoom out">−</button><strong>${Math.round(treeZoom*100)}%</strong><button data-v231-zoom="1" aria-label="Zoom in">+</button></div></div><div class="v231-tree-viewport"><div class="v231-tree-scale" style="width:${graphWidth*treeZoom}px;height:${graphHeight*treeZoom}px"><div class="v231-tree-canvas" style="width:${graphWidth}px;height:${graphHeight}px;transform:scale(${treeZoom})"><svg viewBox="0 0 ${graphWidth} ${graphHeight}" aria-hidden="true" preserveAspectRatio="xMinYMin meet"><defs><marker id="v231-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L7,4 L1,7 Z"/></marker></defs>${edges}</svg>${cards}</div></div></div></div><aside class="v231-tree-details"><span class="v2-overline">${E(currentDiscipline)} · ${E(selected.id)}</span><h3>${E(selected.name)}</h3><div class="v231-node-pills"><span>Tier ${E(selected.tier)} · Lv ${tierLevel[selected.tier]}+</span><span>${E(status)}</span></div>${selected.parents.length?`<p class="v231-prereq"><strong>Requires:</strong> ${E(selected.prereq||selected.parents.map(i=>tree.nodes.find(x=>x.id===i)?.name||i).join(' or '))}</p>`:''}<div class="v231-node-rule">${v226Sanitize(selected.body)}</div>${control}<p class="v231-tree-note">Offline node plan; nothing here spends points on the live Codex. Purchases and branch choices remain subject to DM approval.</p></aside></div></section>`;
}
// Extend the existing sheet in place rather than creating a new page implementation.
const previousSheet=renderSheetV220;
renderSheetV220=function(id){
 const c=db.characters.find(x=>String(x.id)===String(id));
 const same=sheetV220LastId===id,treeWanted=same&&sheetV220Tab==='bloodtree';
 if(treeWanted)sheetV220Tab='features';
 const html=previousSheet(id);
 if(treeWanted)sheetV220Tab='bloodtree';
 if(!c)return html;
 const t=document.createElement('template');t.innerHTML=html;
 if(String(c.ancestry||'').toLowerCase()==='crimsonborn'){
  const aside=t.content.querySelector('.sheet20-secondary-stack');
  if(aside)aside.insertAdjacentHTML('afterbegin',bloodStateHTML(c));
 }
 if(c.className==='Bloodforger'){
  const equipment=t.content.querySelector('.sheet20-tabs [data-value="equipment"]');
  if(equipment){const b=document.createElement('button');b.type='button';b.role='tab';b.textContent='Bloodforger trees';b.dataset.action='sheetTab';b.dataset.value='bloodtree';b.setAttribute('aria-selected',String(treeWanted));if(treeWanted)b.className='active';equipment.before(b);}
  if(treeWanted){
   const features=t.content.querySelector('.sheet20-tabs [data-value="features"]');if(features){features.classList.remove('active');features.setAttribute('aria-selected','false')}
   const area=t.content.querySelector('.sheet20-content');if(area)area.innerHTML=renderBloodTree(c);
  }
 }
 return t.innerHTML;
};
// New interactions are isolated from ordinary sheet controls.
document.addEventListener('click',e=>{
 const action=e.target.closest('[data-v231-hunger],[data-v231-hunger-apply],[data-v231-discipline],[data-v231-node],[data-v231-buy],[data-v231-refund],[data-v231-zoom]');if(!action)return;
 e.preventDefault();e.stopImmediatePropagation();
 const getC=()=>db.characters.find(x=>String(x.id)===String(action.closest('[data-v231-tree-root]')?.dataset.v231TreeRoot||action.dataset.v231Character||action.closest('[data-v231-hunger-panel]')?.dataset.v231HungerPanel));
 const c=getC();if(!c)return;
 if(action.dataset.v231Hunger!==undefined||action.dataset.v231HungerApply!==undefined){
   if(!manage(c))return;
   const v=action.dataset.v231Hunger!==undefined?cState(c)+Number(action.dataset.v231Hunger):Number(document.querySelector('[data-v231-hunger-exact="'+CSS.escape(c.id)+'"]')?.value);
   if(!Number.isFinite(v))return;
   c.bloodState=Math.max(-40,Math.min(40,Math.round(v)));persist();renderPage(false);return;
 }
 if(action.dataset.v231Discipline){currentDiscipline=action.dataset.v231Discipline;selectedNode=source(c).nodes[0]?.id;renderPage(false);return;}
 if(action.dataset.v231Node){selectedNode=action.dataset.v231Node;renderPage(false);return;}
 if(action.dataset.v231Zoom){treeZoom=Math.max(.65,Math.min(1.3,Math.round((treeZoom+Number(action.dataset.v231Zoom)*.15)*100)/100));const sc=document.querySelector('.v231-tree-canvas'),wrap=document.querySelector('.v231-tree-scale');if(sc&&wrap){sc.style.transform=`scale(${treeZoom})`;const tree=source(c);wrap.style.width=(tree.width+150)*treeZoom+'px';wrap.style.height=(tree.height+130)*treeZoom+'px';document.querySelector('.v231-tree-toolbar strong').textContent=Math.round(treeZoom*100)+'%';}return;}
 const id=action.dataset.v231Buy??action.dataset.v231Refund,node=source(c).nodes.find(n=>n.id===id);if(!node||!manage(c))return;
 if(action.dataset.v231Buy){const problem=unlockCheck(c,currentDiscipline,node);if(problem){toast(problem);return;}purchases(c)[key(currentDiscipline,node)]=nodePrice(c,currentDiscipline,node);}
 if(action.dataset.v231Refund){if(!isOwned(c,currentDiscipline,id)||descendantsOwned(c,currentDiscipline,id))return;delete purchases(c)[key(currentDiscipline,node)];}
 persist();renderPage(false);
},true);
// Fix duplicate feature descriptions and replace oversized subclass cards with a proper list + details picker.
function compactWizard(){
 const wizard=document.querySelector('#v229-levelup:not([hidden])');if(!wizard)return;
 const ch=wizard.querySelector('.v229-wizard-main');if(!ch)return;
 const selectedId=db.characters.find(c=>wizard.querySelector('.v229-modal-top h2')?.textContent?.endsWith(c.name))?.id;
 const c=selectedId?db.characters.find(q=>q.id===selectedId):null;
 const intro=ch.querySelector('.v229-wizard-intro');
 if(intro&&intro.querySelector('h3')?.textContent?.includes('what’s new')){
  const p=intro.querySelector('p');if(p&&!p.dataset.v231Intro){p.dataset.v231Intro='true';p.textContent='Review the features you gain at this level. Their mechanics appear once below; make any required choices on the next step.';}
 }
 ch.querySelectorAll('.v230-feature-card:not(.v231-processed)').forEach(card=>{
  card.classList.add('v231-processed');
  const rules=card.querySelector('.v230-exact-rules'),summary=card.querySelector(':scope > p');
  if(rules){
   const body=rules.querySelector(':scope > div');
   if(body){const f=document.createElement('div');f.className='v231-feature-rule';f.innerHTML=v226Sanitize(body.innerHTML);const first=f.querySelector(':scope > h2,:scope > h3,:scope > h4');if(first&&first.textContent.toLowerCase().includes(card.querySelector('h4')?.textContent?.toLowerCase()||'_____'))first.remove();rules.replaceWith(f);summary?.remove();}
  }else if(summary?.textContent?.includes('listed at this level in the published')&&c){
   const name=card.querySelector('h4')?.textContent?.trim()||'';
   const entry=v226Class(c.className),t=document.createElement('template');t.innerHTML=v226Sanitize(entry?.html||'');
   const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const matching=[...t.content.querySelectorAll('h2,h3,h4,h5')].find(h=>{
     const a=norm(h.textContent?.replace(/[-—–]\s*(levels?|lv)\s*\d+.*$/i,'')||'');
     const b=norm(name.replace(/[-—–]\s*(levels?|lv)\s*\d+.*$/i,''));
     return a===b || a.startsWith(b)&&b.length>5;
   });
   if(matching){
     let el=matching.nextElementSibling,content='';
     while(el&&!/^H[1-5]$/.test(el.tagName)&&content.length<3600){content+=el.outerHTML;el=el.nextElementSibling;}
     if(content){const d=document.createElement('div');d.className='v231-feature-rule';d.innerHTML=v226Sanitize(content);summary.replaceWith(d);}
   }
   if(summary.isConnected&&/path feature|college feature|domain feature|circle feature|tradition feature|specialist feature/i.test(name)){
     const path=v226SpecName(c),option=entry?.options?.find(o=>o.name===path),lev=Number(c.v229Pending?.toLevel)||0;
     let exact='';
     if(option){const tp=document.createElement('template');tp.innerHTML=v226Sanitize(option.html);
       const reg=new RegExp('(?:level|lv|at)\\s*'+lev+'\\b','i');
       const sections=[...tp.content.querySelectorAll('p,li')];
       const matched=sections.find(el=>reg.test((el.textContent||'').slice(0,95)));
       if(matched)exact=matched.outerHTML;
     }
     if(exact){const d=document.createElement('div');d.className='v231-feature-rule';d.innerHTML=exact;summary.replaceWith(d);}
     else summary.textContent=path?`Your ${path} path grants its level ${lev} feature; read the full selected path for its mechanics.`:'Choose your specialisation in the next step to see which path features apply.';
   }
  }
 });
 const subList=ch.querySelector('.v230-choice-list:has([data-v230-pick="subclass"])');
 if(subList&&!subList.closest('.v231-subclass-browser')&&c){
  const options=v226Class(c.className)?.options||[];
  const picked=subList.querySelector('[aria-pressed="true"]')?.dataset.v230Value||options[0]?.name;
  const selected=options.find(o=>o.name===picked);
  subList.querySelectorAll('[data-v230-pick="subclass"]').forEach(b=>{const sm=b.querySelector('small');if(sm)sm.textContent='Read path rules →';b.classList.add('v231-subchoice');});
  const wrapper=document.createElement('div');wrapper.className='v231-subclass-browser';subList.replaceWith(wrapper);wrapper.append(subList);
  const preview=document.createElement('div');preview.className='v231-subclass-detail';preview.innerHTML=selected?`<span class="v2-overline">${picked===subList.querySelector('[aria-pressed=true]')?.dataset.v230Value?'SELECTED PATH':'PATH PREVIEW'}</span><h5>${E(selected.name)}</h5><div class="v231-path-rules">${v226Sanitize(selected.html)}</div>`:'<p>Choose a path to preview its rules.</p>';
  const h=preview.querySelector('.v231-path-rules > h2,.v231-path-rules > h3,.v231-path-rules > h4');if(h&&h.textContent.trim()===selected?.name)h.remove();
  wrapper.append(preview);
 }
}
const obs=new MutationObserver(()=>compactWizard());
obs.observe(document.body,{childList:true,subtree:true});
// All modal controls use the same theme palette as the surrounding Codex, including in dark variants.
const oldRender=renderPage;
renderPage=function(...args){
 const r=oldRender(...args);
 document.title=document.title.replace(/V2\.30/g,'V2.31');
 const active=source({}).nodes.find(n=>n.id===selectedNode)||source({}).nodes[0];
 requestAnimationFrame(()=>{
   const vp=document.querySelector('.v231-tree-viewport');if(!vp||!active)return;
   vp.scrollLeft=Math.max(0,(active.x+70)*treeZoom-vp.clientWidth*.3);
   vp.scrollTop=Math.max(0,(active.y+60)*treeZoom-vp.clientHeight*.38);
 });
 return r;
};
renderPage(false);
})();

