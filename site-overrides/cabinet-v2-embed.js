/* Mount the approved Cabinet V2 inside the existing authenticated Codex shell. */
(()=>{'use strict';
const BASE='/terravale-preview/';
const pathNow=()=>decodeURIComponent(location.pathname).replace(/^\/terravale-preview\/?/,'/').replace(/\/+$/,'')||'/';
if(window.__tvCabinetV2Mounted)return;window.__tvCabinetV2Mounted=true;
const style=document.createElement('style');
style.textContent='.tv-cabinet-v2-active{width:100%!important;max-width:none!important;min-width:0!important}.tv-cabinet-v2-active > :not(#tv-cabinet-v2-host){display:none!important}#tv-cabinet-v2-host{display:block!important;width:100%!important;min-width:0!important;margin:0!important;padding:0!important}#tv-cabinet-v2-frame{display:block;width:100%;min-height:500px;height:1500px;border:0;background:#07080c;overflow:hidden}';
document.head.append(style);
let frame=null,root=null;
function mount(){
 if(pathNow()!=='/cabinet-of-curiosities')return;
 const found=document.querySelector('[data-cabinet-full-page]');
 if(!found)return;
 root=found;root.classList.add('tv-cabinet-v2-active');
 let host=root.querySelector(':scope > #tv-cabinet-v2-host');
 if(!host){host=document.createElement('div');host.id='tv-cabinet-v2-host';root.append(host);}
 if(!host.querySelector('#tv-cabinet-v2-frame')){
  frame=document.createElement('iframe');
  frame.id='tv-cabinet-v2-frame';
  frame.title='Cabinet of Curiosities — live achievement collection';
  frame.setAttribute('scrolling','no');frame.loading='eager';
  frame.src=BASE+'codex-achievements/cabinet-v2-live.html';
  host.append(frame);
 }else frame=host.querySelector('#tv-cabinet-v2-frame');
}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.data?.type!=='terravale-cabinet-v2-size')return;
 if(!frame||e.source!==frame.contentWindow)return;
 const n=Number(e.data.height);if(!Number.isFinite(n)||n<300||n>40000)return;
 const px=Math.ceil(n)+'px';if(frame.style.height!==px)frame.style.height=px;
});
const observer=new MutationObserver(()=>{
 if(!document.querySelector('#tv-cabinet-v2-frame'))mount();
});
function init(){
 mount();
 observer.observe(document.body,{childList:true,subtree:true});
 setInterval(mount,2500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
