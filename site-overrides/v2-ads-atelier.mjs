/* In-site Advertisement Atelier. Uses ACTUAL V2 theme tokens and existing
   Supabase DM-only RLS. Pop-ups are artwork-shaped and have no title bar. */
const adsRoot = document.getElementById("tv-v2-ads-manifest");
const ART = adsRoot ? JSON.parse(adsRoot.textContent) : [];
const auth = () => window.TerravaleVerifiedAccount;
let settings = null, autoTimer = null, refreshTimer = null, openAds = [], nextIndex = 0;
const escape = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const random = n => Math.floor(Math.random()*Math.max(1,n));
const manifestImage = art => './ads/' + art.id + '.webp';
function enabledOnThisPage() {
  if (!settings || !settings.enabled) return false;
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
  const pool=ART.filter(a=>settings?.repeat_ads || !showing.has(a.id));
  if (!pool.length) return;
  const art=pool[random(pool.length)],size=popupSize(art),pos=adPosition(size.w,size.h);
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
  if(!settings?.enabled || !settings.automatic)return;
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
  panel.innerHTML=`<header><div><div class="tv-eyebrow">CABINET OF CURIOSITIES · DM CONTROL ROOM</div>
    <h2>Advertisement Atelier</h2><p class="tv-hint">Approved artwork, server-saved settings, every page. Ads remain off until you enable them.</p></div></header>
    <div class="tv-form">
      <label class="tv-toggle"><input type="checkbox" data-ad-setting="enabled">Enable advertisements</label>
      <label class="tv-toggle"><input type="checkbox" data-ad-setting="automatic">Automatic pop-ups</label>
      ${selectField("Average interval",[[15,"15 seconds"],[30,"30 seconds"],[45,"45 seconds"],[60,"1 minute"],[90,"90 seconds"],[120,"2 minutes"],[180,"3 minutes"],[300,"5 minutes"],[600,"10 minutes"],[900,"15 minutes"],[1800,"30 minutes"],[3600,"1 hour"]],"interval_seconds")}
      ${selectField("Simultaneous windows",[["","∞ No maximum"],[1,"1"],[2,"2"],[3,"3"],[4,"4"],[6,"6"],[8,"8"],[10,"10"],[15,"15"],[20,"20"],[30,"30"],[50,"50"],[100,"100"]],"max_ads")}
      ${selectField("Appearance chance",[[0,"0%"],[5,"5%"],[10,"10%"],[20,"20%"],[30,"30%"],[40,"40%"],[50,"50%"],[60,"60%"],[70,"70%"],[80,"80%"],[90,"90%"],[95,"95%"],[100,"100%"]],"chance_percent")}
      ${selectField("Artwork size",[["large","Large, preferred"],["huge","Very large"],["balanced","Balanced"],["mixed","Mixed sizes"]],"size_mode")}
      ${selectField("Position",[["scatter","Scatter across screen"],["center","Centre"],["corners","Corners"]],"position_mode")}
      ${selectField("Coverage",[["all","Every page"],["dashboard","Dashboard only"],["codex","Codex only"],["cabinet","Cabinet only"]],"coverage")}
      ${selectField("Auto-dismiss",[["","Never"],[10,"10 seconds"],[20,"20 seconds"],[30,"30 seconds"],[60,"1 minute"],[120,"2 minutes"],[300,"5 minutes"]],"auto_dismiss_seconds")}
      <label class="tv-toggle"><input type="checkbox" data-ad-setting="repeat_ads">Allow duplicate artwork</label>
    </div>
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
  panel.querySelector("#tv-ad-save").onclick=saveSettings;
  panel.querySelector("#tv-ad-test").onclick=()=>spawnAd(true);
  panel.querySelector("#tv-ad-testfive").onclick=()=>{for(let i=0;i<5;i++)spawnAd(true)};
  panel.querySelector("#tv-ad-clear").onclick=clearAds;
  refreshAdblockStatus(panel);
  return panel;
}
function refreshAdblockStatus(panel=document.getElementById("tv-live-atelier")){
  const state=window.TerravaleV2Bridge?.getAdProgress?.();
  const output=panel?.querySelector("#tv-adblock-progress");
  if(!output)return;
  output.textContent=state?String(Math.min(25,state.count))+" / 25 closed · "+(state.unlocked?"Discovered":"Locked"):"Progress is stored against your Discord account";
}
window.addEventListener("terravale-adblocknt-progress",()=>refreshAdblockStatus());
function fillForm(){
  const panel=document.getElementById("tv-live-atelier");
  if(!panel || !settings)return;
  for(const item of panel.querySelectorAll("[data-ad-setting]")){
    const key=item.dataset.adSetting,value=settings[key];
    if(item.type==="checkbox")item.checked=Boolean(value);
    else item.value=value == null ? "" : String(value);
  }
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
