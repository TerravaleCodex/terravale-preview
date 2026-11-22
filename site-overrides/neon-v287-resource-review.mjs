/** Read-only V2.87 resource reconciliation preview.
 * Browser UI may SUGGEST source-reviewed maxima but may never treat missing
 * saved usage as actual remaining charges or issue any writes. */
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
export function makeV287ResourceReview(snapshot, fixed, spell){
 if(snapshot?.schema!=="terravale.neon.v287.sheet.readonly.v1"||
    snapshot.read_only!==true||!["owned","dm"].includes(snapshot.access)||
    !isObject(snapshot.sources?.approved_build)||!isObject(snapshot.resource_sources)||
    fixed?.schema!=="terravale.native-v287.fixed-resources.v1"||
    spell?.schema!=="terravale.native-v287.spell-progression.v1"||
    spell.automatic_recovery_authorised!==false||
    fixed.auto_rest_authorised!==false)
   throw new TypeError("Authorised read-only character and reviewed rule manifests required");
 const build=snapshot.sources.approved_build;
 const character=build.character;
 const klass=build.class;
 const level=Number(build.level);
 if(!isObject(character)||!Number.isInteger(level)||level<1||level>20||
    klass!==character.className||Number(character.level)!==level)
   return Object.freeze({readOnly:true,validBuild:false,pools:[],missing:0,
     saved:0,unsupported:0,notice:"Class or level needs DM review before resource reconciliation."});
 const savedMap=snapshot.resource_sources.native_v220_usage;
 if(savedMap!==null&&!isObject(savedMap))throw new TypeError("Invalid original saved usage source");
 const saved=isObject(savedMap)?savedMap:{};
 const pools=[];
 const schedule=Object.hasOwn(spell.class_schedules,klass)?spell.class_schedules[klass]:null;
 if(schedule&&!schedule.derived&&!schedule.requires_subclass){
  const current=schedule.levels?.[level-1];
  if(schedule.kind==="pact"&&isObject(current)&&Number.isInteger(current.count)&&current.count>0)
    pools.push({id:"pact-slot-"+current.level,label:"Pact Magic · level "+current.level,max:current.count,source:schedule.source});
  else if(schedule.kind==="standard"&&Array.isArray(current))
    for(let tier=0;tier<current.length;tier++){
     if(Number.isInteger(current[tier])&&current[tier]>0)
      pools.push({id:"spell-slot-"+(tier+1),label:"Spell slots · level "+(tier+1),max:current[tier],source:schedule.source});
    }
 }
 const fixedClass=Object.hasOwn(fixed.classes,klass)?fixed.classes[klass]:null;
 if(fixedClass){
  const cap=fixedClass.max_by_level?.[level];
  if(Number.isInteger(cap)&&cap>0)
   pools.push({id:fixedClass.resource_id,label:klass==="Shaman"?"Spirit Favour":"Blood Reserve",max:cap,source:fixedClass.source});
 }
 const out=pools.map(pool=>{
  const hasSaved=Object.hasOwn(saved,pool.id);
  const value=hasSaved?saved[pool.id]:null;
  const valid=hasSaved&&Number.isInteger(value)&&value>=0&&value<=pool.max;
  const status=!hasSaved?"requires-dm-confirmation":valid?"saved":"invalid-saved-count";
  return Object.freeze({...pool,remaining:valid?value:null,status});
 });
 const ids=new Set(out.map(p=>p.id));
 const unsupported=Object.keys(saved).filter(k=>!ids.has(k)).length;
 return Object.freeze({readOnly:true,validBuild:true,className:klass,level,
  pools:Object.freeze(out),missing:out.filter(p=>p.status==="requires-dm-confirmation").length,
  saved:out.filter(p=>p.status==="saved").length,
  invalid:out.filter(p=>p.status==="invalid-saved-count").length,
  unsupported,
  notice:out.length?"Missing values require a DM-confirmed current count, never a default refill.":
   "No reviewed automatic resource pools for this class/level. Custom or subclass resources require separate DM approval."});
}
