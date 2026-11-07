/* V2.48 — curated demo party sheets: verified published ancestry mechanics
 * plus transparent progression decisions. The existing native V2 Features &
 * Feats reader remains authoritative for feat effects and class tables. */
(function(){
 "use strict";
 const $=s=>document.querySelector(s);
 const current=()=>window.TerravaleVerifiedAccount?.state;
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function featureCard(ch){
   const src=window.TERRAVALE_RULES_MANIFEST;
   const ids=new Set();
   if(ch.rulesV217?.ancestryFeat)ids.add(ch.rulesV217.ancestryFeat);
   if(Array.isArray(ch.ancestryFeats))ch.ancestryFeats.forEach(x=>ids.add(x));
   const list=[...ids].map(id=>(src?.feats||[]).find(x=>x.id===id)).filter(Boolean);
   if(!list.length)return "";
   return '<div class="tv-demo-feats"><span class="v2-overline">CURATED ANCESTRY FEAT</span>'+
      list.map(meta=>'<details class="tv-demo-feat" open><summary><strong>'+escape(meta.name)+
       '</strong><span>'+escape(meta.prerequisites||"Ancestry requirements")+'</span></summary>'+
       '<p>'+escape(meta.name)+' is recorded on this real demonstration sheet.</p>'+
       (window.TERRAVALE_V225_FEATS?.[meta.id]?
         '<div class="tv-demo-published-rule">'+window.TERRAVALE_V225_MD(window.TERRAVALE_V225_FEATS[meta.id])+'</div>':
         '<p class="tv-demo-rule-gap">Published full mechanics were not present in this source snapshot. Consult the Player Primer.</p>')+
       '</details>').join('')+'</div>';
 }
 function mount(){
   const route=location.hash.replace(/^#\/?/,"/");
   if(!route.startsWith("/characters/"))return;
   const id=decodeURIComponent(route.split("/")[2]||"");
   const ch=(typeof db!=="undefined" ? db.characters:[]).find(c=>c.id===id);
   if(!ch || ch.demoCurator!=="Aster")return;
   const shell=$(".sheet20");
   if(!shell)return;
   const tab=$(".sheet20-tabs [data-action='sheetTab'][aria-selected='true']")?.dataset.value;
   if(tab!=="features"&&tab!=="chronicle")return;
   const content=shell.querySelector(".sheet20-content");
   if(!content||content.querySelector("#tv-demo-level-choices"))return;
   const block=document.createElement("section");
   block.className="sheet20-panel tv-demo-level-choices";
   block.id="tv-demo-level-choices";
   const overline=document.createElement("div");overline.className="v2-overline";
   overline.textContent="ASTER'S WAYFARERS · CURATED BUILD";
   const h=document.createElement("h3");h.textContent="How "+ch.name+" reached level "+ch.level;
   const hint=document.createElement("p");hint.className="sheet20-note";
   hint.textContent="These are the character's deliberate roleplaying and training choices. Only the published class/ancestry rules elsewhere on this sheet are mechanical authority.";
   const list=document.createElement("div");list.className="tv-demo-level-list";
   for(const c of Array.isArray(ch.progressionChoices)?ch.progressionChoices:[]){
     const row=document.createElement("div");row.className="tv-demo-level-row";
     const level=document.createElement("strong");level.textContent="Level "+c.level;
     const text=document.createElement("span");text.textContent=c.choice||"";
     row.append(level,text);list.append(row);
   }
   if(!list.children.length)list.textContent="No curated progression choices have been recorded.";
   block.append(overline,h,hint,list);
   if(tab==="features")content.prepend(block);
   else content.append(block);
   // Native feat reader already uses the complete Player Primer source, so
   // do not duplicate its mechanics if the original feat panel exists.
   if(tab==="features"&&!content.querySelector(".sheet22-feats-panel")){
     const panel=document.createElement("div");panel.innerHTML=featureCard(ch);
     block.append(...panel.childNodes);
   }
 }
 let queued=false;
 const observer=new MutationObserver(()=>{
   if(queued)return;
   queued=true;
   requestAnimationFrame(()=>{queued=false;mount()});
 });
 observer.observe(document.getElementById("pageRoot")||document.body,{childList:true,subtree:true});
 window.addEventListener("hashchange",()=>setTimeout(mount,60));
 window.addEventListener("terravale-characters-synced",mount);
 mount();
})();
