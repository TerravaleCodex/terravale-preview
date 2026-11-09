/* V2.48. Earned-only Crimson variant and seasonal Verdant leaves.
   Cosmetic controls never grant privileges or achievements. */
(function(){
  "use strict";
  const state={unlocked:false,checked:false,wanted:"velvet"};
  window.TerravaleCrimsonVariant={
    get:()=>state.wanted,
    isUnlocked:()=>state.checked&&state.unlocked,
    applyFromCloud:value=>{
      state.wanted=value==="obsidian"?"obsidian":"velvet";
      applyVariant();schedule();
    }
  };
  window.addEventListener("terravale-online-appearance",e=>{
    state.wanted=e.detail?.crimson_variant==="obsidian"?"obsidian":"velvet";
    applyVariant();schedule();
  });
  const profile=()=>window.TerravaleVerifiedAccount?.state;
  const sb=()=>window.TerravaleVerifiedAccount?.supabase;
  function applyVariant(){
    const active=state.checked&&state.unlocked&&state.wanted==="obsidian";
    document.body.dataset.tvCrimsonVariant=active?"obsidian":"standard";
    document.querySelectorAll("#tv-crimson-moon").forEach(b=>{
      b.setAttribute("aria-pressed",String(active));
      b.setAttribute("aria-label",active?"Use original Velvet Crimson Court":"Switch to Black & Red Crimson Court");
      b.title=active?"Use Velvet Crimson Court":"Black & Red Crimson Court · Seeing Red reward";
      b.classList.toggle("active",active);
    });
  }
  async function checkEntitlement(){
    if(!profile()?.ready){state.checked=false;state.unlocked=false;applyVariant();return false}
    const {data,error}=await sb().rpc("terravale_crimson_variant_entitlement");
    if(error){console.warn("Crimson entitlement could not be verified:",error.message);return false}
    state.unlocked=Boolean(data);state.checked=true;
    applyVariant();schedule();
    return state.unlocked;
  }
  function mountMoon(){
    // In the actual theme-card footer, beside 'Preview/Current theme'.
    const root=document.getElementById("pageRoot");
    const route=location.hash.toLowerCase();
    if(!root||!route.includes("appearance"))return;
    root.querySelectorAll("#tv-crimson-variant").forEach(x=>x.remove());
    const action=root.querySelector('button[data-action="theme"][data-id="crimson"]');
    if(!action)return;
    const card=action.closest(".theme-card");
    if(!card)return;
    let button=card.querySelector("#tv-crimson-moon");
    if(!state.unlocked||!state.checked){
      button?.remove();
      return;
    }
    if(!button){
      button=document.createElement("button");button.type="button";
      button.id="tv-crimson-moon";button.className="tv-crimson-moon";
      button.textContent="☾";
      button.addEventListener("click",async()=>{
        if(!state.checked||!state.unlocked)return;
        const before=state.wanted;
        state.wanted=before==="obsidian"?"velvet":"obsidian";
        if(document.body.dataset.theme!=="crimson"&&typeof setTheme==="function")setTheme("crimson");
        applyVariant();
        const result=await window.TerravaleLivePreferences?.setVariant(state.wanted);
        if(result===false){
          state.wanted=before;
          applyVariant();
        }
      });
      action.after(button);
    }
    applyVariant();
  }
  // V2.49: individual, stemless leaves rather than vines or angular branches.
  // Each leaf begins as a bud, grows quietly, drifts down, then grows again.
  const outlines=[
    '<svg viewBox="0 0 42 60" aria-hidden="true" focusable="false"><path class="tv-leaf-body" d="M21 56C8 49 3 37 5 24 7 11 20 4 35 3c1 15-3 31-14 53Z"/><path class="tv-leaf-line" d="M20 52C24 37 29 20 34 7"/></svg>',
    '<svg viewBox="0 0 42 60" aria-hidden="true" focusable="false"><path class="tv-leaf-body" d="M22 56C3 43 1 27 12 14 18 7 29 4 34 3c5 27-2 45-12 53Z"/><path class="tv-leaf-line" d="M22 53C24 37 29 19 33 8"/></svg>',
    '<svg viewBox="0 0 42 60" aria-hidden="true" focusable="false"><path class="tv-leaf-body" d="M22 55C12 53 7 44 7 29c0-11 9-19 24-25 8 27 3 43-9 51Z"/><path class="tv-leaf-line" d="M21 53C24 36 28 22 31 9"/></svg>'
  ];
  const shape=i=>{
    const leaf=document.createElement("span");
    leaf.className="tv-season-leaf";
    leaf.innerHTML=outlines[i%outlines.length];
    return leaf;
  };
  function createSeasonalLeaves(){
    const root=document.getElementById("tv-growing-vines");
    if(!root)return;
    if(root.dataset.version==="v249-leaves"&&root.children.length)return;
    root.replaceChildren();
    root.dataset.version="v249-leaves";
    // Restrict foliage to the margins. The story stays readable.
    let seed=173806;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    const count=28;
    for(let i=0;i<count;i++){
      const leaf=shape(i+Math.floor(random()*3));
      const edge=i%2===0?1+random()*20:79+random()*19;
      const x=i%11===0?29+random()*42:edge;
      const y=5+random()*70;
      const size=17+random()*18;
      const duration=84+random()*38;
      const delay=random()*12; // No negative delays: the first cycle actually grows from nothing.
      const fallX=(random()-.5)*140;
      const fallY=170+random()*280;
      const rot=(random()-.5)*88;
      const tilt=(random()-.5)*32;
      leaf.style.cssText=
        "--lx:"+x.toFixed(2)+"%;--ly:"+y.toFixed(2)+"%;"+
        "--ls:"+size.toFixed(1)+"px;--leaf-dur:"+duration.toFixed(1)+"s;"+
        "--leaf-delay:"+delay.toFixed(1)+"s;--fall-x:"+fallX.toFixed(1)+"px;"+
        "--fall-y:"+fallY.toFixed(1)+"px;--leaf-rot:"+rot.toFixed(1)+"deg;"+
        "--leaf-tilt:"+tilt.toFixed(1)+"deg;";
      root.append(leaf);
    }
  }
  let queued=false;
  function schedule(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      if(document.body.dataset.theme==="verdant")createSeasonalLeaves();
      mountMoon();
    });
  }
  // V2.76: chat and initiative updates do not require a theme/gallery scan.
  const observer=new MutationObserver(()=>{
    const visible=location.hash.toLowerCase().includes("appearance");
    if(document.body.dataset.theme==="verdant"||visible)schedule();
  });
  observer.observe(document.getElementById("pageRoot")||document.body,{childList:true,subtree:true});
  document.body.addEventListener("transitionend",e=>{if(e.target===document.body)schedule()});
  window.addEventListener("hashchange",()=>setTimeout(schedule,45));
  window.addEventListener("terravale-auth-ready",()=>{checkEntitlement();schedule()},{once:true});
  window.addEventListener("terravale-achievement-unlocked",e=>{
    if(e.detail?.key==="seeing_red")checkEntitlement();
  });
  window.addEventListener("terravale-achievement-synced",checkEntitlement);
  if(profile()?.ready)checkEntitlement();
  else applyVariant();
  schedule();
})();
