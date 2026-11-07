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
{title:"Welcome to Terravale",eyebrow:"01 · YOUR CHAPTER",description:"Your Discord account is your identity across the Codex. Your short TvUID is shown in the account menu. You can always return here using Help & Tutorial.",where:"#/"},
{title:"Find your way around",eyebrow:"02 · NAVIGATION",description:"Use the left sidebar to explore the Lore Codex, character sheets, campaigns, the Cabinet, and your saved references. Collapse it whenever you need more room.",where:"#/"},
{title:"Join a real campaign",eyebrow:"03 · CAMPAIGN TABLE",description:"A player joins a campaign before creating a character. Use your DM's invitation code or TV-DEMO for the shared Wayfarers' Table demonstration.",where:"#/campaigns"},
{title:"Build an adventurer",eyebrow:"04 · CHARACTER STUDIO",description:"Choose your ancestry and class, select skills and feats, then save a real character sheet. Your DM can review builds; demo characters receive automatic approval.",where:"#/characters"},
{title:"Understand your sheet",eyebrow:"05 · THE SHEET",description:"Your sheet tracks HP, abilities, feats, resources, and inventory. You can inspect individual abilities and move possessions between equipped items and your backpack.",where:"#/characters"},
{title:"Explore the living world",eyebrow:"06 · LORE & DISCOVERIES",description:"Browse the Lore Codex. Some ancestry knowledge is revealed by real campaign characters. Reading and other milestones can earn permanent curiosities in the Cabinet.",where:"#/codex"},
{title:"Appearance and the party",eyebrow:"07 · MAKE IT YOURS",description:"Pick a theme in Appearance. Your choice syncs online to your Discord account. The Session Room contains initiative, dice and chat when your campaign is in session.",where:"#/appearance"},
{title:"Ready to begin",eyebrow:"08 · END OF THE INTRODUCTION",description:"You're ready to explore Terravale. Replay this tour any time from Help & Tutorial. Your completed tutorial status is kept online.",where:"#/help"}
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
let dialog=null;
function mountTour(){
 if(dialog)return dialog;
 const backdrop=document.createElement("div");backdrop.className="tv-tutorial-overlay";
 backdrop.setAttribute("role","presentation");
 const panel=document.createElement("section");panel.className="tv-tutorial-panel";
 panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
 panel.setAttribute("aria-label","Terravale player tutorial");
 panel.innerHTML='<button class="tv-tutorial-exit" type="button" aria-label="Close tutorial">×</button>'+
 '<div class="tv-tutorial-eyebrow"></div><h2 class="tv-tutorial-title"></h2>'+
 '<p class="tv-tutorial-description"></p>'+
 '<div class="tv-tutorial-meter" aria-label="Tutorial progress"></div>'+
 '<div class="tv-tutorial-actions"><button type="button" data-tour="back">Previous</button>'+
 '<button type="button" data-tour="visit">Open this page</button>'+
 '<button type="button" data-tour="next">Continue</button></div>';
 backdrop.append(panel);
 backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeTutorial()});
 panel.querySelector(".tv-tutorial-exit").onclick=closeTutorial;
 panel.querySelector('[data-tour="back"]').onclick=()=>updateStep(Math.max(0,step-1));
 panel.querySelector('[data-tour="next"]').onclick=()=>updateStep(step+1);
 panel.querySelector('[data-tour="visit"]').onclick=()=>{
   const where=steps[step]?.where||"#/";
   window.location.hash=where;
   closeTutorial();
 };
 dialog={backdrop,panel};return dialog;
}
function showStep(){
 const {backdrop,panel}=mountTour();
 step=Math.max(0,Math.min(steps.length-1,step));
 const d=steps[step];
 panel.querySelector(".tv-tutorial-eyebrow").textContent=d.eyebrow+" · "+(step+1)+" / "+steps.length;
 panel.querySelector(".tv-tutorial-title").textContent=d.title;
 panel.querySelector(".tv-tutorial-description").textContent=d.description;
 const meter=panel.querySelector(".tv-tutorial-meter");
 meter.replaceChildren();
 for(let i=0;i<steps.length;i++){
   const b=document.createElement("button");b.type="button";
   b.className=i<=step?"completed":"";
   b.setAttribute("aria-label","Go to tutorial step "+(i+1));
   b.setAttribute("aria-current",i===step?"step":"false");
   b.addEventListener("click",()=>updateStep(i));
   meter.append(b);
 }
 panel.querySelector('[data-tour="back"]').disabled=step===0;
 panel.querySelector('[data-tour="next"]').textContent=step===steps.length-1?"Finish tutorial":"Continue";
 if(!backdrop.isConnected)document.body.append(backdrop);
 panel.querySelector('[data-tour="next"]').focus({preventScroll:true});
}
function closeTutorial(){
 if(dialog?.backdrop.isConnected)dialog.backdrop.remove();
 tutorialOpen=false;
}
function updateStep(newStep){
 if(newStep>=steps.length){
   syncTutorial(steps.length,true);
   closeTutorial();
   toastText("Tutorial complete. Replay it any time from Help & Tutorial.");
   return;
 }
 step=Math.max(0,newStep);
 showStep();
 syncTutorial(step,false);
}
function startTutorial(fromStart=true){
 if(!account()?.ready){toastText("Connect Discord first to save tutorial progress.");return}
 step=fromStart?0:Math.max(0,Math.min(steps.length-1,step));
 tutorialOpen=true;showStep();syncTutorial(step,false);
}
function mountReplay(){
 const root=document.getElementById("pageRoot");
 if(!root||!location.hash.toLowerCase().includes("/help"))return;
 if(root.querySelector("#tv-tutorial-launch"))return;
 const button=document.createElement("button");button.id="tv-tutorial-launch";
 button.type="button";button.className="tv-tutorial-launch";
 button.textContent=finishTutorial?"Replay the player tutorial":"Start the player tutorial";
 button.addEventListener("click",()=>startTutorial(true));
 const head=root.querySelector(".v2-hero,.hero,.v2-page-header")||root;
 head.append(button);
}
let scheduled=false;
const observer=new MutationObserver(()=>{
 if(scheduled)return;scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;mountReplay()});
});
observer.observe(document.getElementById("pageRoot")||document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>setTimeout(mountReplay,50));
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&tutorialOpen)closeTutorial();
});
window.TerravaleLivePreferences={
 get:()=>server,save,queueTheme,setVariant,load,startTutorial
};
if(account()?.ready)load();
else window.addEventListener("terravale-auth-ready",load,{once:true});
mountReplay();
})();
