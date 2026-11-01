/* Repair stale approved-sheet iframe URLs in pre-patch Next.js chunks.
 * The main Codex owns the sidebar; the embedded approved sheet must not
 * load a second navigation frame. This is an intentionally narrow bridge.
 */
(function(){
 "use strict";
 const root="/terravale-preview/";
 const fixedPath=root+"characters/sheet-render-fixed-20261101/";
 function replaceOutdatedSheet(frame){
  const original=frame.getAttribute("src");
  if(!original)return;
  let url;
  try{url=new URL(original,location.href)}catch{return}
  if(url.origin!==location.origin)return;
  if(url.pathname!==root+"characters/sheet-live/")return;
  if(url.searchParams.get("live")!=="1")return;
  url.pathname=fixedPath;
  url.searchParams.set("v","restored-sheet-20261101");
  frame.setAttribute("src",url.pathname+url.search+url.hash);
 }
 function scan(rootNode){
  if(rootNode instanceof HTMLIFrameElement)replaceOutdatedSheet(rootNode);
  if(rootNode.querySelectorAll)for(const el of rootNode.querySelectorAll("iframe[src]"))replaceOutdatedSheet(el);
 }
 new MutationObserver(records=>{
  for(const record of records){
   if(record.type==="attributes"){replaceOutdatedSheet(record.target);continue}
   for(const node of record.addedNodes)if(node.nodeType===1)scan(node);
  }
 }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["src"]});
 scan(document.documentElement);
})();
