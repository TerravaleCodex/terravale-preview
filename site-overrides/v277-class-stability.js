/* V2.77 — keep the clicked Class Codex accordion in place.
   Only acts in Class/Ancestry reference pages; no global scroll overrides. */
(function(){
'use strict';
let pending=false;
const interested='.sheet226-class-level-card>summary,'+
 '.sheet226-class-option>summary,.v232-progression-table details>summary,'+
 '.v223-feature-detail>summary,.v224-option-body>summary';
function page(){
 const root=document.getElementById('pageRoot');
 return root?.classList.contains('page-reference')?root:null;
}
document.addEventListener('click',event=>{
 const summary=event.target.closest?.('summary');
 if(!summary||!summary.matches(interested))return;
 const root=page();
 if(!root||!root.contains(summary))return;
 const block=summary.parentElement;
 if(!block||block.tagName!=='DETAILS')return;
 const route=location.hash,top=summary.getBoundingClientRect().top;
 const oldHeight=Math.ceil(root.getBoundingClientRect().height);
 const viewportBottom=window.scrollY+window.innerHeight;
 const remaining=document.documentElement.scrollHeight-viewportBottom;
 const collapseHeight=Math.max(0,block.scrollHeight-summary.offsetHeight);
 // A collapse near the end of the page can otherwise clamp scrollY and
 // throw the selected heading out of view. Retain a temporary height floor.
 if(block.open&&remaining<collapseHeight+30){
  root.style.minHeight=Math.max(oldHeight,Number(root.dataset.tv277MinHeight)||0)+'px';
  root.dataset.tv277MinHeight=String(Math.max(oldHeight,Number(root.dataset.tv277MinHeight)||0));
 }
 if(pending)return;
 pending=true;
 requestAnimationFrame(()=>{
  pending=false;
  if(location.hash!==route||!summary.isConnected||page()!==root)return;
  const delta=summary.getBoundingClientRect().top-top;
  if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});
 });
},true);
window.addEventListener('hashchange',()=>{
 const root=document.getElementById('pageRoot');
 if(root?.dataset.tv277MinHeight){
  root.style.removeProperty('min-height');
  delete root.dataset.tv277MinHeight;
 }
});
})();