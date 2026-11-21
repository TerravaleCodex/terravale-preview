/* Terravale Codex V2.29 — targeted changes to the approved V2.28 offline build.
   DM grants ONE pending level. Player completes choices/HP inside their sheet.
   Purely local demo state, no live campaign authentication or API changes. */
(function () {
 'use strict';
 const E = x => safe(String(x == null ? '' : x));
 const current = c => Math.max(1, Math.min(20, Math.floor(Number(c.level) || 1)));
 const own = c => !!c && (db.role === 'dm' || c.owner === 'You');
 const pending = c => c?.v229Pending && c.v229Pending.toLevel === current(c) + 1 ? c.v229Pending : null;
 const src = c => v226Class(c.className);
 const hitDie = c => Math.max(4, Math.min(20, Number(src(c)?.stats?.['Hit die']?.match(/d\s*(\d+)/i)?.[1]) || Number(sheetV220Meta(c)?.die) || 8));
 const conMod = c => Math.floor(((Number(c.con) || 10)-10)/2);
 const statNames = [['str','Strength'],['dex','Dexterity'],['con','Constitution'],['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']];
 const skillNames = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
 const spiritNatures=['Ember','River','Stone','Hunt','Hearth','Grave','Grove','Storm','Veil','Memory','Moon'];
 const shamanRites=['Read the Trace','Invite the Local','Threshold Ward','Quiet the Haunting','Cleanse Spiritual Contamination','Prepare the Dead','Dream Shelter','Omen Casting','Binding Circle','Spirit Lantern','Soothe the Possessed','Road of Safe Return'];
 let wizard=null;
 function featureText(html,max=530) {
  const t=document.createElement('template');t.innerHTML=v226Sanitize(html||'');
  let val=(t.content.textContent||'').replace(/\s+/g,' ').trim().replace(/^((level|lv)\s*\d+[\s—–.:]*)/i,'');
  if(!val||/complete rules text.*not|listed in the published progression/i.test(val))return 'Open the class reference to read its full effect and requirements.';
  return val.length>max?val.slice(0,max).replace(/\s+\S*$/,'')+'…':val;
 }
 function sourceExcerpt(source,name,max=530){
  if(!source?.html)return '';
  const fragment=document.createElement('template');fragment.innerHTML=v226Sanitize(source.html);
  const normalize=x=>String(x||'').toLowerCase().replace(/\b(level|lv)\s*\d+\b/gi,'').replace(/[^a-z0-9]/g,'');
  const target=normalize(String(name||'').replace(/\(level\s*\d+\)/gi,''));
  if(target.length<4)return '';
  for(const node of fragment.content.querySelectorAll('p,h2,h3,h4')){
    const txt=(node.textContent||'').replace(/\s+/g,' ').trim();
    const leading=txt.split(/[—–:]/)[0].trim();
    const norm=normalize(leading);
    if(norm===target||(norm.length>4&&target.startsWith(norm))||(target.length>4&&norm.startsWith(target))){
      if(txt.length<50)continue;
      return txt.length>max?txt.slice(0,max).replace(/\s+\S*$/,'')+'…':txt;
    }
  }
  return '';
 }
 function levelInfo(c,lev){
  const source=src(c),p=source?.progression?.levels?.find(x=>Number(x.level)===lev),cells=p?.cells||[];
  const featureCell=cells[1]?.trim()?.startsWith('+')?cells[2]:cells[1];
  const rows=v226Features(c.className,lev).find(x=>x.level===lev)?.features||[];
  const summary=(featureCell||'').trim();
  const names=summary.split(/\s*,\s*/).filter(Boolean);
  const features=[];
  const seen=new Set();
  for(const row of rows){const norm=row.name.toLowerCase().replace(/\s*[-—–]\s*(level|lv)\s*\d+/gi,'').replace(/\s*\(level\s*\d+\)/gi,'').trim();if(!seen.has(norm)){seen.add(norm);{const fromFeature=featureText(row.html),fromSource=sourceExcerpt(source,row.name);features.push({name:row.name,description:/Open the class reference to read its full effect/.test(fromFeature)&&fromSource?fromSource:fromFeature})}}}
  for(const name of names){if(/^(—|-|none)$/i.test(name))continue;const norm=name.toLowerCase();if(!features.some(x=>x.name.toLowerCase().includes(norm)||norm.includes(x.name.toLowerCase().split(' — ')[0]))){features.push({name,description:/feat\s*\/\s*asi|ability score improvement/i.test(name)?'At this milestone choose an Ability Score Improvement (+2 to one score, or +1 to two different scores; maximum 20) OR one eligible feat. The selections are mutually exclusive.':sourceExcerpt(source,name)||'This feature is listed at this level in the published class progression. Its individual rule text is not separately indexed; open the class article for the complete passage.'})}}
  return {source,summary,features};
 }
 function subclassAt(c) {
  const source=src(c), opts=v226SpecOptions(c);
  if(!opts.length||v226SpecName(c))return false;
  const pages=source?.progression?.levels||[];
  const rx=/(?:archetype|tradition|specialist|discipline|domain|college|circle|oath|patron|origin|path|school|subclass|speciali[sz]ation|monastic tradition|martial arts tradition|primal path)/i;
  const isSubclass=(txt)=>rx.test(txt)&&!/feature(?:s)?\s*$/i.test(txt);
  const first=pages.find(row=>{const t=row.cells?.[1]?.startsWith('+')?row.cells?.[2]:row.cells?.[1];return t&&isSubclass(t)&&!/^bloodforger$/i.test(c.className)});
  return first?Math.max(1,Number(first.level)):null;
 }
 function newRite(c,to) {
  if(c.className!=='Shaman')return false;
  const levels=src(c)?.progression?.levels||[];
  const cnt=lev=>Number((levels.find(x=>Number(x.level)===lev)?.cells||[]).at(-1))||0;
  return cnt(to)>cnt(to-1);
 }
 function newBond(c,to) {return c.className==='Shaman' && [5,11,17].includes(to)}
 function checkSkillChoice(info) {return info.features.some(x=>/expertise|skill proficiency|skill choice|choose (?:one|a|two) skill/i.test(x.name+' '+x.description))}
 function skillSlots(c,to,info){return c.className==='Rogue'&&to===6?2:(checkSkillChoice(info)?1:0)}
 function needsASI(info){return /feat\s*\/\s*asi|ability score improvement|\bASI\b/i.test(info.summary)}
 function v230FeatChoices(c,level){
   const all=TVR?.manifest?.feats||[];
   const choices=all.filter(f=>f.ancestry===String(c.ancestry||'').toLowerCase()||(f.ancestry==='elf'&&['Elf','Kharithen','Thalassari','Flugel'].includes(c.ancestry)));
   return choices.map(f=>({ ...f,eligibility:TVR.featCheck(f.id,c.ancestry,level,c.classification||'',c.stage||1)}));
 }
 function v230SourceDetails(f){
   const raw=window.TERRAVALE_V225_FEATS?.[f.id]||'';
   const plain=raw.replace(/^[*#>-]+\s*/gm,'').replace(/\*\*/g,'').replace(/`/g,'').replace(/\s+/g,' ').trim();
   return plain.length>300?plain.slice(0,300).replace(/\s+\S*$/,'')+'…':plain||f.prerequisites||'See the imported feat reference.';
 }
 function v230ChoiceCard(kind,value,title,brief,chosen,disabled=false,extra=''){
   return `<button type="button" class="v230-choice-card ${chosen?'selected':''}" data-v230-pick="${E(kind)}" data-v230-value="${E(value)}" aria-pressed="${chosen}" ${disabled?'disabled':''}><span class="v230-choice-marker">${chosen?'✓':'○'}</span><span><strong>${E(title)}</strong><small>${E(brief)}</small>${extra?`<em>${E(extra)}</em>`:''}</span></button>`;
 }
 function v230ChoiceInfo(c,name){
   const match=src(c)?.options?.find(o=>o.name===name);
   if(!match)return '';
   const t=document.createElement('template');t.innerHTML=v226Sanitize(match.html||'');
   return (t.content.textContent||'').replace(/\s+/g,' ').trim().slice(0,370);
 }
 function v230Stats(c,choices,slot){
   return `<div class="v230-stat-grid" role="group" aria-label="Select ${slot===1?'first':'second'} ability">${statNames.map(([id,title])=>{
     const score=Number(c[id])||10,other=choices[slot===1?'stat2':'stat1'];
     const limit=(slot===1&&choices.scoreMode==='plus2')?2:1;
     const unavailable=score+limit>20||(choices.scoreMode==='split'&&other===id);
     return v230ChoiceCard('stat'+slot,id,`${title} · ${score}`,`+${limit} → ${score+limit}`,choices['stat'+slot]===id,unavailable);
   }).join('')}</div>`;
 }
 function v230FeatPanel(c,level,choices){
   const feats=v230FeatChoices(c,level),chosen=feats.find(f=>f.id===choices.feat),eligible=feats.filter(f=>f.eligibility.status!=='blocked');
   return `<div class="v230-feat-picker"><label class="v2-overline" for="v230-feat-query">BROWSE AVAILABLE FEATS</label><input type="search" id="v230-feat-query" placeholder="Find a feat, effect or requirement…" autocomplete="off"><div class="v230-feat-list" role="group" aria-label="Choose a feat">${feats.map(f=>{
     const blocked=f.eligibility.status==='blocked';
     return `<button type="button" data-v230-pick="feat" data-v230-value="${E(f.id)}" data-v230-feat-search="${E((f.name+' '+f.prerequisites+' '+v230SourceDetails(f)).toLowerCase())}" aria-pressed="${choices.feat===f.id}" class="v230-feat-entry ${choices.feat===f.id?'selected':''}" ${blocked?'disabled':''}><strong>${E(f.name)}</strong><small>${E(f.prerequisites)}</small><span>${blocked?'Unavailable':f.eligibility.status==='review'?'DM confirmation':'Eligible to propose'}</span></button>`;
   }).join('')||'<p>No feat entries were found for this ancestry.</p>'}</div>${chosen?`<div class="v230-feat-preview"><span class="v2-overline">YOUR SELECTED FEAT</span><h4>${E(chosen.name)}</h4><p>${E(v230SourceDetails(chosen))}</p><small>${E(chosen.eligibility.detail)}</small>${chosen.bonus?.length?`<div class="v230-feat-ability"><strong>Feat-granted +1 ability</strong><p>Pick the eligible ability for the feat’s explicit increase.</p><div class="v230-pick-grid">${chosen.bonus.map(id=>v230ChoiceCard('featAbility',id,`${id.toUpperCase()} +1`,`Current ${Number(c[id.toLowerCase()])||10}`,choices.featAbility===id,Number(c[id.toLowerCase()])>=20)).join('')}</div></div>`:''}</div>`:''}</div>`;
 }
 function v230FeatureCard(c,feature){
   const name=feature.name.replace(/\s+[-—–]\s+level\s+\d+$/i,'');
   const asi=/feat\s*\/\s*asi|ability score improvement|^asi$/i.test(name);
   const desc=asi?'Choose an Ability Score Improvement (+2 to one score, or +1 to two different scores, maximum 20), or select one eligible feat instead. You do not take both.':feature.description;
   const html=src(c)?.featureByLevel?.[String(wizard?.step===0?pending(c)?.toLevel:current(c))]?.find(x=>x.name===feature.name)?.html;
   const t=document.createElement('template');t.innerHTML=v226Sanitize(html||'');
   const hasText=(t.content.textContent||'').replace(/\s+/g,' ').trim().length>150;
   return `<article class="v229-new-feature v230-feature-card"><span class="v2-overline">${asi?'ADVANCEMENT CHOICE':'CLASS FEATURE'}</span><h4>${E(name)}</h4><p>${E(desc)}</p>${!asi&&hasText?`<details class="v230-exact-rules"><summary>Read published feature text</summary><div>${v226Sanitize(html)}</div></details>`:''}</article>`;
 }

 function v233FeatureBrief(c,f){
   const name=String(f.name||'').replace(/\s+[-—–]\s+level\s+\d+$/i,'');
   const raw=String(f.description||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
   let text=raw;
   if(/clauses\s*\(level\s*\d+\)|adept clauses|fundamental clauses/i.test(name))text='New clause tier unlocked. Your class reference contains the full list; these are not automatically individual selections.';
   else if(c.className==='Seal-Maintainer'&&name==='Extra Attack')text='When you take the Attack action, you make two attacks rather than one.';
   else if(c.className==='Seal-Maintainer'&&name==='Sealcraft in Motion')text='Replace one attack with creating a Field Seal, repairing Integrity, moving an eligible Anchor, switching a seal active or dormant, or dismissing a seal.';
   else if(/This feature is listed at this level|Open the class reference to read its full effect/i.test(text)){
     const t=document.createElement('template');t.innerHTML=v226Sanitize(src(c)?.html||'');
     const needle=name.toLowerCase().replace(/\(level\s*\d+\)/gi,'').trim();
     const found=[...t.content.querySelectorAll('p,li')].find(el=>{
       const v=el.textContent?.replace(/\s+/g,' ').trim().toLowerCase()||'';
       return v.slice(0,120).includes(needle)&&v.length>needle.length+25;
     });
     if(found){let v=(found.textContent||'').replace(/\s+/g,' ').replace(/^\d+\s*[—–-]\s*/,'').trim();const idx=v.indexOf('. ');if(v.length>220&&idx>75&&idx<235)v=v.slice(0,idx+1);text=v.length>220?v.slice(0,207).replace(/\s+\S*$/,'')+'…':v;}
     else text='Feature gained at this level. The class article provides the complete mechanics.';
   }
   else if(text.length>220){const cut=text.slice(0,221);const stop=cut.lastIndexOf('. ');text=(stop>85?cut.slice(0,stop+1):cut.slice(0,191).replace(/\s+\S*$/,'')+'…');}
   return `<article class="v229-new-feature v233-discovery-card"><span class="v2-overline">CLASS FEATURE</span><h4>${E(name)}</h4><p>${E(text)}</p></article>`;
 }
 function canStart(c){return own(c)&&!!pending(c)}
 // The previous V2.28 button automatically increased level + HP before any player decision.
 // Replace ONLY that hook; the underlying V2.27 DM click handler still calls it.
 window.TERRAVALE_V228_GRANT=function(c){
   if(db.role!=='dm'){toast('DM access required.');return;}
   if(!c||c.campaign!==db.campaign){toast('Choose a character in this campaign.');return;}
   if(current(c)>=20){toast('Already level 20.');return;}
   if(pending(c)){toast(c.name+' already has a level waiting to be completed.');return;}
   c.v229Pending={id:key('advance'),fromLevel:current(c),toLevel:current(c)+1,issuedAt:new Date().toISOString(),roll:null,completed:false};
   persist();renderPage(false);toast('Level '+(current(c)+1)+' awarded to '+c.name+' — ready to complete in their sheet.');
 };

 // Direct DM Chronicle controls: replace the misleading View characters shortcut.
 const oldDM=renderDM;
 renderDM=function(){
   const t=document.createElement('template');t.innerHTML=oldDM();
   const hero=t.content.querySelector('.v2-hero .v2-actions');
   if(hero){const link=document.createElement('button');link.type='button';link.className='btn primary v229-dm-jump';link.dataset.v229Jump='manage';link.textContent='Players & level management ↓';hero.prepend(link);}
   const section=t.content.querySelector('#dm-campaign-management');
   if(section){
     section.setAttribute('tabindex','-1');
     const desc=section.querySelector('.sheet227-dm-head p');if(desc)desc.textContent='Grant one new level per character. The character’s sheet guides the player through the choices and HP before the level becomes active.';
     const oldMethod=section.querySelector('.sheet228-grant-method');if(oldMethod)oldMethod.remove();
     const not=section.querySelector('.sheet227-dm-notice');if(not&&db.role==='dm')not.textContent='Awarded levels appear on the player’s ledger and character sheet until completed.';
     for(const b of section.querySelectorAll('[data-v227-level]')){
       const c=db.characters.find(x=>String(x.id)===b.dataset.v227Level);
       if(!c)continue;
       b.textContent=pending(c)?'Level up pending':'Grant +1 level';
       b.disabled=!!pending(c)||current(c)>=20;
       if(pending(c)){b.title='Complete the awarded level on the character sheet before granting another.';b.classList.add('v229-disabled');}
       const row=b.closest('.sheet227-dm-row'),meta=row?.querySelector('small');
       if(pending(c)&&meta)meta.insertAdjacentHTML('beforeend',`<span class="v229-ready-inline"> · Level ${pending(c).toLevel} ready</span>`);
     }
   }
   return t.innerHTML;
 };
 document.addEventListener('click',e=>{
   const jump=e.target.closest('[data-v229-jump="manage"]');
   if(!jump)return;e.preventDefault();e.stopImmediatePropagation();
   if(route()!=='/dm'){navigate('/dm');requestAnimationFrame(()=>document.getElementById('dm-campaign-management')?.scrollIntoView({block:'start',behavior:'smooth'}));}
   else {const s=document.getElementById('dm-campaign-management');s?.scrollIntoView({block:'start',behavior:'smooth'});s?.focus({preventScroll:true});}
 },true);

 // Featured character selection: up to three, never hide the remaining ledger.
 db.v229Featured ??={};
 function featuredIds(){
   const old=db.featuredCharacters?.[db.campaign];
   const list=db.v229Featured[db.campaign];
   if(!Array.isArray(list)){const first=old||activeCharacters().find(c=>c.owner==='You')?.id||activeCharacters()[0]?.id;db.v229Featured[db.campaign]=first?[first]:[];return db.v229Featured[db.campaign]}
   return list;
 }
 function notify(c){const p=pending(c);if(!p)return '';
   return `<div class="v229-notice"><span class="v229-notice-dot" aria-hidden="true">✦</span><div><strong>Level ${p.toLevel} available</strong><span>New abilities, choices and HP are ready to review.</span></div>${own(c)?`<a href="#/characters/${encodeURIComponent(c.id)}" data-v229-from-ledger="${E(c.id)}" class="v229-notice-link">Complete in sheet →</a>`:''}</div>`;
 }
 function addLedgerNotice(el,c){
   if(!el||!c)return;
   const notice=notify(c);if(notice){const anchor=el.querySelector('.ledger-feature-stats,.ledger-card-vitals,.ledger-card-bottom');(anchor||el).insertAdjacentHTML('beforebegin',notice);el.classList.add('v229-has-levelup');}
   const ownable=c.owner==='You'||db.role==='dm';
   let action=el.querySelector('[data-action="ledgerFeature"]');
   if(!action&&ownable){const end=el.querySelector('.ledger-actions,.ledger-card-bottom');if(end){action=document.createElement('button');end.appendChild(action);action.dataset.action='ledgerFeature';action.dataset.id=c.id;action.className='btn ghost small v229-feature-toggle';}}
   if(action){const isPinned=featuredIds().includes(c.id);action.innerHTML=isPinned?'★ Unfeature':'☆ Feature';action.setAttribute('aria-pressed',String(isPinned));action.classList.add('v229-feature-toggle');if(!isPinned&&featuredIds().length>=3){action.disabled=true;action.title='Unfeature one of your three featured characters first.';}}
 }
 const oldLedger=renderCharacters;
 renderCharacters=function(){
   const t=document.createElement('template');t.innerHTML=oldLedger();
   const all=activeCharacters(),matches=all.filter(ledgerMatch),saved=featuredIds().filter(id=>all.some(x=>x.id===id));
   if(saved.length!==featuredIds().length)db.v229Featured[db.campaign]=saved;
   const chosen=saved.map(id=>matches.find(x=>x.id===id)).filter(Boolean);
   const currentHero=t.content.querySelector('.ledger-feature-wrap');
   const heroId=currentHero?.querySelector('[data-ledger-id]')?.dataset.ledgerId;
   const fallback=matches.find(x=>x.id===heroId)||matches[0];
   const shown=chosen.length?chosen:(fallback?[fallback]:[]);
   const top=shown[0];
   if(currentHero&&top){
     currentHero.innerHTML=ledgerCard(top,true);
     addLedgerNotice(currentHero.querySelector('.ledger-feature'),top);
     if(shown.length>1){const ex=document.createElement('div');ex.className='v229-featured-extras';shown.slice(1,3).forEach(c=>{const b=document.createElement('div');b.innerHTML=ledgerCard(c);const card=b.firstElementChild;card.classList.add('v229-featured-card');addLedgerNotice(card,c);ex.append(card);});currentHero.appendChild(ex);}
     const intro=document.createElement('div');intro.className='v229-featured-caption';intro.innerHTML=`<div><span class="v2-overline">FEATURED CHARACTERS · ${saved.length}/3</span><span>Choose up to three. All other characters remain below.</span></div>`;currentHero.prepend(intro);
   }
   const other=matches.filter(c=>!shown.some(f=>f.id===c.id));
   const roster=t.content.querySelector('.ledger-roster');
   if(roster){roster.innerHTML=other.map(c=>ledgerCard(c)).join('')||'<div class="ledger-only"><strong>No other characters in this view.</strong></div>';roster.querySelectorAll('[data-ledger-id]').forEach(el=>addLedgerNotice(el,other.find(c=>c.id===el.dataset.ledgerId)));}
   const head=t.content.querySelector('.ledger-list-head');if(head)head.innerHTML=`<span class="v2-overline">THE REST OF YOUR CHAPTER</span><span>${other.length} additional ${other.length===1?'record':'records'}</span>`;
   const links=t.content.querySelector('.ledger-heading-links');if(links&&db.role==='dm'){const l=document.createElement('a');l.href='#/dm';l.className='btn ghost';l.textContent='Manage players & levels ↗';links.append(l);}
   return t.innerHTML;
 };
 document.addEventListener('click',e=>{
   const b=e.target.closest('[data-action="ledgerFeature"]');if(!b)return;
   e.preventDefault();e.stopImmediatePropagation();
   const c=db.characters.find(x=>x.id===b.dataset.id&&x.campaign===db.campaign);
   if(!c||!(c.owner==='You'||db.role==='dm'))return;
   const ids=featuredIds(),i=ids.indexOf(c.id);
   if(i>=0){ids.splice(i,1);toast(c.name+' unfeatured.');}
   else if(ids.length<3){ids.push(c.id);toast(c.name+' featured ('+ids.length+'/3).');}
   else{toast('Three featured characters maximum. Unfeature one first.');return}
   db.v229Featured[db.campaign]=ids;db.featuredCharacters??={};db.featuredCharacters[db.campaign]=ids[0]||'';
   persist();renderPage(false);
 },true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-v229-from-ledger]');if(b)window.v229OpenOnSheet=b.dataset.v229FromLedger;},true);

 // A level becomes active only after the player completes the corresponding award.
 const oldSheet=renderSheetV220;
 renderSheetV220=function(id){
   const c=db.characters.find(x=>String(x.id)===String(id));
   const t=document.createElement('template');t.innerHTML=oldSheet(id);
   if(!c)return t.innerHTML;
   const p=pending(c);
   if(p){
     const top=t.content.querySelector('.sheet226-hero');
     if(top){const banner=document.createElement('section');banner.className='v229-sheet-level-banner';banner.innerHTML=`<div><span class="v2-overline">NEW CHAPTER UNLOCKED</span><h3>Level ${p.toLevel} is ready</h3><p>Your DM has awarded your next level. Review what changes and choose your advancement before it becomes active.</p></div>${own(c)?`<button type="button" class="btn primary" data-v229-start="${E(c.id)}">Complete level up →</button>`:''}`;top.after(banner);}
   }
   // Remove redundant warnings from the restricted Edit Character form; player permissions remain unchanged.
   return t.innerHTML;
 };

 const oldEdit=v226Edit;
 v226Edit=function(c,trigger){oldEdit(c,trigger);const form=document.getElementById('sheet228-profile-form');if(form){const lock=form.querySelector('.sheet228-profile-lock');if(lock)lock.remove();form.querySelectorAll('.sheet226-source-note').forEach(n=>n.remove());}}

 function renderWizard(){
   if(!wizard)return;
   const c=db.characters.find(x=>x.id===wizard.id),p=pending(c);
   if(!p){closeWizard();return;}
   const info=levelInfo(c,p.toLevel),step=wizard.step;
   const choiceSub=!!(v226SpecOptions(c).length&&subclassAt(c)!=null&&p.toLevel>=subclassAt(c)&&!v226SpecName(c));
   const skills=skillSlots(c,p.toLevel,info),asi=needsASI(info),rite=newRite(c,p.toLevel),bond=newBond(c,p.toLevel);
   const choices=wizard.choices;
   const phases=choiceSub?['discover','specialisation','choices','hp','finish']:['discover','choices','hp','finish'];
   const phase=phases[step]||'finish';
   const footer='<footer class="v229-wizard-footer"><button class="btn ghost" type="button" data-v229-cancel>Save for later</button><div class="v229-wizard-next">'+(step>0?'<button class="btn ghost" type="button" data-v229-back>Back</button>':'')+(step<phases.length-1?'<button class="btn primary" type="button" data-v229-next>Continue →</button>':'<button class="btn primary" type="button" data-v229-finish>Finish level up</button>')+'</div></footer>';
   let body='';
   if(phase==='discover'){
     const discovery=info.features.filter(f=>!/^(?:feat\s*\/\s*asi|asi|ability score improvement|evolution|major evolution)$/i.test(f.name.replace(/^\d+(?:st|nd|rd|th)\s*[—-]\s*/,'')));
     const cards=discovery.length?discovery.map(f=>v233FeatureBrief(c,f)).join(''):'<article class="v229-new-feature"><h4>Continue your class progression</h4><p>This level has no separately indexed new class feature. Existing abilities continue to develop.</p></article>';
     body=`<div class="v229-wizard-intro"><span class="v2-overline">${E(c.className)} · LEVEL ${p.toLevel}</span><h3>Here’s what’s new</h3><p>At this level you unlock the abilities shown below. Select “Read published feature text” for the exact imported rules where available. Any choices will be made on the next step.</p></div><div class="v229-feature-grid">${cards}</div>`;
   }
   if(phase==='specialisation'){
     const opts=v226SpecOptions(c),srcDoc=src(c);
     body=`<div class="v229-wizard-intro"><span class="v2-overline">${E(c.className)} · SPECIALISATION</span><h3>Choose your path</h3><p>Choose one path to shape your class. Read its description here, with full level-by-level mechanics available in the class reference.</p></div><div class="v232-sub-select"><div class="v232-sub-choices">${opts.map(o=>v230ChoiceCard('subclass',o,o,'',choices.subclass===o)).join('')}</div><div class="v232-sub-description"><span class="v2-overline">SELECTED SPECIALISATION</span><h4>${E(choices.subclass||'Choose a path')}</h4><p>${E(choices.subclass?v230ChoiceInfo(c,choices.subclass).slice(0,160).replace(/\s+\S*$/,'')+'…':'Select an option to see its defining theme. Complete mechanics stay in the class reference.')}</p><a href="#/classes/${E(c.className.toLowerCase().replace(/[^a-z0-9]+/g,'-'))}" target="_self">Open full class reference ↗</a></div></div>`;
   }
   if(phase==='choices'){
     let blocks='';
     if(bond)blocks+=`<section class="v229-choice"><h4>A new spirit bond</h4><p>Choose a spirit nature. The particular spirit you encounter and the bond you form remain part of the story.</p><div class="v230-pick-grid">${spiritNatures.map(n=>v230ChoiceCard('bond',n,n,'Spirit nature',choices.bond===n)).join('')}</div></section>`;
     if(rite)blocks+=`<section class="v229-choice"><h4>Select a Shaman rite</h4><p>Your new rite becomes available at this level. Read each rite’s detailed effect in your class reference.</p><div class="v230-choice-list">${shamanRites.filter(r=>p.toLevel>=13||r!=='Road of Safe Return').map(r=>v230ChoiceCard('rite',r,r,sourceExcerpt(src(c),r,190)||'Rite available at this level',choices.rite===r)).join('')}</div></section>`;
     if(skills){blocks+=`<section class="v229-choice"><h4>Skill or expertise choice</h4><p>Choose ${skills>1?'two different skills':'a skill'} for the feature unlocked at this level. Existing proficiencies still matter; this selection will be recorded for the DM.</p><div class="v230-stat-title">${skills>1?'First skill':'Skill choice'}</div><div class="v230-pick-grid">${skillNames.map(x=>v230ChoiceCard('skill',x,x,'',choices.skill===x)).join('')}</div>${skills>1?`<div class="v230-stat-title">Second skill</div><div class="v230-pick-grid">${skillNames.map(x=>v230ChoiceCard('skill2',x,x,'',choices.skill2===x,x===choices.skill)).join('')}</div>`:''}</section>`;}
     if(asi){
       blocks+=`<section class="v229-choice v230-asi-choice"><h4>Ability Score Improvement or Feat</h4><p>This is <strong>one</strong> advancement choice. Increasing ability scores and selecting a feat are alternatives, not two requirements.</p><div class="v230-mode-grid">${v230ChoiceCard('asi','asi','Ability Score Improvement','Increase one score by 2 OR two different scores by 1. Maximum 20.',choices.asi==='asi')}${v230ChoiceCard('asi','feat','Choose a feat','Select an eligible published feat. See its prerequisites and effects.',choices.asi==='feat')}</div>`;
       if(choices.asi==='asi'){
         blocks+=`<div class="v230-asi-details"><h5>How will you increase your scores?</h5><div class="v230-mode-grid">${v230ChoiceCard('scoreMode','plus2','+2 to one ability','A single increase, maximum score 20.',choices.scoreMode!=='split')}${v230ChoiceCard('scoreMode','split','+1 to two different abilities','Choose two scores, maximum 20 each.',choices.scoreMode==='split')}</div><h5>${choices.scoreMode==='split'?'Choose your first +1':'Choose the ability for +2'}</h5>${v230Stats(c,choices,1)}${choices.scoreMode==='split'?`<h5>Choose your second +1</h5>${v230Stats(c,choices,2)}`:''}</div>`;
       } else if(choices.asi==='feat'){
         blocks+=v230FeatPanel(c,p.toLevel,choices);
       }
       blocks+='</section>';
     }
     if(c.className==='Summoner'&&[7,13].includes(p.toLevel)){
       const major=p.toLevel===13;const list=window.TERRAVALE_V232_CATALOG?.[major?'major':'normal']||[];
       blocks+=`<section class="v229-choice v232-evolution-pick"><h4>${major?'Major':'Normal'} Evolution</h4><p>Choose a permanent ${major?'major':'normal'} evolution for your Eidolon. These are the published choices and effects, not placeholders.</p><div class="v232-catalog-tiles">${list.map(o=>v230ChoiceCard('evolution',o.name,o.name,o.effect,choices.evolution===o.name)).join('')}</div></section>`;
     }
     if(c.className==='Bloodforger'&&p.toLevel>=3)blocks+=`<section class="v229-choice"><h4>Bloodforger disciplines</h4><p>Discipline Points and crowns are spent in the Bloodforger tree interface, not through a generic subclass picker. Your new level will be reflected there.</p></section>`;
     body=`<div class="v229-wizard-intro"><h3>Choose your advancement</h3><p>Each card describes what you are selecting. The next step appears once every required choice for this level is complete.</p></div>${blocks||'<div class="v229-choice"><strong>No new choices required.</strong><p>Continue to your Hit Points.</p></div>'}`;
   }
   const die=hitDie(c),mod=conMod(c),fixed=Math.max(1,Math.floor(die/2)+1+mod),val=wizard.method==='fixed'?fixed:p.roll?Math.max(1,p.roll.face+mod):null;
   if(phase==='hp')body=`<div class="v229-wizard-intro"><h3>Hit Points at level ${p.toLevel}</h3><p>Pick the fixed increase or an automatic d${die} roll. If you roll, the first result is saved immediately and cannot be rerolled.</p></div><div class="v229-hp-options"><label class="${wizard.method==='fixed'?'selected':''}"><input type="radio" name="v229-hp" value="fixed" ${wizard.method==='fixed'?'checked':''}><strong>Fixed average</strong><span>${Math.floor(die/2)+1} ${mod>=0?'+':'−'} ${Math.abs(mod)} CON</span></label><label class="${wizard.method==='roll'?'selected':''}"><input type="radio" name="v229-hp" value="roll" ${wizard.method==='roll'?'checked':''}><strong>Roll d${die}</strong><span>Automatic · one saved result</span></label></div><div class="v229-roll-result"><span class="v2-overline">MAXIMUM HP INCREASE</span><strong>+${val??'—'} HP</strong><p>${wizard.method==='roll'&&p.roll?`d${die} result <b>${p.roll.face}</b> ${mod>=0?'+':'−'} ${Math.abs(mod)} CON · minimum 1`:`Fixed ${Math.floor(die/2)+1} ${mod>=0?'+':'−'} ${Math.abs(mod)} CON · minimum 1`}</p><small>${Number(c.maxHp)||1} → ${(Number(c.maxHp)||1)+(val||0)} maximum HP</small></div>`;
   if(phase==='finish'){
     const summary=[choiceSub&&choices.subclass?['Specialisation',choices.subclass]:null,bond&&choices.bond?['Spirit nature',choices.bond]:null,rite&&choices.rite?['Rite',choices.rite]:null,skills&&choices.skill?['Skill',choices.skill+(choices.skill2?' & '+choices.skill2:'')]:null,choices.evolution?['Eidolon evolution',choices.evolution]:null,asi?['Advancement',choices.asi==='asi'?`ASI: ${choices.stat1?.toUpperCase()} ${choices.scoreMode==='split'?'+1, '+choices.stat2?.toUpperCase()+' +1':'+2'}`:'Feat: '+(TVR.feat(choices.feat)?.name||'')]:null].filter(Boolean);
     body=`<div class="v229-wizard-intro"><h3>Ready to complete?</h3><p>Your selected choices are recorded and the HP increase is applied exactly once when you finish.</p></div><div class="v229-confirm-grid"><div><small>LEVEL</small><strong>${p.fromLevel} → ${p.toLevel}</strong></div><div><small>MAXIMUM HP</small><strong>+${val??fixed}</strong></div><div><small>UNLOCKED FEATURES</small><strong>${info.features.length}</strong></div></div>${summary.length?`<div class="v229-summary"><span class="v2-overline">YOUR SELECTIONS</span>${summary.map(([label,value])=>`<p><strong>${E(label)}:</strong> ${E(value)}</p>`).join('')}</div>`:''}`;
   }
   const root=document.getElementById('v229-levelup');
   root.innerHTML=`<div class="v229-dialog" role="dialog" aria-modal="true" aria-label="Level up ${E(c.name)}"><div class="v229-modal-top"><div><span class="v2-overline">TERRAVALE · YOUR ADVENTURER</span><h2>Level up · ${E(c.name)}</h2></div><button type="button" class="v229-close" data-v229-cancel aria-label="Close level up">×</button></div><div class="v229-steps" aria-label="Level-up progress">${phases.map((x,i)=>`<span class="${step===i?'active':i<step?'complete':''}"><b>${i+1}</b>${x==='hp'?'Hit Points':x[0].toUpperCase()+x.slice(1)}</span>`).join('')}</div><div class="v229-wizard-main">${body}</div>${footer}</div>`;
 }
 function openWizard(id){
   const c=db.characters.find(x=>x.id===id);
   if(!canStart(c)){toast('No level-up award to complete for this character.');return;}
   wizard={id,step:0,method:'fixed',choices:{...(c.v229Pending.choices||{})}};
   let el=document.getElementById('v229-levelup');if(!el){el=document.createElement('div');el.id='v229-levelup';el.className='v229-overlay';document.body.append(el);}
   el.hidden=false;document.body.classList.add('v229-wizard-open');renderWizard();el.querySelector('.v229-close')?.focus();
 }
 function closeWizard(){wizard=null;const el=document.getElementById('v229-levelup');if(el){el.hidden=true;el.innerHTML='';}document.body.classList.remove('v229-wizard-open');}
 function saveChoices(){
   if(!wizard)return;
   const c=db.characters.find(x=>x.id===wizard.id),p=pending(c);if(!p)return;
   p.choices={...wizard.choices};persist();
 }
 function validateStep(){
   const cc=db.characters.find(x=>x.id===wizard.id);const sub=!!(v226SpecOptions(cc).length&&subclassAt(cc)!=null&&cc.v229Pending?.toLevel>=subclassAt(cc)&&!v226SpecName(cc));
   const currentPhase=(sub?['discover','specialisation','choices','hp','finish']:['discover','choices','hp','finish'])[wizard.step];
   if(currentPhase==='specialisation'){if(!wizard.choices.subclass){toast('Choose a specialisation to continue.');return false;}return true;}
   if(currentPhase!=='choices')return true;
   const c=db.characters.find(x=>x.id===wizard.id),p=pending(c),info=levelInfo(c,p.toLevel),ch=wizard.choices;
   if(v226SpecOptions(c).length&&subclassAt(c)!=null&&p.toLevel>=subclassAt(c)&&!v226SpecName(c)&&!ch.subclass){toast('Choose your specialisation.');return false;}
   if(newBond(c,p.toLevel)&&!ch.bond){toast('Choose a spirit nature.');return false;}
   if(newRite(c,p.toLevel)&&!ch.rite){toast('Choose a rite.');return false;}
   const skills=skillSlots(c,p.toLevel,info);
   if(skills>0&&!ch.skill){toast('Choose the skill gained with this feature.');return false;}
   if(skills>1&&(!ch.skill2||ch.skill===ch.skill2)){toast('Choose two different skills.');return false;}
   if(c.className==='Summoner'&&[7,13].includes(p.toLevel)&&!ch.evolution){toast('Choose an Eidolon evolution.');return false;}
   if(needsASI(info)){
     if(ch.asi==='asi'){
       if(!ch.stat1){toast('Choose the ability to increase.');return false;}
       if(ch.scoreMode==='split'&&(!ch.stat2||ch.stat1===ch.stat2)){toast('Choose two different +1 abilities.');return false;}
       const first=Number(c[ch.stat1])||10;
       if(first+(ch.scoreMode==='split'?1:2)>20){toast('Ability score cannot exceed 20.');return false;}
       if(ch.scoreMode==='split'&&(Number(c[ch.stat2])||10)+1>20){toast('Ability score cannot exceed 20.');return false;}
     } else if(ch.asi==='feat'){
       const f=v230FeatChoices(c,p.toLevel).find(x=>x.id===ch.feat);
       if(!f||f.eligibility.status==='blocked'){toast('Choose an available feat from the catalogue.');return false;}
       if(f.bonus?.length&&(!ch.featAbility||!f.bonus.includes(ch.featAbility))){toast('Choose the +1 ability provided by this feat.');return false;}
       if(ch.featAbility&&(Number(c[ch.featAbility.toLowerCase()])||10)>=20){toast('The feat cannot raise that score above 20.');return false;}
     } else {toast('Choose Ability Score Improvement or Feat.');return false;}
   }
   return true;
 }
 function finishWizard(){
   if(!wizard)return;
   const currentCharacter=db.characters.find(x=>x.id===wizard.id);const hasSub=!!(v226SpecOptions(currentCharacter).length&&subclassAt(currentCharacter)!=null&&currentCharacter.v229Pending?.toLevel>=subclassAt(currentCharacter)&&!v226SpecName(currentCharacter));
   if(wizard.step!==(hasSub?4:3))return;
   const c=db.characters.find(x=>x.id===wizard.id),p=pending(c);if(!p||!canStart(c)){toast('The award is no longer available.');closeWizard();return;}
   const ch=wizard.choices,info=levelInfo(c,p.toLevel);if(!validateStep())return;
   const die=hitDie(c),face=wizard.method==='roll'?(p.roll?.face||null):Math.floor(die/2)+1;
   if(face==null){toast('Select a Hit Points method.');return;}
   const gain=Math.max(1,face+conMod(c)),oldMax=Math.max(1,Number(c.maxHp)||1),oldHp=Math.max(0,Number(c.hp)||0);
   const oldLevel=current(c);
   if(p.toLevel!==oldLevel+1){toast('Level changed; refresh your character.');closeWizard();return;}
   if(ch.subclass){c.subclass=ch.subclass;c.progression??={};c.progression.subclass=ch.subclass;c.progression.tradition=ch.subclass;}
   if(ch.asi==='asi'&&needsASI(info)){const n=ch.scoreMode==='split'?1:2;c[ch.stat1]=(Number(c[ch.stat1])||10)+n;if(ch.scoreMode==='split')c[ch.stat2]=(Number(c[ch.stat2])||10)+1;}
   if(ch.asi==='feat'&&needsASI(info)){
      const feat=TVR.feat(ch.feat);
      if(feat){c.v230EarnedFeats??=[];c.v230EarnedFeats.push({id:feat.id,name:feat.name,level:p.toLevel,ability:ch.featAbility||null,dmReview:true});
      if(ch.featAbility){const id=ch.featAbility.toLowerCase();c[id]=(Number(c[id])||10)+1;}}
   }
   if(ch.evolution){c.v232Evolutions??=[];c.v232Evolutions.push({level:p.toLevel,name:ch.evolution});}
   c.v229Choices??=[];c.v229Choices.push({level:p.toLevel,choices:{...ch},hpMethod:wizard.method,hitDie:die,dieResult:wizard.method==='roll'?face:null,hpGain:gain});
   c.level=p.toLevel;c.maxHp=oldMax+gain;c.hp=Math.min(c.maxHp,oldHp+gain);
   c.v229LastCompleted={level:c.level,method:wizard.method,gain,at:new Date().toISOString()};
   delete c.v229Pending;
   persist();closeWizard();renderPage(false);
   toast(`${c.name} reached level ${c.level} · +${gain} maximum HP.`);
 }
 document.addEventListener('click',function(e){
   const start=e.target.closest('[data-v229-start]');if(start){e.preventDefault();e.stopImmediatePropagation();openWizard(start.dataset.v229Start);return;}
   if(!wizard)return;
   const pick=e.target.closest('[data-v230-pick]');
   if(pick){
     e.preventDefault();e.stopImmediatePropagation();
     if(pick.disabled)return;
     const field=pick.dataset.v230Pick,val=pick.dataset.v230Value,ch=wizard.choices;
     if(field==='asi'){ch.asi=val;ch.feat='';ch.featAbility='';ch.stat1='';ch.stat2='';ch.scoreMode='plus2';}
     else if(field==='scoreMode'){ch.scoreMode=val;ch.stat1='';ch.stat2='';}
     else if(field==='feat'){ch.feat=val;ch.featAbility='';}
     else if(field==='stat1'||field==='stat2'||field==='featAbility'){ch[field]=val;}
     else ch[field]=val;
     saveChoices();renderWizard();return;
   }
   const target=e.target.closest('[data-v229-cancel],[data-v229-back],[data-v229-next],[data-v229-finish]');if(!target)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(target.hasAttribute('data-v229-cancel')){saveChoices();closeWizard();return;}
   if(target.hasAttribute('data-v229-back')){saveChoices();wizard.step=Math.max(0,wizard.step-1);renderWizard();return;}
   if(target.hasAttribute('data-v229-next')){if(!validateStep())return;saveChoices();const char=db.characters.find(x=>x.id===wizard.id);const sub=!!(v226SpecOptions(char).length&&subclassAt(char)!=null&&char.v229Pending?.toLevel>=subclassAt(char)&&!v226SpecName(char));wizard.step=Math.min(sub?4:3,wizard.step+1);renderWizard();return;}
   if(target.hasAttribute('data-v229-finish')){finishWizard();}
 },true);
 document.addEventListener('change',e=>{
   if(!wizard)return;
   const f=e.target.closest('[data-v229-field]');
   if(f){wizard.choices[f.dataset.v229Field]=f.value;saveChoices();renderWizard();return;}
   if(e.target.name==='v229-hp'){
     wizard.method=e.target.value==='roll'?'roll':'fixed';
     if(wizard.method==='roll'){
       const c=db.characters.find(x=>x.id===wizard.id),p=pending(c);
       if(p&&!p.roll){p.roll={face:Math.floor(Math.random()*hitDie(c))+1,die:hitDie(c),rolledAt:new Date().toISOString()};persist();}
     }
     renderWizard();
   }
 },true);
 document.addEventListener('input',e=>{if(!wizard)return;const f=e.target.closest('[data-v229-field]');if(f&&f.tagName==='INPUT'){wizard.choices[f.dataset.v229Field]=f.value;saveChoices();}},true);
 document.addEventListener('input',e=>{if(!wizard||e.target.id!=='v230-feat-query')return;const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.v230-feat-entry').forEach(el=>el.hidden=!el.dataset.v230FeatSearch.includes(q));},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&wizard){e.preventDefault();e.stopImmediatePropagation();saveChoices();closeWizard();}},true);

 // Short, source-backed rules topics should not occupy the full width of a huge empty article.
 const oldReader=sheetV222FeaturesPage;
 sheetV222FeaturesPage=function(c){
   const t=document.createElement('template');t.innerHTML=oldReader(c);
   const prose=t.content.querySelector('.sheet228-rule-prose');
   if(prose){const n=(prose.textContent||'').trim().length;const parent=prose.closest('.sheet228-reader');if(n<360){parent?.classList.add('v229-short-topic');}}
   return t.innerHTML;
 };

 const prevRender=renderPage;
 renderPage=function(...args){const result=prevRender(...args);document.title=document.title.replace(/V2\.29|V2\.28|V2\.27/g,'V2.30');const id=window.v229OpenOnSheet;if(id&&route()==='/characters/'+id){delete window.v229OpenOnSheet;requestAnimationFrame(()=>openWizard(id));}return result;};
 renderPage(false);
})();
