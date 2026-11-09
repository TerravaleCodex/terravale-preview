/* V2.76 — steady layout mode; preserves the approved 1.5s sidebar morph.
   Diagnoses visual layout shifts locally. No network calls or player data. */
(function(){
'use strict';
const STORAGE='tv-v276-steady-layout';
const body=document.body;
let enabled=true;
try{enabled=localStorage.getItem(STORAGE)!=='off'}catch{}
let shifting=false,closeJob=0,sidebarWidth=null,sidebar=null,observer=null;
let toggling=false,reportButton=null;
const shiftEvents=[],widthEvents=[];
const motionToggle=()=>body.dataset.tv276Steady=enabled?'on':'off';
motionToggle();
const route=()=>{
 const s=location.hash.replace(/^#\/?/,'').split('/')[0]||'dashboard';
 return /^[a-z-]{1,40}$/i.test(s)?s:'other';
};
function markMotion(){
 if(!enabled)return;
 if(!shifting){shifting=true;body.dataset.tv276NavShift='on'}
 clearTimeout(closeJob);
 closeJob=setTimeout(()=>{
  shifting=false;
  delete body.dataset.tv276NavShift;
 },240);
}
function connectSidebar(){
 const next=document.getElementById('sidebar')||
  document.querySelector('.sidebar');
 if(next===sidebar)return;
 observer?.disconnect();
 sidebar=next;sidebarWidth=null;
 if(!sidebar||typeof ResizeObserver!=='function')return;
 observer=new ResizeObserver(entries=>{
  const width=entries[0]?.contentRect?.width;
  if(!Number.isFinite(width))return;
  if(sidebarWidth!==null&&Math.abs(width-sidebarWidth)>.5){
   widthEvents.push({at:Math.round(performance.now()),from:Math.round(sidebarWidth),to:Math.round(width)});
   if(widthEvents.length>25)widthEvents.shift();
   markMotion();
  }
  sidebarWidth=width;
 });
 observer.observe(sidebar);
}
connectSidebar();
function recordShift(entry){
 if(entry.hadRecentInput)return;
 const impact=Number(entry.value)||0;
 if(impact<.005)return;
 const names=(entry.sources||[]).slice(0,4).map(s=>{
  const n=s.node;
  if(!n||n.nodeType!==1)return '(detached)';
  const tag=n.tagName?.toLowerCase()||'element';
  const classes=typeof n.className==='string'?
   n.className.trim().split(/\s+/).filter(Boolean).slice(0,2).join('.'):'';
  return (tag+(classes?'.'+classes:'')).slice(0,90);
 });
 shiftEvents.push({at:Math.round(performance.now()),route:route(),value:Math.round(impact*10000)/10000,elements:names});
 if(shiftEvents.length>30)shiftEvents.shift();
}
if(typeof PerformanceObserver==='function'){
 try{
  const audit=new PerformanceObserver(list=>{
   for(const event of list.getEntries())recordShift(event);
  });
  audit.observe({type:'layout-shift',buffered:true});
 }catch{}
}
const create=(tag,cls,text)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==undefined)e.textContent=String(text);
 return e;
};
function report(){
 const data={
  release:'2.76',route:route(),
  viewport:{width:window.innerWidth,height:window.innerHeight,
   devicePixelRatio:window.devicePixelRatio||1},
  steady_layout:enabled,
  reduced_motion:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false,
  layout_shifts:shiftEvents.slice(),
  sidebar_width_changes:widthEvents.slice()
 };
 return JSON.stringify(data,null,2);
}
function mount(){
 const root=document.getElementById('pageRoot');if(!root)return;
 if(!/(appearance|help)/.test(location.hash.toLowerCase()))return;
 if(root.querySelector('[data-tv276-controls]'))return;
 const panel=create('section','tv276-stability-panel');
 panel.dataset.tv276Controls='1';
 panel.append(create('div','tv254-eyebrow','INTERFACE · STABILITY'));
 panel.append(create('h3','','Steady layouts'));
 panel.append(create('p','tv276-caption',
  'Stops decorative cards and parallax from nudging the interface while you browse. The sidebar still has its original smooth transition.'));
 const actions=create('div','tv276-actions');
 const toggle=create('button','btn ghost small');
 toggle.type='button';
 const update=()=>{
  toggle.textContent='Steady layouts: '+(enabled?'On':'Off');
  toggle.setAttribute('aria-pressed',String(enabled));
 };
 update();
 toggle.addEventListener('click',()=>{
  enabled=!enabled;
  try{localStorage.setItem(STORAGE,enabled?'on':'off')}catch{}
  motionToggle();update();
 });
 actions.append(toggle);
 const copy=create('button','btn ghost small','Copy local layout diagnostics');
 copy.type='button';
 const status=create('small','tv276-caption');
 copy.addEventListener('click',async()=>{
  const result=report();
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard not available');
   await navigator.clipboard.writeText(result);
   status.textContent='Copied. No diagnostics were sent to a server.';
  }catch{
   window.prompt('Copy this local diagnostic report:',result);
   status.textContent='No diagnostics were sent to a server.';
  }
 });
 actions.append(copy);
 panel.append(actions,status);
 const destination=root.querySelector('.page-appearance,.page-help,.v2-page-content,.v2-hero')||root;
 destination.append(panel);
}
let mountQueued=false;
const domObserver=new MutationObserver(()=>{
 if(mountQueued)return;
 mountQueued=true;
 requestAnimationFrame(()=>{
  mountQueued=false;
  connectSidebar();
  if(/appearance|help/.test(location.hash.toLowerCase()))mount();
 });
});
domObserver.observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{
 markMotion();setTimeout(()=>{connectSidebar();mount()},65);
});
window.addEventListener('terravale-auth-ready',()=>{connectSidebar();mount()});
window.addEventListener('resize',()=>{
 if(!toggling){
  toggling=true;
  requestAnimationFrame(()=>{toggling=false;connectSidebar()});
 }
},{passive:true});
mount();
window.TerravaleV276Stability={report,isEnabled:()=>enabled};
})();