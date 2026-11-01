/* The Session Room sidebar link must perform a document navigation. */
(function(){
  const route="/terravale-preview/party/";
  const routes=new Set([route,"/terravale-preview/session-room/"]);
  function nav(ev){
    if(ev.button!==0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;
    if(document.body?.dataset.roomProduction==="1")return;
    const el=ev.target?.closest?.("a[href]");
    if(!el)return;
    const url=new URL(el.href,location.href);
    if(url.origin!==location.origin)return;
    const path=url.pathname.replace(/\\/+$/,"")+"/";
    if(!routes.has(path))return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    location.assign(route+"?native-room=1");
  }
  window.addEventListener("click",nav,true);
})();