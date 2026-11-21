/* Terravale V2.34: source-verified spell slots / class resources; consistent ability readers;
 * branch-exclusion display for the existing Bloodforger graphs. Offline preview only. */
(function(){'use strict';
 const E=x=>safe(String(x??''));
 const SPELLS=JSON.parse(document.getElementById('v234-spell-tables').textContent);
 const SOURCES=JSON.parse(document.getElementById('v234-resource-tables').textContent);
 const SUBCLASS_USES=JSON.parse(document.getElementById('v234-subclass-limits').textContent);
 const GRAPH=JSON.parse(document.getElementById('v231-bloodforger-source').textContent);
 const clean=x=>String(x||'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
 const score=(c,key)=>Math.floor(((Number(c[key])||10)-10)/2);
 const pb=c=>sheetV220Prof(c);
 const level=c=>Math.min(20,Math.max(1,Number(c.level)||1));
 const path=c=>String(c.progression?.subclass||c.progression?.tradition||c.subclass||v226SpecName(c)||'').trim();
 const choicesOnly=/^(?:Feat\s*\/\s*ASI|ASI\s*\/\s*Feat|Ability Score Improvement|ASI|Fighting Style|Weapon Mastery|Deft Explorer|Expertise|Tool Expertise|Ranger Archetype|Martial Archetype|Bard College|Druid Circle|Primal Path|Monastic Tradition|Arcane Tradition|Sacred Oath|Divine Domain|Otherworldly Patron|Sorcerous Origin|Artificer Specialist|Pact Gift|Primal Knowledge|Specialist feature|Domain feature|Circle feature|College feature|Tradition feature|Path feature|Archetype feature|Oath feature|Origin feature)(?:\s*[-—–]\s*(?:level|lv)\s*\d+|\s*\(level\s*\d+\))?$/i;
 window.TV34_IS_CHOICE_ONLY=name=>choicesOnly.test(String(name||'').trim());
 const oldResources=sheetV220Resources;
 function amount(c,rec){
  switch(rec.formula){
   case 'cha':return Math.max(1,score(c,'cha'));
   case 'int':return Math.max(1,score(c,'int'));
   case 'pb':return pb(c);
   case 'fighter_action':return level(c)>=17?2:1;
   case 'fighter_indo':return level(c)>=17?3:level(c)>=13?2:1;
   case 'cleric_cd':return level(c)>=18?4:level(c)>=6?3:2;
   case 'druid_wild':return level(c)>=20?null:level(c)>=17?3:2;
   case 'paladin_lay':return 5*level(c);
   case 'paladin_cd':return level(c)>=11?3:2;
   default:return Number(rec.value)||0;
  }
 }
 function currentMagic(c){
  const subclass=path(c),k=c.className+'|'+subclass;
  // Eldritch Knight & Arcane Trickster have an expressly stated one-third Wizard casting progression.
  return SPELLS[c.className]||SPELLS[k]||null;
 }
 function spellRows(c){
  const magic=currentMagic(c);if(!magic)return [];
  const entry=magic.levels[level(c)-1];if(!entry)return [];
  if(magic.kind==='pact')return entry.count?[{id:'pact-slot-'+entry.level,name:`Pact Magic · ${spellLevel(entry.level)} spells`,unit:'slots',max:entry.count,source:magic.source,kind:'spell',recovery:'Pact Magic recovery'}]:[];
  return entry.map((n,i)=>Number(n)>0?{id:'spell-slot-'+(i+1),name:spellLevel(i+1)+'-level spell slots',unit:'slots',max:Number(n),source:magic.source,kind:'spell',recovery:'Long-rest spell slots',review:!!magic.derived}:null).filter(Boolean);
 }
 function spellLevel(n){return String(n)+(n===1?'st':n===2?'nd':n===3?'rd':'th');}
 sheetV220Resources=function(c){
  const base=oldResources(c),seen=new Set(base.map(r=>r.id));
  function add(r){if(seen.has(r.id))return;if(r.max===undefined||r.max!==null&&(!Number.isFinite(Number(r.max))||r.max<1))return;seen.add(r.id);base.push(r);}
  const vals=SOURCES[c.className]||[];
  for(const rec of vals){
   if(rec.level&&level(c)<rec.level)continue;
   let max,unit='uses';
   if(rec.values){const v=rec.values[level(c)-1];if(!v)continue;max=v.max;unit=v.unit||'uses';}
   else max=amount(c,rec);
   const id='verified:'+clean(c.className)+':'+rec.id;
   add({id,name:rec.name,unit,max,source:rec.source,recovery:rec.rest||'Published class recovery',kind:'ability'});
  }
  // Mystic Arcanum is not a normal spell slot and does not belong in the Pact-slot pool.
  if(c.className==='Warlock')for(const [l,spell] of [[11,6],[13,7],[15,8],[17,9]])if(level(c)>=l)add({id:'arcanum-'+spell,name:`Mystic Arcanum · ${spellLevel(spell)}`,unit:'use',max:1,source:'Warlock Mystic Arcanum class progression',recovery:'Published Arcanum recovery',kind:'ability'});
  // Explicitly written subclass feature uses, granted only when the actual path and level match.
  // This data is extracted from named level-feature paragraphs, never from arbitrary catalogue entries.
  const active=path(c).toLowerCase().trim();
  if(active)for(const entry of SUBCLASS_USES){
   if(entry.class!==c.className||level(c)<entry.level)continue;
   const published=entry.subclass.toLowerCase();
   if(published!==active&&!published.startsWith(active+' —')&&!active.startsWith(published+' —'))continue;
   const max=entry.formula==='pb'?pb(c):Number(entry.max)||0;
   add({id:'subclass-use:'+clean(c.className)+':'+clean(entry.subclass)+':'+clean(entry.name),name:entry.name,max,unit:'uses',kind:'ability',source:`${entry.subclass} · level ${entry.level} · ${entry.recovery}`,recovery:entry.recovery,review:'subclass'});
  }
  for(const r of spellRows(c))add(r);
  return base;
 };
 function resourceCell(c,r,state,can){
  const max=r.max,unlimited=max==null,current=unlimited?null:Math.max(0,Math.min(max,Number(state.resources[r.id]===undefined?max:state.resources[r.id])||0));
  const dots=unlimited?'':`<div class="v234-resource-pips">${Array.from({length:Math.min(max,14)},(_,i)=>`<span class="${i<current?'filled':''}"></span>`).join('')}${max>14?`<small>of ${max}</small>`:''}</div>`;
  return `<div class="v234-resource-item" data-v234-resource="${E(r.id)}"><div class="v234-resource-line"><div><strong>${E(r.name)}</strong><small>${E(r.unit)}${r.review==='subclass'?' · source conditions apply':r.review?' · derived, DM review':''}</small></div><b>${unlimited?'∞':`${current}<em> / ${max}</em>`}</b></div>${dots}${can&&!unlimited?`<div class="v234-resource-actions"><button type="button" data-action="sheetResource" data-id="${E(c.id)}" data-value="${E(r.id)}" data-delta="-1" ${current<1?'disabled':''} aria-label="Spend one ${E(r.name)}">− Spend</button><button type="button" data-action="sheetResource" data-id="${E(c.id)}" data-value="${E(r.id)}" data-delta="1" ${current>=max?'disabled':''} aria-label="Restore one ${E(r.name)}">+ Restore</button></div>`:''}<small class="v234-resource-source">${E(r.source)}</small></div>`;
 }
 sheetV220ResourcesPanel=function(c){
  const state=sheetV220State(c),can=sheetV220CanEdit(c),all=sheetV220Resources(c),spells=all.filter(x=>x.kind==='spell'||/^spell-slot-|^pact-slot-/.test(x.id)),abilities=all.filter(x=>!spells.includes(x));
  const magic=currentMagic(c),isPact=magic?.kind==='pact';
  return `<section class="sheet20-panel sheet20-resource-panel v234-resources"><div class="sheet20-panel-heading"><span>CLASS RESOURCES</span><span class="sheet20-source">SOURCE-BACKED TRACKING</span></div><h3>${spells.length?'Resources & spellcasting':'Class resources'}</h3>${spells.length?`<div class="v234-resource-group"><header><span>MAGIC · ${isPact?'PACT SLOTS':'SPELL SLOTS'}</span><small>${isPact?'All Pact slots share one spell level':'Each spell level tracks its own remaining slots'}</small></header><div class="v234-resource-grid v234-spell-grid">${spells.map(r=>resourceCell(c,r,state,can)).join('')}</div>${magic?.derived?'<p class="v234-derived-note">One-third caster: numerical slot schedule follows a derived 5e model. DM verification required against the adopted Terravale baseline.</p>':''}</div>`:''}${abilities.length?`<div class="v234-resource-group"><header><span>LIMITED-USE CLASS ABILITIES</span><small>Counts from class progression or explicitly stated rules</small></header><div class="v234-resource-grid">${abilities.map(r=>resourceCell(c,r,state,can)).join('')}</div></div>`:''}${!spells.length&&!abilities.length?'<p class="v234-resource-empty">No fixed spendable pool is granted to this class at the character’s current level. Its other class features remain available in Features & Feats.</p>':''}<p class="v234-resource-help">Use the counters as you play. Spell slots and class uses are tracked separately; a long-rest recovery or special feature must follow its published rules.</p></section>`;
 };
 let selectedTechnique='',techniqueQuery='';
 const previousReader=sheetV222FeaturesPage;
 sheetV222FeaturesPage=function(c){
  const original=previousReader(c);if(c.className!=='Bloodforger')return original;
  const t=document.createElement('template');t.innerHTML=original;
  const button=t.content.querySelector('[data-v232-feature-tab="bloodforger"]');
  if(!button||button.getAttribute('aria-selected')!=='true')return original;
  const owned=c.v231BloodPurchases||{};const groups=Object.entries(GRAPH.disciplines).map(([tree,def])=>({tree,nodes:def.nodes.filter(n=>Object.prototype.hasOwnProperty.call(owned,tree+':'+n.id))})).filter(x=>x.nodes.length);
  const every=groups.flatMap(g=>g.nodes.map(n=>({tree:g.tree,node:n})))
  if(!every.some(x=>x.tree+':'+x.node.id===selectedTechnique))selectedTechnique=every[0]?every[0].tree+':'+every[0].node.id:'';
  const focus=every.find(x=>x.tree+':'+x.node.id===selectedTechnique);
  let menu=groups.length?groups.map(g=>`<div class="sheet228-list-label">${E(g.tree)} · ${g.nodes.length} planned</div>${g.nodes.map(n=>`<button type="button" class="sheet227-entry ${g.tree+':'+n.id===selectedTechnique?'is-active':''}" aria-pressed="${g.tree+':'+n.id===selectedTechnique}" data-v234-technique="${E(g.tree+':'+n.id)}" data-v234-search="${E((g.tree+' '+n.name+' '+n.id).toLowerCase())}"><strong>${E(n.name)}</strong><small>${E(n.id)} · Tier ${E(n.tier)}</small><span aria-hidden="true">›</span></button>`).join('')}`).join(''):'<p class="sheet22-empty-features">Plan nodes in the Bloodforger tree to collect them here.</p>';
  let content=focus?`<div class="sheet227-rule-heading"><span class="v2-overline">${E(focus.tree)} · ${E(focus.node.id)} · TIER ${E(focus.node.tier)}</span><h3>${E(focus.node.name)}</h3><div class="sheet228-status">Planned discipline technique · ${E(owned[selectedTechnique])} DP</div></div><div class="sheet228-rule-prose">${v226Sanitize(focus.node.body)}</div><p class="v234-planning-note">This is a local technique plan, not a live character purchase.</p>`:'<p>Choose a planned node to read its rules.</p>';
  const body=t.content.querySelector('.sheet227-reader-body');if(body)body.innerHTML=`<aside class="sheet227-reader-index"><label class="v2-overline" for="v234-technique-search">FIND A TECHNIQUE</label><input id="v234-technique-search" type="search" placeholder="Search planned nodes or trees…" value="${E(techniqueQuery)}"><small class="sheet227-reader-count">${every.length} planned · ${groups.length} disciplines</small><div class="sheet227-reader-entries">${menu}</div></aside><article class="sheet227-reader-detail">${content}</article>`;
  return t.innerHTML;
 };
 function applyTechniqueSearch(){const q=techniqueQuery.toLowerCase();document.querySelectorAll('[data-v234-technique]').forEach(b=>{b.hidden=!b.dataset.v234Search?.includes(q)});}
 document.addEventListener('click',e=>{const el=e.target.closest('[data-v234-technique]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();selectedTechnique=el.dataset.v234Technique;renderPage(false);},true);
 document.addEventListener('click',e=>{const el=e.target.closest('[data-v234-pair-jump]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();const holder=el.closest('.v231-tree-panel,.v232-lab-workspace');const id=el.dataset.v234PairJump;const target=holder?.querySelector(`[data-v231-node="${id}"],[data-v232-lab-node="${id}"]`);target?.click();},true);
 document.addEventListener('input',e=>{if(e.target.id!=='v234-technique-search')return;techniqueQuery=e.target.value;applyTechniqueSearch();},true);
 // Mutually exclusive routes are shown as red dashed 'choose one' connectors, not ordinary prerequisite edges.
 const pairs={};
 for(const [tree,d] of Object.entries(GRAPH.disciplines)){
  const p=[];const seen=new Set();for(const n of d.nodes)if(n.lockOther){const other=d.nodes.find(x=>x.id===n.lockOther);if(!other)continue;const key=[n.id,other.id].sort().join('|');if(!seen.has(key)){seen.add(key);p.push([n,other]);}}
  pairs[tree]=p;
 }
 function annotateGraph(root,treeName,owner){
  const graph=GRAPH.disciplines[treeName];if(!graph||!root)return;
  const svg=root.querySelector('svg');if(!svg)return;
  svg.querySelector('.v234-conflicts')?.remove();root.querySelector('.v234-conflict-legend')?.remove();
  const selected=owner||{};const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('class','v234-conflicts');g.setAttribute('aria-hidden','true');
  for(const [a,b] of pairs[treeName]){
   const x=a.x+70,y=a.y+60,X=b.x+70,Y=b.y+60,mx=(x+X)/2,my=(y+Y)/2,dx=Math.abs(x-X),dy=Math.abs(y-Y);
   const path=document.createElementNS(ns,'path');path.setAttribute('d',`M${x},${y} Q${mx+(dy>dx?42:0)},${my+(dx>=dy?38:0)} ${X},${Y}`);path.setAttribute('class','v234-conflict-edge');g.appendChild(path);
   const text=document.createElementNS(ns,'text');text.setAttribute('x',String(mx));text.setAttribute('y',String(my-8));text.setAttribute('text-anchor','middle');text.setAttribute('class','v234-conflict-label');text.textContent='×';g.appendChild(text);
   for(const node of [a,b]){const n=root.querySelector(`[data-v231-node="${node.id}"],[data-v232-lab-node="${node.id}"]`);if(n){n.classList.add('v234-exclusive-node');const other=node.id===a.id?b:a;const wasSelected=Object.prototype.hasOwnProperty.call(selected,treeName+':'+other.id);n.classList.toggle('v234-branch-blocked',wasSelected&&!Object.prototype.hasOwnProperty.call(selected,treeName+':'+node.id));const sp=document.createElement('span');sp.className='v234-route-badge';sp.textContent=wasSelected?'BLOCKED':'EITHER / OR';n.appendChild(sp);n.title=`Exclusive route: choosing ${node.name} blocks ${other.name}`;}}
  }
  svg.appendChild(g);
  const legend=document.createElement('div');legend.className='v234-conflict-legend';legend.innerHTML=`<span class="v234-dashed-swatch"></span><strong>Exclusive forks:</strong> select one route; its counterpart is blocked.${pairs[treeName].length?`<div class="v234-pair-jump">${pairs[treeName].map(([a,b])=>`<button type="button" data-v234-pair-jump="${a.id}" title="Show the exclusive fork between ${E(a.name)} and ${E(b.name)}">${E(a.name)} <span>×</span> ${E(b.name)}</button>`).join('')}</div>`:''}`;
  const toolbar=root.closest('.v231-tree-panel,.v232-lab-workspace')?.querySelector('.v231-tree-toolbar,.v232-lab-hint');toolbar?.after(legend);
 }
 function markGraphs(){
  const sheet=document.querySelector('.v231-tree-canvas');if(sheet){const root=sheet.closest('[data-v231-tree-root]'),c=db.characters.find(x=>String(x.id)===String(root?.dataset.v231TreeRoot));const label=root?.querySelector('.v231-node-pills')?.closest('.v231-tree-details')?.querySelector('.v2-overline')?.textContent||'';const tree=Object.keys(GRAPH.disciplines).find(x=>label.startsWith(x+' ·'))||Object.keys(GRAPH.disciplines).find(x=>root?.querySelector(`.v231-discipline-tabs button.active`)?.textContent?.startsWith(x))||'Alteration';annotateGraph(sheet,tree,c?.v231BloodPurchases||{});}
  const lab=document.querySelector('.v232-lab-graph');if(lab){const tree=Object.keys(GRAPH.disciplines).find(x=>document.querySelector('.v232-lab-tabs button.active')?.dataset.v232LabTree===x)||db.v232BuildLab?.tree||'Alteration';annotateGraph(lab,tree,db.v232BuildLab?.owned||{});}
 }
 // Preserve the original saved-reference IDs while resolving two inherited v1.10 label aliases against their v2.0 full chapters.
 for(const [oldName,newName,canonical,legacy] of [
   ['Vhaeros Cantor (v1.10)','Vhaeros Cantor','vhaeros-cantor','vhaeros-cantor-v1-10'],
   ['Vitaeforge (v1.10)','Vitaeforge','vitaeforge','vitaeforge-v1-10']
 ]){
   const entry=CLASS.find(x=>x.slug===legacy);
   if(entry)entry.name=newName;
   const manifest=V223_MANIFEST.classes.find(x=>x.name===oldName);
   if(manifest)manifest.name=newName;
   if(V223_DATA.classes?.[oldName]&&!V223_DATA.classes[newName])V223_DATA.classes[newName]=V223_DATA.classes[oldName];
 }
 const previousReference=renderReference;
 renderReference=function(kind,slug){
   if(kind==='class'&&slug==='vhaeros-cantor')slug='vhaeros-cantor-v1-10';
   if(kind==='class'&&slug==='vitaeforge')slug='vitaeforge-v1-10';
   return previousReference(kind,slug);
 };
 const oldRender=renderPage;renderPage=function(...args){const result=oldRender(...args);markGraphs();applyTechniqueSearch();document.title=document.title.replace(/V2\.3[0-3]/g,'V2.34');return result;};
 window.TERRAVALE_V234_AUDIT={classesAudited:33,verifiedSpellTables:Object.values(SPELLS).filter(x=>!x.derived).length,derivedSubclassTables:Object.values(SPELLS).filter(x=>x.derived).length,explicitResourceDefinitions:Object.values(SOURCES).reduce((n,a)=>n+a.length,0),mutuallyExclusivePairs:Object.values(pairs).reduce((n,a)=>n+a.length,0)};
 renderPage(false);
})();
