/* V2.66: stronger *Cabinet-specific* iridescence inside its same-origin iframe.
   The existing Appearance texture toggle remains the only switch. */
(()=>{
 'use strict';
 if(window.__tv266CabinetTexture)return;
 window.__tv266CabinetTexture=true;
 const css=`
 html[data-tv265-textures="on"] body{
  background-image:radial-gradient(ellipse 76% 28% at 92% 6%,#90b8ee22,transparent 78%),
   linear-gradient(180deg,#07080ce9,#080911d8 52%,#050709eb),
   var(--tv265-art-achievements,none)!important;
  background-size:cover,cover,cover!important;
  background-position:center,center,center 14%!important;
  background-attachment:scroll!important;
 }
 html[data-tv265-textures="on"] .hero{
  background-image:linear-gradient(110deg,#171323dd 0%,#1b1937a0 48%,#101521dc 100%),
   var(--tv265-art-achievements,none)!important;
  background-size:cover,cover!important;
  background-position:center,center 42%!important;
 }
 html[data-tv265-textures="on"] .summary-cell{
  background-image:linear-gradient(130deg,#11131edb,#121623d4 78%),
   var(--tv265-art-achievements,none)!important;
  background-size:cover,cover!important;
  background-position:center,center 65%!important;
 }
 html[data-tv265-textures="on"] .ach-card.is-earned:is(
  [data-rarity="rare"],[data-rarity="epic"],[data-rarity="legendary"],[data-rarity="mythic"]):after{
  opacity:.38!important;
 }
 html[data-tv265-textures="on"] .ach-card.is-earned:is(
  [data-rarity="rare"],[data-rarity="epic"],[data-rarity="legendary"],[data-rarity="mythic"]):hover:after{
  opacity:.58!important;
 }
 @media(prefers-reduced-motion:reduce){.ach-card:after{animation:none!important}}
 `;
 function install(){
  const iframe=document.getElementById('tv-cabinet-v2-frame');
  if(!iframe)return;
  try{
   const doc=iframe.contentDocument;
   if(!doc?.head||doc.getElementById('tv266-cabinet-texture'))return;
   const style=doc.createElement('style');
   style.id='tv266-cabinet-texture';style.textContent=css;doc.head.append(style);
  }catch{}
  if(iframe.dataset.tv266CabinetLoad!=='1'){
   iframe.dataset.tv266CabinetLoad='1';iframe.addEventListener('load',install);
  }
 }
 let queued=false;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;install()})}
 new MutationObserver(schedule).observe(document.getElementById('pageRoot')||document.body,{childList:true,subtree:true});
 window.addEventListener('hashchange',schedule);
 schedule();
})();