
/* V2.25.1 — verified published subclass index and optional complete local source import.
   Read-only references. Does not change characters or class mechanics. */
(()=>{
'use strict';
const INDEX={"Echo-Bearer":["Discipline of the Remembered Blade","Discipline of the Living Chorus","Discipline of the Gentle Unburdening"],"Lineage Adept":["Stillwatcher","Trailcaller","Holdfast"],"Artificer":["Alchemist","Armorer","Artillerist","Battle Smith","Reanimator","Archivist"],"Barbarian":["Berserker","Wild Heart","Spiritual Guardian","Storm Herald","Zealot","Beast","Giant","Wild Magic","World Tree","Lament","Battlerager"],"Bard":["College of Lore","College of Valor","College of Glamour","College of Dance","College of Creation","College of Eloquence","College of Swords","College of Whispers","College of Spirits","College of the Moon","College of Satire"],"Cleric":["Life Domain","Light Domain","Trickery Domain","War Domain","Knowledge Domain","Grave Domain","Arcana Domain","Nature Domain","Tempest Domain","Death Domain","Forge Domain","Order Domain","Peace Domain","Twilight Domain","Fate Domain","Freedom Domain","Pestilence Domain"],"Druid":["Circle of the Land","Circle of the Moon","Circle of Stars","Circle of the Sea","Circle of Dreams","Circle of the Shepherd","Circle of Spores","Circle of Wildfire","Circle of Preservation","Circle of the Titan","Circle of Twilight"],"Fighter":["Champion","Battle Master","Eldritch Knight","Psi Warrior","Arcane Archer","Banneret","Cavalier","Samurai","Rune Knight","Echo Knight","Gladiator","Iron Justiciar"],"Monk":["Way of the Open Hand","Way of Shadow","Warrior of the Elements","Way of Mercy","Way of the Astral Self","Way of the Kensei","Way of the Long Death","Way of the Sun Soul","Way of the Ascendant Dragon","Way of Intoxication","Tattooed Warrior","Way of Mystic Arts","Way of Venom","Cobalt Soul"],"Paladin":["Oath of Devotion","Oath of the Ancients","Oath of Vengeance","Oath of Glory","Oath of Conquest","Oath of Redemption","Oath of the Crown","Oath of the Watchers","Oath of the Elemental Sovereign","Oath of the Spellguard","Oathbreaker","Oath of the Open Sea"],"Ranger":["Hunter","Beast Master","Gloom Stalker","Fey Wanderer","Swarmkeeper","Horizon Walker","Monster Slayer","Drakewarden","Winter Walker","Hollow Warden"],"Rogue":["Thief","Assassin","Arcane Trickster","Soulknife","Phantom","Swashbuckler","Scout","Inquisitive","Mastermind","Magic Stealer","Agent"],"Sorcerer":["Draconic Sorcery","Wild Magic Sorcery","Aberrant Sorcery","Clockwork Sorcery","Divine Soul","Shadow Sorcery","Storm Sorcery","Lunar Sorcery","Spellfire Sorcery","Defiled Sorcery","Demonic Sorcery","Phoenix Sorcery","Sea Sorcery","Stone Sorcery","Runechild"],"Warlock":["Archfae Patron","Celestial Patron","Daemon Patron","Old God Patron","Fathomless Patron","True Dragon Patron","Reaper Patron","Vestige Patron","Sorcerer-King Patron","Primordial Patron","Seeker Patron","Eldritch Patron"],"Wizard":["Abjurer","Conjurer","Diviner","Enchanter","Evoker","Illusionist","Necromancer","Transmuter","Bladesinger","War Magic","Order of Scribes","Graviturgy","Blood Magic"],"Crimson Conduit":["Pulsewright","Red Intercessor","Severance Conduit"],"Ripperbound":["Iron Leash — Capture & Control","Red Pursuit — Relentless Hunting","Last Restraint — Defence & Sacrifice"],"Scarlet Masque":["Veiled Courtier — Institutional Infiltration","Red Witness — Forensics and Anti-Imposture","Velvet Knife — Precision Combat and Misdirection"],"Chaos Arsenal":["Path of the Shardstorm","Path of the Siege Body","Path of the Razor Choir","Path of the Devouring Shape"],"Dream-Eater":["Nightmare Maw — Predatory Fear","Lucid Shepherd — Dream Protection"],"Vhaeros Cantor (v1.10)":["3rd-Level Verses — Choose One","6th-Level Verses — Choose One","10th-Level Verses — Choose One","14th-Level Verses — Choose One"],"Vitaeforge (v1.10)":["Adamant Frame","Ravener Frame","Protean Frame"],"Gatewarden":["Iron Threshold — direct interception / immovable defence","Bridgekeeper — moving formations / protected passage","Collapse Engineer — structures / battlefield engineering"],"Ventweaver":["Storm-Choral","Descent Warden","Ruin Mediator"],"Shaman":["The Vessel","The Warden","The Ancestor Keeper","The Spiritwalker","The Wild Speaker"],"Summoner":["Conduit — External Projection","Vessel — Internal Merge","Shaper — Versatile Forms","Ascendant — Controlled Overreach"],"Ashheir":["Reliquary Heir","Namebearer","Last Scion"],"Shadowforger":["The Black Edge","The Sepulchral Mantle","The Hollow Architect"],"Pressurebearer":["The Unmoving Line","The Shared Burden","The Breaking Point","The Long Watch"],"Seal-Maintainer":["Silent Seal","Closed Road","Burden-House","Severing Script"],"Oracle of the Two Waters":["Choir of the Silver Current","Choir of Stillwater","Choir of Warning","Choir of the Abyssal Confluence"]};
const STORE='terravale-v2251-published-subclasses-v1';
const GROUP_HEADINGS=['Full Features','Echo Disciplines','Adept Callings','Conduit Paths','Ripper Bindings','Scarlet Roles','Ruin Paths','Dream Hungers','Domain Verses','Forge Disciplines','Warden Charges','Vent Traditions','Summoner Paths','Modes of Inheritance','Forge Traditions','Pressure Disciplines','Seal Disciplines','Sacred Choirs'];
const normal=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[’‘]/g,"'").replace(/[—–]/g,'-').replace(/\s*-\s*[^-]+$/,'').replace(/^the\s+/,'').replace(/[^a-z0-9]+/g,'');
let cached={};
try{cached=JSON.parse(localStorage.getItem(STORE)||'{}');if(!cached||typeof cached!=='object'||Array.isArray(cached)) cached={};}catch{cached={};}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function decodeEntities(value){const el=document.createElement('textarea');el.innerHTML=String(value||'');return el.value;}
function plainHTML(value){return decodeEntities(String(value||'')
 .replace(/<li\b[^>]*>/gi,'\n• ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|li|tr|div|h[1-6]|blockquote)>/gi,'\n')
 .replace(/<\/(td|th)>/gi,'  ·  ').replace(/<[^>]+>/g,'')
 .replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim());}
function extractSource(documents){
 if(!Array.isArray(documents))throw Error('Expected the published codex.json article array.');
 const result={};let found=0,matched=0;
 for(const item of documents){if(!item||typeof item.title!=='string'||typeof item.html!=='string'||!INDEX[item.title])continue;
  const cls=item.title,html=item.html;
  const headings=[...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m=>({level:Number(m[1]),title:plainHTML(m[2]),start:m.index,end:m.index+m[0].length}));
  const groups=headings.filter(h=>h.level===2&&GROUP_HEADINGS.some(v=>h.title.includes(v)));
  const options={};
  function add(h,end){let next=headings.find(y=>y.start>h.start&&y.level<=h.level);let text=plainHTML(html.slice(h.end,Math.min(end,next?.start||end)));if(text.length>=35)options[h.title]=text;}
  for(const group of groups){let end=headings.find(h=>h.start>group.start&&h.level<=2)?.start||html.length;
   for(const h of headings.filter(y=>y.start>group.start&&y.start<end&&y.level===3))add(h,end);
  }
  if(cls==='Shaman')for(const h of headings.filter(h=>h.level===2&&/^The (Vessel|Warden|Ancestor Keeper|Spiritwalker|Wild Speaker)$/.test(h.title))){const end=headings.find(y=>y.start>h.start&&y.level<=2)?.start||html.length;add(h,end);}
  for(const expected of INDEX[cls]){let key=Object.keys(options).find(k=>k===expected)||Object.keys(options).find(k=>normal(k)===normal(expected));if(key){(result[cls]||={})[expected]=options[key];matched++;}}
  found++;
 }
 if(found<3||matched<10)throw Error('The supplied file does not contain the expected Terravale published class articles.');
 return {result,matched,articles:found};
}
function options(cls){return INDEX[cls]||window.TERRAVALE_V224_DETAILS?.subclasses?.[cls]||[];}
function lookup(cls,name){const src=cached[cls]||{};const exact=src[name]||Object.entries(src).find(([k])=>normal(k)===normal(name))?.[1];
 if(exact)return {status:'complete',label:'Published rules · full class-article section',text:exact};
 const snippets=window.TERRAVALE_V225_SUBCLASSES?.[String(cls).toLowerCase()]||{};
const short=snippets[name]||Object.entries(snippets).find(([k])=>normal(k)===normal(name))?.[1];
 if(short)return {status:'excerpt',label:'Incomplete 700-character source excerpt',text:short};
 const brief=window.TERRAVALE_V224_DETAILS?.guides?.[cls]||{};
 const desc=brief[name]||Object.entries(brief).find(([k])=>normal(k)===normal(name))?.[1];
 if(desc)return {status:'abridged',label:'Condensed reference only',text:desc};
 return {status:'unavailable',label:'Published option name · rules not imported',text:''};
}
function statusCount(cls){const opts=options(cls);return {total:opts.length,full:opts.filter(n=>lookup(cls,n).status==='complete').length,excerpt:opts.filter(n=>lookup(cls,n).status==='excerpt').length};}
function renderRule(rule){if(!rule.text)return '<p>The published option is identified, but its mechanics are not included in this copy of the offline preview.</p>';
 return `<div class="v2251-rule-text">${escapeHTML(rule.text)}</div>`;}
function parseInput(txt){
 const source=String(txt||'');
 if(source.trimStart().startsWith('['))return JSON.parse(source);
 // Older Terravale Open Me prototypes ship the same published article array inline.
 const marker=/window\.TERRAVALE_CODEX\s*=\s*\[/g.exec(source);
 if(marker){
  const begin=source.indexOf('[',marker.index),depthStart=begin;
  let depth=0,quoted=false,escaped=false;
  for(let at=begin;at<source.length;at++){
   const ch=source[at];
   if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
   if(ch==='"'){quoted=true;continue;}
   if(ch==='[')depth++;
   if(ch===']'){depth--;if(depth===0)return JSON.parse(source.slice(depthStart,at+1));}
  }
 }
 throw Error('Select the published codex.json or a Terravale Open Me prototype HTML containing TERRAVALE_CODEX.');
}
function importFile(file){return file.text().then(txt=>{const parsed=extractSource(parseInput(txt));cached=parsed.result;
  try{localStorage.setItem(STORE,JSON.stringify(cached));}catch{throw Error('Could not store the imported rules in this browser.');}
  if(typeof renderPage==='function')renderPage(false);
  if(typeof toast==='function')toast('Imported '+parsed.matched+' published specialisation sections locally.');
  return parsed;
 });}
function exportRules(){const blob=new Blob([JSON.stringify({format:'terravale-v2251-class-subclasses',classes:cached},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='terravale-published-subclasses-local.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('change',ev=>{if(ev.target?.matches('[data-v2251-source-file]')){const file=ev.target.files?.[0];if(!file)return;
 importFile(file).catch(error=>{if(typeof toast==='function')toast('Could not import class rules: '+error.message);else alert(error.message);});}},true);
document.addEventListener('click',ev=>{if(ev.target?.closest('[data-v2251-export]')){ev.preventDefault();ev.stopPropagation();exportRules();}},true);
window.TERRAVALE_V2251={INDEX,options,lookup,statusCount,renderRule,escapeHTML,extractSource,parseInput,importFile,exportRules,
  fullCount:()=>Object.values(cached).reduce((n,v)=>n+Object.keys(v).length,0)};
})();

