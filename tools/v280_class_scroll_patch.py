"""V2.80 — preserve absolute viewport position when changing class reader content.
V2.77's reanchor used scrollBy() to compensate changes, but can move the page
even when the user never scrolled. Reuse its in-place renderer, not global repaint.
"""
def patch(source: str) -> str:
    before = """function v277Reanchor(element,top){
 if(!element||!element.isConnected)return;
 const delta=element.getBoundingClientRect().top-top;
 if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});
}"""
    after = """function v280PreserveScroll(){
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
}"""
    assert source.count(before)==1, "V2.77 reanchor changed"
    source=source.replace(before,after,1)
    a=""" const anchorTop=grid.getBoundingClientRect().top;
 const focusWasInside=current.contains(document.activeElement);"""
    b=""" const anchorTop=grid.getBoundingClientRect().top;
 const restoreScroll=v280PreserveScroll();
 const focusWasInside=current.contains(document.activeElement);"""
    assert source.count(a)==1
    source=source.replace(a,b,1)
    a=""" v277Reanchor(grid,anchorTop);
 return true;
}
function v277UpdateOptions"""
    b=""" restoreScroll();
 return true;
}
function v277UpdateOptions"""
    assert source.count(a)==1
    source=source.replace(a,b,1)
    a=""" const anchorTop=reader.getBoundingClientRect().top;
 const priorSearch=current.querySelector('[data-v232-opt-query]');"""
    b=""" const anchorTop=reader.getBoundingClientRect().top;
 const restoreScroll=v280PreserveScroll();
 const priorSearch=current.querySelector('[data-v232-opt-query]');"""
    assert source.count(a)==1
    source=source.replace(a,b,1)
    a=""" current.replaceWith(next);
 v277Reanchor(reader,anchorTop);
 return true;"""
    b=""" current.replaceWith(next);
 restoreScroll();
 return true;"""
    assert source.count(a)==1
    source=source.replace(a,b,1)
    a=""" const anchorTop=steps?.getBoundingClientRect().top;
 v277KeepHeight(next,old,reader);"""
    b=""" const anchorTop=steps?.getBoundingClientRect().top;
 const restoreScroll=v280PreserveScroll();
 v277KeepHeight(next,old,reader);"""
    assert source.count(a)==1
    source=source.replace(a,b,1)
    a=""" if(steps)v277Reanchor(steps,anchorTop);
 return true;"""
    b=""" restoreScroll();
 return true;"""
    assert source.count(a)==1
    source=source.replace(a,b,1)
    return source
