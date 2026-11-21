
(function(){'use strict';
 window.TV33_PATH_LEVELS=window.TV33_PATH_LEVELS||{};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-v233-path-step]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();window.TV33_PATH_LEVELS[b.dataset.v233For]=b.dataset.v233PathStep;if(window.TerravaleV277RefreshPath?.(b))return;renderPage(false);},true);
 // DM Chronicle is the only location where Crimsonborn stage progression can be changed.
 const previousDM=renderDM;
 renderDM=function(){const t=document.createElement('template');t.innerHTML=previousDM();if(db.role!=='dm')return t.innerHTML;
  const cs=db.characters.filter(c=>c.campaign===db.campaign&&String(c.ancestry||'').toLowerCase()==='crimsonborn');
  const panel=document.createElement('section');panel.className='v233-stage-section';panel.id='v233-crimson-stages';
  panel.innerHTML='<span class="v2-overline">CAMPAIGN CONTROL · DM ONLY</span><h3>Crimsonborn stages</h3><p>Set each character’s stage here. The positive Blood State cap is +10 at Stage 1, +20 at Stage 2, and +40 from Stage 3 onward.</p><div class="v233-stage-grid">'+(cs.length?cs.map(c=>{const st=Math.max(1,Math.min(5,Number(c.crimsonStage||c.stage)||1));return '<div class="v233-stage-row"><div><b>'+safe(c.name)+'</b><small>Current Stage '+st+' · Blood State '+(Number(c.bloodState)||0)+'</small></div><select aria-label="Crimson Stage for '+safe(c.name)+'" data-v232-stage="'+safe(c.id)+'">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(n===st?'selected':'')+'>Stage '+n+' · +'+(n===1?10:n===2?20:40)+' cap</option>').join('')+'</select></div>'}).join(''):'<p>No Crimsonborn characters in the active campaign.</p>')+'</div>';
  const main=t.content.querySelector('.v2-layout.v2-section')||t.content.querySelector('.v2-section');if(main)main.before(panel);else t.content.append(panel);
  return t.innerHTML;
 };
 // The lab opens focused on its selected node, especially important at phone width.
 const previousPage=renderPage;
 renderPage=function(...args){const result=previousPage(...args);document.title=document.title.replace(/V2\.(?:2[6-9]|3[0-2])/g,'V2.33');
  if(location.hash.replace(/^#/,'').startsWith('/classes/bloodforger/build-lab'))requestAnimationFrame(()=>{
    const vp=document.querySelector('.v232-lab-viewport');if(!vp)return;
    const lab=db.v232BuildLab||{},tree=JSON.parse(document.getElementById('v231-bloodforger-source').textContent).disciplines[lab.tree||'Alteration'];
    const node=tree?.nodes.find(n=>n.id===lab.selected)||tree?.nodes[0],zoom=Math.max(.6,Math.min(1.2,Number(lab.zoom)||.9));if(!node)return;
    vp.scrollLeft=Math.max(0,(node.x+70)*zoom-vp.clientWidth*.38);
    vp.scrollTop=Math.max(0,(node.y+60)*zoom-vp.clientHeight*.52);
  });return result;
 };
 // Named features inside a levelling wizard should be summaries, never a full rules dump.
 renderPage(false);
})();
