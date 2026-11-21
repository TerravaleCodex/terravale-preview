/* V2.30 — title editing, prominent primary feature, explicit-use class resources, improved formatting */
(function(){
 'use strict';
 const E=s=>safe(String(s==null?'':s));
 const currentCampaign=()=>db.campaign;
 const isDM=()=>db.role==='dm';
 db.v230MainFeatured??={};
 const oldFeatured=renderCharacters;
 renderCharacters=function(){
   const id=db.v230MainFeatured?.[currentCampaign()];
   const list=db.v229Featured?.[currentCampaign()];
   if(id&&Array.isArray(list)&&list.includes(id)&&list[0]!==id){db.v229Featured[currentCampaign()]=[id,...list.filter(x=>x!==id)];}
   const t=document.createElement('template');t.innerHTML=oldFeatured();
   const selected=Array.isArray(db.v229Featured?.[currentCampaign()])?db.v229Featured[currentCampaign()]:[];
   const main=selected[0];
   t.content.querySelectorAll('.ledger-feature[data-ledger-id],.v229-featured-card[data-ledger-id],.ledger-card[data-ledger-id]').forEach(card=>{
     const id=card.dataset.ledgerId;
     if(!selected.includes(id))return;
     const area=card.querySelector('.ledger-actions,.ledger-card-bottom');if(!area)return;
     const btn=document.createElement('button');btn.type='button';btn.className='btn ghost small v230-main-feature';btn.dataset.v230Main=id;
     btn.textContent=id===main?'★ Main featured':'☆ Make main featured';
     btn.disabled=id===main;btn.title=id===main?'This is the main featured character':'Show this character in the large featured panel';
     area.appendChild(btn);
   });
   const caption=t.content.querySelector('.v229-featured-caption');if(caption){const t2=caption.querySelector('.v2-overline');if(t2)t2.textContent=`FEATURED CHARACTERS · ${selected.length}/3 · MAIN FIRST`;}
   return t.innerHTML;
 };
 document.addEventListener('click',e=>{
   const btn=e.target.closest('[data-v230-main]');if(!btn)return;
   e.preventDefault();e.stopImmediatePropagation();
   const id=btn.dataset.v230Main,list=db.v229Featured?.[currentCampaign()]||[];
   if(!list.includes(id))return;
   db.v230MainFeatured[currentCampaign()]=id;
   db.v229Featured[currentCampaign()]=[id,...list.filter(x=>x!==id)];
   db.featuredCharacters??={};db.featuredCharacters[currentCampaign()]=id;
   persist();renderPage(false);toast('Main featured character updated.');
 },true);
 // The display title is a DM-authored character record, not a player-accessible stat.
 const oldSheet=renderSheetV220;
 renderSheetV220=function(id){
   const c=db.characters.find(x=>String(x.id)===String(id));
   const t=document.createElement('template');t.innerHTML=oldSheet(id);
   if(!c)return t.innerHTML;
   const head=t.content.querySelector('.sheet20-hero-copy');
   if(head){
     const line=head.querySelector('.sheet226-classline');
     const subclass=String(c.progression?.subclass||c.progression?.tradition||c.subclass||'').trim();
     if(line&&subclass){const span=document.createElement('span');span.className='v230-class-subclass';span.textContent=' · '+subclass;line.append(span);}
     head.querySelector('.sheet226-pathline')?.remove();
     const info=head.querySelector(':scope > p');
     if(info){const title=String(c.displayTitle||'Adventurer').trim()||'Adventurer';info.className='v230-character-title';info.textContent=title;
       if(isDM()){const b=document.createElement('button');b.type='button';b.className='v230-title-edit';b.dataset.v230EditTitle=c.id;b.textContent='✎ Edit title';info.append(b);}
       if(c.concept){const concept=document.createElement('p');concept.className='v230-concept';concept.textContent=c.concept;info.after(concept);}
     }
   }
   return t.innerHTML;
 };
 document.addEventListener('click',e=>{
   const btn=e.target.closest('[data-v230-edit-title]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();
   if(!isDM())return;
   const c=db.characters.find(x=>x.id===btn.dataset.v230EditTitle&&x.campaign===currentCampaign());if(!c)return;
   modal('Character title · '+c.name,'Set a custom nickname, rank, epigraph, joke or lore-based title for the character sheet.',`<form id="v230TitleForm"><input type="hidden" name="id" value="${E(c.id)}"><label class="v2-field">Displayed title<input name="title" maxlength="75" value="${E(c.displayTitle||'Adventurer')}" required placeholder="e.g. The Walking Incident"></label><button type="submit" class="btn primary">Save title</button></form>`,btn);
 },true);
 document.addEventListener('submit',e=>{
   const form=e.target;if(form?.getAttribute?.('id')!=='v230TitleForm')return;e.preventDefault();e.stopImmediatePropagation();
   if(!isDM())return;
   const f=new FormData(form),c=db.characters.find(x=>x.id===String(f.get('id'))&&x.campaign===currentCampaign());
   if(!c)return;
   const name=String(f.get('title')||'').trim();if(!name||name.length>75){toast('Choose a title of 1 to 75 characters.');return;}
   c.displayTitle=name;persist();closeModal();renderPage(false);toast('Character title saved.');
 },true);
 // Explicitly documented limited-use class abilities are resources, without inventing unknown counts.
 const oldResources=sheetV220Resources;
 sheetV220Resources=function(c){
   const base=oldResources(c),seen=new Set(base.map(r=>r.id));
   const maxLevel=Math.max(1,Math.min(20,Number(c.level)||1));
   const rows=v226Features(c.className,maxLevel)||[];
   const add=(name,n,rest,level)=>{
     const max=Number(n);if(!name||max<1||max>20)return;
     const slug=x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
     const id='class-use:'+slug(c.className)+':'+slug(name);
     if(seen.has(id))return;seen.add(id);
     base.push({id,name,max,unit:'uses',source:`${max} per ${rest} rest · Level ${level} class rule`});
   };
   const usage=/^(.{4,90}?)\s*\(\s*(\d+)\s*\/\s*(short\s+or\s+long|short|long)\s+rest\s*\)/i;
   for(const row of rows)for(const f of row.features||[]){
     const title=String(f.name||''),match=title.match(usage);
     if(match)add(match[1].trim(),match[2],match[3],row.level);
     // Individual class subfeatures can be embedded under a large named feature,
     // e.g. Emergency Seal inside Core Sealcraft. Match only explicit, named limits.
     const t=document.createElement('template');t.innerHTML=v226Sanitize(f.html||'');
     for(const el of t.content.querySelectorAll('p,li')){
       const label=el.querySelector(':scope > strong:first-child');if(!label)continue;
       const text=label.textContent||'',m=text.match(usage);
       if(m)add(m[1].trim(),m[2],m[3],row.level);
     }
   }
   return base;
 };
 const oldResourcePanel=sheetV220ResourcesPanel;
 sheetV220ResourcesPanel=function(c){
   const html=oldResourcePanel(c),t=document.createElement('template');t.innerHTML=html;
   const explicit=sheetV220Resources(c).some(x=>x.id.startsWith('class-use:'));
   if(explicit){const title=t.content.querySelector('.sheet20-resource-panel > h3');if(title&&!['Bloodforger','Shaman'].includes(c.className))title.textContent='Your class resources & limited-use abilities';
      const note=t.content.querySelector('.sheet20-resource-panel > p.sheet20-note');if(note)note.remove();
      const source=t.content.querySelector('.sheet20-resource-panel .sheet20-panel-heading .sheet20-source');if(source)source.textContent='TRACKED ABILITIES';
      t.content.querySelectorAll('.sheet20-pool').forEach(pool=>{const small=pool.querySelector(':scope > small');if(small)small.textContent=small.textContent.replace(/ · Recovery not automated/g,'');});}
   return t.innerHTML;
 };
 // Keep selections legible without adding fake paragraphs to brief mechanics.
 const oldReader=sheetV222FeaturesPage;
 sheetV222FeaturesPage=function(c){
   const t=document.createElement('template');t.innerHTML=oldReader(c);
   t.content.querySelectorAll('.sheet227-entry small').forEach(el=>{if(el.textContent?.trim()==='Individual rules topic')el.textContent='Rules topic';});
   return t.innerHTML;
 };
 const prev=renderPage;
 renderPage=function(...args){const result=prev(...args);document.title=document.title.replace(/V2\.29|V2\.28|V2\.27/g,'V2.30');return result;};
 renderPage(false);
})();