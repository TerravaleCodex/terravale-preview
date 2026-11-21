/**
 * Neon staging ONLY: defence-in-depth for the untouched V2 embedded sheet.
 *
 * The legacy V2 renderer can re-render forms after initial load (including
 * async rules refreshes and tab switches). This observer keeps those controls
 * disabled. There is deliberately NO database client and NO save handler here.
 */
(()=>{"use strict";
 if(window.parent===window||!new URLSearchParams(location.search).has("live"))return;
 const readonly=()=>{
   const root=document.querySelector("#page");
   if(!root)return;
   for(const field of root.querySelectorAll("input,textarea,select")){
     if(!field.disabled)field.disabled=true;
   }
   for(const editable of root.querySelectorAll("[contenteditable]")){
     if(editable.getAttribute("contenteditable")!=="false")editable.setAttribute("contenteditable","false");
   }
   // The old [data-note] controls are custom editable text surfaces.
   for(const note of root.querySelectorAll("[data-note]")){
     if(note.getAttribute("aria-disabled")!=="true")note.setAttribute("aria-disabled","true");
     if("disabled" in note)note.disabled=true;
   }
 };
 const observe=()=>{
   readonly();
   const root=document.querySelector("#page");
   if(root)new MutationObserver(readonly).observe(root,{subtree:true,childList:true});
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});
 else observe();
 // Reject any unexpected attempt to load an editable character in the staging
 // iframe. The parent still performs the authoritative owner/DM RPC check.
 window.addEventListener("message",event=>{
   if(event.source!==window.parent||event.origin!==location.origin)return;
   if(event.data?.type==="TV_SHEET_LOAD" && event.data.character?.readOnly!==true)
     event.stopImmediatePropagation();
 },true);
})();
