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
  const shape=()=>{const wrapper=document.createElement("span");wrapper.className="tv-season-leaf";
    wrapper.innerHTML='<svg viewBox="0 0 42 64" aria-hidden="true" focusable="false"><path d="M20 58 C-5 36 2 13 24 3 C49 15 49 40 20 58 Z" class="tv-leaf-body"/><path d="M20 57 C21 41 25 27 26 8 M22 44 L10 31 M24 34 L35 21 M25 23 L14 16" class="tv-leaf-veins"/></svg>';
    return wrapper};
  function createSeasonalLeaves(){
    const root=document.getElementById("tv-growing-vines");
    if(!root)return;
    if(root.dataset.version==="v248-leaves"&&root.children.length)return;
    root.replaceChildren();root.dataset.version="v248-leaves";
    // Deterministic natural-looking distribution, with most foliage at
    // the edges and a few faint leaves crossing the centre.
    let seed=173806;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    for(let i=0;i<36;i++){
      const leaf=shape();
      const edge=i%4===0?8+random()*18:i%4===1?75+random()*18:i%4===2?1+random()*20:73+random()*25;
      const x=i%9===0?25+random()*50:edge;
      const y=4+random()*76;
      const size=18+random()*30;
      const duration=93+random()*76;
      const delay=-(random()*duration);
      const fallX=(random()-.5)*175;
      const fallY=130+random()*270;
      const rot=(random()-.5)*80;
      leaf.style.cssText="--lx:"+x.toFixed(2)+"%;--ly:"+y.toFixed(2)+"%;"+
        "--ls:"+size.toFixed(1)+"px;--leaf-dur:"+duration.toFixed(1)+"s;"+
        "--leaf-delay:"+delay.toFixed(1)+"s;--fall-x:"+fallX.toFixed(1)+"px;"+
        "--fall-y:"+fallY.toFixed(1)+"px;--leaf-rot:"+rot.toFixed(1)+"deg;";
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
  const observer=new MutationObserver(schedule);
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
