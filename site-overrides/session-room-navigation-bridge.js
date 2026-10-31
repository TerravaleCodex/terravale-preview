/* Make all existing Codex links to Session Room open the new deployed
 * static route instead of a cached Next.js client-side Session Room build. */
(function(){
 const target="/terravale-preview/session-room/";
 document.addEventListener("click",function(ev){
  if(ev.button!==0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;
  const anchor=ev.target.closest?.("a[href]");
  if(!anchor)return;
  let url;
  try{url=new URL(anchor.href,location.href)}catch{return;}
  if(url.origin!==location.origin)return;
  const normalized=url.pathname.replace(/\/+$/,"")+"/";
  if(normalized!==target)return;
  if(location.pathname.replace(/\/+$/,"")+"/"===target)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  location.assign(url.href);
 },true);
})();
