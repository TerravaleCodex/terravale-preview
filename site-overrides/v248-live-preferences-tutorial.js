/* Terravale V2.48 — account-synced appearance and repeatable onboarding.
   This replaces local-only appearance state for verified Discord users.
   It never impersonates a Discord account and does not bypass unlock RLS. */
(function(){
"use strict";
const account=()=>window.TerravaleVerifiedAccount?.state;
const api=()=>window.TerravaleVerifiedAccount?.supabase;
const themes=new Set(["classic","shady","zero","night","guildie","verdant","crimson","nullmeridian","gloamglass"]);
let loaded=false,hydrating=false,writing=false,pending=null,server=null,tutorialOpen=false,step=0,finishTutorial=false;
const steps=[
 {title:"Welcome to the 2.0 Codex",eyebrow:"01 · YOUR STORY BEGINS",description:"A new chapter of Terravale is yours to explore. This little guided tour will show you around the real Codex: its campaigns, characters, lore and curiosities. Follow the spotlight; nothing here will spend resources or change your character.",where:null,targets:[]},
 {title:"Your new home",eyebrow:"02 · THE DASHBOARD",description:"The Dashboard is your home base. Your campaign and featured adventurers live here; the sidebar is your route to everything else. You can collapse that sidebar when you need more space.",where:"#/",targets:["#pageRoot .v2-hero","#pageRoot .hero","#pageRoot .v2-page-header",".sidebar"]},
 {title:"Find your campaign",eyebrow:"03 · THE CAMPAIGN TABLE",description:"Campaigns determine which adventurers and party records you can access. Join using your DM's invitation, or try the Wayfarers' Table demo with TV-DEMO.",where:"#/campaigns",nav:"campaign",targets:["#pageRoot .v2-hero","#pageRoot .v2-page-header","#pageRoot h1","#pageRoot .v2-card"]},
 {title:"Make your adventurer",eyebrow:"04 · THE CHARACTER STUDIO",description:"Create your character, choose your ancestry feats and class progression, and open your sheet to see HP, equipment, backpack and abilities. The real campaign's DM approves non-demo builds.",where:"#/characters",nav:"character",targets:["#pageRoot .v2-hero","#pageRoot .v2-page-header","#pageRoot .tv-demo-party","#pageRoot h1"]},
 {title:"The world's secrets",eyebrow:"05 · THE LORE CODEX",description:"Browse the lore as real reading pages, with the calendar, search and related articles close to hand. Some entries are accessible only when your character's ancestry allows it.",where:"#/lore",nav:"lore",targets:["#pageRoot .tv-lore","#pageRoot .v2-hero","#pageRoot .lore-grid","#pageRoot h1"]},
 {title:"The Cabinet of Curiosities",eyebrow:"06 · ACHIEVEMENTS",description:"Your discoveries and earned account-wide achievements are kept in the Cabinet. Permanent unlocks stay yours; some earned surprises unlock special appearance options.",where:"#/cabinet-of-curiosities",nav:"cabinet",targets:["#pageRoot .cabinet-grid","#pageRoot .cab-head","#pageRoot h1"]},
 {title:"Your table, live",eyebrow:"07 · SESSION ROOM",description:"Visit the Session Room for your party's initiative, dice and chat. The room is bound to your campaign, and your DM controls the encounter.",where:"#/session-room",nav:"session",targets:["#pageRoot .v2-hero","#pageRoot .sr-root","#pageRoot .sr-queue","#pageRoot h1"]},
 {title:"Make the Codex yours",eyebrow:"08 · APPEARANCE",description:"Themes change the entire Codex. Your selected theme follows your verified Discord account, and a few additional looks unlock through achievements.",where:"#/appearance",nav:"appearance",targets:["#pageRoot .theme-grid","#pageRoot .theme-card","#pageRoot .v2-hero","#pageRoot h1"]},
 {title:"Your journey continues",eyebrow:"09 · REPLAY ANY TIME",description:"That's the 2.0 Codex. Whenever you'd like a refresher, open Help & Tutorial and choose Replay the guided tour. You can also restart this tour from the Help control in the sidebar.",where:"#/help",nav:"help",targets:["#tv-tutorial-launch","#pageRoot .v2-hero","#pageRoot h1"]}
];
function toastText(s){if(typeof toast==="function")toast(s);else console.info(s)}
function setBodyTheme(theme){
 if(!themes.has(theme))return;
 if(typeof db!=="undefined"){
   db.theme=theme;
   if(Array.isArray(db.themesTried)&&!db.themesTried.includes(theme))db.themesTried.push(theme);
 }
 document.body.dataset.theme=theme;
 if(typeof persist==="function")persist();
 if(typeof renderPage==="function")renderPage(false);
}
async function save(theme,variant){
 if(!account()?.ready||!api()){toastText("Please connect Discord to save your appearance online.");return false}
 if(!themes.has(theme))return false;
 const desired={theme,variant:variant==="obsidian"?"obsidian":"velvet"};
 if(writing){pending=desired;return true}
 writing=true;
 try{
   const {data,error}=await api().rpc("terravale_set_user_appearance",{
     new_theme:desired.theme,new_variant:desired.variant
   });
   if(error){toastText("Could not save appearance online: "+error.message);return false}
   server={...server,...data,theme:desired.theme,crimson_variant:desired.variant};
   window.dispatchEvent(new CustomEvent("terravale-online-appearance",{detail:server}));
   return true;
 }catch(e){toastText("Appearance sync error: "+e.message);return false}
 finally{
   writing=false;
   if(pending){
      const next=pending;pending=null;
      if(next.theme!==server?.theme||next.variant!==server?.crimson_variant)save(next.theme,next.variant);
   }
 }
}
const currentVariant=()=>{
 const stored=window.TerravaleCrimsonVariant?.get?.();
 if(stored)return stored==="obsidian"?"obsidian":"velvet";
 return server?.crimson_variant==="obsidian"?"obsidian":"velvet";
};
function queueTheme(theme){
 if(hydrating || !loaded)return;
 save(theme,currentVariant());
}
function setVariant(variant){
 if(variant==="obsidian"&&!window.TerravaleCrimsonVariant?.isUnlocked?.()){
   toastText("Earn Seeing Red before using the Black & Red theme.");return false;
 }
 return save(db.theme,variant);
}
async function load(){
 if(!account()?.ready||hydrating)return;
 hydrating=true;
 try{
   // Migrate a user's already-selected local theme on first online login.
   const {data:existing,error:selectError}=await api()
       .from("terravale_user_preferences")
       .select("theme,crimson_variant,tutorial_last_step,tutorial_completed_at")
       .eq("user_id",account().user.id).maybeSingle();
   if(selectError)throw selectError;
   let result=existing;
   if(!result){
      const currentTheme=themes.has(db.theme)?db.theme:"classic";
      const {data:allow,error:err}=await api().rpc("terravale_crimson_variant_entitlement");
      if(err)throw err;
      const variant=allow&&currentVariant()==="obsidian"?"obsidian":"velvet";
      const created=await api().rpc("terravale_set_user_appearance",{
        new_theme:currentTheme,new_variant:variant});
      if(created.error)throw created.error;
      result={theme:currentTheme,crimson_variant:variant,
        tutorial_last_step:0,tutorial_completed_at:null};
   }
   server={...result};
   loaded=true;
   finishTutorial=Boolean(result.tutorial_completed_at||result.tutorial_completed);
   step=Number(result.tutorial_last_step)||0;
   if(themes.has(result.theme)&&db.theme!==result.theme)setBodyTheme(result.theme);
   window.dispatchEvent(new CustomEvent("terravale-online-appearance",{detail:server}));
   offerWelcome();
 }catch(e){
   console.warn("Online account preferences unavailable:",e.message);
   toastText("Could not load your online appearance. The current visual setting has not been saved.");
 }finally{hydrating=false}
}
async function syncTutorial(currentStep,finish=false){
 if(!loaded||!account()?.ready)return;
 const {data,error}=await api().rpc("terravale_set_tutorial_progress",{
   new_step:currentStep,finish:!!finish});
 if(error)console.warn("Tutorial progress not saved online:",error.message);
 else if(data){finishTutorial=Boolean(data.tutorial_completed);step=currentStep}
}
let dialog=null,activeTarget=null,previousFocus=null,viewToken=0,resizeJob=0;
const isVisible=node=>{
 if(!node||!node.isConnected)return false;
 const box=node.getBoundingClientRect();
 const style=getComputedStyle(node);
 return box.width>12&&box.height>10&&style.display!=="none"&&style.visibility!=="hidden";
};
function findSection(d){
 for(const selector of d.targets||[]){
   try{
     const el=Array.from(document.querySelectorAll(selector)).find(isVisible);
     if(el)return el;
   }catch{}
 }
 const nav=d.nav;
 if(nav){
   const links=document.querySelectorAll(".sidebar a,.sidebar button,.nav-item,#sidebar a,#sidebar button");
   const found=Array.from(links).find(el=>{
     const label=(el.getAttribute("aria-label")||el.getAttribute("title")||el.textContent||"").toLowerCase();
     const href=(el.getAttribute("href")||el.getAttribute("data-route")||"").toLowerCase();
     return isVisible(el)&&(label.includes(nav)||href.includes(nav));
   });
   if(found)return found;
 }
 return Array.from(document.querySelectorAll("#pageRoot .v2-card,#pageRoot header,#pageRoot h1")).find(isVisible)||null;
}
function followRoute(d){
 if(d?.where && location.hash!==d.where)location.hash=d.where;
}
function mountTour(){
 if(dialog)return dialog;
 const backdrop=document.createElement("div");
 backdrop.className="tv-tutorial-overlay";
 const spotlight=document.createElement("div");
 spotlight.className="tv-tutorial-spotlight";
 spotlight.setAttribute("aria-hidden","true");
 const panel=document.createElement("section");panel.className="tv-tutorial-panel";
 panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
 panel.setAttribute("aria-label","Terravale 2.0 guided tutorial");
 panel.setAttribute("tabindex","-1");
 panel.innerHTML='<button class="tv-tutorial-exit" type="button" aria-label="Close guided tutorial">×</button>'+
 '<div class="tv-tutorial-eyebrow"></div><h2 class="tv-tutorial-title"></h2>'+
 '<p class="tv-tutorial-description"></p>'+
 '<p class="tv-tutorial-hint">The highlighted area is the part of the Codex we are visiting.</p>'+
 '<div class="tv-tutorial-meter" aria-label="Tutorial progress"></div>'+
 '<div class="tv-tutorial-actions"><button type="button" data-tour="back">Previous</button>'+
 '<button type="button" data-tour="visit">Explore here</button>'+
 '<button type="button" data-tour="next">Continue</button></div>';
 backdrop.append(spotlight,panel);
 backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeTutorial()});
 panel.querySelector(".tv-tutorial-exit").onclick=closeTutorial;
 panel.querySelector('[data-tour="back"]').onclick=()=>updateStep(Math.max(0,step-1));
 panel.querySelector('[data-tour="next"]').onclick=()=>updateStep(step+1);
 panel.querySelector('[data-tour="visit"]').onclick=()=>{
   const d=steps[step];
   if(d.where)window.location.hash=d.where;
   closeTutorial();
 };
 dialog={backdrop,panel,spotlight};
 return dialog;
}
function placeTour(){
 if(!tutorialOpen||!dialog)return;
 const {backdrop,panel,spotlight}=dialog;
 const target=activeTarget&&isVisible(activeTarget)?activeTarget:null;
 backdrop.classList.toggle("has-target",!!target);
 if(!target){
   spotlight.style.display="none";
   panel.style.left="50%";
   panel.style.top="50%";
   panel.style.transform="translate(-50%,-50%)";
   panel.dataset.placement="center";
   return;
 }
 const bounds=target.getBoundingClientRect();
 const pad=9,viewW=window.innerWidth,viewH=window.innerHeight;
 const left=Math.max(6,bounds.left-pad),top=Math.max(6,bounds.top-pad);
 const right=Math.min(viewW-6,bounds.right+pad),bottom=Math.min(viewH-6,bounds.bottom+pad);
 spotlight.style.display="block";
 Object.assign(spotlight.style,{
   left:left+"px",top:top+"px",
   width:Math.max(16,right-left)+"px",
   height:Math.max(16,bottom-top)+"px"
 });
 panel.style.transform="none";
 const width=Math.min(420,viewW-24),height=Math.min(panel.offsetHeight,viewH-20);
 let x,y,placement;
 if(viewW<720){
   x=(viewW-width)/2;y=Math.max(10,viewH-height-13);
   placement="bottom";
 }else{
   const spaceRight=viewW-right,spaceLeft=left,spaceBelow=viewH-bottom,spaceAbove=top;
   if(spaceRight>=width+22){
     x=right+16;y=Math.max(12,Math.min(top,viewH-height-12));placement="right";
   }else if(spaceLeft>=width+22){
     x=left-width-16;y=Math.max(12,Math.min(top,viewH-height-12));placement="left";
   }else if(spaceBelow>=height+20){
     x=Math.max(12,Math.min(viewW-width-12,left));y=bottom+12;placement="below";
   }else if(spaceAbove>=height+20){
     x=Math.max(12,Math.min(viewW-width-12,left));y=top-height-12;placement="above";
   }else{
     x=Math.max(12,viewW-width-12);
     y=Math.max(12,viewH-height-12);
     placement="corner";
   }
 }
 panel.style.left=Math.max(8,Math.min(viewW-width-8,x))+"px";
 panel.style.top=Math.max(8,Math.min(viewH-height-8,y))+"px";
 panel.dataset.placement=placement;
}
function refreshSpotlight(token,scroll=true){
 if(!tutorialOpen||token!==viewToken)return;
 const d=steps[step];
 activeTarget=findSection(d);
 if(activeTarget&&scroll){
   const r=activeTarget.getBoundingClientRect();
   if(r.top<65||r.bottom>window.innerHeight-65){
     activeTarget.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center",inline:"nearest"});
   }
 }
 placeTour();
}
function queueSpotlight(scroll=false){
 if(!tutorialOpen)return;
 cancelAnimationFrame(resizeJob);
 resizeJob=requestAnimationFrame(()=>refreshSpotlight(viewToken,scroll));
}
function showStep(){
 const {backdrop,panel}=mountTour();
 step=Math.max(0,Math.min(steps.length-1,step));
 const d=steps[step];
 const token=++viewToken;
 activeTarget=null;
 panel.querySelector(".tv-tutorial-eyebrow").textContent=d.eyebrow+" · "+(step+1)+" / "+steps.length;
 panel.querySelector(".tv-tutorial-title").textContent=d.title;
 panel.querySelector(".tv-tutorial-description").textContent=d.description;
 panel.querySelector(".tv-tutorial-hint").hidden=step===0;
 const meter=panel.querySelector(".tv-tutorial-meter");meter.replaceChildren();
 for(let i=0;i<steps.length;i++){
   const button=document.createElement("button");button.type="button";
   button.className=i<=step?"completed":"";
   button.setAttribute("aria-label","Go to tutorial step "+(i+1));
   button.setAttribute("aria-current",i===step?"step":"false");
   button.addEventListener("click",()=>updateStep(i));
   meter.append(button);
 }
 panel.querySelector('[data-tour="back"]').disabled=step===0;
 panel.querySelector('[data-tour="visit"]').hidden=step===0;
 panel.querySelector('[data-tour="next"]').textContent=step===steps.length-1?"Finish tutorial":"Continue";
 if(!backdrop.isConnected)document.body.append(backdrop);
 followRoute(d);
 placeTour();
 for(const delay of [90,260,600,1550]){
   setTimeout(()=>refreshSpotlight(token,delay===90),delay);
 }
 panel.querySelector('[data-tour="next"]').focus({preventScroll:true});
}
function closeTutorial(){
 if(dialog?.backdrop.isConnected)dialog.backdrop.remove();
 tutorialOpen=false;activeTarget=null;++viewToken;
 if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
 previousFocus=null;
}
function updateStep(newStep){
 if(newStep>=steps.length){
   syncTutorial(steps.length-1,true);
   closeTutorial();
   toastText("You know your way around the 2.0 Codex. Replay the tour from Help whenever you like.");
   return;
 }
 step=Math.max(0,Math.min(steps.length-1,newStep));
 showStep();
 syncTutorial(step,false);
}
function startTutorial(fromStart=true){
 if(!account()?.ready){toastText("Connect Discord to use the live Codex tutorial.");return}
 if(!tutorialOpen)previousFocus=document.activeElement;
 step=fromStart?0:Math.max(0,Math.min(steps.length-1,step));
 tutorialOpen=true;showStep();syncTutorial(step,false);
}
function mountReplay(){
 const root=document.getElementById("pageRoot");
 if(!root||!location.hash.toLowerCase().includes("/help"))return;
 if(root.querySelector("#tv-tutorial-launch"))return;
 const button=document.createElement("button");button.id="tv-tutorial-launch";
 button.type="button";button.className="tv-tutorial-launch";
 button.textContent=finishTutorial?"Replay the guided 2.0 tutorial":"Start the guided 2.0 tutorial";
 button.addEventListener("click",()=>startTutorial(true));
 const head=root.querySelector(".v2-hero,.hero,.v2-page-header")||root;
 head.append(button);
}
let scheduled=false;
const observer=new MutationObserver(()=>{
 if(scheduled)return;scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;mountReplay();if(tutorialOpen)queueSpotlight()});
});
observer.observe(document.getElementById("pageRoot")||document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>{setTimeout(mountReplay,60);if(tutorialOpen)setTimeout(()=>queueSpotlight(true),90)});
window.addEventListener("resize",()=>queueSpotlight());
window.addEventListener("scroll",()=>queueSpotlight(),{capture:true,passive:true});
document.addEventListener("keydown",e=>{
 if(!tutorialOpen)return;
 if(e.key==="Escape"){e.preventDefault();closeTutorial();return}
 if(e.key==="Tab"&&dialog){
   const buttons=Array.from(dialog.panel.querySelectorAll("button:not([hidden]):not(:disabled)"));
   if(!buttons.length)return;
   if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus()}
   else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus()}
 }
});
function offerWelcome(){
 const id=account()?.user?.id;
 if(!id||finishTutorial)return;
 const key="tv-v249-tour-offered:"+id;
 try{if(sessionStorage.getItem(key)==="1")return;sessionStorage.setItem(key,"1")}catch{}
 setTimeout(()=>{if(account()?.ready&&!tutorialOpen&&!finishTutorial)startTutorial(true)},600);
}
window.TerravaleLivePreferences={
 get:()=>server,save,queueTheme,setVariant,load,startTutorial
};
if(account()?.ready)load();
else window.addEventListener("terravale-auth-ready",load,{once:true});
mountReplay();
})();
