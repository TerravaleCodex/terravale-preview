/* In-site Advertisement Atelier. Uses ACTUAL V2 theme tokens and existing
   Supabase DM-only RLS. Pop-ups are artwork-shaped and have no title bar. */
const adsRoot = document.getElementById("tv-v2-ads-manifest");
const ART = adsRoot ? JSON.parse(adsRoot.textContent) : [];
const GRIM_MEAL_ID = "zip-037";
const GRIM_GOURMET_CATEGORY = "grim-gourmet";
const AD_WEIGHTS = Object.freeze([1,3,8]);
const CATEGORY_LABELS = Object.freeze({
 "grim-gourmet":"Grim Gourmet","food-drink":"Food & Drink","dating":"Dating & Romance",
 "pets":"Pets & Companions","wellness":"Health & Lifestyle","magic":"Magic & Alchemy",
 "tech":"Tech & Gadgets","games":"Games & Entertainment",
 "travel":"Travel & Places","services":"Shops & Services","chaos":"Clickbait & Chaos"
});
const categoryKeys = Object.keys(CATEGORY_LABELS);
const safeCategories = value => Array.isArray(value)
  ? [...new Set(value.filter(category=>categoryKeys.includes(category)))]
  : [];
const approvedAdIds = new Set(ART.map(art=>art.id));
let priorityDraft = Object.create(null), categoryDraft=new Set(), showAllPriorityRows=false;
const safePriorities = value => {
  const output=Object.create(null);
  if(value && typeof value==="object" && !Array.isArray(value)){
    for(const [id,weight] of Object.entries(value))
      if(approvedAdIds.has(id) && AD_WEIGHTS.includes(weight) && weight!==1)
        output[id]=weight;
  }
  return output;
};
function eligibleArtwork(config,showing){
  const categories=safeCategories(config?.ad_categories);
  return ART.filter(art=>
    (config?.grim_food_only
      ? art.category===GRIM_GOURMET_CATEGORY
      : (!categories.length || categories.includes(art.category))) &&
    (config?.repeat_ads || !showing.has(art.id)));
}
function chooseArtwork(pool,config,roll=Math.random()){
  if(!pool.length)return null;
  const priorities=safePriorities(config?.ad_priorities);
  const weights=pool.map(art=>priorities[art.id]||1);
  const total=weights.reduce((sum,n)=>sum+n,0);
  let target=Math.min(0.999999999999,Math.max(0,Number(roll)||0))*total;
  for(let i=0;i<pool.length;i++){
    target-=weights[i];
    if(target<0)return pool[i];
  }
  return pool[pool.length-1];
}
const auth = () => window.TerravaleVerifiedAccount;
let settings = null, autoTimer = null, refreshTimer = null, openAds = [], nextIndex = 0;
const escape = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const random = n => Math.floor(Math.random()*Math.max(1,n));
const manifestImage = art => './ads/' + art.id + '.webp';
function enabledOnThisPage() {
  if (!settings || !settings.enabled) return false;
  if(window.TerravaleV2Bridge?.getAdProgress?.()?.enabled)return false;
  const route = location.hash.toLowerCase();
  if (settings.coverage === "dashboard" && !(route === "" || route === "#/" || route.includes("dashboard"))) return false;
  if (settings.coverage === "cabinet" && !route.includes("cabinet")) return false;
  if (settings.coverage === "codex" && !route.includes("codex") && !route.includes("lore")) return false;
  return true;
}
function popupSize(art) {
  const vw = Math.max(300,innerWidth),vh=Math.max(300,innerHeight);
  const scaleKind = settings?.size_mode || "large";
  let base = scaleKind === "huge" ? 950 : scaleKind === "balanced" ? 610 : scaleKind === "mixed" ? [520,680,840,960][random(4)] : 765;
  const safeW = Math.max(150,vw-22),safeH=Math.max(160,vh-32);
  let w = Math.min(base,safeW);
  let h = w * art.height / art.width;
  if (h>safeH) { h=safeH;w=h*art.width/art.height; }
  return {w:Math.round(w),h:Math.round(h)};
}
function adPosition(w,h) {
  const maxX=Math.max(0,innerWidth-w-9),maxY=Math.max(0,innerHeight-h-9);
  const mode=settings?.position_mode || "scatter";
  if(mode==="center")return {x:Math.floor(maxX/2),y:Math.floor(maxY/2)};
  if(mode==="corners"){const pick=random(4);return {x:pick%2?maxX:9,y:pick>1?maxY:9};}
  return {x:Math.round(9+Math.random()*Math.max(0,maxX-9)),y:Math.round(9+Math.random()*Math.max(0,maxY-9))};
}
async function recordAdDismissal(){
  const sb=auth()?.supabase, user=auth()?.state?.user;
  if(!sb || !user)return;
  const {data,error}=await sb.rpc("terravale_register_ad_dismissal");
  if(error){console.warn("Adblockn’t could not record a dismissal:",error.message);return;}
  window.TerravaleV2Bridge?.applyAdProgress?.(data);
  if(data.just_unlocked){
    const heading=document.createElement("div");
    heading.className="tv-adblock-unlock";
    heading.setAttribute("role","status");
    heading.textContent="✦ Adblockn’t unlocked · 25 real pop-ups dismissed";
    document.body.append(heading);
    setTimeout(()=>heading.remove(),8500);
  }
  const burst=Math.max(0,Math.min(50,Number(data.burst)||0));
  if(burst)for(let i=0;i<burst;i++)spawnAd(true);
}
function closeAd(popup,credit=false) {
  if(!popup.isConnected)return;
  popup.remove();openAds=openAds.filter(x=>x.popup!==popup);
  window.dispatchEvent(new CustomEvent("terravale-ad-dismissed"));
  if(credit)recordAdDismissal();
}
function spawnAd(force=false) {
  if (!force && !enabledOnThisPage()) return;
  const maximum=settings?.max_ads;
  if (!force && maximum !== null && maximum !== undefined && openAds.length>=maximum) return;
  const showing=new Set(openAds.map(x=>x.art.id));
  const pool=eligibleArtwork(settings,showing);
  if (!pool.length) return;
  const art=chooseArtwork(pool,settings),size=popupSize(art),pos=adPosition(size.w,size.h);
  const popup=document.createElement("div");
  popup.className="tv-ad-popup";popup.style.width=size.w+"px";popup.style.left=pos.x+"px";popup.style.top=pos.y+"px";
  popup.setAttribute("role","group");popup.setAttribute("aria-label","Terravale advertisement: "+art.title);
  const img=document.createElement("img");
  img.alt=art.alt || art.title;img.src=manifestImage(art);img.draggable=false;
  const close=document.createElement("button");close.className="tv-close";close.textContent="×";
  close.type="button";close.setAttribute("aria-label","Close advertisement");
  close.addEventListener("click",e=>{e.stopPropagation();closeAd(popup,true)});
  popup.append(img,close);document.body.append(popup);openAds.push({popup,art});
  let drag=null;
  popup.addEventListener("pointerdown",e=>{
    if(e.target===close || close.contains(e.target))return;
    popup.style.zIndex=String(10020+ ++nextIndex);
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:popup.offsetLeft,top:popup.offsetTop};
    popup.setPointerCapture(e.pointerId);
  });
  popup.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const x=Math.max(0,Math.min(innerWidth-popup.offsetWidth,drag.left+e.clientX-drag.x));
    const y=Math.max(0,Math.min(innerHeight-popup.offsetHeight,drag.top+e.clientY-drag.y));
    popup.style.left=x+"px";popup.style.top=y+"px";
  });
  const stop=e=>{if(drag&&e.pointerId===drag.id)drag=null;};
  popup.addEventListener("pointerup",stop);popup.addEventListener("pointercancel",stop);
  if(settings?.auto_dismiss_seconds){
    setTimeout(()=>{if(popup.isConnected)closeAd(popup,false)},settings.auto_dismiss_seconds*1000);
  }
}
function clearAds(){for(const item of [...openAds])closeAd(item.popup,false);}
function beginSchedule() {
  if(autoTimer)clearInterval(autoTimer);
  autoTimer=null;
  if(!settings?.enabled || !settings.automatic || window.TerravaleV2Bridge?.getAdProgress?.()?.enabled)return;
  const seconds=Math.max(5,Number(settings.interval_seconds)||120);
  autoTimer=setInterval(()=>{
    if(Math.random()*100 < (settings.chance_percent ?? 100))spawnAd();
  },seconds*1000);
}
async function refreshSettings(){
  const client=auth()?.supabase;if(!client)return;
  const {data,error}=await client.from("site_ad_settings").select("*").eq("id",1).maybeSingle();
  if(error){console.warn("Terravale ad settings unavailable",error.message);return;}
  if(!data)return;
  const old=JSON.stringify(settings);settings=data;
  if(JSON.stringify(settings)!==old)beginSchedule();
  fillForm();
}
function selectField(name,options,value) {
  return '<label>'+escape(name)+'<select data-ad-setting="'+escape(value)+'">'+options.map(([v,label])=>
    '<option value="'+escape(v)+'">'+escape(label)+'</option>').join('')+'</select></label>';
}
function layout(){
  const panel=document.createElement("section");
  panel.className="tv-ad-controls";panel.id="tv-live-atelier";
  panel.innerHTML=`<style>
#tv-live-atelier .tv-toggle{display:flex;align-items:center;gap:12px;min-height:38px;cursor:pointer}
#tv-live-atelier .tv-toggle input[type=checkbox]{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:44px;height:24px;margin:0;border:1px solid #745787;border-radius:24px;background:#272131;cursor:pointer;transition:background .2s}
#tv-live-atelier .tv-toggle input[type=checkbox]:before{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#c8bed3;transition:transform .2s}
#tv-live-atelier .tv-toggle input[type=checkbox]:checked{background:#6c4b8e;border-color:#bd9be2}
#tv-live-atelier .tv-toggle input[type=checkbox]:checked:before{transform:translateX(20px);background:#fff}
#tv-live-atelier .tv-toggle input[type=checkbox]:focus-visible{outline:2px solid #d9bbff;outline-offset:3px}
#tv-live-atelier .tv-ad-slider-label{display:flex;flex-direction:column;gap:14px;position:relative;padding:8px 0}
#tv-live-atelier .tv-ad-slider-label output{position:absolute;right:0;top:8px;font-weight:700;color:#d9b8fb}
#tv-live-atelier .tv-ad-slider-label input[type=range]{width:100%;accent-color:#b68bdf;cursor:pointer}
#tv-live-atelier .tv-ad-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
#tv-live-atelier .tv-ad-button-group{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#tv-live-atelier .tv-ad-button-group button{background:#1b1724;color:#d8cce2;border:1px solid #584763;border-radius:8px;padding:8px 10px;min-height:34px;font-size:12px}
#tv-live-atelier .tv-ad-button-group button[aria-pressed=true]{background:#4c355f;border-color:#bb98e0;color:#fff}
#tv-live-atelier .tv-ad-interval-range{width:100%;accent-color:#b68bdf;margin-top:8px;cursor:pointer}
#tv-live-atelier .tv-ad-interval-readout{display:block;color:#d9b9fa;font-weight:700;margin-top:8px}

</style><header><div><div class="tv-eyebrow">CABINET OF CURIOSITIES · DM CONTROL ROOM</div>
    <h2>Advertisement Atelier</h2><p class="tv-hint">Approved artwork, server-saved settings, every page. Ads remain off until you enable them.</p></div></header>
    <div class="tv-form">
      <label class="tv-toggle"><input type="checkbox" data-ad-setting="enabled">Enable advertisements</label>
      <label class="tv-toggle"><input type="checkbox" data-ad-setting="automatic">Automatic pop-ups</label>
      ${selectField("Average interval",[[5,"5 seconds"],[10,"10 seconds"],[15,"15 seconds"],[20,"20 seconds"],[25,"25 seconds"],[30,"30 seconds"],[45,"45 seconds"],[60,"1 minute"],[75,"75 seconds"],[90,"90 seconds"],[120,"2 minutes"],[150,"2.5 minutes"],[180,"3 minutes"],[240,"4 minutes"],[300,"5 minutes"],[420,"7 minutes"],[600,"10 minutes"],[900,"15 minutes"],[1200,"20 minutes"],[1800,"30 minutes"],[2700,"45 minutes"],[3600,"1 hour"]],"interval_seconds")}
      ${selectField("Simultaneous windows",[["","∞ No maximum"],[1,"1"],[2,"2"],[3,"3"],[4,"4"],[6,"6"],[8,"8"],[10,"10"],[15,"15"],[20,"20"],[30,"30"],[50,"50"],[100,"100"]],"max_ads")}
      <label class="tv-ad-slider-label">Appearance chance <output id="tv-ad-chance-output">100%</output><input type="range" min="0" max="100" step="5" data-ad-setting="chance_percent"></label>
      ${selectField("Artwork size",[["large","Large, preferred"],["huge","Very large"],["balanced","Balanced"],["mixed","Mixed sizes"]],"size_mode")}
      ${selectField("Position",[["scatter","Scatter across screen"],["center","Centre"],["corners","Corners"]],"position_mode")}
      ${selectField("Coverage",[["all","Every page"],["dashboard","Dashboard only"],["codex","Codex only"],["cabinet","Cabinet only"]],"coverage")}
      ${selectField("Auto-dismiss",[["","Never"],[3,"3 seconds"],[5,"5 seconds"],[10,"10 seconds"],[15,"15 seconds"],[20,"20 seconds"],[30,"30 seconds"],[45,"45 seconds"],[60,"1 minute"],[90,"90 seconds"],[120,"2 minutes"],[180,"3 minutes"],[300,"5 minutes"],[600,"10 minutes"],[900,"15 minutes"],[1800,"30 minutes"],[3600,"1 hour"]],"auto_dismiss_seconds")}
      <label class="tv-toggle"><input type="checkbox" data-ad-setting="repeat_ads">Allow duplicate artwork</label>
    </div>
    <section class="tv-ad-frequency" aria-label="Advert frequency and selection">
      <div class="tv-eyebrow">ADVERTISEMENT ROTATION · DM ONLY</div>
      <h3>Which adverts appear?</h3>
      <p class="tv-hint">Choose which categories can appear globally, then make individual artworks more common. These options do not enable adverts automatically.</p>
      <label class="tv-toggle tv-grim-only"><input type="checkbox" data-ad-setting="grim_food_only">Only show Grim Gourmet food adverts (19 designs)</label>
      <p class="tv-hint">Grim Gourmet mode overrides the other category filters. If duplicate artwork is off, each Grim Gourmet design can appear once at a time.</p>
      <div class="tv-ad-category-head">
        <strong>Allowed categories</strong><button type="button" id="tv-ad-category-all" aria-pressed="true">All categories</button>
      </div>
      <div id="tv-ad-category-options" class="tv-ad-category-options" role="group" aria-label="Advert categories allowed to appear"></div>
      <p class="tv-hint" id="tv-ad-category-summary">All approved categories can appear until you choose one.</p>
      <div class="tv-ad-frequency-head">
        <label for="tv-ad-frequency-search">Find an advert</label>
        <input type="search" id="tv-ad-frequency-search" placeholder="Search all 159 approved adverts…" autocomplete="off">
        <button type="button" id="tv-ad-priority-reset">Reset priorities</button>
      </div>
      <div class="tv-ad-priority-list" id="tv-ad-priority-list" aria-label="Advert frequency preferences"></div>
      <button type="button" id="tv-ad-show-all" hidden>Show all adverts</button>
      <p class="tv-hint" id="tv-ad-priority-summary">Normal = 1× · More often = 3× · Spotlight = 8×. Weights affect selection, not overall pop-up frequency.</p>
    </section>
    <section class="tv-adblock-config" aria-label="Adblockn’t progression controls">
      <div class="tv-eyebrow">THE CABINET · EPIC ACHIEVEMENT</div>
      <h3>Adblockn’t</h3>
      <p class="tv-hint">Award the permanent account-wide achievement after a player closes 25 actual advertisement pop-ups. Closing a test advertisement also counts; clearing windows or automatic dismissal does not.</p>
      <div class="tv-adblock-count" id="tv-adblock-progress">Checking your account’s progress…</div>
      <div class="tv-form">
        <label class="tv-toggle"><input type="checkbox" data-ad-setting="adblocknt_enabled">Record real ad dismissals</label>
        <label class="tv-toggle"><input type="checkbox" data-ad-setting="adblocknt_swarm_enabled">Trigger a one-time unlock burst</label>
        ${selectField("Unlock burst size",[[0,"None"],[5,"5 ads"],[10,"10 ads"],[15,"15 ads"],[20,"20 ads (original)"],[25,"25 ads"],[30,"30 ads"],[40,"40 ads"],[50,"50 ads"]],"adblocknt_swarm_size")}
      </div>
    </section>
    <div class="tv-toolbar"><button class="tv-primary" type="button" id="tv-ad-save">Save DM settings</button>
      <button type="button" id="tv-ad-test">Test a random ad</button>
      <button type="button" id="tv-ad-testfive">Test five ads</button>
      <button type="button" id="tv-ad-clear">Clear pop-ups</button></div>
    <p id="tv-ad-save-status" class="tv-hint" aria-live="polite"></p>
    <p class="tv-hint">The windows have no title bars; drag the artwork and use the translucent × to close them. ${ART.length} approved images available in this hosted build.</p>`;
  panel.querySelector('[data-ad-setting="chance_percent"]').addEventListener("input",e=>{panel.querySelector("#tv-ad-chance-output").textContent=e.target.value+"%";});
  const syncs=[];
  for(const key of ["size_mode","position_mode"]){
    const select=panel.querySelector('[data-ad-setting="'+key+'"]'),group=document.createElement("div");
    group.className="tv-ad-button-group";group.setAttribute("role","group");group.setAttribute("aria-label",key==="size_mode"?"Artwork size":"Position");
    const update=()=>group.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===select.value)));
    for(const option of select.options){const b=document.createElement("button");b.type="button";b.dataset.value=option.value;b.textContent=option.textContent;b.onclick=()=>{select.value=b.dataset.value;update();};group.append(b);}
    select.after(group);select.classList.add("tv-ad-visually-hidden");syncs.push(update);
  }
  const interval=panel.querySelector('[data-ad-setting="interval_seconds"]'),opts=[...interval.options],range=document.createElement("input"),readout=document.createElement("output"),shortcuts=document.createElement("div");
  range.type="range";range.min=0;range.max=opts.length-1;range.step=1;range.className="tv-ad-interval-range";range.setAttribute("aria-label","Average interval");
  readout.className="tv-ad-interval-readout";shortcuts.className="tv-ad-button-group";
  interval.after(readout,range,shortcuts);interval.classList.add("tv-ad-visually-hidden");
  const updateInterval=()=>{const i=Math.max(0,opts.findIndex(x=>x.value===interval.value));range.value=i;readout.textContent=opts[i].textContent;shortcuts.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===interval.value)));};
  for(const val of ["5","15","30","60","120","300","600","1800","3600"]){const o=opts.find(x=>x.value===val),b=document.createElement("button");b.type="button";b.dataset.value=val;b.textContent=o.textContent;b.onclick=()=>{interval.value=val;updateInterval();};shortcuts.append(b);}
  range.addEventListener("input",()=>{interval.value=opts[Number(range.value)].value;updateInterval();});
  syncs.push(updateInterval);panel._syncAdControls=()=>syncs.forEach(fn=>fn());panel._syncAdControls();
  panel.querySelector("#tv-ad-save").onclick=saveSettings;
  panel.querySelector("#tv-ad-test").onclick=()=>spawnAd(true);
  panel.querySelector("#tv-ad-testfive").onclick=()=>{for(let i=0;i<5;i++)spawnAd(true)};
  panel.querySelector("#tv-ad-clear").onclick=clearAds;
  panel.querySelector("#tv-ad-category-all").onclick=()=>{
    categoryDraft.clear();renderCategories();renderPriorities();
  };
  panel.querySelector('[data-ad-setting="grim_food_only"]').addEventListener("change",()=>{
    renderCategories();renderPriorities();
  });
  panel.querySelector("#tv-ad-frequency-search").addEventListener("input",()=>{
    showAllPriorityRows=false;renderPriorities();
  });
  panel.querySelector("#tv-ad-show-all").onclick=()=>{
    showAllPriorityRows=!showAllPriorityRows;renderPriorities();
  };
  panel.querySelector("#tv-ad-priority-reset").onclick=()=>{
    priorityDraft=Object.create(null);renderPriorities();
  };
  refreshAdblockStatus(panel);
  return panel;
}
function renderCategories(){
  const panel=document.getElementById("tv-live-atelier");
  if(!panel)return;
  const container=panel.querySelector("#tv-ad-category-options");
  const onlyGrim=panel.querySelector('[data-ad-setting="grim_food_only"]').checked;
  container.replaceChildren();
  for(const category of categoryKeys){
    const count=ART.filter(x=>x.category===category).length;
    if(!count)continue;
    const button=document.createElement("button");
    button.type="button";button.className="tv-ad-category-pill";
    const enabled=!categoryDraft.size||categoryDraft.has(category);
    button.dataset.active=enabled?"true":"false";
    button.setAttribute("aria-pressed",enabled?"true":"false");
    button.disabled=onlyGrim;
    button.textContent=CATEGORY_LABELS[category]+" · "+count;
    button.onclick=()=>{
      if(!categoryDraft.size)categoryDraft.add(category);
      else if(categoryDraft.has(category))categoryDraft.delete(category);
      else categoryDraft.add(category);
      renderCategories();renderPriorities();
    };
    container.append(button);
  }
  const all=panel.querySelector("#tv-ad-category-all");
  all.disabled=onlyGrim;
  all.setAttribute("aria-pressed",categoryDraft.size?"false":"true");
  const amount=eligibleArtwork({
    grim_food_only:onlyGrim,ad_categories:[...categoryDraft],repeat_ads:true
  },new Set()).length;
  panel.querySelector("#tv-ad-category-summary").textContent=
    onlyGrim?"Grim Gourmet only: "+amount+" designs can appear.":
    categoryDraft.size?"Selected "+categoryDraft.size+" categor"+(categoryDraft.size===1?"y":"ies")+
      " · "+amount+" matching adverts can appear.":
      "All "+ART.length+" adverts are eligible, subject to your normal pop-up settings.";
}
function renderPriorities(){
  const panel=document.getElementById("tv-live-atelier");
  if(!panel)return;
  const container=panel.querySelector("#tv-ad-priority-list");
  const query=panel.querySelector("#tv-ad-frequency-search").value.trim().toLowerCase();
  const allowed=new Set(eligibleArtwork({
    grim_food_only:panel.querySelector('[data-ad-setting="grim_food_only"]').checked,
    ad_categories:[...categoryDraft],repeat_ads:true
  },new Set()).map(x=>x.id));
  const selected=ART.filter(art=>allowed.has(art.id) &&
    (art.title.toLowerCase().includes(query)||art.id.includes(query)||
      CATEGORY_LABELS[art.category]?.toLowerCase().includes(query)))
    .sort((a,b)=>(priorityDraft[b.id]||1)-(priorityDraft[a.id]||1));
  const showAll=panel.querySelector("#tv-ad-show-all");
  showAll.hidden=selected.length<=12;
  showAll.textContent=showAllPriorityRows?"Show fewer adverts":"Show all "+selected.length+" adverts";
  const visible=showAllPriorityRows?selected:selected.slice(0,12);
  container.replaceChildren();
  for(const art of visible){
    const row=document.createElement("div");row.className="tv-ad-priority-row";
    const thumb=document.createElement("img");thumb.src=manifestImage(art);thumb.alt="";thumb.loading="lazy";
    const title=document.createElement("span");title.textContent=art.title;title.title=art.title;
    const button=document.createElement("button");button.type="button";
    button.dataset.artId=art.id;button.className="tv-ad-weight";
    const refresh=()=>{
      const weight=priorityDraft[art.id]||1;
      button.textContent=weight===1?"Normal · 1×":weight===3?"More often · 3×":"Spotlight · 8×";
      button.dataset.weight=String(weight);
      button.setAttribute("aria-label",art.title+": "+button.textContent+". Click to change.");
    };
    button.onclick=()=>{
      const previous=priorityDraft[art.id]||1;
      const next=AD_WEIGHTS[(AD_WEIGHTS.indexOf(previous)+1)%AD_WEIGHTS.length];
      if(next===1)delete priorityDraft[art.id];else priorityDraft[art.id]=next;
      refresh();
      updatePrioritySummary(panel);
    };
    refresh();row.append(thumb,title,button);container.append(row);
  }
  updatePrioritySummary(panel);
}
function updatePrioritySummary(panel){
  const count=Object.keys(priorityDraft).length;
  panel.querySelector("#tv-ad-priority-summary").textContent=
    count+" prioritised · Normal = 1× · More often = 3× · Spotlight = 8×. "+
    "Weights affect which advert is chosen, not the number of pop-ups.";
}
function refreshAdblockStatus(panel=document.getElementById("tv-live-atelier")){
  const state=window.TerravaleV2Bridge?.getAdProgress?.();
  const output=panel?.querySelector("#tv-adblock-progress");
  if(!output)return;
  output.textContent=state?String(Math.min(25,state.count))+" / 25 closed · "+(state.unlocked?"Discovered":"Locked"):"Progress is stored against your Discord account";
}
window.addEventListener("terravale-adblocknt-progress",()=>{refreshAdblockStatus();beginSchedule();});
function fillForm(){
  const panel=document.getElementById("tv-live-atelier");
  if(!panel || !settings)return;
  for(const item of panel.querySelectorAll("[data-ad-setting]")){
    const key=item.dataset.adSetting,value=settings[key];
    if(item.type==="checkbox")item.checked=Boolean(value);
    else item.value=value == null ? "" : String(value);
  }
  priorityDraft=safePriorities(settings.ad_priorities);
  categoryDraft=new Set(safeCategories(settings.ad_categories));
  renderCategories();
  renderPriorities();
  panel._syncAdControls?.();
}
async function saveSettings(){
  const panel=document.getElementById("tv-live-atelier");
  const profile=auth()?.state.profile;
  if(!panel || !profile?.is_dm)return;
  const get=k=>panel.querySelector('[data-ad-setting="'+k+'"]');
  const optionalNumber=k=>get(k).value==="" ? null : Number(get(k).value);
  const patch={
    enabled:get("enabled").checked,automatic:get("automatic").checked,
    interval_seconds:Number(get("interval_seconds").value),
    max_ads:optionalNumber("max_ads"),
    chance_percent:Number(get("chance_percent").value),
    size_mode:get("size_mode").value,position_mode:get("position_mode").value,
    coverage:get("coverage").value,auto_dismiss_seconds:optionalNumber("auto_dismiss_seconds"),
    repeat_ads:get("repeat_ads").checked,
    grim_food_only:get("grim_food_only").checked,
    ad_categories:[...categoryDraft],
    ad_priorities:safePriorities(priorityDraft),
    adblocknt_enabled:get("adblocknt_enabled").checked,
    adblocknt_swarm_enabled:get("adblocknt_swarm_enabled").checked,
    adblocknt_swarm_size:Number(get("adblocknt_swarm_size").value)
  };
  const label=panel.querySelector("#tv-ad-save-status");label.textContent="Saving to Terravale…";
  const {data,error}=await auth().supabase.from("site_ad_settings")
    .update(patch).eq("id",1).select("*").single();
  if(error){label.textContent="Save failed: "+error.message;return;}
  settings=data;beginSchedule();fillForm();refreshAdblockStatus();label.textContent="Saved securely. Changes apply throughout Terravale.";
}
function mountAtelier(){
  if(!auth()?.state.profile?.is_dm)return;
  const hash=location.hash.toLowerCase();
  if(!hash.includes("cabinet"))return;
  const root=document.getElementById("pageRoot");
  if(!root || root.querySelector("#tv-live-atelier"))return;
  // Only append to the existing Cabinet: never replace achievements.
  root.append(layout());fillForm();
}
let observer=null,scheduled=false;
function start(){
  refreshSettings();
  if(refreshTimer)clearInterval(refreshTimer);
  refreshTimer=setInterval(refreshSettings,60000);
  window.addEventListener("hashchange",()=>setTimeout(mountAtelier,120));
  observer=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;mountAtelier()});
  });
  observer.observe(document.getElementById("pageRoot")||document.body,{childList:true,subtree:true});
  mountAtelier();
}
if(auth()?.state.ready)start();
else window.addEventListener("terravale-auth-ready",start,{once:true});
