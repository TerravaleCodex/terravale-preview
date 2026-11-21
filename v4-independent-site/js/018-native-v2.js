
/* V2.27: preserve V2.25/V2.26 base behavior, refine presentation, restore DM controls. */
(function(){
 'use strict';
 const S=c=>safe(String(c==null?'':c));
 const originalGear=window.TERRAVALE_V227_BASE_GEAR;
 if(typeof originalGear==='function'){
   sheetV220Equipment=function(c){
     const tmp=document.createElement('template');
     tmp.innerHTML=originalGear(c);
     const grid=tmp.content.querySelector('.sheet21-gear-slots');
     if(grid){
       grid.classList.add('sheet227-slots');
       const all=[...grid.querySelectorAll('.sheet21-gear-slot')];
       all.forEach(el=>el.classList.add('sheet227-slot'));
       const main=grid.querySelector('[data-sheet-slot="main"]');
       const off=grid.querySelector('[data-sheet-slot="off"]');
       const two=main?.querySelector('.sheet22-equipped small')?.textContent?.includes('Two-handed');
       if(two&&off){main.classList.add('sheet227-twohands');main.querySelector('.sheet21-gear-slot-title span:first-child').textContent='Both hands · two-handed';off.remove()}
     }
     const note=tmp.content.querySelector('section.sheet20-panel p.sheet20-note');
     if(note)note.textContent='Equipped and empty slots keep the same height. Two-handed items occupy both hands. All original Backpack, Move, Edit and drag actions remain available.';
     return tmp.innerHTML;
   };
 }
 let reader={character:null,mode:'class',index:0,query:''};
 const rawFeatPanel=sheetV222FeatPanel;
 function ruleBlocks(html){
   const t=document.createElement('template');t.innerHTML=v226Sanitize(html||'');
   const parts=[],groups=[];
   let group=[];let letters=0;
   const push=()=>{if(group.length){parts.push(group.map(el=>el.outerHTML).join(''));group=[];letters=0}};
   for(const el of [...t.content.children]){
     const tag=el.tagName?.toLowerCase()||'';
     const title=/^h[2-6]$/.test(tag)||tag==='p'&&!!el.querySelector(':scope > strong:first-child')&&el.textContent.length<260;
     if(title&&group.length)push();
     // Keep related text with its heading, but avoid carrying multiple unrelated paragraphs into a giant card.
     if(!title&&letters>780&&group.length>1)push();
     group.push(el);letters+=el.textContent.length;
   }push();
   return '<div class="sheet227-rule-cards">'+(parts.length?parts:['<p>No text is available in the current source.</p>']).map((p,i)=>'<section class="sheet227-rule-card">'+p+'</section>').join('')+'</div>';
 }
 function v227CompleteFeatures(name,limit){
   const rows=v226Features(name,limit),source=v226Class(name);
   if(!source)return rows;
   const t=document.createElement('template');t.innerHTML=v226Sanitize(source.html||'');
   const all=[...t.content.querySelectorAll('p,h2,h3,h4,h5')];
   const norm=s=>String(s||'').toLowerCase().replace(/\b(the|feature|level|lv)\b/g,'').replace(/[^a-z0-9]/g,'');
   const aliases={'bonds':['spirit bonds'],'channel':['channel spirit'],'favour':['spirit favour'],'rites':['spirit rites'],'deep invocation':['deepened invocation']};
   for(const group of rows)for(const item of group.features){
     if(!/listed in the published progression|Refer to the published source reference|complete rules text.*not/i.test(item.html||''))continue;
     const names=[item.name.toLowerCase(),...(aliases[item.name.toLowerCase()]||[])];
     let found=null;
     for(const node of all){
       const label=node.matches('p')?node.querySelector(':scope > strong:first-child'):node;
       if(!label)continue;
       const t=(label.textContent||'').split(/[—–:]/)[0].trim(),key=norm(t);
       if(names.some(n=>{const q=norm(n);return q.length>3&&(key===q||key.startsWith(q)||q.startsWith(key))})){found=node;break;}
     }
     if(found){
       const tag=found.tagName.toLowerCase();let fragment='';
       if(tag==='p')fragment='<h3>'+S(item.name)+'</h3>'+found.outerHTML;
       else{let nodes=[],sib=found.nextElementSibling;while(sib&&nodes.length<24&&!/^H[234]$/.test(sib.tagName)){nodes.push(sib.outerHTML);sib=sib.nextElementSibling}fragment=found.outerHTML+nodes.join('')}
       if(fragment.length>100)item.html=fragment;
     }
   }return rows;
 }
 function featEntries(c){
   const template=document.createElement('template');template.innerHTML=rawFeatPanel(c);
   const native=[...template.content.querySelectorAll('.sheet22-feat')].map((el,i)=>({
     name:el.querySelector('summary strong')?.textContent?.trim()||'Ancestry feat '+(i+1),
     html:el.querySelector('.sheet22-feat-body')?.innerHTML||el.innerHTML
   }));
 return native.concat(window.TerravaleV258Feats?.getEntries?.(c.id,c.campaign)||[]);}

 sheetV222FeaturesPage=function(c){
   if(reader.character!==c.id){reader={character:c.id,mode:'class',index:0,query:''}}
   const feats=featEntries(c);
   const entries=v227CompleteFeatures(c.className,c.level).flatMap(row=>row.features.map(f=>({...f,level:row.level})));
   const mode=reader.mode==='feats'?'feats':'class';const curr=mode==='class'?entries:feats;
   const visible=curr.map((x,i)=>({...x,i})).filter(x=>!reader.query||(x.name+' '+(x.level||'')).toLowerCase().includes(reader.query.toLowerCase()));
   const selected=curr[reader.index]||curr[0];const selectedIndex=selected?curr.indexOf(selected):0;
   if(!selected&&reader.index!==0)reader.index=0;
   const menu=visible.map(f=>'<button class="sheet227-entry '+(f.i===selectedIndex?'is-active':'')+'" type="button" data-v227-entry="'+f.i+'" aria-pressed="'+(f.i===selectedIndex?'true':'false')+'"><strong>'+S(f.name)+'</strong><small>'+(mode==='class'?'Class feature · Level '+f.level:(f.custom?'DM-granted feat':'Ancestry feat'))+'</small><span aria-hidden="true">›</span></button>').join('');
   const content=selected?'<div class="sheet227-rule-heading"><span class="v2-overline">'+(mode==='class'?S(c.className)+' · Level '+selected.level:(selected.custom?'DM-granted feat':S(c.ancestry)+' · Ancestry feat'))+'</span><h3>'+S(selected.name)+'</h3></div>'+ruleBlocks(selected.html):'<div class="sheet22-empty-features">'+(mode==='class'?'No class abilities have been indexed for this level.':'No feats have been recorded on this character.')+'</div>';
   return '<section class="sheet20-panel sheet227-reader" data-tv259-character="'+S(c.id)+'"><div class="sheet20-panel-heading"><span>CHARACTER SHEET · FEATURES & FEATS</span><span>LEVEL '+Number(c.level||1)+' · '+S(c.className)+'</span></div><h3>Your abilities and feats</h3><p class="sheet20-note">Class abilities, ancestry feats and DM-granted feats are available in the same reader.</p><div class="sheet227-reader-tabs" role="tablist"><button role="tab" aria-selected="'+(mode==='class')+'" data-v227-reader-tab="class">Class abilities <span>'+entries.length+'</span></button><button role="tab" aria-selected="'+(mode==='feats')+'" data-v227-reader-tab="feats">Feats <span>'+feats.length+'</span></button></div><div class="sheet227-reader-body"><aside class="sheet227-reader-index"><label class="v2-overline" for="sheet227-search">FIND '+(mode==='class'?'AN ABILITY':'A FEAT')+'</label><input id="sheet227-search" type="search" placeholder="Search '+(mode==='class'?'abilities and levels':'your recorded feats')+'…" value="'+S(reader.query)+'"><small class="sheet227-reader-count">'+visible.length+' of '+curr.length+' displayed</small><div class="sheet227-reader-entries">'+(menu||'<p class="v2-dim">No matches.</p>')+'</div></aside><article class="sheet227-reader-detail">'+content+'</article></div><footer class="sheet227-reader-footer">'+lnk('/classes/'+String(c.className).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),'Read full '+S(c.className)+' class rules ↗','v2-link')+'<small>Full source rules are referenced here. Resource spending and conditional effects use normal sheet / DM controls.</small></footer></section>'+
    (sheetV224SubclassPanel(c)||'');
 };
 document.addEventListener('click',e=>{
   const tab=e.target.closest('[data-v227-reader-tab]');
   if(tab){window.TerravaleReaderRequestedMode=tab.dataset.v227ReaderTab;e.preventDefault();reader.mode=tab.dataset.v227ReaderTab;reader.index=0;reader.query='';renderPage(false);return}
   const entry=e.target.closest('[data-v227-entry]');
   if(entry){e.preventDefault();reader.index=Number(entry.dataset.v227Entry)||0;renderPage(false);return}
 },true);
 document.addEventListener('input',e=>{if(e.target.id!=='sheet227-search')return; const focused=e.target; reader.query=focused.value;const selection=focused.selectionStart;renderPage(false);const next=document.getElementById('sheet227-search');if(next){next.focus();try{next.setSelectionRange(selection,selection)}catch{}}},true);
 // Preserve the approved core sheet & all existing action handlers. Only rearrange header action controls.
 const oldSheet=renderSheetV220;
 renderSheetV220=function(id){const t=document.createElement('template');t.innerHTML=oldSheet(id);const hero=t.content.querySelector('.sheet226-hero');if(hero){hero.classList.add('sheet227-hero');const controls=hero.querySelector('.sheet226-hero-actions');if(controls){controls.classList.add('sheet227-hero-actions');const btns=[...controls.children];btns.forEach(el=>el.classList.add('sheet227-header-action'));}const copy=hero.querySelector('.sheet20-hero-copy');if(copy){const path=copy.querySelector('.sheet226-pathline');if(path)path.classList.add('sheet227-pathline');}}return t.innerHTML};
 // Grant-level and roster control are IN the DM Chronicle rather than only buried under the character sheet.
 const oldDM=renderDM;
 renderDM=function(){let html=oldDM();const members=activeCharacters();const allowed=db.role==='dm';const rows=members.length?members.map(c=>'<div class="sheet227-dm-row"><div><strong>'+S(c.name)+'</strong><small>'+S(c.owner||'Unassigned player')+' · '+S(c.ancestry)+' / '+S(c.className)+' · Level '+Math.max(1,Number(c.level)||1)+' · '+S(c.status)+'</small></div><div class="sheet227-dm-actions">'+lnk('/characters/'+encodeURIComponent(c.id),'View sheet','btn ghost small')+(allowed?'<button type="button" class="btn ghost small" data-v227-player="'+S(c.id)+'">Manage player</button><button type="button" class="btn primary small" data-v227-level="'+S(c.id)+'">Grant level / HP</button>':'')+'</div></div>').join(''):'<div class="sheet22-empty-features">No characters in this campaign yet.</div>';
 const addition='<section class="v2-section sheet227-dm-section" id="dm-campaign-management"><div class="sheet227-dm-head"><div><span class="v2-overline">CAMPAIGN CONTROL · OFFLINE</span><h2>Players & level management</h2><p>Manage characters in '+S(campaignName())+'. Grant levels, adjust the linked character’s maximum HP, or review player assignments.</p></div><div class="sheet227-dm-links">'+lnk('/campaigns/'+encodeURIComponent(db.campaign),'Campaign roster →','btn ghost small')+lnk('/characters','All character sheets','btn ghost small')+'</div></div>'+(allowed?'<div class="sheet227-dm-notice">Changes are saved only in this offline preview. This is not connected to live campaign accounts.</div>':'<div class="sheet227-dm-notice">Switch the preview to <strong>DM mode</strong> to enable management controls.</div>')+'<div class="sheet227-dm-rows">'+rows+'</div></section>';
 return html.replace('<div class="v2-layout v2-section">',addition+'<div class="v2-layout v2-section">');
 };
 function managePlayer(c,trigger){modal('Manage player · '+c.name,'Preview only · change the player label, approval state, or campaign for this character.',`<form id="sheet227-player-form"><input type="hidden" name="id" value="${S(c.id)}"><label class="v2-field">Assigned player / display name<input name="owner" maxlength="90" value="${S(c.owner||'')}"></label><label class="v2-field">Approval status<select name="status"><option ${c.status==='Approved'?'selected':''}>Approved</option><option ${c.status==='Pending'?'selected':''}>Pending</option></select></label><label class="v2-field">Campaign<select name="campaign">${db.campaigns.map(x=>`<option value="${S(x.id)}" ${x.id===c.campaign?'selected':''}>${S(x.name)}</option>`).join('')}</select></label><div class="v2-actions"><button class="btn primary" type="submit">Save player assignment</button></div></form>`,trigger);}
 document.addEventListener('click',e=>{const lv=e.target.closest('[data-v227-level]'),player=e.target.closest('[data-v227-player]');if(!lv&&!player)return;e.preventDefault();e.stopImmediatePropagation();if(db.role!=='dm'){toast('Switch to DM mode first.');return}const id=(lv||player).dataset[lv?'v227Level':'v227Player'];const c=db.characters.find(x=>String(x.id)===String(id));if(!c)return;if(lv)window.TERRAVALE_V228_GRANT(c,lv);else managePlayer(c,player);},true);
 document.addEventListener('submit',e=>{if(e.target.getAttribute('id')!=='sheet227-player-form')return;e.preventDefault();e.stopImmediatePropagation();if(db.role!=='dm')return;const v=new FormData(e.target),c=db.characters.find(x=>String(x.id)===String(v.get('id')));if(!c)return;c.owner=String(v.get('owner')||'').trim().slice(0,90)||'Unassigned';c.status=String(v.get('status'))==='Pending'?'Pending':'Approved';const to=String(v.get('campaign')||'');if(db.campaigns.some(x=>x.id===to))c.campaign=to;persist();closeModal();renderPage(false);toast('Offline player assignment saved');},true);
 // HP method roll: never require a separate Roll Now button. One result per chosen level/method.
 v226UpdateHPForm=function(){const f=document.getElementById('sheet226EditForm');if(!f)return;const target=Math.max(1,Math.min(20,Number(f.elements.targetLevel.value)||1));const base=Number(f.dataset.current)||1;const n=Math.max(0,target-base);const die=Number(f.dataset.die)||8;const mod=Number(f.dataset.mod)||0;const method=f.elements.hpMethod.value;const out=f.querySelector('[data-v226-preview]');const button=f.querySelector('[data-v226-roll]');if(button){button.hidden=true;button.remove()}
   f.dataset.gainCount=String(n);
   if(!n){out.innerHTML='<strong>No level increase</strong><small>Choose a higher level to calculate your HP increase.</small>';return}
   if(method==='fixed'){const baseVal=Math.floor(die/2)+1;const each=Math.max(1,baseVal+mod);out.innerHTML='<strong>+'+(n*each)+' maximum HP · Fixed</strong><small>'+n+' level'+(n===1?'':'s')+' × ('+baseVal+' fixed + '+mod+' CON), minimum 1 HP per level.</small>';return}
   if(Number(f.dataset.rolledCount)!==n||f.dataset.rolledMethod!=='roll'||f.dataset.rolledGain==null){const rolled=Array.from({length:n},()=>Math.floor(Math.random()*die)+1),gain=rolled.reduce((s,x)=>s+Math.max(1,x+mod),0);f.dataset.rolledCount=String(n);f.dataset.rolledMethod='roll';f.dataset.rolledGain=String(gain);f.dataset.rolledDetail=rolled.map(x=>'d'+die+': '+x).join(' · ')}
   out.innerHTML='<strong>+'+S(f.dataset.rolledGain)+' maximum HP · Automatically rolled</strong><small>'+S(f.dataset.rolledDetail)+' · CON '+(mod>=0?'+':'')+mod+' each level · Result retained until level changes.</small>';
 };
 const oldEdit=v226Edit;v226Edit=function(c,trigger){oldEdit(c,trigger);const f=document.getElementById('sheet226EditForm');if(f){const btn=f.querySelector('[data-v226-roll]');if(btn)btn.remove();const a=f.querySelector('.sheet226-edit-fields');if(a)a.classList.add('sheet227-edit-fields');const hp=f.querySelector('.sheet226-hp');if(hp)hp.classList.add('sheet227-hp');v226UpdateHPForm()}};
 const baseRenderV227=renderPage;
 renderPage=function(...args){const result=baseRenderV227(...args);document.title=document.title.replace(/V2\.26/g,'V2.27');return result};
 persist();renderPage(false);
})();

