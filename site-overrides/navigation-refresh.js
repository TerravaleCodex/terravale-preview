/* Published-site navigation overlay for compiled Next shell and standalone shared sidebar.
 * Preserve the underlying hydrated React tree, campaign state and existing routes.
 */
(function(){
 "use strict";
 const PREFIX="/terravale-preview/";
 const GROUP_KEY="terravale.ui.sidebar.groups.v1";
 const groups=[
  {id:"workspace",name:"Workspace",open:true,links:[["/","◈","Dashboard"],["/campaigns","♧","Campaigns"],["/party","⚄","Session Room"]]},
  {id:"characters",name:"Characters",open:true,links:[["/characters","♟","Characters"],["/characters/create","✦","Create Character"]]},
  {id:"library",name:"Library & Notes",open:false,links:[["/classes","⚔","Classes"],["/ancestries","♜","Ancestries & Feats"],["/codex","▤","World Codex & Rules"],["/journal","✎","Journal"],["/bookmarks","★","Saved References"]]},
  {id:"dm",name:"Dungeon Master",open:true,links:[["/dm","♜","DM Chronicle"]]},
  {id:"settings",name:"Settings",open:false,links:[["/appearance","✦","Appearance"]]}
 ];
 const states={};try{const saved=JSON.parse(localStorage.getItem(GROUP_KEY)||"null");if(saved&&typeof saved==="object")for(const g of groups)if(typeof saved[g.id]==="boolean")states[g.id]=saved[g.id];}catch{}
 for(const g of groups)if(typeof states[g.id]!=="boolean")states[g.id]=g.open;
 const isShared=()=>!!document.querySelector("#codex-sidebar-root");
 const isNewSource=()=>!!document.querySelector(".sidebar-nav-section");
 const pathNow=()=>{const q=isShared()?new URLSearchParams(location.search).get("current"):null;const p=(q?"/"+q:location.pathname.replace(/^\/terravale-preview\/?/,"/")).replace(/\/+$/,"")||"/";return p==="/session-room"?"/party":p;};
 const active=(href,p)=>href==="/"?p==="/":p===href||p.startsWith(href+"/");
 const make=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el};
 const hrefOf=p=>PREFIX+(p==="/"? "":p.replace(/^\//,"")+"/");
 const isMobile=()=>matchMedia("(max-width:760px)").matches;
 const compact=()=>!isMobile()&&(document.querySelector(".app-frame.sidebar-is-collapsed")||document.documentElement.dataset.sidebarCollapsed==="true");
 const help=()=>{
   if(isShared()){window.top.location.assign(PREFIX+"?terravale-help=1");return}
   const original=document.querySelector(".topbar .site-tour-trigger");
   if(original){original.click();return}
   window.location.assign(PREFIX+"?terravale-help=1");
 };
 function visibleGroup(g,aside){
   if(g.id!=="dm")return true;
   // The source shell already evaluates authenticated DM visibility. Never
   // reveal DM Chronicle merely because the user knows its URL.
   const original=aside.querySelector('nav:not(.terr-nav) a[data-tour-nav="/dm"], nav:not(.terr-nav) a[href$="/dm"], nav:not(.terr-nav) a[href$="/dm/"]');
   return !!original;
 }
 function mount(){
  if(isNewSource())return;
  const aside=document.querySelector(".app-frame>.sidebar, #codex-sidebar-root>aside.sidebar, #codex-sidebar-root>aside");
  if(!aside)return;
  const p=pathNow();
  const dmVisible=visibleGroup(groups[3],aside);
  const existing=aside.querySelector(":scope > .terr-nav");
  if(existing){
   if(existing.dataset.current===p&&existing.dataset.dmVisible===String(dmVisible))return;
   existing.remove();
  }
  const root=make("div","terr-nav");root.setAttribute("aria-label","Codex navigation");
  root.dataset.current=p;root.dataset.dmVisible=String(dmVisible);
  const search=make("a","terr-nav-search"+(active("/search",p)?" active":""));
  search.href=hrefOf("/search");search.setAttribute("aria-label","Search Codex");
  search.title="Search Codex";search.append(make("span","terr-nav-icon","⌕"),make("span","terr-nav-label","Search Codex"),make("span","terr-nav-search-trail","↗"));
  const scroll=make("nav","terr-nav-scroll");scroll.setAttribute("aria-label","Main navigation");
  const sections=new Map();
  for(const g of groups){
   if(!visibleGroup(g,aside))continue;
   const section=make("section","terr-nav-section");section.dataset.section=g.id;
   const heading=make("button","terr-nav-heading");heading.type="button";
   const label=make("span","terr-nav-heading-label",g.name),arrow=make("span","terr-nav-chevron",states[g.id]?"⌄":"›");
   arrow.setAttribute("aria-hidden","true");
   heading.append(label,arrow);
   const links=make("div","terr-nav-section-links");links.id="terr-nav-"+g.id;
   heading.setAttribute("aria-controls",links.id);
   const expanded=states[g.id]||g.links.some(l=>active(l[0],p));
   if(expanded)states[g.id]=true;
   heading.setAttribute("aria-expanded",String(expanded));links.hidden=!expanded;
   heading.addEventListener("click",()=>{
    states[g.id]=!states[g.id];try{localStorage.setItem(GROUP_KEY,JSON.stringify(states))}catch{}
    update();
   });
   for(const [href,glyph,title] of g.links){
    const link=make("a","terr-nav-link"+(active(href,p)?" active":""));
    link.href=hrefOf(href);link.dataset.tourNav=href;link.setAttribute("aria-label",title);
    link.title=title;
    if(active(href,p)){link.setAttribute("aria-current","page");if(isShared())link.dataset.sidebarCurrent="true"}
    if(isShared())link.target="_top";
    const icon=make("span","terr-nav-icon",glyph);icon.setAttribute("aria-hidden","true");
    link.append(icon,make("span","terr-nav-label",title));
    links.appendChild(link);
   }
   section.append(heading,links);scroll.appendChild(section);sections.set(g.id,{heading,links,arrow});
  }
  function update(){
   for(const [id,parts] of sections){
    const expanded=!!states[id]||compact()||!!document.querySelector(".site-tour-running");
    parts.heading.setAttribute("aria-expanded",String(expanded));
    parts.links.hidden=!expanded;parts.arrow.textContent=expanded?"⌄":"›";
   }
  }
  const footer=make("div","terr-nav-footer");
  const helpButton=make("button","terr-nav-help");helpButton.type="button";helpButton.title="Help & Tutorial";helpButton.setAttribute("aria-label","Help and site tutorial");
  helpButton.append(make("span","terr-nav-help-icon","?"),make("span","terr-nav-label","Help & Tutorial"));
  helpButton.addEventListener("click",help);footer.appendChild(helpButton);
  root.append(search,scroll,footer);aside.appendChild(root);
  // The old links remain rendered by React but must not be selected by the
  // site tutorial while the replacement navigation is visible.
  for(const link of aside.querySelectorAll('nav:not(.terr-nav) [data-tour-nav]'))link.removeAttribute("data-tour-nav");
  update();
 }
 function avatarUrl(){
  try{
   for(let n=0;n<localStorage.length;n++){
    const key=localStorage.key(n)||"";
    if(!/^sb-[\w-]+-auth-token$/.test(key)&&!key.includes("supabase.auth.token"))continue;
    const session=JSON.parse(localStorage.getItem(key)||"null");
    const meta=session?.user?.user_metadata||session?.user?.identities?.[0]?.identity_data;
    const value=meta?.avatar_url||meta?.picture;
    if(typeof value!=="string")continue;
    const url=new URL(value);
    if(url.protocol==="https:" && /(^|\.)discordapp\.com$|(^|\.)discordapp\.net$/.test(url.hostname))return url.href;
   }
  }catch{}return null;
 }
 function account(){
  if(isShared()||isNewSource())return;
  const pill=document.querySelector(".app-frame .topbar .user-pill");
  if(!pill||pill.querySelector(".terr-account-avatar"))return;
  const current=(pill.textContent||"Account").trim();
  const name=make("span","terr-account-name",current);
  const avatar=make("span","terr-account-avatar",current[0]?.toUpperCase()||"?");
  const src=avatarUrl();
  if(src){
   const img=document.createElement("img");img.src=src;img.alt="";img.referrerPolicy="no-referrer";img.loading="lazy";
   img.addEventListener("error",()=>img.remove(),{once:true});avatar.appendChild(img);
  }
  const arrow=make("span","terr-account-chevron","⌄");
  pill.textContent="";pill.append(avatar,name,arrow);
  pill.title="Account settings";
 }
 function tutorialDeepLink(){
  if(isShared()||isNewSource())return;
  if(new URLSearchParams(location.search).get("terravale-help")!=="1")return;
  if(window.__terravaleHelpOpened)return;
  const trigger=document.querySelector(".topbar .site-tour-trigger");
  if(trigger){window.__terravaleHelpOpened=true;trigger.click()}
 }
 let queued=false;
 function schedule(){
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;mount();account();tutorialDeepLink()});
 }
 function start(){
  schedule();
  const observer=new MutationObserver(records=>{
   for(const entry of records){
    const target=entry.target;
    if(target?.closest?.(".sidebar,.topbar,#codex-sidebar-root")||
       Array.from(entry.addedNodes).some(n=>n.nodeType===1&&(n.matches?.(".app-frame,.sidebar,.topbar,#codex-sidebar-root")||n.querySelector?.(".sidebar,.topbar")))){
      schedule();break;
    }
   }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("storage",schedule);
  window.addEventListener("resize",schedule,{passive:true});
 }
 if(document.readyState==="complete")setTimeout(start,180);
 else window.addEventListener("load",()=>setTimeout(start,180),{once:true});
})();
