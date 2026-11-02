/* Terravale Bloodforger V2: visual layout adapter for the existing published Next.js build.
   Safe boundary: never modifies character state, React handlers, purchases or cloud data.
   The build workflow prepends the exact approved layout algorithm + source diagram JSON. */
(function () {
  'use strict';
  const graphs = BLOODFORGER_V2_GRAPHS;
  const states = new WeakMap();
  const layoutCache = new Map();
  let pending = false;
  const limit = value => Math.max(.25, Math.min(1.6, value));

  function codeOf(button) {
    const raw = button.querySelector('.tree-node-top > span')?.textContent || '';
    return raw.split('·')[0].trim();
  }
  function graphOf(shell) {
    const heading = shell.querySelector('.tree-map-top > strong')?.textContent?.trim() || '';
    const name = Object.keys(graphs).find(key => heading === key || heading.startsWith(key + ' / '));
    if (!name) return null;
    const branch = heading.startsWith(name + ' / ') ? heading.slice(name.length + 3).trim() : 'All branches';
    return {name, branch, graph:graphs[name]};
  }
  function setStyle(element, property, value) {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  }
  function setAttr(element, name, value) {
    if (element.getAttribute(name) !== String(value)) element.setAttribute(name, String(value));
  }
  function getZoom(stage, state) {
    if (state.zoomOverride != null) return state.zoomOverride;
    const match = (stage.style.transform || '').match(/scale\(([\d.]+)\)/);
    return match ? Number(match[1]) : 1;
  }
  function ancestors(graph, id) {
    const route = new Set();
    const seen = new Set();
    const todo = [id];
    while (todo.length) {
      const child = todo.pop();
      if (seen.has(child)) continue;
      seen.add(child);
      for (const e of graph.edges) {
        if (e.to === child) {
          route.add(e.from + '>' + e.to);
          todo.push(e.from);
        }
      }
    }
    return route;
  }
  function controls(shell, stage, scroll, state) {
    const zoom = shell.querySelector('.tree-zoom');
    if (!zoom) return;
    // Reuse the real React toolbar buttons when the source already provides
    // Fit/Centre. The previous adapter appended another pair on every mount.
    const buttons=[...zoom.querySelectorAll('button')];
    let fit=zoom.querySelector('[data-bf2-control="fit"]') ||
      buttons.find(button=>button.textContent.trim().toLowerCase()==='fit');
    let center=zoom.querySelector('[data-bf2-control="centre"]') ||
      buttons.find(button=>/^(centre|center)$/i.test(button.textContent.trim()));
    const originalFit=Boolean(fit), originalCenter=Boolean(center);
    if(!fit){
      fit=document.createElement('button');fit.type='button';fit.textContent='Fit';
      zoom.insertBefore(fit,zoom.firstElementChild);
    }
    if(!center){
      center=document.createElement('button');center.type='button';center.textContent='Centre';
      zoom.insertBefore(center,fit.nextSibling);
    }
    fit.dataset.bf2Control='fit';center.dataset.bf2Control='centre';
    fit.title='Fit the entire skill tree to this viewport';
    center.title='Return to foundation nodes';
    if(!fit.dataset.bf2Bound){
      fit.dataset.bf2Bound='1';
      fit.addEventListener('click',event=>{
        // Prevent the original Next handler from fitting obsolete geometry.
        if(originalFit){event.preventDefault();event.stopPropagation();}
        state.zoomOverride=limit((scroll.clientWidth-28)/state.layout.width);
        schedule();
        requestAnimationFrame(()=>{scroll.scrollLeft=0;scroll.scrollTop=0;});
      },true);
    }
    if(!center.dataset.bf2Bound){
      center.dataset.bf2Bound='1';
      center.addEventListener('click',event=>{
        if(originalCenter){event.preventDefault();event.stopPropagation();}
        scroll.scrollLeft=Math.max(0,(state.layout.width*getZoom(stage,state)-scroll.clientWidth)/2);
        scroll.scrollTop=0;
      },true);
    }
    for (const kind of ['Zoom in','Zoom out']) {
      const btn = zoom.querySelector('button[aria-label="' + kind + '"]');
      if (!btn || btn.dataset.bf2ZoomBound) continue;
      btn.dataset.bf2ZoomBound = '1';
      btn.addEventListener('click', e => {
        if (state.zoomOverride == null) return; // existing React buttons still work normally
        e.preventDefault();
        e.stopPropagation();
        state.zoomOverride = limit(state.zoomOverride + (kind === 'Zoom in' ? .1 : -.1));
        schedule();
      });
    }
    if (scroll.dataset.bf2GestureBound) return;
    scroll.dataset.bf2GestureBound = '1';
    const pointers = new Map();
    let dragged = false;
    scroll.style.touchAction = 'none';
    scroll.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && (e.button !== 0 || e.target.closest('button'))) return;
      if (!pointers.size) dragged = false;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if (e.pointerType === 'mouse') scroll.setPointerCapture(e.pointerId);
    });
    scroll.addEventListener('pointermove', e => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const dx = e.clientX-previous.x, dy = e.clientY-previous.y;
      if (Math.abs(dx)+Math.abs(dy) > 4) dragged = true;
      if (pointers.size === 1) {
        scroll.scrollLeft -= dx;
        scroll.scrollTop -= dy;
      } else if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
        if (other) {
          const before = Math.hypot(previous.x-other.x,previous.y-other.y);
          const after = Math.hypot(e.clientX-other.x,e.clientY-other.y);
          if (before > 8 && after > 8) {
            const old = getZoom(stage,state), next = limit(old*after/before);
            if (Math.abs(next-old)>.002) {
              const r=scroll.getBoundingClientRect();
              const cx=(e.clientX+other.x)/2-r.left,cy=(e.clientY+other.y)/2-r.top;
              state.zoomOverride = next;
              schedule();
              requestAnimationFrame(()=>{
                scroll.scrollLeft = (scroll.scrollLeft+cx)*(next/old)-cx;
                scroll.scrollTop = (scroll.scrollTop+cy)*(next/old)-cy;
              });
            }
          }
        }
      }
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    },{passive:true});
    const end = e => {
      pointers.delete(e.pointerId);
      if (scroll.hasPointerCapture(e.pointerId)) scroll.releasePointerCapture(e.pointerId);
    };
    scroll.addEventListener('pointerup',end);
    scroll.addEventListener('pointercancel',end);
    // Do not select a technique accidentally after a drag, but keep normal clicks.
    scroll.addEventListener('click',e=>{
      if (!dragged) return;
      dragged = false;
      e.preventDefault();e.stopPropagation();
    },true);
  }
  function apply(stage) {
    const shell = stage.closest('.tree-map-shell');
    if (!shell) return;
    const target = graphOf(shell);
    if (!target) return;
    const {name,branch,graph}=target;
    const buttons = [...stage.querySelectorAll('.tree-node')];
    const paths = [...stage.querySelectorAll('.tree-connections path')];
    const cacheKey = name + '/' + branch;
    if (!layoutCache.has(cacheKey)) layoutCache.set(cacheKey, layoutSkillGraph(graph,branch));
    const layout = layoutCache.get(cacheKey);
    const positions = new Map(layout.placed.map(n=>[n.code,n]));
    const byCode = new Map(graph.nodes.map(n=>[n.code,n.id]));
    // Abort rather than risk replacing React geometry against mismatched diagram data.
    if (buttons.length !== layout.placed.length || paths.length !== layout.paths.length ||
        buttons.some(b=>!positions.has(codeOf(b)))) return;
    let state=states.get(stage);
    if (!state) {state={signature:'',zoomOverride:null,layout};states.set(stage,state);}
    const changed = state.signature !== cacheKey;
    if (changed) {state.signature=cacheKey;state.zoomOverride=null;}
    state.layout=layout;
    const scroll=stage.closest('.tree-scroll');
    const container=stage.closest('.tree-stage-container');
    const svg=stage.querySelector('.tree-connections');
    if (!scroll || !container || !svg) return;
    controls(shell,stage,scroll,state);
    const scale=getZoom(stage,state);
    setStyle(stage,'width',layout.width+'px');
    setStyle(stage,'height',layout.height+'px');
    if (state.zoomOverride!=null) setStyle(stage,'transform','scale('+scale+')');
    setStyle(container,'width',Math.round(layout.width*scale)+'px');
    setStyle(container,'height',Math.round(layout.height*scale)+'px');
    setAttr(svg,'width',layout.width);setAttr(svg,'height',layout.height);
    setAttr(svg,'viewBox','0 0 '+layout.width+' '+layout.height);
    for(const button of buttons){
      const node=positions.get(codeOf(button));
      setStyle(button,'left',node.x+'px');setStyle(button,'top',node.y+'px');
      setStyle(button,'width',NODE_WIDTH+'px');
      setStyle(button,'height',NODE_HEIGHT+'px');
    }
    const lanes = new Map(layout.lanes.map(l=>[l.name,l]));
    for(const label of stage.querySelectorAll('.tree-lane-label')){
      const lane=lanes.get(label.textContent.trim());
      if (lane){setStyle(label,'left',lane.x+'px');setStyle(label,'width',lane.width+'px');}
    }
    const focusedCode = buttons.find(b=>b.classList.contains('focused'))?.querySelector('.tree-node-top > span')?.textContent?.split('·')[0].trim();
    const trail = focusedCode ? ancestors(graph,byCode.get(focusedCode)) : new Set();
    for(let i=0;i<paths.length;i++){
      const path=paths[i], item=layout.paths[i];
      setAttr(path,'d',item.d);
      const selected=trail.has(item.key);
      if(path.classList.contains('bf2-route')!==selected) path.classList.toggle('bf2-route',selected);
      if(path.classList.contains('bf2-muted')!==Boolean(focusedCode&&!selected)) path.classList.toggle('bf2-muted',Boolean(focusedCode&&!selected));
    }
    const display=shell.querySelector('.tree-zoom > span');
    if(display && state.zoomOverride!=null && display.textContent!==Math.round(scale*100)+'%') display.textContent=Math.round(scale*100)+'%';
    if(changed) requestAnimationFrame(()=>{
      scroll.scrollLeft=Math.max(0,(layout.width*getZoom(stage,state)-scroll.clientWidth)/2);
      scroll.scrollTop=0;
    });
  }
  function scan(){
    pending=false;
    for(const stage of document.querySelectorAll('.tree-stage')){
      try{apply(stage);}catch(error){console.warn('Bloodforger V2 presentation fallback:',error);}
    }
  }
  function schedule(){
    if(pending) return;pending=true;requestAnimationFrame(scan);
  }
  const observer = new MutationObserver(records=>{
    for(const mutation of records){
      const el = mutation.target;
      if(el instanceof Element && (el.closest('.tree-map-shell') ||
         (mutation.type==='childList' && [...mutation.addedNodes].some(n=>n.nodeType===1 && (n.matches?.('.tree-map-shell') || n.querySelector?.('.tree-map-shell')))))) {
        schedule();return;
      }
      if(mutation.type==='childList' && document.querySelector('.tree-stage')){schedule();return;}
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','d','width','height','viewBox','aria-label']});
  schedule();
})();
