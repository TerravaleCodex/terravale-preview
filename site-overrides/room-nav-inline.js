/* Same-document native navigation: no iframe, delayed theme or reflow. */
(()=>{"use strict";
const root=document.getElementById("room-native-nav");
if(!root)return;
const storageKey="terravale.ui.sidebar.groups.v1";
const collapsedKey="terravale.ui.sidebar.collapsed.v1";
let saved={};
try{const v=JSON.parse(localStorage.getItem(storageKey)||"null");if(v&&typeof v==="object"&&!Array.isArray(v))saved=v;}catch{}
const sectionButtons=[...root.querySelectorAll(".nav-section-toggle")];
function expanded(button,collapsed){
 const section=button.closest(".sidebar-nav-section");
 const panel=document.getElementById(button.getAttribute("aria-controls")||"");
 if(!section||!panel)return;
 const id=section.dataset.section;
 const active=!!panel.querySelector('[aria-current="page"]');
 const current=typeof saved[id]==="boolean"?saved[id]:button.getAttribute("aria-expanded")==="true";
 const show=collapsed||current||active;
 panel.hidden=!show;
 button.setAttribute("aria-expanded",String(show));
 const chevron=button.querySelector(".nav-section-chevron");
 if(chevron)chevron.textContent=show?"⌄":"›";
}
function paint(){
 const collapsed=document.body.classList.contains("sidebar-collapsed")&&matchMedia("(min-width:761px)").matches;
 for(const button of sectionButtons)expanded(button,collapsed);
}
for(const button of sectionButtons)button.addEventListener("click",()=>{
 const section=button.closest(".sidebar-nav-section");
 const id=section?.dataset.section;
 if(!id)return;
 const panel=document.getElementById(button.getAttribute("aria-controls")||"");
 const current=typeof saved[id]==="boolean"?saved[id]:!(panel?.hidden);
 saved[id]=!current;
 try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{}
 paint();
});
root.querySelector(".sidebar-help")?.addEventListener("click",()=>location.assign("/terravale-preview/?terravale-help=1"));
for(const link of root.querySelectorAll("a[href]"))link.addEventListener("click",()=>{
 if(matchMedia("(max-width:760px)").matches)document.body.classList.remove("room-nav-open");
});
const toggle=document.getElementById("sidebar-toggle");
if(toggle){
 const original=toggle.onclick;
 toggle.addEventListener("click",()=>{
  if(matchMedia("(max-width:760px)").matches){
   // The original room toggle controls desktop collapse; restore the mobile drawer.
   document.body.classList.remove("sidebar-collapsed");
   document.body.classList.toggle("room-nav-open");
   toggle.setAttribute("aria-expanded",String(document.body.classList.contains("room-nav-open")));
  }else{
   document.body.classList.remove("room-nav-open");
   try{localStorage.setItem(collapsedKey,String(document.body.classList.contains("sidebar-collapsed")))}catch{}
  }
  paint();
 });
}
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&document.body.classList.contains("room-nav-open")){document.body.classList.remove("room-nav-open");toggle?.focus()}
});
window.addEventListener("resize",()=>{if(innerWidth>760)document.body.classList.remove("room-nav-open");paint()},{passive:true});
paint();
})();
