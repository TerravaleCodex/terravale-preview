/* V2.47: Crimson Court variant belongs to Appearance, not the hunger widget.
 * Verdant's animation is decorative; server unlock follows prolonged growth. */
(function(){
  "use strict";
  const KEY="tv-crimson-court-appearance-variant";
  let variant="standard";
  try{variant=localStorage.getItem(KEY)==="obsidian"?"obsidian":"standard"}catch{}
  const setVariant=v=>{
    variant=v==="obsidian"?"obsidian":"standard";
    try{localStorage.setItem(KEY,variant)}catch{}
    document.body.dataset.tvCrimsonVariant=variant;
    repaintButtons();
  };
  const isCrimson=()=>document.body.dataset.theme==="crimson";
  const repaintButtons=()=>{
    document.querySelectorAll("#tv-crimson-variant button[data-variant]").forEach(b=>{
      b.setAttribute("aria-pressed",String(b.dataset.variant===variant));
    });
  };
  function mountAppearance(){
    const route=location.hash.toLowerCase();
    if(!route.includes("appearance"))return;
    const root=document.getElementById("pageRoot");if(!root)return;
    const titles=[...root.querySelectorAll("h2,h3,h4")];
    const crimsonTitle=titles.find(h=>h.textContent.trim()==="Crimson Court");
    if(!crimsonTitle)return;
    let card=crimsonTitle.closest(".v2-card,article,.appearance-card,.theme-card");
    if(!card){
      card=crimsonTitle.parentElement;
      while(card && !card.textContent.includes("Preview this theme"))card=card.parentElement;
    }
    if(!card || card.querySelector("#tv-crimson-variant"))return;
    const panel=document.createElement("div");
    panel.id="tv-crimson-variant";panel.className="tv-crimson-variant";
    const label=document.createElement("div");
    label.className="tv-eyebrow";label.textContent="CRIMSON COURT · APPEARANCE";
    const hint=document.createElement("p");
    hint.textContent="Choose wine-red velvet or a deeper near-black-and-red version.";
    const choices=document.createElement("div");choices.className="tv-crimson-choices";
    for(const [v,name] of [["standard","Velvet"],["obsidian","Black & Red"]]){
      const button=document.createElement("button");button.type="button";
      button.dataset.variant=v;button.textContent=name;
      button.setAttribute("aria-pressed",String(v===variant));
      button.addEventListener("click",()=>{
        setVariant(v);
        if(!isCrimson() && typeof setTheme==="function")setTheme("crimson");
      });
      choices.append(button);
    }
    panel.append(label,hint,choices);card.append(panel);
  }
  const NS="http://www.w3.org/2000/svg";
  const svgNode=(tag,attrs={})=>{
    const n=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
    return n;
  };
  function createBotanical(){
    const root=document.getElementById("tv-growing-vines");
    if(!root)return;
    if(root.querySelector(".tv-botanical-art"))return;
    const svg=svgNode("svg",{
      class:"tv-botanical-art",viewBox:"0 0 1200 760",
      preserveAspectRatio:"xMidYMid slice","aria-hidden":"true"
    });
    const defs=svgNode("defs");
    const grad=svgNode("linearGradient",{id:"tv-leaf-shading",x1:"0",y1:"0",x2:"1",y2:"1"});
    for(const [off,color,opacity] of [["0%","#4b9360",".10"],["50%","#83c99b",".32"],["100%","#245637",".18"]]){
      const stop=svgNode("stop",{offset:off,"stop-color":color,"stop-opacity":opacity});grad.append(stop);
    }
    defs.append(grad);svg.append(defs);
    const stem=svgNode("g",{class:"tv-botanical-stems"});
    const strokes=[
      ["M -20 785 C 70 710,65 615,110 535 S 145 410,93 325 S 88 186,155 95",0],
      ["M 1235 792 C 1125 700,1170 580,1086 488 S 985 341,1065 230 S 1158 130,1118 -25",7],
      ["M 10 760 C 22 660,49 630,86 585 S 185 522,206 458",17],
      ["M 1190 770 C 1180 600,1110 535,1020 512 S 946 438,915 392",28],
      ["M 105 532 C 158 495,175 470,176 417",35],
      ["M 102 389 C 49 344,34 310,41 266",42],
      ["M 1070 482 C 1133 458,1145 410,1140 368",49],
      ["M 1030 415 C 976 402,964 364,984 310",57]
    ];
    strokes.forEach(([d,delay],i)=>{
      const path=svgNode("path",{d,class:"tv-botanical-stem",style:
        "--grow-delay:"+delay+"s;--grow-length:"+(i<2?1000:430)+";"});
      stem.append(path);
    });svg.append(stem);
    // Varied veined, pointed leaves along the branches rather than oversized ovals.
    const placements=[
      [80,625,-47,19,25],[115,549,42,15,39],[112,463,-34,19,47],
      [99,386,52,14,58],[126,293,-42,17,66],[132,206,26,13,77],
      [53,685,26,16,37],[157,501,32,16,57],[180,453,-37,13,70],
      [40,289,-18,14,88],[1127,648,34,19,30],[1089,570,-46,17,42],
      [1058,490,42,17,51],[1032,409,-37,19,63],[1063,312,52,14,75],
      [1115,204,-24,16,87],[1159,550,-40,13,59],[1000,453,-19,14,72],
      [955,394,33,12,86],[1147,369,40,14,93]
    ];
    const leaves=svgNode("g",{class:"tv-botanical-leaves"});
    for(const [x,y,angle,size,delay] of placements){
      const g=svgNode("g",{class:"tv-botanical-leaf",style:
        "--leaf-delay:"+delay+"s;--leaf-angle:"+angle+"deg",
        transform:"translate("+x+" "+y+") rotate("+angle+") scale("+(size/16)+")"});
      const shape=svgNode("path",{d:"M0 0 C-10 -11,-13 -25,-6 -38 C-1 -45,9 -48,14 -52 C20 -31,18 -13,0 0 Z",
        fill:"url(#tv-leaf-shading)",stroke:"#6ead83","stroke-width":".75","stroke-opacity":".30"});
      const vein=svgNode("path",{d:"M0 -1 C4 -17,7 -32,13 -48 M4 -19 L-5 -30 M8 -32 L15 -39",
        fill:"none",stroke:"#b1e0b4","stroke-width":".7","stroke-opacity":".17"});
      g.append(shape,vein);leaves.append(g);
    }
    svg.append(leaves);root.append(svg);
  }
  const refresh=()=>{
    document.body.dataset.tvCrimsonVariant=variant;
    mountAppearance();
    if(document.body.dataset.theme==="verdant")createBotanical();
  };
  let pending=false;
  const observer=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;refresh()});
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-theme"]});
  window.addEventListener("hashchange",()=>setTimeout(refresh,80));
  window.addEventListener("terravale-auth-ready",refresh,{once:true});
  refresh();
})();
