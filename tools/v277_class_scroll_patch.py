"""V2.77 — surgically stabilise native Class Codex interactions in V2.39.
Change the original handlers in their own closures, not a competing event overlay.
Only re-render the affected level/path detail; never repaint the entire page.
"""
def patch(source: str) -> str:
    before = """document.addEventListener('click',e=>{const v=e.target.closest('[data-v232-class-view]'),o=e.target.closest('[data-v232-class-option]'),lv=e.target.closest('[data-v232-level]'),f=e.target.closest('[data-v232-feature]');if(!v&&!o&&!lv&&!f)return;e.preventDefault();e.stopImmediatePropagation();const id=(v||o||lv||f).dataset.v232For;if(v)classView[id]=v.dataset.v232ClassView;if(o)classOption[id]=o.dataset.v232ClassOption;if(lv){classLevel[id]=Number(lv.dataset.v232Level);classFeature[id]=0;}if(f)classFeature[id]=Number(f.dataset.v232Feature);renderPage(false);},true);"""
    helper = r'''
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
function v277Reanchor(element,top){
 if(!element||!element.isConnected)return;
 const delta=element.getBoundingClientRect().top-top;
 if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});
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
 const levels=reader.querySelectorAll('[data-v232-level]').length||20;
 const fresh=v277ReadMarkup(v223ClassFeatures(doc.name,levels),'.v232-progression-reader');
 const replacement=fresh?.querySelector('.v232-level-content');
 if(!replacement)return false;
 const anchorTop=grid.getBoundingClientRect().top;
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
 v277Reanchor(grid,anchorTop);
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
 v277Reanchor(reader,anchorTop);
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
 v277KeepHeight(next,old,reader);
 old.replaceWith(next);
 const chosen=window.TV33_PATH_LEVELS?.[trigger.dataset.v233For];
 reader.querySelectorAll('[data-v233-path-step]').forEach(button=>{
  const active=button.dataset.v233For===trigger.dataset.v233For&&
     button.dataset.v233PathStep===chosen;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 if(steps)v277Reanchor(steps,anchorTop);
 return true;
};
'''
    after = """document.addEventListener('click',e=>{const v=e.target.closest('[data-v232-class-view]'),o=e.target.closest('[data-v232-class-option]'),lv=e.target.closest('[data-v232-level]'),f=e.target.closest('[data-v232-feature]');if(!v&&!o&&!lv&&!f)return;e.preventDefault();e.stopImmediatePropagation();const id=(v||o||lv||f).dataset.v232For;if(v)classView[id]=v.dataset.v232ClassView;if(o)classOption[id]=o.dataset.v232ClassOption;if(lv){classLevel[id]=Number(lv.dataset.v232Level);classFeature[id]=0;}if(f)classFeature[id]=Number(f.dataset.v232Feature);if(lv&&v277UpdateProgression(id,lv,'level'))return;if(f&&v277UpdateProgression(id,f,'feature'))return;if(o&&v277UpdateOptions(id,o))return;renderPage(false);},true);"""
    assert source.count(before)==1, 'Original V2.32 class-level handler changed'
    source=source.replace(before,helper+'\n'+after,1)
    previous = """window.TV33_PATH_LEVELS[b.dataset.v233For]=b.dataset.v233PathStep;renderPage(false);},true);"""
    improved = """window.TV33_PATH_LEVELS[b.dataset.v233For]=b.dataset.v233PathStep;if(window.TerravaleV277RefreshPath?.(b))return;renderPage(false);},true);"""
    assert source.count(previous)==1, 'Original V2.33 class-path handler changed'
    source=source.replace(previous,improved,1)
    return source
