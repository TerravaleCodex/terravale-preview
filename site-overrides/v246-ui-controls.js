/* V2.46: authentic full feats and custom selections; DM player-view, Lore
   roster, intentional hidden achievements and responsive UI repairs. */
(function(){
 'use strict';
 const $=(s,root=document)=>root.querySelector(s);
 const safe=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function featHTML(markdown){
   const fmt=s=>safe(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g,'<em>$1</em>');
   let open=false;const out=[];
   for(const line of String(markdown||'').split(/\r?\n/)){
     const x=line.trim();
     if(/^[-*]\s+/.test(x)){
       if(!open){open=true;out.push('<ul>')}
       out.push('<li>'+fmt(x.replace(/^[-*]\s+/,''))+'</li>');
       continue;
     }
     if(open){out.push('</ul>');open=false}
     if(!x)continue;
     if(/^#{1,6}\s/.test(x)){out.push('<h4>'+fmt(x.replace(/^#{1,6}\s+/,''))+'</h4>');continue}
     if(x==='---'){out.push('<hr>');continue}
     out.push('<p>'+fmt(x)+'</p>');
   }
   if(open)out.push('</ul>');
   return out.join('');
 }
 function mountFeatMechanics(){
   const parent=$('#creatorStudio .v218-feat-detail');
   if(!parent)return;
   const selected=$('#creatorStudio .v218-feat-item.is-focused [data-feat-id]');
   const featId=selected?.dataset?.featId;
   const raw=window.TERRAVALE_V225_FEATS?.[featId];
   if(!featId)return;
   if(parent.dataset.featLoaded===featId)return;
   parent.querySelectorAll('.tv-full-feat').forEach(e=>e.remove());
   if(!raw)return;
   const section=document.createElement('section');
   section.className='tv-full-feat';
   section.innerHTML='<div class="v2-overline">PUBLISHED FEAT · FULL MECHANICAL RULES</div>'+featHTML(raw);
   const actions=parent.querySelector('.v218-feat-detail-actions');
   if(actions)actions.before(section);else parent.append(section);
   parent.dataset.featLoaded=featId;
 }
 function mountASI(){
   document.querySelectorAll('#creatorStudio select[data-creator-asi]').forEach(select=>{
     if(select.dataset.tvButtons)return;
     select.dataset.tvButtons='1';select.classList.add('tv-native-select-hidden');
     const group=document.createElement('div');
     group.className='tv-asi-buttons';
     group.setAttribute('role','group');
     group.setAttribute('aria-label','Ability increase for '+select.dataset.creatorAsi);
     for(const option of Array.from(select.options).filter(o=>o.value)){
       const button=document.createElement('button');
       button.type='button';button.className='tv-asi-choice';
       button.textContent=option.textContent||option.value;
       button.setAttribute('aria-pressed',String(select.value===option.value));
       button.addEventListener('click',()=>{
         select.value=option.value;
         select.dispatchEvent(new Event('change',{bubbles:true}));
       });
       group.append(button);
     }
     select.after(group);
   });
 }
 function mountTechniqueBack(){
   const panel=$('.sheet227-reader');
   const active=panel?.querySelector('[data-v232-feature-tab="bloodforger"][aria-selected="true"]');
   if(!active || panel.querySelector('.tv-back-technique'))return;
   const b=document.createElement('button');
   b.type='button';b.className='tv-back-technique';
   b.textContent='← Back to class abilities';
   b.onclick=()=>{
     const original=panel.querySelector('[data-v228-tab="class"]');
     original?.click();
   };
   const tabs=panel.querySelector('.sheet227-reader-tabs');
   tabs?.after(b);
 }
 function mountActualHeritage(){
   const panel=$('#tv238-heritage');
   if(!panel || !window.TerravaleV2Bridge?.isSynced?.())return;
   const users=(db.characters||[]).filter(c=>window.TerravaleV2Bridge?.hasCampaign?.(c.campaign));
   const sig=users.map(c=>c.id+'|'+c.ancestry).join(',');
   if(panel.dataset.tvActual===sig)return;
   panel.dataset.tvActual=sig;
   panel.innerHTML='';
   const eyebrow=document.createElement('div');eyebrow.className='lore-ey';
   eyebrow.textContent='CULTURAL LIBRARY · VERIFIED CHARACTER ACCESS';
   const title=document.createElement('h2');title.textContent='Knowledge from home';
   const p=document.createElement('p');
   p.textContent='Ancestry knowledge comes from your real campaign characters, not fictional preview profiles.';
   const wrap=document.createElement('div');wrap.className='tv-real-heritage';
   if(users.length){
     for(const c of users){
       const a=document.createElement('a');a.href='#/characters/'+encodeURIComponent(c.id);
       a.className='lore-pill';
       a.textContent=c.name+' · '+c.ancestry+' ↗';
       wrap.append(a);
     }
   }else{
     const hint=document.createElement('p');hint.className='lore-meta';
     hint.textContent='Join a campaign and create a character to reveal eligible ancestry entries.';
     wrap.append(hint);
   }
   panel.append(eyebrow,title,p,wrap);
 }
 function mountCrimsonSwitch(){
   const panel=document.querySelector('.v231-hunger-panel:has(.v231-state-critical)');
   if(!panel)return;
   let button=panel.querySelector('.tv-crimson-theme-toggle');
   if(!button){
     button=document.createElement('button');button.type='button';
     button.className='tv-crimson-theme-toggle';
     panel.append(button);
     button.addEventListener('click',()=>{
       if(db.theme==='crimson'){setTheme(window.TerravaleBeforeCrimson||'classic');}
       else{window.TerravaleBeforeCrimson=db.theme||'classic';setTheme('crimson');}
       renderPage(false);
     });
   }
   button.setAttribute('aria-pressed',String(db.theme==='crimson'));
   button.textContent=db.theme==='crimson'?'Return to previous theme':'Activate Crimson Court';
 }
 function installSecrets(){
   const list=window.TERRAVALE_DATA?.achievements;
   if(!Array.isArray(list)||list.some(x=>x.id==='roots_in_margins'))return;
   list.push(
     {id:'roots_in_margins',title:'Roots in the Margins',description:'Watch Verdant Archive grow its roots.',rarity:'rare',icon:'feather',order:62},
     {id:'seeing_red',title:'Seeing Red',description:'Reach an extreme of the Crimsonborn Blood State scale.',rarity:'epic',icon:'drop',order:63}
   );
   for(const a of list){
     if(!['roots_in_margins','seeing_red','bloodforger_all','journal_twenty'].includes(a.id))continue;
     const fullTitle=a.title,fullDescription=a.description,fullIcon=a.icon;
     Object.defineProperty(a,'title',{configurable:true,get:()=>db.unlocked.includes(a.id)?fullTitle:'Unknown curiosity'});
     Object.defineProperty(a,'description',{configurable:true,get:()=>db.unlocked.includes(a.id)?fullDescription:'Its secrets remain undiscovered.'});
     Object.defineProperty(a,'icon',{configurable:true,get:()=>db.unlocked.includes(a.id)?fullIcon:'seal'});
   }
 }
 function playerPreview(){
   const top=$('.top-right');
   const account=window.TerravaleVerifiedAccount?.state?.profile;
   if(!top||!account?.is_dm)return;
   if(top.querySelector('#tv-preview-as-player'))return;
   const button=document.createElement('button');
   button.id='tv-preview-as-player';button.type='button';
   button.className='tv-player-preview-button';
   button.title='Preview the site using player-visible controls. This does not change server permissions.';
   button.setAttribute('aria-pressed',String(Boolean(window.TerravalePlayerPreview)));
   button.textContent=window.TerravalePlayerPreview?'Exit player view':'Player view';
   button.addEventListener('click',()=>{
     window.TerravalePlayerPreview=!window.TerravalePlayerPreview;
     db.role=window.TerravalePlayerPreview?'player':'dm';
     document.body.classList.toggle('tv-player-preview',window.TerravalePlayerPreview);
     button.textContent=window.TerravalePlayerPreview?'Exit player view':'Player view';
     button.setAttribute('aria-pressed',String(window.TerravalePlayerPreview));
     if(window.TerravalePlayerPreview && location.hash.includes('/dm'))location.hash='#/';
     persist();renderPage(false);
   });
   const search=top.querySelector('button[title*="earch"],[aria-label*="earch"],.search-trigger');
   if(search)search.after(button);else top.prepend(button);
 }
 let queued=false;
 function decorate(){
   queued=false;
   installSecrets();mountFeatMechanics();mountASI();mountTechniqueBack();mountCrimsonSwitch();
   mountActualHeritage();playerPreview();
 }
 const observer=new MutationObserver(()=>{
   if(queued)return;queued=true;requestAnimationFrame(decorate);
 });
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('terravale-characters-synced',()=>{
   if(location.hash.includes('/lore'))window.dispatchEvent(new Event('hashchange'));
   decorate();
 });
 window.addEventListener('terravale-achievement-unlocked',()=>{
   if(location.hash.includes('cabinet'))renderPage(false);
 });
 window.addEventListener('hashchange',()=>setTimeout(decorate,60));
 if(window.TerravaleVerifiedAccount?.state?.ready)decorate();
 else window.addEventListener('terravale-auth-ready',decorate,{once:true});
 decorate();
})();
