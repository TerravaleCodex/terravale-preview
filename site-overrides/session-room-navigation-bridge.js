/* The established Terravale Session Room lives at /party/.
 * Capture existing compiled Next.js sidebar links before the old client
 * router can render the obsolete Session Room component. */
(function(){
  const base="/terravale-preview/";
  const actual=base+"party/";
  const oldAlias=base+"session-room/";
  const normalized=p=>p.replace(/\/+$/,"")+"/";
  document.addEventListener("click",function(ev){
    if(ev.defaultPrevented||ev.button!==0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;
    const link=ev.target.closest?.("a[href]");
    if(!link||link.target==="_blank"||link.hasAttribute("download"))return;
    let u;
    try{u=new URL(link.href,location.href)}catch{return}
    if(u.origin!==location.origin)return;
    const p=normalized(u.pathname);
    if(p!==actual&&p!==oldAlias)return;
    if(normalized(location.pathname)===actual)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    location.assign(actual+u.search+u.hash);
  },true);
})();
