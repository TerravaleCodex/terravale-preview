
/* Terravale Codex V2.28: retain V2.27's actual site and source corpus.
   Restore clean reader with subtopic navigation; separate profile editing and DM advancement. */
(function () {
 'use strict';
 const esc = x => safe(String(x == null ? '' : x));
 const cleanName = x => String(x || '').toLowerCase().replace(/\s*\(level\s*\d+\)\s*/gi,'').replace(/[^a-z0-9]/g,'');
 const isDM = () => db.role === 'dm';
 const classSlug = x => String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
 let view={character:null,mode:'class',key:'',query:''};
 const getFeatPanel = sheetV222FeatPanel;
 const sourceCache=new Map();
 function fullFeatureRows(name, limit) {
   const source=v226Class(name),rows=v226Features(name,limit);
   if(!source) return rows;
   const content=document.createElement('template');content.innerHTML=v226Sanitize(source.html||'');
   const nodes=[...content.content.querySelectorAll('p,h2,h3,h4,h5')];
   const aliases={bonds:['spirit bonds'],channel:['channel spirit'],favour:['spirit favour'],rites:['spirit rites'],'deep invocation':['deepened invocation']};
   for(const group of rows) for(const item of group.features) {
     if(!/listed in the published progression|Refer to the published source reference|complete rules text.*not/i.test(item.html||'')) continue;
     const wanted=[item.name.toLowerCase(),...(aliases[item.name.toLowerCase()]||[])].map(cleanName);
     let found=null;
     for(const node of nodes) {
       const label=node.matches('p')?node.querySelector(':scope > strong:first-child'):node;
       if(!label)continue;
       const key=cleanName((label.textContent||'').split(/[—–:]/)[0]);
       if(wanted.some(q=>q.length>3&&(key===q||key.startsWith(q)||q.startsWith(key)))) {found=node;break;}
     }
     if(!found)continue;
     let html='';
     if(found.matches('p')) html='<h3>'+esc(item.name)+'</h3>'+found.outerHTML;
     else {let siblings=[],next=found.nextElementSibling;while(next&&siblings.length<24&&!/^H[234]$/.test(next.tagName)){siblings.push(next.outerHTML);next=next.nextElementSibling;}html=found.outerHTML+siblings.join('');}
     if(html.length>100)item.html=html;
   }
   return rows;
 }
 function onePiece(title,html){return {name:title,html};}
 function leadLabel(el, fallback) {
   const strong=el.querySelector(':scope > strong:first-child,:scope > b:first-child');
   if(!strong)return fallback;
   const val=(strong.textContent||'').replace(/[:;]+$/,'').trim();
   return val.length>2&&val.length<75?val:fallback;
 }
 function partGroup(feature) {
   const fragment=document.createElement('template'); fragment.innerHTML=v226Sanitize(feature.html||'');
   const elements=[...fragment.content.children];
   const textLength=fragment.content.textContent?.trim().length||0;
   if(textLength<1350||elements.length<3)return null;
   const chunks=[]; let current=[],section='',count=0;
   const add = (title,markup) => {const snippet=document.createElement('template');snippet.innerHTML=markup;if(snippet.content.textContent?.trim())chunks.push(onePiece(title,markup));};
   const flush = ()=>{if(current.length){add(section||'Overview',current.join(''));current=[];count=0;}};
   for(const node of elements){
     const tag=(node.tagName||'').toLowerCase();
     if(/^h[1-6]$/.test(tag)) {
       flush();
       const name=(node.textContent||'').trim();
       if(cleanName(name)!==cleanName(feature.name))section=name;
       continue;
     }
     if(tag==='ul'||tag==='ol'){
       const lis=[...node.children].filter(x=>x.tagName?.toLowerCase()==='li');
       if(lis.length>=3&&node.textContent.length>470){
         // Related short clauses belong together: one-sentence bullets must not
         // turn into enormous near-empty individual detail pages.
         let batch=[],size=0,first=true;
         const intro=current.join('');current=[];count=0;
         const emit=()=>{
           if(!batch.length)return;
           const from=leadLabel(batch[0], 'Details'),to=leadLabel(batch[batch.length-1],'Details');
           const suffix=from===to?from:from+' – '+to;
           const title=section&&lis.length<=4&&batch.length===lis.length?section:(section?section+' · ':'')+suffix;
           add(title,(first?intro:'')+`<${tag}>`+batch.map(li=>li.outerHTML).join('')+`</${tag}>`);
           first=false;batch=[];size=0;
         };
         lis.forEach(li=>{
           const n=(li.textContent||'').length;
           if(batch.length&&(size+n>1000||batch.length>=4))emit();
           batch.push(li);size+=n;
           if(size>=1000)emit();
         });
         emit();continue;
       }
     }
     if(tag==='p'){
       const label=leadLabel(node,'');
       const numbered=/^\d+[.)]\s+/.test(node.textContent.trim());
       if(numbered){flush();add(label||node.textContent.trim().slice(0,55),node.outerHTML);continue;}
       if(label&&(count>250||(!current.length&&chunks.length&&(node.textContent||'').length>140))){flush();section=label;}
     }
     current.push(node.outerHTML);count+=(node.textContent||'').length;
     if(count>650&&current.length>1)flush();
   }
   flush();
   const folded=[];
   for(const part of chunks){
     const t=document.createElement('template');t.innerHTML=part.html;
     const length=(t.content.textContent||'').replace(/\s+/g,' ').trim().length;
     if(folded.length&&length<275&&/^(Duration|Overview|Create Field Seal)/i.test(part.name)){
       const previous=folded[folded.length-1];
       previous.html+='<h4>'+part.name+'</h4>'+part.html;
       continue;
     }
     folded.push(part);
   }
   return folded.length>=2?folded:null;
 }
 function makeEntries(c) {
   const rows=fullFeatureRows(c.className,c.level),normal=[],deep=[];
   for(const row of rows)for(const f of row.features){if(window.TV34_IS_CHOICE_ONLY?.(f.name))continue;
     const id='f:'+row.level+':'+normal.length;
     const parts=partGroup(f);
     const tpl=document.createElement('template');tpl.innerHTML=v226Sanitize(f.html||'');
     const first=tpl.content.querySelector('p');
     const short=first?first.outerHTML:'<p>Open the detailed sections to see this rule.</p>';
     normal.push({key:id,name:f.name,level:row.level,html:parts?short:f.html,complex:!!parts,deepKey:parts?id+':0':null,partCount:parts?.length||0});
     if(parts)parts.forEach((p,i)=>{
       const gated=p.name.match(/\(level\s*(\d+)\)\s*$/i);
       if(gated&&Number(gated[1])>Number(c.level))return;
       const html=document.createElement('template');html.innerHTML=p.html;
       html.content.querySelectorAll('li').forEach(li=>{
         const short=(li.textContent||'').slice(0,160);
         const match=short.match(/\(level\s*(\d+)\)/i);
         if(match&&Number(match[1])>Number(c.level))li.remove();
       });
       if(!html.content.textContent?.trim())return;
       deep.push({key:id+':'+i,name:p.name,parent:f.name,level:row.level,html:html.innerHTML});
     });
   }
   const subclass=[];
   const selectedPath=v226SpecName(c),option=v226Class(c.className)?.options?.find(o=>o.name===selectedPath);
   if(option){
     const subt=document.createElement('template');subt.innerHTML=v226Sanitize(option.html||'');
     let last=null;
     const pieces=[];for(const el of [...subt.content.children]){if(el.tagName==='P'&&el.querySelector('br')){for(const segment of el.innerHTML.split(/<br\s*\/?>/i)){if(!segment.trim())continue;const p=document.createElement('p');p.innerHTML=segment;pieces.push(p);}}else pieces.push(el);}
     for(const el of pieces){
       if(/^H[1-6]$/.test(el.tagName))continue;
       const bold=el.querySelector('strong')?.textContent?.trim()||'';
       const m=bold.match(/^(?:(?:At\s+)?Level\s*)?(\d{1,2})(?:st|nd|rd|th)?\s*[—–-]\s*(.+)$/i);
       if(m){const lev=Number(m[1]);last=lev<=Number(c.level)?{key:'sub:'+lev+':'+subclass.length,name:m[2].replace(/[.\s]+$/,''),level:lev,html:el.outerHTML}:null;if(last)subclass.push(last);}
       else if(last)last.html+=el.outerHTML;
     }
   }
   const tpl=document.createElement('template');tpl.innerHTML=getFeatPanel(c);
   const feats=[...tpl.content.querySelectorAll('.sheet22-feat')].map((el,i)=>({
     key:'a:'+i,name:el.querySelector('summary strong')?.textContent?.trim()||'Ancestry feat '+(i+1),
     level:0,html:el.querySelector('.sheet22-feat-body')?.innerHTML||el.innerHTML
   }));
   for(const earned of c.v230EarnedFeats||[]){
     const raw=window.TERRAVALE_V225_FEATS?.[earned.id]||'';
     if(!raw)continue;
     const md=window.TERRAVALE_V225_MD?window.TERRAVALE_V225_MD(raw):'<p>'+esc(raw)+'</p>';
     feats.push({key:'earned:'+earned.id+':'+earned.level,name:earned.name,level:earned.level,html:md});
   }
   return {normal,deep,feats,subclass};
 }
 function stripTitle(html,title){
   const t=document.createElement('template');t.innerHTML=v226Sanitize(html||'');
   const first=t.content.firstElementChild;
   if(first&&/^H[1-6]$/.test(first.tagName)&&cleanName(first.textContent)===cleanName(title))first.remove();
   return t.innerHTML;
 }
 function readerPage(c){
   if(view.character!==c.id){view={character:c.id,mode:'class',key:'',query:''};}
   const data=makeEntries(c);
    const assigned=window.TerravaleV258Feats?.getEntries?.(c.id,c.campaign)||[];
    const known=new Set(data.feats.map(f=>String(f.key)));
    for(const feat of assigned){
      const key='dm-grant:'+feat.id;
      if(known.has(key))continue;
      known.add(key);
      data.feats.push({key,name:feat.name,html:feat.html,
        custom:true,level:0,complex:false,partCount:0});
    }
   const hasDeep=data.deep.length>0;
   if(view.mode==='deep'&&!hasDeep){view.mode='class';view.key='';}if(view.mode==='subclass'&&!data.subclass.length){view.mode='class';view.key='';}
   const category=view.mode==='feats'?data.feats:view.mode==='deep'?data.deep:view.mode==='subclass'?data.subclass:data.normal;
   const visible=category.filter(x=>!view.query||(x.name+' '+(x.parent||'')+' '+(x.level||'')).toLowerCase().includes(view.query.toLowerCase()));
   const selected=category.find(x=>x.key===view.key)||category[0];
   const headingLabel=view.mode==='feats'?'FEATS · '+c.ancestry:view.mode==='deep'?'DETAILED CLASS RULES · '+c.className:view.mode==='subclass'?'SUBCLASS · '+v226SpecName(c):'CLASS ABILITIES · '+c.className;
   const tabs=[['class','Class abilities',data.normal.length],...(data.subclass.length?[['subclass','Subclass abilities',data.subclass.length]]:[]),['feats','Feats',data.feats.length],...(hasDeep?[['deep',c.className==='Seal-Maintainer'?'Sealcraft':'Detailed rules',data.deep.length]]:[])];
   const tabHtml=tabs.map(([id,label,num])=>`<button role="tab" type="button" aria-selected="${view.mode===id}" data-v228-tab="${id}">${esc(label)} <span>${num}</span></button>`).join('');
   let menu='',last='';
   for(const entry of visible){
     const group=view.mode==='deep'?entry.parent:['class','subclass'].includes(view.mode)?'Level '+entry.level:'';
     if(group&&group!==last){menu+=`<div class="sheet228-list-label">${esc(group)}</div>`;last=group;}
     menu+=`<button type="button" class="sheet227-entry ${selected?.key===entry.key?'is-active':''}" data-v228-entry="${esc(entry.key)}" aria-pressed="${selected?.key===entry.key}"><strong>${esc(entry.name)}</strong><small>${view.mode==='feats'?entry.custom?'DM-granted feat':entry.level?'Level-up feat · Level '+entry.level:'Recorded ancestry feat':view.mode==='deep'?'Individual rules topic':view.mode==='subclass'?'Subclass feature · Level '+entry.level:'Class feature · Level '+entry.level}${entry.complex?' · '+entry.partCount+' topics':''}</small><span aria-hidden="true">›</span></button>`;
   }
   const readable=selected?stripTitle(selected.html,selected.name):'';
   const body=selected?`<div class="sheet227-rule-heading"><span class="v2-overline">${esc(selected.custom?'DM-GRANTED FEAT':headingLabel)}${selected.level?' · LEVEL '+selected.level:''}</span><h3>${esc(selected.name)}</h3>${view.mode==='class'?`<div class="sheet228-status">Unlocked · Level ${selected.level} &nbsp;·&nbsp; Player Primer ${esc(v226Class(c.className)?.sourceVersion||'')}</div>`:''}</div><div class="sheet228-rule-prose">${readable}</div>${selected.complex?`<div class="sheet228-deep-prompt"><span>This ability contains ${selected.partCount} detailed rules topics, separated for easier reading.</span><button class="btn ghost small" type="button" data-v228-jump="${esc(selected.deepKey)}">Read ${esc(selected.name)} by topic →</button></div>`:''}`:`<p class="sheet22-empty-features">No abilities recorded for this section.</p>`;
   return `<section class="sheet20-panel sheet227-reader sheet228-reader" data-tv259-character="${esc(c.id)}"><div class="sheet20-panel-heading"><span>CHARACTER SHEET · FEATURES & FEATS</span><span>LEVEL ${Number(c.level)||1} · ${esc(c.className)}</span></div><h3>Your abilities and feats</h3><p class="sheet20-note">Class abilities, ancestry feats and DM-granted custom feats appear together here. Select one to read its rules.</p><nav class="sheet227-reader-tabs" role="tablist" aria-label="Ability categories">${tabHtml}</nav><div class="sheet227-reader-body"><aside class="sheet227-reader-index"><label class="v2-overline" for="sheet228-search">FIND ${view.mode==='deep'?'A RULES TOPIC':view.mode==='feats'?'A FEAT':'AN ABILITY'}</label><input type="search" id="sheet228-search" value="${esc(view.query)}" placeholder="Search ${view.mode==='deep'?'rules topics':'abilities and levels'}…"><small class="sheet227-reader-count">${visible.length} of ${category.length} displayed</small><div class="sheet227-reader-entries">${menu||'<p class="sheet22-empty-features">No matching entries.</p>'}</div></aside><article class="sheet227-reader-detail">${body}</article></div><footer class="sheet227-reader-footer">${lnk('/classes/'+classSlug(c.className),'Read full '+esc(c.className)+' class rules ↗','v2-link')}<small>Reference rules only; resource spending and conditional effects use normal sheet and DM controls.</small></footer></section>`;
 }
 sheetV222FeaturesPage=readerPage;
 document.addEventListener('click',function(e){
   const tab=e.target.closest('[data-v228-tab]');
   if(tab){window.TerravaleReaderRequestedMode=tab.dataset.v228Tab;e.preventDefault();view.mode=tab.dataset.v228Tab;view.key='';view.query='';renderPage(false);return;}
   const item=e.target.closest('[data-v228-entry]');
   if(item){e.preventDefault();view.key=item.dataset.v228Entry;renderPage(false);return;}
   const jump=e.target.closest('[data-v228-jump]');
   if(jump){e.preventDefault();view.mode='deep';view.key=jump.dataset.v228Jump;view.query='';renderPage(false);return;}
 },true);
 document.addEventListener('input',function(e){
   if(e.target.id!=='sheet228-search')return;
   view.query=e.target.value;const pos=e.target.selectionStart;renderPage(false);
   const now=document.getElementById('sheet228-search');if(now){now.focus();try{now.setSelectionRange(pos,pos)}catch{}}
 },true);

 // The Campaign Hub reaches the real character ledger, not a decorative mock page.
 const originalCampaigns=renderCampaigns;
 renderCampaigns=function(){
   const t=document.createElement('template');t.innerHTML=originalCampaigns();
   const hero=t.content.querySelector('.campaign-feature-actions');
   if(hero){const link=document.createElement('a');link.href='#/characters';link.className='btn ghost';link.textContent='View characters →';hero.append(link);}
   for(const tile of t.content.querySelectorAll('.campaign-tile')){
     const overview=tile.querySelector('a.campaign-card-link');const m=overview?.getAttribute('href')?.match(/#\/campaigns\/([^/?#]+)/);
     const foot=tile.querySelector('.campaign-tile-foot');if(!foot||!m)continue;
     const btn=document.createElement('button');btn.type='button';btn.className='campaign-characters-link';btn.dataset.v228CampaignCharacters=decodeURIComponent(m[1]);btn.textContent='View characters';foot.insertBefore(btn,foot.lastElementChild);
   }
   return t.innerHTML;
 };
 document.addEventListener('click',function(e){
   const target=e.target.closest('[data-v228-campaign-characters]');if(!target)return;
   e.preventDefault();const id=target.dataset.v228CampaignCharacters;
   if(!db.campaigns.some(c=>c.id===id))return;
   db.campaign=id;persist();navigate('/characters');
 },true);

 // Edit Character is profile-only for players AND DMs; leveling lives in the DM Chronicle.
 function editProfile(c,trigger){
   if(!sheetV220CanEdit(c))return;
   const opts=v226SpecOptions(c),current=v226SpecName(c);
   const choice=opts.length?`<label class="v2-field">Specialisation (optional)<select name="subclass"><option value="">Not yet selected</option>${opts.map(x=>`<option value="${esc(x)}" ${x===current?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`:'<p class="sheet226-source-note">This class uses a separate discipline or advancement system.</p>';
   const form=`<form id="sheet228-profile-form"><input type="hidden" name="id" value="${esc(c.id)}"><div class="sheet226-edit-fields"><label class="v2-field">Character name<input name="name" maxlength="90" required value="${esc(c.name)}"></label><label class="v2-field">Pronouns (optional)<input name="pronouns" maxlength="60" value="${esc(c.pronouns||'')}"></label></div><label class="v2-field">Character concept<input name="concept" maxlength="160" value="${esc(c.concept||'')}"></label>${choice}<div class="sheet228-profile-lock"><strong>Level ${Number(c.level)||1} · ${Math.max(1,Number(c.maxHp)||1)} maximum HP</strong><small>Level and maximum HP are managed by your Dungeon Master, not edited here.</small></div><div class="v2-actions"><button class="btn primary" type="submit">Save character details</button></div></form>`;
   modal('Edit character · '+c.name,'Update character details. Level advancement and maximum HP are managed separately by the DM.',form,trigger);
 }
 v226Edit=editProfile;
 v226SaveEdit=function(){toast('Level advances can only be granted from the DM Chronicle.');};
 document.addEventListener('submit',function(e){
   if(e.target.getAttribute('id')!=='sheet228-profile-form')return;
   e.preventDefault();e.stopImmediatePropagation();
   const f=new FormData(e.target),c=db.characters.find(x=>String(x.id)===String(f.get('id')));
   if(!c||!sheetV220CanEdit(c)){toast('You cannot edit this character.');return;}
   const name=String(f.get('name')||'').trim();if(!name||name.length>90){toast('Please enter a valid name.');return;}
   c.name=name;c.pronouns=String(f.get('pronouns')||'').trim().slice(0,60);c.concept=String(f.get('concept')||'').trim().slice(0,160);
   if(v226SpecOptions(c).length){c.subclass=String(f.get('subclass')||'').trim();if(c.progression&&typeof c.progression==='object'){c.progression.subclass=c.subclass;c.progression.tradition=c.subclass;}}
   persist();closeModal();renderPage(false);toast('Character details saved locally');
 },true);

 // The DM Chronicle's "Grant +1 level" is deliberately NOT another edit modal.
 window.TERRAVALE_V228_GRANT=function(c,button){
   if(!isDM()){toast('Only a DM can grant levels.');return;}
   if(!c||!activeCharacters().some(x=>x.id===c.id)){toast('Character is not in this campaign.');return;}
   const oldLevel=Math.max(1,Number(c.level)||1);if(oldLevel>=20){toast('This character is already level 20.');return;}
   const die=Number(v226Class(c.className)?.stats?.['Hit die']?.match(/\d+/)?.[0])||Number(sheetV220Meta(c)?.die)||8;
   const modifier=Math.floor((Number(c.con||10)-10)/2);
   const method=db.v228GrantMethod==='roll'?'roll':'fixed';
   const face=method==='roll'?Math.floor(Math.random()*die)+1:Math.floor(die/2)+1;
   const gain=Math.max(1,face+modifier);
   const priorMax=Math.max(1,Number(c.maxHp)||1);const priorCurrent=Math.max(0,Number(c.hp)||0);
   c.level=oldLevel+1;c.maxHp=priorMax+gain;c.hp=Math.min(c.maxHp,priorCurrent+gain);
   persist();renderPage(false);
   toast(`${c.name} · Level ${c.level} · +${gain} maximum HP (${method==='roll'?'d'+die+' rolled '+face:'fixed average'})`);
 };
 const originalDM=renderDM;
 renderDM=function(){
   const t=document.createElement('template');t.innerHTML=originalDM();
   const section=t.content.querySelector('#dm-campaign-management');
   if(section){
     const para=section.querySelector('.sheet227-dm-head p');if(para)para.textContent='Review assignments and character sheets. Grant +1 level once per click; the chosen HP method updates maximum and current HP automatically.';
     const group=document.createElement('div');group.className='sheet228-grant-method';
     group.innerHTML=`<span class="v2-overline">HIT POINTS ON NEXT LEVEL GRANT</span><div class="sheet228-method-picks" role="radiogroup" aria-label="HP calculation for granted level"><label><input type="radio" name="sheet228-hp-method" value="fixed" ${db.v228GrantMethod==='roll'?'':'checked'} ${!isDM()?'disabled':''}><span>Fixed average</span></label><label><input type="radio" name="sheet228-hp-method" value="roll" ${db.v228GrantMethod==='roll'?'checked':''} ${!isDM()?'disabled':''}><span>Roll automatically</span></label></div><small>The Grant +1 button adds exactly one level and its HP increase. It never opens Edit Character.</small>`;
     const rows=section.querySelector('.sheet227-dm-rows');if(rows)rows.before(group);
     for(const b of section.querySelectorAll('[data-v227-level]')){
       b.textContent='Grant +1 level';
       const target=db.characters.find(c=>String(c.id)===b.dataset.v227Level);
       if(target&&Number(target.level)>=20){b.disabled=true;b.title='Already at level 20';}
     }
   }
   return t.innerHTML;
 };
 document.addEventListener('change',function(e){
   if(e.target.name!=='sheet228-hp-method'||!isDM())return;
   db.v228GrantMethod=e.target.value==='roll'?'roll':'fixed';persist();
 },true);
 // Keep version label accurate after every offline navigation.
 const baseRender=renderPage;
 renderPage=function(...args){const result=baseRender(...args);document.title=document.title.replace(/V2\.27/g,'V2.28');return result;};
 renderPage(false);
})();

