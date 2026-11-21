/**
 * V2.87 migration — read-only, source-preserving Neon sheet snapshot.
 *
 * This is NOT a replacement sheet UI, nor a writable client. It combines two
 * independently owner/DM-authorised staging RPC responses without guessing
 * class mechanics, spell slots, currencies, divine charges or item properties.
 * The native V2.87 renderer can consume an explicit source contract later.
 */
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function validId(v){return typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
function freezeTree(obj){
 if(obj&&typeof obj==="object"&&!Object.isFrozen(obj)){
   for(const value of Object.values(obj))freezeTree(value);
   Object.freeze(obj);
 }
 return obj;
}
function requireArray(value,label,max){
 if(!Array.isArray(value)||value.length>max)throw new TypeError("Invalid read-only sheet source: "+label);
 return value;
}
function copied(value){
 // All values come from JSON REST responses, never from a browser state object.
 // A separate graph prevents mutations to the original RPC result or renderer.
 return JSON.parse(JSON.stringify(value));
}
export function makeV287NeonReadOnlySnapshot(core,linked,expectedId){
 const c=core?.character,st=core?.state;
 if(!validId(expectedId)||core?.read_only!==true||linked?.read_only!==true||
    !isRecord(c)||c.id!==expectedId||linked?.character_id!==expectedId||
    !["owned","dm"].includes(c.access)||linked?.access!==c.access||
    !isRecord(c.approved_build)||!isRecord(c.approved_build.character)||
    !isRecord(st)||!Array.isArray(st.resources)||!Array.isArray(st.inventory)||
    !Array.isArray(st.conditions)||!isRecord(st.death_saves)||
    !isRecord(linked.proficiencies)||!isRecord(linked.training)){
   throw new TypeError("Original V2.87 sheet sources are missing or access does not match");
 }
 const wallet=requireArray(core.wallet,"wallet",500);
 const props=requireArray(core.item_properties,"item properties",200);
 const custom=requireArray(linked.custom_feats,"custom feat grants",100);
 const legacy=requireArray(linked.granted_boons,"granted legacy boons",100);
 const awards=requireArray(linked.canonical_awards,"canonical awards",100);
 const effects=requireArray(linked.divine_effects,"divine effects",100);
 const build=c.approved_build;
 const approved=build.character;
 const basePrefs=isRecord(approved.sheetV220)?approved.sheetV220:{};
 const snapshot={
   schema:"terravale.neon.v287.sheet.readonly.v1",
   read_only:true,
   id:expectedId,
   access:c.access,
   character:{id:expectedId,name:c.name,status:c.status,campaign:c.campaign},
   sources:{
     approved_build:build,
     character_state:st,
     wallet,
     item_properties:props,
     proficiencies:linked.proficiencies,
     training:linked.training,
     custom_feats:custom,
     granted_boons:legacy,
     canonical_awards:awards,
     divine_effects:effects
   },
   resource_sources:{
     saved_class_resources:st.resources,
     saved_spell_list:Array.isArray(approved.spells)?approved.spells:null,
     saved_sheet_resource_settings:isRecord(basePrefs.resources)?basePrefs.resources:null,
     item_charge_properties:props.filter(entry=>isRecord(entry?.properties)&&
       (Object.hasOwn(entry.properties,"charges")||Object.hasOwn(entry.properties,"max_charges"))),
     granted_divine_charge_records:[
       ...legacy.map(x=>({source:"legacy_granted_boon",id:x.id,name:x.name,
         current:x.charges_remaining??null,max:x.max_charges??null,recovery:x.recovery??null})),
       ...awards.map(x=>({source:"canonical_granted_award",id:x.id,name:x.name,
         current:x.uses_remaining??null,max:x.max_uses??null,recovery:x.recovery??null}))
     ]
   },
   counts:{
     inventory:st.inventory.length,
     saved_class_resources:st.resources.length,
     wallet_denominations:wallet.length,
     item_properties:props.length,
     item_charge_properties:props.filter(entry=>isRecord(entry?.properties)&&
       (Object.hasOwn(entry.properties,"charges")||Object.hasOwn(entry.properties,"max_charges"))).length,
     custom_feats:custom.length,
     granted_boons:legacy.length,
     canonical_awards:awards.length,
     divine_effects:effects.length
   }
 };
 // Do not emit a 'native UI ready' flag. Live V2.87 render parity has NOT
 // been verified by the staging sheet, and some sources can be legitimately empty.
 return freezeTree(copied(snapshot));
}
