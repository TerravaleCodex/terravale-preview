
 'use strict';
/* V2.19 source-derived ancestry ability-score options and equipment slots.
   Origin: lib/ancestry-catalog.json, lib/equipment.ts, lib/character-builder.ts (2026-11-04 snapshot).
   Full item and feat powers NOT inferred. */
(function(){
const R=window.TVR;if(!R)throw Error('V2.17 rules foundation must load before V2.19');
const S=R.STAT;
const configurations={
 Beastfolk:[['flex21','Flexible · +2 and +1'],['flex111','Flexible · three +1 increases']],
 Crimsonborn:[['flex21','One +2 and one +1 (different abilities)']],
 Daemon:[['flex21','Flexible · +2 and +1'],['flex111','Flexible · three +1 increases']],
 Dvergr:[['con2-str1','Constitution +2 · Strength +1'],['con2-wis1','Constitution +2 · Wisdom +1'],['flex21','Flexible · +2 and +1']],
 Elf:[['dex2-other1','Dexterity +2 · another ability +1'],['flex21','Flexible · +2 and +1']],
 Kharithen:[['dex2-other1','Dexterity +2 · another ability +1'],['flex21','Flexible · +2 and +1']],
 Thalassari:[['dex2-other1','Dexterity +2 · another ability +1'],['flex21','Flexible · +2 and +1']],
 Flugel:[['dex2-other1','Dexterity +2 · another ability +1'],['flex21','Flexible · +2 and +1']],
 Human:[['flex111','Three different +1 increases'],['flex21','One +2 and one +1']],
 Oni:[['str2-con1','Strength +2 · Constitution +1'],['con2-str1','Constitution +2 · Strength +1'],['flex21','Flexible · +2 and +1']]
};
const getASI=n=>configurations[n]||[];
function validASI(a,selected){
 const modes=getASI(a);const mode=selected?.mode;
 const choice=modes.find(([m])=>m===mode);
 if(!choice)return {valid:false,bonus:{},issue:'Choose an ancestry ability-score increase pattern.'};
 const p=selected.primary,q=selected.secondary,t=selected.third;
 let bonus={};
 if(mode==='str2-con1')bonus={STR:2,CON:1};
 else if(mode==='con2-str1')bonus={CON:2,STR:1};
 else if(mode==='con2-wis1')bonus={CON:2,WIS:1};
 else if(mode==='dex2-other1'){
  if(!S.includes(q)||q==='DEX')return {valid:false,bonus:{},issue:'Choose an ability other than Dexterity for the +1 increase.'};
  bonus={DEX:2,[q]:1};
 }else if(mode==='flex21'){
  if(!S.includes(p)||!S.includes(q)||p===q)return {valid:false,bonus:{},issue:'Choose different abilities for the +2 and +1 increases.'};
  bonus={[p]:2,[q]:1};
 }else if(mode==='flex111'){
  if(!S.includes(p)||!S.includes(q)||!S.includes(t)||new Set([p,q,t]).size!==3)return {valid:false,bonus:{},issue:'Choose three different abilities for the three +1 increases.'};
  bonus={[p]:1,[q]:1,[t]:1};
 }else return {valid:false,bonus:{},issue:'Unknown ancestry ability-score pattern.'};
 return {valid:true,bonus,issue:''};
}
function asiSchema(a,sel){const mode=sel?.mode||'',locked=mode==='dex2-other1'?{DEX:2}:mode==='con2-str1'?{CON:2,STR:1}:mode==='con2-wis1'?{CON:2,WIS:1}:mode==='str2-con1'?{STR:2,CON:1}:{};return {modes:getASI(a),selected:mode,locked,check:validASI(a,sel)}}
const originalCompute=R.compute;
R.compute=function(d){
 const base=originalCompute({...d,ancestryFeat:'',featAbilityStat:''});
 const selected=validASI(d.ancestry,d.ancestryASI);
 const ancestryBonus=selected.valid?selected.bonus:{};
 const f=R.feat(d.ancestryFeat),featResult=f?R.featCheck(f.id,d.ancestry,1,d.classification||'',1):null;
 const featBonus={};let featError='';
 if(f){if(featResult.status==='blocked')featError=featResult.detail;
 else if(f.bonus.length){if(!d.featAbilityStat)featError='Choose the ability increased by this feat.';
 else if(!f.bonus.includes(d.featAbilityStat))featError='The proposed feat cannot increase '+d.featAbilityStat+'.';
 else featBonus[d.featAbilityStat]=1;}
 else if(d.featAbilityStat)featError='This feat has no recorded +1 ability-score choice.';}
 else if(d.featAbilityStat)featError='Clear the feat ability selection when no feat is selected.';
 const scores={...base.scores};const issue=[...base.issues],review=[...base.review];
 for(const k of S){scores[k]+=Number(ancestryBonus[k]||0)+Number(featBonus[k]||0);if(scores[k]>20)issue.push(k+' exceeds the starting ability score cap of 20.');}
 const cls=R.cls(d.className);
 if(!selected.valid && d.ancestry)review.push('Ancestry ability increases have not been assigned yet.');
 if(featError)issue.push(featError);
 const items=Array.isArray(d.equipment)?d.equipment:[];
 const equipmentCheck=R.checkEquipment(items);
 if(!equipmentCheck.valid)issue.push(...equipmentCheck.errors);
 const hp=cls?Math.max(1,Number(cls.die||0)+R.mod(scores.CON)):null;
 const AC=10+R.mod(scores.DEX);
 const saveMods=Object.fromEntries(S.map(k=>[k,R.mod(scores[k])+(cls?.saves.includes(k)?R.prof(1):0)]));
 const skillAbility={Acrobatics:'DEX','Animal Handling':'WIS',Arcana:'INT',Athletics:'STR',Deception:'CHA',History:'INT',Insight:'WIS',Intimidation:'CHA',Investigation:'INT',Medicine:'WIS',Nature:'INT',Perception:'WIS',Performance:'CHA',Persuasion:'CHA',Religion:'INT','Sleight of Hand':'DEX',Stealth:'DEX',Survival:'WIS'};
 const skillMods=Object.fromEntries(Object.entries(skillAbility).map(([name,attr])=>[name,R.mod(scores[attr])+((d.skills||[]).includes(name)?R.prof(1):0)]));
 const filtered=review.filter(x=>!x.includes('Ancestry ability-score increases, equipment AC')&&!x.includes('Feat powers are not imported')&&!x.includes('are not applied by this snapshot'));
 if(f)filtered.push('Only the feat’s explicit +1 ability increase is calculated; its other features require published rules and DM adjudication.');
 if(items.length)filtered.push('Equipment slot checks are supported. Armour AC, attack bonuses, weight and weapon damage are not automatically calculated.');
 if(!selected.valid&&d.ancestry&& !filtered.some(x=>x.includes('not been assigned')))filtered.push(selected.issue);
 return {...base,scores,abilityBreakdown:Object.fromEntries(S.map(k=>[k,{base:Number(d.scores?.[k.toLowerCase()]||10),ancestry:ancestryBonus[k]||0,feat:featBonus[k]||0,total:scores[k]}])),
  ancestryBonus,featBonus,asi:selected,feat:featResult,hp,ac:AC,initiative:R.mod(scores.DEX),saveMods,skillMods,equipmentCheck,
  issues:[...new Set(issue)],review:[...new Set(filtered)],valid:issue.length===0};
};
R.getASI=getASI;R.validASI=validASI;R.asiSchema=asiSchema;R.version='2.19';
})();
