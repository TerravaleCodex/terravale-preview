/* Original V2.87 staging clone: no network access or persistent storage.
   Loaded BEFORE the original page scripts. The actual live file is untouched. */
(function(){
  "use strict";
  const makeStore=()=>{
    const data=new Map();
    return Object.freeze({
      get length(){return data.size},
      clear(){data.clear()},
      getItem(key){return data.has(String(key))?data.get(String(key)):null},
      key(n){return [...data.keys()][n]??null},
      removeItem(key){data.delete(String(key))},
      setItem(key,value){data.set(String(key),String(value))}
    });
  };
  for(const which of ["localStorage","sessionStorage"]){
    try{Object.defineProperty(window,which,{configurable:true,get:()=>store[which]})}
    catch{ /* iframe sandbox also denies the unmodified browser storage */ }
  }
  function denied(){return Promise.reject(new TypeError("No external calls are permitted in Neon staging read-only sheet"))}
  const store={localStorage:makeStore(),sessionStorage:makeStore()};
  try{Object.defineProperty(window,"fetch",{configurable:true,value:denied})}catch{}
  try{Object.defineProperty(window,"XMLHttpRequest",{configurable:true,value:class{constructor(){throw new TypeError("Read-only offline frame")}}})}catch{}
  try{Object.defineProperty(window,"WebSocket",{configurable:true,value:class{constructor(){throw new TypeError("Read-only offline frame")}}})}catch{}
  try{Object.defineProperty(window,"EventSource",{configurable:true,value:class{constructor(){throw new TypeError("Read-only offline frame")}}})}catch{}
  try{Object.defineProperty(window,"confirm",{configurable:true,value:()=>false})}catch{}
  window.TerravaleNeonNativeFrame={staging:true,readOnly:true};
  function allowNavigation(target){
    return !!target.closest(".sheet20-tabs [data-action='sheetTab'],.sheet20-tabs [role='tab'],button[data-action='sheetTab'],[role='tab'],[data-v228-tab],.tv284-read-gift,.tv284-close-detail,summary");
  }
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("button,input[type='button'],input[type='submit'],a");
    if(button&&!allowNavigation(button)){
      // Never trigger sheet mutation / gameplay action from the staging clone.
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  document.addEventListener("submit",event=>{event.preventDefault();event.stopImmediatePropagation()},true);
  function lock(){
    for(const item of document.querySelectorAll("input,textarea,select,[contenteditable]")){
      if("disabled" in item)item.disabled=true;
      if(item.hasAttribute("contenteditable"))item.setAttribute("contenteditable","false");
    }
  }
  const begin=()=>{
    lock();
    new MutationObserver(lock).observe(document.documentElement,{subtree:true,childList:true});
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",begin,{once:true});
  else begin();
})();