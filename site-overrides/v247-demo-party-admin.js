/* Terravale V2.47: Actual shared demo party and DM-only character administration.
 * All destructive actions are server-verified and require typed confirmation.
 * Aster is a fictional demo curator, NOT a simulated Discord login. */
(function(){
  "use strict";
  const account=()=>window.TerravaleVerifiedAccount;
  const bridge=()=>window.TerravaleV2Bridge;
  const client=()=>account()?.supabase;
  const p=()=>account()?.state?.profile;
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isDm=()=>Boolean(p()?.is_dm&&!window.TerravalePlayerPreview);
  let partyCache=null, partyPending=false, rendering=false;
  const root=()=>document.getElementById("pageRoot");
  const path=()=>location.hash.replace(/^#\/?/,"/");
  function showNotice(message){
    if(typeof toast==="function")toast(message);
    else console.info("[Terravale]",message);
  }
  function typedConfirmation({title,message,phrase,submitLabel}){
    return new Promise(resolve=>{
      const backdrop=document.createElement("div");
      backdrop.className="tv-confirm-backdrop";
      const dialog=document.createElement("section");
      dialog.className="tv-confirm-dialog";
      dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");
      const heading=document.createElement("h2");heading.textContent=title;
      const paragraph=document.createElement("p");paragraph.textContent=message;
      const instruction=document.createElement("label");instruction.textContent="Type "+phrase+" to confirm";
      const field=document.createElement("input");field.type="text";field.autocomplete="off";
      field.spellcheck=false;field.placeholder=phrase;field.setAttribute("aria-label","Confirmation phrase");
      const actions=document.createElement("div");actions.className="tv-confirm-actions";
      const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";
      const proceed=document.createElement("button");proceed.type="button";
      proceed.textContent=submitLabel;proceed.className="tv-danger";proceed.disabled=true;
      instruction.append(field);actions.append(cancel,proceed);
      dialog.append(heading,paragraph,instruction,actions);backdrop.append(dialog);
      document.body.append(backdrop);
      const close=answer=>{document.removeEventListener("keydown",keys);backdrop.remove();resolve(answer)};
      const keys=e=>{if(e.key==="Escape")close(false)};
      document.addEventListener("keydown",keys);
      field.addEventListener("input",()=>{proceed.disabled=field.value!==phrase});
      cancel.onclick=()=>close(false);
      proceed.onclick=()=>close(true);
      backdrop.onclick=e=>{if(e.target===backdrop)close(false)};
      field.focus();
    });
  }

  async function loadParty(force=false){
    if(partyPending)return partyCache||[];
    if(partyCache&&!force)return partyCache;
    partyPending=true;
    try{
      const {data,error}=await client().rpc("terravale_demo_party");
      if(error)throw error;
      partyCache=Array.isArray(data)?data:[];
    }catch(e){console.warn("Demo party list unavailable:",e.message);partyCache=[]}
    finally{partyPending=false}
    return partyCache;
  }

  async function deleteCharacter(ch){
    if(!isDm()||!ch?.id)return;
    if(ch.demoCurator==='Aster'||ch.demoTemplateSlot){showNotice('The curated Wayfarers are permanent campaign characters.');return}
    const answer=await typedConfirmation({
      title:"Delete "+ch.name+"?",
      message:"This deletes this real character sheet from the selected campaign, including its live HP, inventory and roster slot. An archive snapshot is retained for recovery; the action cannot be undone in the interface.",
      phrase:ch.name,submitLabel:"Delete character"
    });
    if(!answer)return;
    const {data,error}=await client().rpc("terravale_delete_character",
      {target_character:ch.id,confirm_name:ch.name});
    if(error){showNotice("Character deletion failed: "+error.message);return}
    db.characters=db.characters.filter(c=>c.id!==ch.id);
    persist();
    partyCache=null;
    if(path().startsWith("/characters/"))navigate("/characters");
    await bridge()?.syncCharacters?.();
    await loadParty(true);
    showNotice("Deleted "+(data?.name||ch.name)+". A recovery snapshot was archived.");
    schedule();
  }
  const makeButton=(text,action,className="")=>{
    const b=document.createElement("button");b.type="button";
    b.className="tv-demo-btn "+className;b.textContent=text;
    b.addEventListener("click",action);return b;
  };
  function partyTile(ch,featured=false){
    const article=document.createElement("article");
    article.className="tv-demo-character"+(featured?" tv-demo-featured":"");
    const mark=document.createElement("span");mark.className="tv-demo-mark";
    mark.textContent=featured?"✧":(ch.class_name||"?").slice(0,1);
    const title=document.createElement("a");
    title.href="#/characters/"+encodeURIComponent(ch.character_id);
    title.textContent=ch.character_name;
    title.className="tv-demo-character-title";
    const line=document.createElement("p");line.textContent=
      ch.ancestry+" · "+ch.class_name+" · Level "+ch.level;
    const role=document.createElement("p");role.className="tv-demo-role";
    role.textContent=ch.party_role||(featured?"Research and protection":"Adventuring companion");
    const credit=document.createElement("small");
    credit.textContent="Played by "+ch.curator+" · Demo character";
    article.append(mark,title,line,role,credit);
    if(featured){
      const m=document.createElement("span");m.className="tv-demo-margin";
      m.textContent="Margin · memory-crow companion";article.append(m);
    }
    return article;
  }
  async function mountParty(){
    const el=root();
    if(!el||typeof db==='undefined')return;
    const route=path(),demoId=db.campaigns.find(c=>bridge()?.isDemo?.(c.id))?.id;
    const inCampaign=Boolean(demoId&&route==="/campaigns/"+demoId);
    const rosterTab=inCampaign&&Boolean(el.querySelector(
      '.campaign-detail-tabs [data-action="campaignTab"][data-value="party"][aria-selected="true"]'));
    const chronicle=Boolean(demoId&&db.campaign===demoId&&route.startsWith("/dm"));
    if(!demoId||!bridge()?.hasCampaign?.(demoId)||(!rosterTab&&!chronicle))return;
    const host=rosterTab?
      el.querySelector(".campaign-detail-content .campaign-detail-section"):
      el.querySelector(".dm-content,.dm-root,.dm-chronicle")||el;
    if(!host||host.querySelector("#tv-demo-party"))return;
    const panel=document.createElement("section");
    panel.id="tv-demo-party";panel.className="tv-demo-party tv-demo-permanent-party";
    const heading=document.createElement("div");heading.className="tv-demo-party-heading";
    heading.innerHTML='<div><div class="tv-eyebrow">THE WAYFARERS’ TABLE · PERMANENT PARTY</div><h2>Aster’s Wayfarers</h2><p>Seven real, approved, permanent adventurers. Their character IDs, equipment, abilities and progress now remain intact — they are not rebuilt or reset.</p></div>';
    const count=document.createElement("span");count.className="tv-demo-party-count";
    count.textContent="7 adventurers";heading.append(count);
    const grid=document.createElement("div");grid.className="tv-demo-party-grid";
    grid.textContent="Loading the party…";panel.append(heading,grid);
    if(rosterTab){
      const before=host.querySelector(".campaign-roster");
      if(before)before.insertAdjacentElement("beforebegin",panel);
      else host.append(panel);
    }else host.append(panel);
    const list=await loadParty();
    if(!panel.isConnected)return;
    grid.replaceChildren();
    if(!list.length){
      grid.textContent="The permanent party could not be loaded. Try refreshing the page.";
      return;
    }
    for(const ch of list)grid.append(partyTile(ch,ch.character_name==="Aster Vaelith"));
    count.textContent=list.length+" adventurers";
    if(rosterTab){
      const native=host.querySelector(".campaign-roster");
      if(native){
        const curatedIds=new Set(list.map(ch=>String(ch.character_id)));
        for(const link of native.querySelectorAll('a[href*="#/characters/"]')){
          const id=(link.getAttribute("href")||"").split("/").pop();
          if(curatedIds.has(decodeURIComponent(id)))link.remove();
        }
        if(!native.querySelector(".campaign-detail-row"))native.hidden=true;
      }
      const caption=host.querySelector(".campaign-detail-title p");
      if(caption)caption.textContent="The Wayfarers and any additional adventurers who joined the real campaign.";
    }
  }
  function characterButtons(ch){
    const area=document.createElement("div");area.className="tv-admin-inline";
    if(ch.demoCurator==='Aster'||ch.demoTemplateSlot){
      const note=document.createElement("small");note.className="tv-demo-permanent-note";
      note.textContent="Permanent · played by Aster";area.append(note);
    }else area.append(makeButton("Delete character",()=>deleteCharacter(ch),"tv-danger"));
    return area;
  }
  function mountAdmin(){
    const el=root();
    if(!el||!isDm())return;
    const route=path(), demoId=db.campaigns.find(c=>bridge()?.isDemo?.(c.id))?.id;
    const selectedCampaign=db.campaign;
    // DM Chronicle and demo campaign: manager shows actual synced records.
    if(route.startsWith("/dm")&&!el.querySelector("#tv-demo-admin")){
      const panel=document.createElement("section");panel.id="tv-demo-admin";panel.className="tv-demo-admin";
      const eyebrow=document.createElement("div");eyebrow.className="tv-eyebrow";
      eyebrow.textContent="DM CHRONICLE · CHARACTER MANAGEMENT";
      const h=document.createElement("h2");h.textContent="Campaign characters";
      const note=document.createElement("p");
      note.textContent="The seven Aster-curated characters are permanent. Other campaign characters can be deleted individually with name confirmation.";
      const list=document.createElement("div");list.className="tv-demo-admin-list";
      const characters=(db.characters||[]).filter(c=>c.campaign===selectedCampaign);
      for(const ch of characters){
        const line=document.createElement("div");line.className="tv-demo-admin-row";
        const link=document.createElement("a");link.href="#/characters/"+encodeURIComponent(ch.id);
        link.textContent=ch.name;
        const subtype=document.createElement("small");
        subtype.textContent=ch.className+" · "+(ch.ownerName||"Unknown player");
        const identity=document.createElement("div");identity.append(link,subtype);
        line.append(identity,characterButtons(ch));list.append(line);
      }
      if(!characters.length)list.textContent="No characters in the currently selected campaign.";
      panel.append(eyebrow,h,note,list);
      // No demo reset: curated characters now have permanent saved records.
      el.append(panel);
    }
    // Also expose direct delete in character sheet when it's a DM-owned campaign.
    if(route.startsWith("/characters/")&&!el.querySelector("#tv-character-admin")){
      const id=route.split("/")[2],ch=(db.characters||[]).find(c=>c.id===id);
      if(!ch||!bridge()?.hasCampaign?.(ch.campaign))return;
      if(ch.demoCurator==='Aster'||ch.demoTemplateSlot)return;
      const sec=document.createElement("section");sec.id="tv-character-admin";sec.className="tv-character-admin";
      sec.append(document.createTextNode("DM actions"),characterButtons(ch));
      el.append(sec);
    }
  }
  let queued=false;
  function schedule(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;mountParty();mountAdmin()});
  }
  const observer=new MutationObserver(schedule);
  observer.observe(document.getElementById("pageRoot")||document.body,
    {childList:true,subtree:true});
  window.addEventListener("hashchange",()=>setTimeout(schedule,90));
  window.addEventListener("terravale-characters-synced",()=>{partyCache=null;schedule()});
  window.addEventListener("terravale-auth-ready",schedule,{once:true});
  schedule();
})();
