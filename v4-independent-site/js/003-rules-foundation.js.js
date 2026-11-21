
'use strict';
/* Offline-source-derived foundation. No cloud access, no implied published rules. */
(function(){
const M=window.TERRAVALE_RULES_MANIFEST;
const STAT=['STR','DEX','CON','INT','WIS','CHA'];
const ARRAY=[15,14,13,12,10,8];
const cls=n=>M.classes.find(c=>c.name===n)||null;
const ancestry=n=>M.ancestries.find(a=>a.name===n)||null;
const feat=id=>M.feats.find(f=>f.id===id)||null;
const mod=n=>Math.floor((Number(n)-10)/2);
const bonus=n=>{const x=mod(n);return (x>=0?'+':'')+x};
const prof=l=>2+Math.floor((Math.max(1,Math.min(20,Number(l)||1))-1)/4);
const isArray=s=>{if(!s)return false;const nums=STAT.map(k=>Number(s[k.toLowerCase()]));return nums.every(Number.isInteger)&&nums.sort((a,b)=>b-a).join(',')===ARRAY.join(',')};
const withArray=(s,key,val)=>{const n=Number(val),out={...s};if(!ARRAY.includes(n))return out;const prev=Number(s[key]);const old=Object.keys(s).find(k=>k!==key&&Number(s[k])===n);out[key]=n;if(old)out[old]=prev;return out;};
function eligibility(className, ancestryName){
 const c=cls(className),a=ancestry(ancestryName);
 if(!c||!a)return {status:'missing',detail:'Choose an ancestry and class to check eligibility.'};
 if(c.ancestries.length===0)return {status:'allowed',detail:'No ancestry restriction in the imported class catalogue.'};
 if(c.ancestries.includes(a.name))return c.name==='Echo-Bearer'?{status:'review',detail:'Base Elf qualifies in the catalogue; the Ael’Vaen lineage must be confirmed with the DM.'}:{status:'allowed',detail:'The class catalogue lists this ancestry as eligible.'};
 if(c.ancestries.includes('Draconic'))return {status:'review',detail:'Requires a Draconic manifestation/overlay. The ten base ancestries do not encode it; DM confirmation required.'};
 return {status:'blocked',detail:`The class catalogue restricts ${c.name} to ${c.ancestries.join(', ')}. An exception requires DM authorisation.`};
}
function featCheck(id,a,level=1,classification='',stage=1){
 const f=feat(id);if(!f)return{status:'missing',detail:'No feat selected'};
 if(f.ancestry!==String(a||'').toLowerCase() && !(f.ancestry==='elf'&&['Elf','Kharithen','Thalassari','Flugel'].includes(a)))return {status:'blocked',detail:'This feat is recorded for a different ancestry.'};
 const m=f.prerequisites.match(/(?:Crimson\s+)?Stage\s+(\d+)/i);
 if(m&&Number(stage)<Number(m[1]))return {status:'blocked',detail:`Requires Crimson Stage ${m[1]}; new Crimsonborn begin at Stage I.`};
 const l=f.prerequisites.match(/(\d+)(?:st|nd|rd|th)?\s+level/i);
 if(l&&Number(level)<Number(l[1]))return {status:'blocked',detail:`Requires level ${l[1]}.`};
 const rest=f.prerequisites.replace(/^[^;,()]+(?:\s*\([^)]*\))?[,;]?\s*/,'').trim();
 if(rest || /DM approval|Lineage|classification|Trait|Stage|Instinctive/i.test(f.prerequisites))return {status:'review',detail:'Other prerequisites need confirmation: '+f.prerequisites};
 return {status:'allowed',detail:'Ancestry, level and stage checks pass; detailed effects still need the full feat text.'};
}
const SLOTS=['main','off','head','chest','gloves','legs','feet','cloak','neck','ring1','ring2','accessory1','accessory2','focus'];
const KIND_SLOTS={weapon:['main','off'],shield:['off'],head:['head'],chest:['chest'],gloves:['gloves'],legs:['legs'],feet:['feet'],cloak:['cloak'],neck:['neck'],ring:['ring1','ring2'],accessory:['accessory1','accessory2'],focus:['focus','main','off'],armour:['head','chest','gloves','legs','feet','cloak']};
function allowedSlots(item){const kind=item?.kind,base=KIND_SLOTS[kind]||[];if(item?.twoHanded)return (kind==='weapon'||kind==='focus')?['main']:[];return base;}
function checkEquipment(items){const errors=[];const occupied=new Map();for(const item of items||[]){if(!item.slot)continue;if(!allowedSlots(item).includes(item.slot)){errors.push((item.name||'Item')+' cannot occupy '+item.slot+'.');continue}if(occupied.has(item.slot))errors.push('Two items cannot share '+item.slot+'.');occupied.set(item.slot,item)}if(occupied.has('main')&&occupied.get('main').twoHanded&&occupied.has('off'))errors.push('Two-handed main-hand equipment occupies both hands.');return {valid:errors.length===0,errors};}
function compute(d){const c=cls(d.className),a=ancestry(d.ancestry),base=d.scores||{},scores=Object.fromEntries(STAT.map(k=>[k,Number(base[k.toLowerCase()]||10)]));const f=feat(d.ancestryFeat),choice=d.featAbilityStat;
 const featResult=f?featCheck(f.id,d.ancestry,1,d.classification||'',1):null;
 if(f&&choice&&f.bonus.includes(choice)&&scores[choice]<20&&featResult?.status!=='blocked')scores[choice]++;
 const hp=c?Math.max(1,c.die+mod(scores.CON)):null;
 const elig=eligibility(d.className,d.ancestry);
 const issues=[],review=[];
 if(d.className&&d.ancestry&&elig.status==='blocked')issues.push(elig.detail);
 if(d.className&&d.ancestry&&elig.status==='review')review.push(elig.detail);
 if(!isArray(base))issues.push('Assign each standard-array value exactly once: 15, 14, 13, 12, 10, 8.');
 if(d.className&&c){if(c.skillCount!==null){const s=d.skills||[];if(s.length!==c.skillCount||!c.skillAll&&s.some(x=>!c.skills.includes(x)))issues.push('Choose exactly '+c.skillCount+' valid class skills.');}
 if(!c.startingProfileVerified)review.push('Specialised class features, proficiencies and resource details need full Player Primer/DM review.');
 if(c.saves.some(x=>!STAT.includes(x)))review.push('Class has non-standard saving throw metadata; DM adjudication required.');}
 if(f){if(featResult.status==='blocked')issues.push(featResult.detail);if(featResult.status==='review')review.push(featResult.detail);
 if(f.bonus.length&&!choice)issues.push('Choose which ability this feat increases.');if(choice&&!f.bonus.includes(choice))issues.push('This feat cannot increase '+choice+'.');}
 if(d.ancestry==='Crimsonborn')review.push('Crimsonborn begins at Stage I. Blood State, feeding and regeneration require full rules.');
 if(d.ancestry==='Beastfolk')review.push('Beastfolk Animal Classification and expression require DM confirmation for applicable feats.');
 review.push('Ancestry ability-score increases, equipment AC and class-specific exceptions are not applied by this snapshot.');
 return {scores,hp,ac:10+mod(scores.DEX),initiative:mod(scores.DEX),speed:a?.speed??null,size:a?.size??null,proficiency:prof(1),saves:c?.saves||[],hitDie:c?.die??null,eligibility:elig,issues:[...new Set(issues)],review:[...new Set(review)],feat:featResult,valid:issues.length===0};
}
window.TVR={manifest:M,STAT,ARRAY,cls,ancestry,feat,mod,bonus,prof,isArray,withArray,eligibility,featCheck,SLOTS,KIND_SLOTS,allowedSlots,checkEquipment,compute};
})();

