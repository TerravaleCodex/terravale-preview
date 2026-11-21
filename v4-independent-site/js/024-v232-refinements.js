/* Terravale Codex V2.33 — same offline V2 site, source-backed readers and build lab. */
(function(){
'use strict';
const E=x=>safe(String(x??''));
const RULES=window.TERRAVALE_V226_RULES;
const GRAPH=JSON.parse(document.getElementById('v231-bloodforger-source').textContent);
const stages={1:10,2:20,3:40,4:40,5:40};
const tierLevels={I:3,II:5,III:9,IV:13,Crown:17};
const treeNames=Object.keys(GRAPH.disciplines);
let classView={},classOption={},classLevel={},classFeature={},classQuery={},v232NodeTree='Alteration',v232LabNode='A01',treeTab='class',previewStage=null,readerSelectedTree='Alteration';
const dataByName=name=>RULES.classes.find(c=>c.name.toLowerCase()===String(name||'').replace(/\s*\(v1\.10\)/i,'').trim().toLowerCase());
const keyClass=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
const classesCount=RULES.classes.length;
const toText=html=>{let t=document.createElement('template');t.innerHTML=v226Sanitize(html||'');return (t.content.textContent||'').replace(/\s+/g,' ').trim()};
function cleanRule(html,title){let t=document.createElement('template');t.innerHTML=v226Sanitize(html||'');const top=t.content.firstElementChild;if(/^H[1-6]$/.test(top?.tagName||'')&&keyClass(top.textContent).includes(keyClass(title)))top.remove();return t.innerHTML;}
function sourceIntro(doc){let t=document.createElement('template');t.innerHTML=v226Sanitize(doc?.html||'');let first=t.content.querySelector('p');const text=(first?.textContent||toText(doc?.html)).replace(/\s+/g,' ').trim();return text.length>520?text.slice(0,518).replace(/\s+\S*$/,'')+'…':text;}
function allSourceTags(){return `<span class="v232-source-mark">${classesCount} class chapters · ${RULES.classes.reduce((n,c)=>n+(c.progression?.levels?.length||0),0)} progression rows</span>`}
// Replace bulky, duplicative subclass accordions in the actual class pages.
v224SubclassPanel=function(name){
 const doc=dataByName(name);if(!doc)return '';
 const opts=doc.options||[],id=keyClass(name),picked=classOption[id]||opts[0]?.name,active=opts.find(o=>o.name===picked)||opts[0];
 if(!opts.length)return `<section class="v223-section v232-class-reader"><h2>Class progression</h2><p>This class uses its dedicated progression system. See its class chapter for the complete rules.</p></section>`;
 function sections(option){
  const t=document.createElement('template');t.innerHTML=v226Sanitize(option?.html||'');
  let intro='',blocks=[],current=null;
  const parts=[];for(const el of [...t.content.children]){if(el.tagName==='P'&&el.querySelector('br')){for(const segment of el.innerHTML.split(/<br\s*\/?>/i)){if(!segment.trim())continue;const p=document.createElement('p');p.innerHTML=segment;parts.push(p);}}else parts.push(el);}
  for(const el of parts){
   if(/^H[1-6]$/.test(el.tagName)&&el.textContent.trim()===option.name)continue;
   let first=el.querySelector('strong')?.textContent?.trim()||'';
   const m=first.match(/^(?:(?:At\s+)?Level\s*)?(\d{1,2})(?:st|nd|rd|th)?\s*[—–-]\s*(.+)$/i);
   if(m){current={level:Number(m[1]),title:m[2].replace(/[.\s]+$/,''),html:el.outerHTML};blocks.push(current);}
   else if(current)current.html+=el.outerHTML;
   else intro+=el.outerHTML;
  }
  if(!blocks.length)return [{level:0,title:'Complete path rules',html:cleanRule(option?.html||'',option?.name)}];
  if(intro.trim())blocks[0].html=intro+blocks[0].html;
  return blocks;
 }
 const all=sections(active),key=id+':'+(active?.name||''),selectedLevel=window.TV33_PATH_LEVELS?.[key];
 const selected=all.find((x,i)=>String(x.level)+':'+i===selectedLevel)||all[0];
 const levelChoices=all.map((x,i)=>`<button class="${x===selected?'active':''}" type="button" data-v233-path-step="${E(x.level+':'+i)}" data-v233-for="${E(key)}" aria-pressed="${x===selected}">${x.level?`Level ${x.level}`:'Overview'}<small>${E(x.title)}</small></button>`).join('');
 return `<section id="class-options" class="v223-section v224-subclass-section v232-class-reader v233-path-reader" data-v232-class="${E(id)}"><header class="v223-section-head"><div><span class="v2-overline">CLASS OPTIONS</span><h2>${E(doc.optionsLabel||'Paths & specialisations')}</h2><p>Select a path, then explore its individual level features.</p></div><span class="v223-count">${opts.length} paths</span></header><div class="v232-class-layout"><aside class="v232-class-menu"><label class="v2-overline" for="v232-opt-search-${E(id)}">FIND A PATH</label><input id="v232-opt-search-${E(id)}" data-v232-opt-query="${E(id)}" placeholder="Search specialisations…" value="${E(classQuery[id]||'')}"><div class="v232-option-links">${opts.filter(o=>o.name.toLowerCase().includes((classQuery[id]||'').toLowerCase())).map(o=>`<button type="button" data-v232-class-option="${E(o.name)}" data-v232-for="${E(id)}" aria-pressed="${active?.name===o.name}" class="${active?.name===o.name?'active':''}"><b>${E(o.name)}</b></button>`).join('')}</div></aside><article class="v232-class-detail"><div class="v2-overline">${E(doc.name)} · PATH RULES</div><h3>${E(active?.name||'Choose a path')}</h3><div class="v233-level-steps" role="group" aria-label="Path features by level">${levelChoices}</div><div class="v233-path-content"><div class="v2-overline">${selected.level?'UNLOCKED AT LEVEL '+selected.level:'FULL RULES'}</div><h4>${E(selected.title)}</h4><div class="v232-class-prose">${v226Sanitize(selected.html)}</div></div></article></div></section>`;
};
// Every class now uses the same navigable progression reader, rather than per-level grids of duplicate titles.
v223ClassFeatures=function(name,limit=20){
 const doc=dataByName(name);if(!doc)return '<p>Class chapter not found.</p>';
 const id=keyClass(name),max=Math.min(20,Math.max(1,Number(limit)||20)),chosen=Math.min(max,Math.max(1,Number(classLevel[id])||1));
 const levels=(doc.progression?.levels||[]).filter(row=>row.level<=max),fs=doc.featureByLevel?.[String(chosen)]||[];let idx=Math.min(fs.length-1,Math.max(0,Number(classFeature[id])||0));
 const f=fs[idx];
 return `<div class="v232-progression-reader" data-v232-progression="${E(id)}"><div class="v232-progression-table"><details><summary>View complete 1–20 progression table</summary><div class="v232-class-prose">${v226Sanitize(doc.progression?.html||'')}</div></details></div><div class="v232-level-grid">${levels.map(x=>`<button type="button" data-v232-level="${x.level}" data-v232-for="${E(id)}" class="${chosen===x.level?'active':''}"><span>LEVEL ${x.level}</span><small>${(doc.featureByLevel?.[String(x.level)]||[]).length} features</small></button>`).join('')}</div><div class="v232-level-content"><aside><div class="v2-overline">LEVEL ${chosen} FEATURES</div>${fs.length?fs.map((o,i)=>`<button data-v232-feature="${i}" data-v232-for="${E(id)}" class="${i===idx?'active':''}"><strong>${E(o.name)}</strong><small>View actual mechanics</small></button>`).join(''):'<p>No separately indexed feature at this level. Existing class mechanics still apply.</p>'}</aside><article><span class="v2-overline">${E(doc.name)} · LEVEL ${chosen}</span><h3>${E(f?.name||'Continuing progression')}</h3>${f?`<div class="v232-class-prose">${cleanRule(f.html,f.name)}</div>`:`<p>See the full progression table above for ability improvements, spell slots and continuing abilities.</p>`}</article></div></div>`;
};
// Source coverage counts reflect chapters and feature entries, not guesses at content quality.
window.TERRAVALE_V232_AUDIT={classes:RULES.classes.length,rows:RULES.classes.reduce((n,c)=>n+(c.progression?.levels?.length||0),0),paths:RULES.classes.reduce((n,c)=>n+(c.options?.length||0),0),features:RULES.classes.reduce((n,c)=>n+Object.values(c.featureByLevel||{}).reduce((m,a)=>m+a.length,0),0)};
// Crimsonborn stages are DM-controlled and use the exact Stage 1/2/3+ saturation caps.
function maxBlood(c){return stages[Math.min(5,Math.max(1,Number(c.crimsonStage||c.stage)||1))]||10;}
function bloodStagePanel(c){const cap=maxBlood(c),stage=Math.min(5,Math.max(1,Number(c.crimsonStage||c.stage)||1));return `<div class="v232-stage-controls"><span class="v2-overline">CRIMSON STAGE · ${stage} <small>Positive cap +${cap}</small></span>${db.role==='dm'?`<label>DM: Change Crimson Stage<select data-v232-stage="${E(c.id)}">${[1,2,3,4,5].map(n=>`<option value="${n}" ${stage===n?'selected':''}>Stage ${n} · cap +${stages[n]}</option>`).join('')}</select></label>`:`<label>Preview a stage (does not change your character)<select data-v232-stage-preview="${E(c.id)}"><option value="">Current stage ${stage}</option>${[1,2,3,4,5].map(n=>`<option value="${n}">Stage ${n}</option>`).join('')}</select></label><p class="v232-stage-preview-note" data-v232-stage-note="${E(c.id)}">Your recorded Stage is ${stage}. Your positive Blood State cannot exceed +${cap}.</p>`}</div>`;}
const oldSheet=renderSheetV220;
renderSheetV220=function(id){const c=db.characters.find(x=>String(x.id)===String(id));if(c&&String(c.ancestry||'').toLowerCase()==='crimsonborn')c.bloodState=Math.max(-40,Math.min(maxBlood(c),Math.round(Number(c.bloodState)||0)));const t=document.createElement('template');t.innerHTML=oldSheet(id);if(!c)return t.innerHTML;
 if(String(c.ancestry||'').toLowerCase()==='crimsonborn'){const p=t.content.querySelector('.v231-hunger-panel');if(p){const cap=maxBlood(c),current=Math.max(-40,Math.min(cap,Math.round(Number(c.bloodState)||0)));if(current!==Number(c.bloodState??0)){c.bloodState=current;persist()}const input=p.querySelector('[data-v231-hunger-exact]');if(input){input.max=String(cap);input.value=String(current)}const label=p.querySelector('.v231-hunger-top small');if(label)label.textContent=`Stage cap +${cap} · source track −40 to +40`;const right=p.querySelector('.v231-hunger-scale>div>span:last-child');if(right)right.textContent=`+${cap} · Stage limit`;const block=p.querySelector('.v231-hunger-track');if(block){const capMark=document.createElement('span');capMark.className='v232-stage-cap';capMark.style.left=((cap+40)/80*100)+'%';capMark.title=`Stage ${Number(c.crimsonStage||c.stage)||1} cap +${cap}`;block.append(capMark)}}}
 return t.innerHTML;
};
// Never silently alter the stage for player role. Positive bound enforced at click time, even before next sheet render.
document.addEventListener('change',e=>{const stage=e.target.closest('[data-v232-stage]');if(stage){e.preventDefault();e.stopImmediatePropagation();if(db.role!=='dm')return;const c=db.characters.find(x=>String(x.id)===stage.dataset.v232Stage&&x.campaign===db.campaign);if(!c)return;c.crimsonStage=Math.min(5,Math.max(1,Number(stage.value)||1));c.stage=c.crimsonStage;c.bloodState=Math.min(Number(c.bloodState)||0,maxBlood(c));persist();renderPage(false);toast('Crimson Stage updated by DM.');return;}const preview=e.target.closest('[data-v232-stage-preview]');if(preview){const note=document.querySelector(`[data-v232-stage-note="${CSS.escape(preview.dataset.v232StagePreview)}"]`);if(note){const n=Number(preview.value);note.textContent=n?`Stage ${n} would allow a positive Blood State cap of +${stages[n]}. Preview only; your actual Stage is unchanged.`:'Preview cleared; the current Stage remains unchanged.';}}},true);
// The original V2.31 hunger buttons are handled in capture phase; constrain input/button before they reach that handler.
document.addEventListener('click',e=>{const b=e.target.closest('[data-v231-hunger],[data-v231-hunger-apply]');if(!b)return;const id=b.dataset.v231Character||b.dataset.v231HungerApply;const c=db.characters.find(x=>String(x.id)===String(id));if(!c)return;const input=document.querySelector(`[data-v231-hunger-exact="${CSS.escape(id)}"]`),cap=maxBlood(c);if(b.dataset.v231HungerApply!==undefined&&input)input.value=String(Math.max(-40,Math.min(cap,Number(input.value)||0)));if(b.dataset.v231Hunger!==undefined){const current=Number(c.bloodState)||0;const delta=Number(b.dataset.v231Hunger)||0;if(current+delta>cap){e.preventDefault();e.stopImmediatePropagation();c.bloodState=cap;persist();renderPage(false);toast(`Stage cap +${cap} reached.`);}}},true);
// Character abilities gain a grouped, source-backed section for the player's planned Bloodforger nodes.
const previousFeatureReader=sheetV222FeaturesPage;
sheetV222FeaturesPage=function(c){const base=previousFeatureReader(c);if(c.className!=='Bloodforger')return base;const t=document.createElement('template');t.innerHTML=base;const tabBar=t.content.querySelector('.sheet227-reader-tabs'),body=t.content.querySelector('.sheet227-reader-body');if(!tabBar||!body)return base;const b=document.createElement('button');b.setAttribute('role','tab');b.dataset.v232FeatureTab='bloodforger';b.innerHTML='Bloodforger techniques <span>'+Object.keys(c.v231BloodPurchases||{}).length+'</span>';if(window.TerravaleReaderRequestedMode&&window.TerravaleReaderRequestedMode!=='bloodforger')treeTab='class';b.setAttribute('aria-selected',String(treeTab==='bloodforger'));tabBar.append(b);if(treeTab==='bloodforger'){
 tabBar.querySelectorAll('button:not([data-v232-feature-tab])').forEach(el=>el.setAttribute('aria-selected','false'));
 const owned=c.v231BloodPurchases||{},list=treeNames.filter(n=>Object.keys(owned).some(k=>k.startsWith(n+':')));if(!list.includes(readerSelectedTree))readerSelectedTree=list[0]||'Alteration';const tree=GRAPH.disciplines[readerSelectedTree],nodes=tree.nodes.filter(n=>Object.hasOwn(owned,readerSelectedTree+':'+n.id));
 body.innerHTML=`<aside class="sheet227-reader-index v232-owned-index"><span class="v2-overline">YOUR PLANNED TECHNIQUES</span>${(list.length?list:treeNames).map(name=>`<button class="v232-owned-tree ${readerSelectedTree===name?'active':''}" data-v232-owned-tree="${E(name)}"><strong>${E(name)}</strong><small>${Object.keys(owned).filter(x=>x.startsWith(name+':')).length} planned nodes</small></button>`).join('')}</aside><article class="sheet227-reader-detail v232-owned-content"><span class="v2-overline">${E(readerSelectedTree)} · PLANNED NODES</span><h3>${E(readerSelectedTree)} techniques</h3>${nodes.length?nodes.map(n=>`<div class="v232-owned-node"><span class="v2-overline">${E(n.id)} · TIER ${E(n.tier)}</span><h4>${E(n.name)}</h4><div>${v226Sanitize(n.body)}</div></div>`).join(''):'<p>Select nodes on your Bloodforger trees to see them collected here by discipline.</p>'}<p class="v2-dim">Offline planned nodes. Live purchases and DM approval have not been applied.</p></article>`;
 }
 return t.innerHTML;
};
document.addEventListener('click',e=>{const tab=e.target.closest('[data-v232-feature-tab]');if(tab){window.TerravaleReaderRequestedMode='bloodforger';e.preventDefault();e.stopImmediatePropagation();treeTab=tab.dataset.v232FeatureTab;renderPage(false);return;}const original=e.target.closest('[data-v228-tab]');if(original){treeTab='class';setTimeout(()=>renderPage(false),0);}const group=e.target.closest('[data-v232-owned-tree]');if(group){e.preventDefault();e.stopImmediatePropagation();readerSelectedTree=group.dataset.v232OwnedTree;renderPage(false);}},true);
// Optional preview styles on two classes and both styles available on all class pages.

// V2.77: the original handler used renderPage(false) for each level/feature,
// destroying #pageRoot, scroll anchors, focus and open progression tables.
function v277Document(id){
 return RULES.classes.find(d=>keyClass(d.name)===id)||null;
}
function v277ReadMarkup(html,selector){
 const template=document.createElement('template');
 template.innerHTML=html;
 return template.content.querySelector(selector);
}
function v280PreserveScroll(){
 const top=window.scrollY;
 const route=location.hash;
 const html=document.documentElement;
 const prior=html.style.overflowAnchor;
 // Avoid competing browser scroll anchoring while replacing a level detail.
 html.style.overflowAnchor='none';
 let restored=false;
 return function restore(){
  if(restored)return;
  restored=true;
  if(Math.abs(window.scrollY-top)>.5)window.scrollTo({top,behavior:'instant'});
  requestAnimationFrame(()=>{
   if(location.hash===route&&Math.abs(window.scrollY-top)>.5)
    window.scrollTo({top,behavior:'instant'});
   html.style.overflowAnchor=prior;
  });
 };
}
function v277Reanchor(element,top){
 // Intentionally disabled: proportional scrollBy was itself moving the viewport.
 // Reader dimensions are preserved by v277KeepHeight instead.
}
function v277KeepHeight(next,current,remember){
 const oldHeight=Math.ceil(current.getBoundingClientRect().height);
 const prior=Number(remember.dataset.v277HeldHeight)||0;
 const minimum=Math.max(oldHeight,prior);
 remember.dataset.v277HeldHeight=String(minimum);
 // Avoid shrinking the total document while the reader is under the viewport.
 // Height may expand for longer mechanics, but never collapses on each click.
 next.style.minHeight=minimum+'px';
}
function v277UpdateProgression(id,trigger,mode){
 const reader=trigger.closest('.v232-progression-reader');
 const doc=v277Document(id);
 if(!reader||!doc||reader.dataset.v232Progression!==id)return false;
 const grid=reader.querySelector('.v232-level-grid');
 const current=reader.querySelector('.v232-level-content');
 if(!grid||!current)return false;
 const levels=20;
 const fresh=v277ReadMarkup(v223ClassFeatures(doc.name,levels),'.v232-progression-reader');
 const replacement=fresh?.querySelector('.v232-level-content');
 if(!replacement)return false;
 const anchorTop=grid.getBoundingClientRect().top;
 const restoreScroll=v280PreserveScroll();
 const focusWasInside=current.contains(document.activeElement);
 if(mode==='feature'){
  const oldArticle=current.querySelector('article');
  const newArticle=replacement.querySelector('article');
  if(!oldArticle||!newArticle)return false;
  v277KeepHeight(newArticle,oldArticle,current);
  oldArticle.replaceWith(newArticle);
  current.querySelectorAll('[data-v232-feature]').forEach(button=>{
   const active=Number(button.dataset.v232Feature)===Number(classFeature[id]||0);
   button.classList.toggle('active',active);
   button.setAttribute('aria-pressed',String(active));
  });
 }else{
  v277KeepHeight(replacement,current,reader);
  current.replaceWith(replacement);
  grid.querySelectorAll('[data-v232-level]').forEach(button=>{
   const active=Number(button.dataset.v232Level)===Number(classLevel[id]||1);
   button.classList.toggle('active',active);
   button.setAttribute('aria-pressed',String(active));
  });
  if(focusWasInside){
   const same=replacement.querySelector('[data-v232-feature="0"]');
   same?.focus({preventScroll:true});
  }
 }
 restoreScroll();
 return true;
}
function v277UpdateOptions(id,trigger){
 const reader=trigger.closest('.v232-class-reader');
 const doc=v277Document(id);
 if(!reader||!doc||reader.dataset.v232Class!==id)return false;
 const current=reader.querySelector('.v232-class-layout');
 const fresh=v277ReadMarkup(v224SubclassPanel(doc.name),'.v232-class-reader');
 const next=fresh?.querySelector('.v232-class-layout');
 if(!current||!next)return false;
 const anchorTop=reader.getBoundingClientRect().top;
 const restoreScroll=v280PreserveScroll();
 const priorSearch=current.querySelector('[data-v232-opt-query]');
 const nextSearch=next.querySelector('[data-v232-opt-query]');
 if(priorSearch&&nextSearch){
  nextSearch.value=priorSearch.value;
  const query=priorSearch.value.toLowerCase();
  next.querySelectorAll('[data-v232-class-option]').forEach(btn=>{
   btn.hidden=!btn.dataset.v232ClassOption.toLowerCase().includes(query);
  });
 }
 v277KeepHeight(next,current,reader);
 current.replaceWith(next);
 restoreScroll();
 return true;
}
window.TerravaleV277RefreshPath=function(trigger){
 const reader=trigger.closest('.v233-path-reader');
 const id=reader?.dataset.v232Class;
 const doc=id&&v277Document(id);
 if(!reader||!doc)return false;
 const old=reader.querySelector('.v233-path-content');
 const fresh=v277ReadMarkup(v224SubclassPanel(doc.name),'.v233-path-reader');
 const next=fresh?.querySelector('.v233-path-content');
 if(!old||!next)return false;
 const steps=reader.querySelector('.v233-level-steps');
 const anchorTop=steps?.getBoundingClientRect().top;
 const restoreScroll=v280PreserveScroll();
 v277KeepHeight(next,old,reader);
 old.replaceWith(next);
 const chosen=window.TV33_PATH_LEVELS?.[trigger.dataset.v233For];
 reader.querySelectorAll('[data-v233-path-step]').forEach(button=>{
  const active=button.dataset.v233For===trigger.dataset.v233For&&
     button.dataset.v233PathStep===chosen;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 restoreScroll();
 return true;
};

document.addEventListener('click',e=>{const v=e.target.closest('[data-v232-class-view]'),o=e.target.closest('[data-v232-class-option]'),lv=e.target.closest('[data-v232-level]'),f=e.target.closest('[data-v232-feature]');if(!v&&!o&&!lv&&!f)return;e.preventDefault();e.stopImmediatePropagation();const id=(v||o||lv||f).dataset.v232For;if(v)classView[id]=v.dataset.v232ClassView;if(o)classOption[id]=o.dataset.v232ClassOption;if(lv){classLevel[id]=Number(lv.dataset.v232Level);classFeature[id]=0;}if(f)classFeature[id]=Number(f.dataset.v232Feature);if(lv&&v277UpdateProgression(id,lv,'level'))return;if(f&&v277UpdateProgression(id,f,'feature'))return;if(o&&v277UpdateOptions(id,o))return;renderPage(false);},true);
document.addEventListener('input',e=>{const f=e.target.closest('[data-v232-opt-query]');if(!f)return;const id=f.dataset.v232OptQuery;classQuery[id]=f.value;const list=f.closest('.v232-class-reader')?.querySelectorAll('.v232-option-links button');list?.forEach(b=>b.hidden=!b.dataset.v232ClassOption.toLowerCase().includes(f.value.toLowerCase()));},true);
// Exportable, importable level-scaled sandbox. This is completely separate from character purchases.
function initialLab(){return {level:5,owned:{},notes:'',tree:'Alteration',selected:'A01',saved:false};}
function lab(){db.v232BuildLab??=initialLab();return db.v232BuildLab;}
function labPoints(){return Number(GRAPH.dp[Math.max(1,Math.min(20,lab().level))]||0);}
function labSpent(){return Object.values(lab().owned).reduce((n,p)=>n+Number(p||0),0);}
function labOwned(tree,node){return Object.hasOwn(lab().owned,tree+':'+node);}
function labPrice(tree,node){if(node.tier!=='Crown')return 1;return 3+GRAPH.disciplines[tree].nodes.filter(n=>n.tier==='Crown'&&labOwned(tree,n.id)).length;}
function labBlock(tree,node){if(labOwned(tree,node.id))return '';if(lab().level<tierLevels[node.tier])return 'Unlocks at level '+tierLevels[node.tier];const other=GRAPH.disciplines[tree].nodes.find(n=>n.lockOther===node.id);if(node.lockOther&&labOwned(tree,node.lockOther)||other&&labOwned(tree,other.id))return 'Branch conflict';if(node.parents?.length&&!node.parents.some(p=>labOwned(tree,p)))return 'Requires an upstream node';if(labSpent()+labPrice(tree,node)>labPoints())return 'Not enough DP';return '';}
function labContent(){const c=lab(),tree=GRAPH.disciplines[c.tree]||GRAPH.disciplines.Alteration,node=tree.nodes.find(n=>n.id===c.selected)||tree.nodes[0];if(!tree.nodes.some(n=>n.id===c.selected))c.selected=node.id;
 const scale=Math.min(1.2,Math.max(.6,Number(c.zoom)||.9)),w=tree.width+150,h=tree.height+130;
 const centers=Object.fromEntries(tree.nodes.map(n=>[n.id,n]));const pts=tree.edges.map(([a,b])=>{const p=centers[a],q=centers[b];if(!p||!q)return '';const x=p.x+70,y=p.y+60,X=q.x+70,Y=q.y+60,m=(x+X)/2;return `<path d="M ${x} ${y} C ${m} ${y},${m} ${Y},${X} ${Y}" class="${labOwned(c.tree,a)&&labOwned(c.tree,b)?'owned':''}"/>`;}).join('');
 const cards=tree.nodes.map(n=>`<button class="v232-lab-node ${labOwned(c.tree,n.id)?'owned':''} ${n.id===c.selected?'selected':''}" style="left:${n.x+70}px;top:${n.y+60}px" data-v232-lab-node="${E(n.id)}"><small>${E(n.id)} · ${E(n.tier)}</small><strong>${E(n.name)}</strong></button>`).join('');
 const blocked=labBlock(c.tree,node),own=labOwned(c.tree,node.id),children=tree.nodes.some(n=>n.parents?.includes(node.id)&&labOwned(c.tree,n.id));
 return `<div class="v232-lab-page"><div class="v2-overline">BLOODFORGER · EXPERIMENTAL LAB</div><h1>Discipline Build Lab</h1><p>Try combinations at any level, keep notes, share builds, and return to the same node plan. Sandbox points are not real Discipline Points.</p><div class="v232-lab-tools"><label>Test level <select data-v232-lab-level>${Array.from({length:18},(_,i)=>i+3).map(n=>`<option value="${n}" ${c.level===n?'selected':''}>Level ${n}</option>`).join('')}</select></label><div class="v232-lab-points"><b>${labPoints()-labSpent()}</b> / ${labPoints()} DP available · ${labSpent()} planned</div><button data-v232-lab-save class="btn ghost">${c.saved?'✓ Quick Saved':'☆ Add to Quick Save'}</button><button data-v232-lab-export class="btn ghost">Export JSON</button><label class="btn ghost v232-import-label">Import JSON<input type="file" accept=".json,application/json" data-v232-lab-import hidden></label><button data-v232-lab-clear class="btn ghost">Clear plan</button><a class="btn ghost" href="#/classes/bloodforger">Return to Bloodforger ↗</a></div><div class="v232-lab-tabs">${treeNames.map(n=>`<button data-v232-lab-tree="${E(n)}" class="${n===c.tree?'active':''}">${E(n)} <small>${Object.keys(c.owned).filter(k=>k.startsWith(n+':')).length}</small></button>`).join('')}</div><div class="v232-lab-workspace"><div class="v232-lab-graph-frame"><div class="v232-lab-hint">Select a node to inspect it · drag the map to pan <span class="v232-lab-zoom"><button data-v232-lab-zoom="-1">−</button><button data-v232-lab-zoom="fit">Fit</button><button data-v232-lab-zoom="1">+</button></span></div><div class="v232-lab-viewport"><div class="v232-lab-graph" style="width:${w}px;height:${h}px;transform:scale(${scale})"><svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><g>${pts}</g></svg>${cards}</div></div></div><aside class="v232-lab-detail"><span class="v2-overline">${E(c.tree)} · ${E(node.id)} · ${E(node.tier)}</span><h3>${E(node.name)}</h3><p>${E(own?'Planned · '+c.owned[c.tree+':'+node.id]+' DP':blocked||'Available · '+labPrice(c.tree,node)+' DP')}</p><div class="v232-node-text">${v226Sanitize(node.body)}</div><button class="btn primary" data-v232-lab-buy="${E(node.id)}" ${own||blocked?'disabled':''}>${blocked?E(blocked):'Plan node · '+labPrice(c.tree,node)+' DP'}</button>${own?`<button class="btn ghost" data-v232-lab-refund="${E(node.id)}" ${children?'disabled':''}>${children?'Remove descendants first':'Undo planned node'}</button>`:''}</aside></div><div class="v232-lab-notes"><label for="v232-lab-notes" class="v2-overline">BUILD NOTES</label><textarea id="v232-lab-notes" placeholder="Combos, synergies, roleplay ideas, trade-offs…">${E(c.notes)}</textarea><small>Autosaved in this offline browser alongside the node plan. Export to share.</small></div></div>`;
}
function saveLab(){persist();}
const oldSaved=resolveSaved;
resolveSaved=function(id){if(id==='bloodforger-lab')return {title:'Bloodforger Build Lab',kind:'Build experiment',route:'/classes/bloodforger/build-lab'};return oldSaved(id);};
function routeLab(){return window.location.hash.replace(/^#/, '').split('?')[0]==='/classes/bloodforger/build-lab';}
const prevRender=renderPage;
renderPage=function(...args){const rv=prevRender(...args);if(routeLab()){
 const el=document.getElementById('pageRoot');if(el){el.classList.add('page-reference');el.innerHTML=labContent();}const crumb=document.querySelector('.breadcrumb strong');if(crumb)crumb.textContent='Bloodforger Build Lab';document.title='Bloodforger Build Lab · Terravale Codex V2.33 Offline';
 }else if(location.hash.includes('/classes/bloodforger')){const area=document.getElementById('pageRoot');const title=area?.querySelector('.v223-hero,.v223-section-head');if(title){const link=document.createElement('a');link.className='btn primary v232-lab-link';link.href='#/classes/bloodforger/build-lab';link.textContent='Open Discipline Build Lab ↗';title.append(link);}}
 return rv;};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-v232-lab-node],[data-v232-lab-tree],[data-v232-lab-buy],[data-v232-lab-refund],[data-v232-lab-clear],[data-v232-lab-save],[data-v232-lab-export],[data-v232-lab-zoom]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 const c=lab();if(b.dataset.v232LabZoom!==undefined){const n=b.dataset.v232LabZoom;const tree=GRAPH.disciplines[c.tree];c.zoom=n==='fit'?Math.max(.55,Math.min(.95,document.querySelector('.v232-lab-viewport').clientWidth/(tree.width+150))):Math.min(1.2,Math.max(.6,(Number(c.zoom)||.9)+Number(n)*.1));saveLab();renderPage(false);return;}if(b.dataset.v232LabTree){c.tree=b.dataset.v232LabTree;c.selected=GRAPH.disciplines[c.tree].nodes[0]?.id;}
 if(b.dataset.v232LabNode){c.selected=b.dataset.v232LabNode;}
 if(b.dataset.v232LabBuy){const n=GRAPH.disciplines[c.tree].nodes.find(x=>x.id===b.dataset.v232LabBuy);if(n&&!labBlock(c.tree,n)){c.owned[c.tree+':'+n.id]=labPrice(c.tree,n);}}
 if(b.dataset.v232LabRefund){const id=b.dataset.v232LabRefund,tree=GRAPH.disciplines[c.tree];if(!tree.nodes.some(n=>n.parents?.includes(id)&&labOwned(c.tree,n.id)))delete c.owned[c.tree+':'+id];}
 if(b.hasAttribute('data-v232-lab-clear')){if(confirm('Clear this sandbox build and notes?'))db.v232BuildLab=initialLab();else return;}
 if(b.hasAttribute('data-v232-lab-save')){c.saved=!c.saved;db.saved??=[];const id='bloodforger-lab',i=db.saved.indexOf(id);if(c.saved&&i===-1)db.saved.push(id);if(!c.saved&&i>=0)db.saved.splice(i,1);}
 if(b.hasAttribute('data-v232-lab-export')){const obj={format:'terravale-bloodforger-lab-v1',level:c.level,owned:c.owned,notes:c.notes};const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Terravale_Bloodforger_Build_Lv'+c.level+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
 saveLab();renderPage(false);
},true);
document.addEventListener('change',async e=>{const f=e.target.closest('[data-v232-lab-level],[data-v232-lab-import]');if(!f)return;if(f.hasAttribute('data-v232-lab-level')){lab().level=Math.min(20,Math.max(3,Number(f.value)||5));const before=Object.keys(lab().owned).length;let changed=true;while(changed){changed=false;for(const [key]of Object.entries(lab().owned)){const split=key.lastIndexOf(':'),treeName=key.slice(0,split),id=key.slice(split+1),node=GRAPH.disciplines[treeName]?.nodes.find(n=>n.id===id);if(!node||lab().level<tierLevels[node.tier]){delete lab().owned[key];changed=true;}}}while(labSpent()>labPoints()){const k=Object.keys(lab().owned).at(-1);if(!k)break;delete lab().owned[k];}if(before!==Object.keys(lab().owned).length)toast('Nodes above this level or budget were removed.');saveLab();renderPage(false);return;}
 const file=f.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw Error('File too large.');const j=JSON.parse(await file.text());if(j.format!=='terravale-bloodforger-lab-v1'||typeof j.owned!=='object'||!j.owned||Array.isArray(j.owned))throw Error('Not a supported Bloodforger build file.');const replacement=initialLab();replacement.level=Math.max(3,Math.min(20,Math.round(Number(j.level)||5)));replacement.notes=String(j.notes||'').slice(0,12000);const owned=Object.entries(j.owned);if(owned.length>350)throw Error('Too many nodes.');let cost=0;for(const [k,v] of owned){const cut=k.lastIndexOf(':'),tree=k.slice(0,cut),id=k.slice(cut+1),n=GRAPH.disciplines[tree]?.nodes.find(x=>x.id===id);if(!n||replacement.level<tierLevels[n.tier]||!Number.isInteger(Number(v))||Number(v)<1||Number(v)>10)throw Error('Invalid node, level, or cost.');replacement.owned[k]=Number(v);cost+=Number(v);}if(cost>Number(GRAPH.dp[replacement.level]||0))throw Error('Imported build exceeds its level DP budget.');for(const [k]of owned){const i=k.lastIndexOf(':'),tree=k.slice(0,i),id=k.slice(i+1),n=GRAPH.disciplines[tree].nodes.find(n=>n.id===id);if(n.parents?.length&&!n.parents.some(p=>Object.hasOwn(replacement.owned,tree+':'+p)))throw Error('Missing a prerequisite node.');if(n.lockOther&&Object.hasOwn(replacement.owned,tree+':'+n.lockOther))throw Error('Conflicting branches.');}
 replacement.saved=lab().saved;db.v232BuildLab=replacement;persist();renderPage(false);toast('Build imported successfully.');}catch(ex){toast('Import rejected: '+ex.message);}f.value='';},true);
document.addEventListener('input',e=>{if(e.target.id==='v232-lab-notes'){lab().notes=e.target.value.slice(0,12000);saveLab();}},true);
// Smooth pan: remove intrusive scrollbars but keep pointer, trackpad and keyboard navigation.
function panify(view){if(view.dataset.v232Pan)return;view.dataset.v232Pan='true';let start=null;view.addEventListener('pointerdown',e=>{if(e.target.closest('button,a,input,select'))return;e.preventDefault();start={x:e.clientX,y:e.clientY,left:view.scrollLeft,top:view.scrollTop};view.setPointerCapture(e.pointerId);view.classList.add('dragging');});view.addEventListener('pointermove',e=>{if(!start)return;view.scrollLeft=start.left-(e.clientX-start.x);view.scrollTop=start.top-(e.clientY-start.y);});const end=()=>{start=null;view.classList.remove('dragging')};view.addEventListener('pointerup',end);view.addEventListener('pointercancel',end);view.addEventListener('wheel',e=>{if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){view.scrollLeft+=e.deltaX||e.deltaY;}else{view.scrollTop+=e.deltaY;}}, {passive:true});}
const treeObserver=new MutationObserver(()=>{document.querySelectorAll('.v231-tree-viewport,.v232-lab-viewport').forEach(panify)});
treeObserver.observe(document.body,{childList:true,subtree:true});
// Demo choices menu stays source-backed and never silently invents class options.
renderPage(false);
})();
