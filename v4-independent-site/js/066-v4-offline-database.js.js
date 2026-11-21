
/* Living Codex V4 - IndexedDB-backed local Supabase compatibility adapter.
 * It reuses actual live V2.87 screens; this file does not draw replacement sheets.
 * This is a local collaboration SIMULATOR, not server authentication or security.
 * Unsupported database operations fail explicitly instead of fake success.
 */
(function(){
'use strict';
if(window.TerravaleOfflineDatabase)return;
const VERSION=1, DB_NAME='living-codex-v4-local', FALLBACK='living-codex-v4.records.v1',
 ACTIVE_KEY='living-codex-v4.active-profile', ROOT_ID='00000000-0000-4000-8000-000000000001';
const TABLES=new Set(['profiles','campaigns','campaign_members','campaign_join_codes','parties',
 'party_members','campaign_content','content','characters','character_state','character_item_properties',
 'approval_requests','terravale_dm_vault_items','terravale_character_wallet','terravale_wallet_ledger',
 'terravale_dm_custom_feats','terravale_character_custom_feats','terravale_character_proficiencies',
 'terravale_character_training_overrides','terravale_proficiency_bonus_choices',
 'terravale_item_transfer_notifications','codex_ad_achievements','codex_achievement_unlocks',
 'session_events','room_state','journal','saved_references','divine_favour','divine_boons','settings']);
const now=()=>new Date().toISOString();
const uuid=()=>globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const fail=m=>({data:null,error:{message:'Offline database: '+m}});
const ok=data=>({data:clone(data),error:null});
const safeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let native=null, memory=null, active=null, current=null, booted=false;
const state={user:null,profile:null,ready:false};
const opened=new Promise(resolve=>{
  if(!('indexedDB' in window)){resolve(null);return}
  try{
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('rows')){
        const rows=db.createObjectStore('rows',{keyPath:'key'});
        rows.createIndex('table','table',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
    request.onblocked=()=>resolve(null);
  }catch(e){resolve(null)}
});
async function storage(){
  if(native||memory)return;
  native=await opened;
  if(native)return;
  try{memory=JSON.parse(localStorage.getItem(FALLBACK)||'{}')}catch{memory={}}
}
async function list(table){
  await storage();
  if(!TABLES.has(table))throw Error('Unrecognised table '+table);
  if(memory)return clone(memory[table]||[]);
  return new Promise((resolve,reject)=>{
    const transaction=native.transaction('rows','readonly');
    const request=transaction.objectStore('rows').index('table').getAll(table);
    request.onsuccess=()=>resolve(request.result.map(x=>x.value));
    request.onerror=()=>reject(request.error);
  });
}
async function get(table,id){
  await storage();
  if(!TABLES.has(table))throw Error('Unrecognised table '+table);
  if(memory)return clone((memory[table]||[]).find(x=>String(x.id)===String(id)));
  return new Promise((resolve,reject)=>{
    const request=native.transaction('rows','readonly').objectStore('rows').get(table+'|'+id);
    request.onsuccess=()=>resolve(request.result?.value);
    request.onerror=()=>reject(request.error);
  });
}
async function save(table,record){
  await storage();
  if(!TABLES.has(table))throw Error('Unrecognised table '+table);
  const item=clone(record);
  if(!item.id)item.id=uuid();
  if(!item.created_at)item.created_at=now();
  item.updated_at=now();
  if(memory){
    const rows=memory[table]||(memory[table]=[]),i=rows.findIndex(x=>x.id===item.id);
    if(i<0)rows.push(item);else rows[i]=item;
    localStorage.setItem(FALLBACK,JSON.stringify(memory));
    return clone(item);
  }
  return new Promise((resolve,reject)=>{
    const transaction=native.transaction('rows','readwrite');
    transaction.objectStore('rows').put({key:table+'|'+item.id,table,id:item.id,value:item});
    transaction.oncomplete=()=>resolve(item);
    transaction.onerror=()=>reject(transaction.error);
  });
}
async function remove(table,id){
  await storage();
  if(!TABLES.has(table))throw Error('Unrecognised table '+table);
  if(memory){
    memory[table]=(memory[table]||[]).filter(x=>String(x.id)!==String(id));
    localStorage.setItem(FALLBACK,JSON.stringify(memory));return;
  }
  return new Promise((resolve,reject)=>{
    const t=native.transaction('rows','readwrite');
    t.objectStore('rows').delete(table+'|'+id);
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);
  });
}
async function allProfiles(){return list('profiles')}
async function members(campaignId){return (await list('campaign_members')).filter(m=>m.campaign_id===campaignId)}
async function membership(campaignId,userId=current?.id){
  return (await members(campaignId)).find(m=>m.profile_id===userId);
}
async function assertMember(campaignId){
  if(!await membership(campaignId))throw Error('Campaign membership required');
}
async function assertDm(campaignId){
  if((await membership(campaignId))?.role!=='dm')throw Error('Campaign DM permissions required');
}
async function accessibleCampaignIds(){
  return new Set((await list('campaign_members')).filter(m=>m.profile_id===current?.id).map(m=>m.campaign_id));
}
async function visibleRows(table){
  const records=await list(table),accessible=await accessibleCampaignIds();
  if(table==='campaigns')return records.filter(x=>accessible.has(x.id));
  if(table==='characters')return records.filter(x=>accessible.has(x.campaign_id));
  if(table==='profiles')return records;
  if(table==='campaign_members')return records.filter(x=>accessible.has(x.campaign_id));
  if(table==='campaign_join_codes')return records.filter(x=>accessible.has(x.campaign_id));
  if(table==='parties')return records.filter(x=>accessible.has(x.campaign_id));
  if(table==='content')return records;
  if(table==='campaign_content')return records.filter(x=>accessible.has(x.campaign_id));
  const characterTables=new Set(['character_state','character_item_properties','approval_requests',
    'terravale_character_wallet','terravale_wallet_ledger','terravale_character_proficiencies',
    'terravale_character_training_overrides','terravale_proficiency_bonus_choices',
    'terravale_character_custom_feats','terravale_item_transfer_notifications']);
  if(characterTables.has(table)){
    const ids=new Set((await list('characters')).filter(x=>accessible.has(x.campaign_id))
      .map(x=>x.id));return records.filter(x=>ids.has(x.character_id));
  }
  return records.filter(x=>!x.campaign_id||accessible.has(x.campaign_id));
}
// The live V2 browser bridge derives DM status from campaign.owner_id. Only
// the VIEW returned to this specific local account aliases that field.
// Underlying database owner_id always remains the original author.
async function present(table,rows){
  if(table==='campaigns'){
    const grants=await list('campaign_members');
    return rows.map(x=>({...x,owner_id:grants.some(g=>
      g.campaign_id===x.id&&g.profile_id===current?.id&&g.role==='dm')
      ?current.id:x.owner_id}));
  }
  if(table==='characters'){
    const grants=await list('campaign_members');
    const visible=rows.filter(x=>x.owner_id===current?.id||x.sheet_visible_to_party||
      grants.some(g=>g.campaign_id===x.campaign_id&&g.profile_id===current?.id&&g.role==='dm'));
    const states=await list('character_state'),props=await list('character_item_properties');
    return visible.map(x=>({...x,character_state:states.find(s=>s.character_id===x.id)||null,
      character_item_properties:props.filter(p=>p.character_id===x.id)}));
  }
  return rows;
}
class Query{
  constructor(table){this.table=table;this.filters=[];this.sort=null;this.cap=null;
    this.offset=0;this.take=null;this.operation='select';this.payload=null;this.mode='many';}
  select(){return this}
  eq(key,val){this.filters.push(x=>String(x[key]??'')===String(val??''));return this}
  neq(key,val){this.filters.push(x=>String(x[key])!==String(val));return this}
  in(key,values){const set=new Set((values||[]).map(String));this.filters.push(x=>set.has(String(x[key])));return this}
  is(key,val){this.filters.push(x=>val===null?x[key]==null:x[key]===val);return this}
  order(key,opt={}){this.sort={key,asc:opt.ascending!==false};return this}
  limit(n){this.cap=Math.max(0,Number(n)||0);return this}
  range(a,b){this.offset=Math.max(0,a||0);this.take=Math.max(0,b-a+1);return this}
  maybeSingle(){this.mode='maybe';return this}
  single(){this.mode='single';return this}
  insert(data){this.operation='insert';this.payload=data;return this}
  update(data){this.operation='update';this.payload=data;return this}
  upsert(data){this.operation='upsert';this.payload=data;return this}
  delete(){this.operation='delete';return this}
  then(resolve,reject){return this.execute().then(resolve,reject)}
  async execute(){
    try{
      if(!TABLES.has(this.table))return fail('Table '+this.table+' has not been ported');
      let rows=await visibleRows(this.table);
      rows=await present(this.table,rows);
      rows=rows.filter(x=>this.filters.every(test=>test(x)));
      if(this.operation==='select'){
        if(this.sort)rows.sort((a,b)=>{
          const cmp=String(a[this.sort.key]??'').localeCompare(String(b[this.sort.key]??''));
          return this.sort.asc?cmp:-cmp;
        });
        if(this.offset)rows=rows.slice(this.offset);
        if(this.take!==null)rows=rows.slice(0,this.take);
        if(this.cap!==null)rows=rows.slice(0,this.cap);
        if(this.mode==='single'&&!rows.length)return fail('Expected one row; none found');
        if(this.mode==='single'&&rows.length!==1)return fail('Expected one row; found '+rows.length);
        return ok(this.mode==='many'?rows:rows[0]||null);
      }
      let changed=[];
      if(this.operation==='insert'||this.operation==='upsert'){
        for(const values of Array.isArray(this.payload)?this.payload:[this.payload]){
          const row={...values,id:values.id||uuid()};
          if(this.table==='campaigns'){
            if(!current?.is_dm)throw Error('DM profile required to create a campaign');
            row.owner_id=current.id;
            row.description=row.description||'';
            row.long_description=row.long_description||'';
            row.theme=row.theme||'';row.genre=row.genre||'';
            changed.push(await save(this.table,row));
            await save('campaign_members',{id:uuid(),campaign_id:row.id,
              profile_id:current.id,role:'dm'});
            continue;
          }
          if(row.campaign_id)await assertDm(row.campaign_id);
          changed.push(await save(this.table,row));
        }
      }else{
        for(const existing of rows){
          const real=await get(this.table,existing.id);if(!real)continue;
          if(this.table==='campaigns'||real.campaign_id)await assertDm(
            this.table==='campaigns'?real.id:real.campaign_id);
          if(this.operation==='delete'){await remove(this.table,real.id);changed.push(real)}
          else changed.push(await save(this.table,{...real,...this.payload,
            ...(this.table==='campaigns'?{owner_id:real.owner_id}:{})}));
        }
      }
      return ok(this.mode==='many'?changed:this.mode==='single'?changed[0]||null:changed[0]||null);
    }catch(e){return fail(e.message||String(e))}
  }
}
function errorRPC(name){return fail('Method '+name+' needs an offline implementation; no change was saved')}
async function rpc(name,args={}){
  try{
    const uid=current?.id;
    switch(name){
      case 'terravale_sync_discord_profile':return ok({...current,discord_uid:current.discord_uid});
      case 'terravale_demo_campaign_id':return ok(null);
      case 'terravale_demo_curator_labels':return ok([]);
      case 'terravale_character_owner_labels':{
        const people=await allProfiles(),chars=await visibleRows('characters');
        return ok(chars.map(c=>({character_id:c.id,
          discord_username:people.find(p=>p.id===c.owner_id)?.discord_username||'Adventurer',
          tvuid:people.find(p=>p.id===c.owner_id)?.tvuid||''})));
      }
      case 'terravale_create_character':{
        const campaignId=args.target_campaign,c=args.sheet||{};
        await assertMember(campaignId);
        const allowed=(await list('campaign_content')).filter(x=>
          x.campaign_id===campaignId&&x.enabled!==false);
        const classes=allowed.filter(x=>x.type==='class').map(x=>x.name.toLowerCase());
        const ancestry=allowed.filter(x=>x.type==='ancestry').map(x=>x.name.toLowerCase());
        if(!classes.length||!ancestry.length)
          throw Error('The DM must add at least one class and one ancestry before characters can be created.');
        if(!classes.includes(String(c.className||c.class||'').trim().toLowerCase())||
           !ancestry.includes(String(c.ancestry||'').trim().toLowerCase()))
          throw Error('This class or ancestry has not been enabled in the current campaign.');
        if(!String(c.name||'').trim())throw Error('Character name required');
        const id=uuid();
        await save('characters',{id,name:String(c.name).trim(),owner_id:uid,
          campaign_id:campaignId,status:'pending',sheet_visible_to_party:false,
          approved_build:{character:{...c,id},level:1,class:c.className||c.class,ancestry:c.ancestry}});
        await save('character_state',{id:uuid(),character_id:id,hp:c.hp??0,
          blood_state:c.bloodState??0,inventory:c.inventory||[]});
        return ok({id,status:'pending',is_demo:false});
      }
      case 'terravale_save_character_sheet':{
        const row=await get('characters',args.target_character);
        if(!row)throw Error('Character not found');
        if(row.owner_id!==uid&&(await membership(row.campaign_id))?.role!=='dm')
          throw Error('Character owner or campaign DM required');
        const sheet=args.sheet||{};
        row.name=sheet.name||row.name;
        row.approved_build={...row.approved_build,character:{...row.approved_build?.character,...sheet},
          level:Number(sheet.level||row.approved_build?.level||1)};
        await save('characters',row);
        const stateRows=await list('character_state');
        const st=stateRows.find(x=>x.character_id===row.id);
        if(st)await save('character_state',{...st,hp:sheet.hp??st.hp,
          blood_state:sheet.bloodState??st.blood_state,inventory:sheet.inventory??st.inventory});
        return ok({saved:true});
      }
      case 'terravale_dm_approve_initial_character':{
        const c=await get('characters',args.target_character);
        if(!c)throw Error('Character not found');await assertDm(c.campaign_id);
        const was=c.status==='approved';c.status='approved';await save('characters',c);
        return ok({approved:true,already_approved:was});
      }
      case 'terravale_request_character_level_up':{
        const c=await get('characters',args.target_character);
        if(!c||c.owner_id!==uid)throw Error('Character ownership required');
        if(c.status!=='approved')throw Error('Approve initial character first');
        const requests=(await list('approval_requests')).filter(x=>x.character_id===c.id&&
          x.status==='pending'&&x.proposed_changes?.kind==='level_up');
        if(requests.length)return ok({pending:true,id:requests[0].id});
        const from=Number(c.approved_build?.level||1);
        if(from>=20)throw Error('Already level 20');
        const r=await save('approval_requests',{id:uuid(),campaign_id:c.campaign_id,
          character_id:c.id,status:'pending',proposed_changes:{kind:'level_up',
          from_level:from,to_level:from+1}});
        return ok({pending:true,id:r.id});
      }
      case 'terravale_dm_decide_character_level_up':{
        const r=await get('approval_requests',args.target_request);
        if(!r)throw Error('Request not found');await assertDm(r.campaign_id);
        if(r.status!=='pending')throw Error('Request already decided');
        const c=await get('characters',r.character_id);
        r.status=args.approve_level?'approved':'rejected';
        if(args.approve_level){
          const lv=Number(r.proposed_changes.to_level);
          c.approved_build.level=lv;
          c.approved_build.character={...c.approved_build.character,level:lv};
          await save('characters',c);
        }
        await save('approval_requests',r);return ok({status:r.status});
      }
      case 'create_campaign_join_code':{
        await assertDm(args.target_campaign);
        const code='TV-'+Math.random().toString(36).slice(2,8).toUpperCase();
        await save('campaign_join_codes',{id:uuid(),campaign_id:args.target_campaign,
          code,expires_at:new Date(Date.now()+Math.max(1,Number(args.days_valid)||7)*86400000).toISOString(),
          allowed_uses:Math.max(1,Number(args.allowed_uses)||100),used:0});
        return ok(code);
      }
      case 'join_campaign_by_code':{
        const code=String(args.given_code||'').trim().toUpperCase();
        const invite=(await list('campaign_join_codes')).find(x=>x.code===code);
        if(!invite||Date.parse(invite.expires_at)<Date.now()||
          invite.used>=invite.allowed_uses)throw Error('Invalid or expired invite code');
        if(!await membership(invite.campaign_id)){
          await save('campaign_members',{id:uuid(),campaign_id:invite.campaign_id,
            profile_id:uid,role:'player'});
          invite.used++;await save('campaign_join_codes',invite);
        }
        return ok(invite.campaign_id);
      }
      case 'terravale_leave_campaign':{
        const m=await membership(args.target_campaign);
        if(!m)throw Error('Not a member of this campaign');
        if(m.role==='dm'&&(await members(args.target_campaign)).filter(x=>x.role==='dm').length===1)
          throw Error('Last DM cannot leave. Assign another DM first.');
        await remove('campaign_members',m.id);return ok({left:true});
      }
      case 'terravale_wallet_adjust':
      case 'terravale_wallet_self_adjust':{
        const c=await get('characters',args.target_character);
        if(!c)throw Error('Character not found');
        if(name==='terravale_wallet_adjust')await assertDm(c.campaign_id);
        else if(c.owner_id!==uid)throw Error('Only the character owner may alter their own wallet');
        const denomination=String(args.target_denomination||'').trim();
        const delta=Number(args.delta_quantity);
        if(!denomination||!Number.isSafeInteger(delta)||Math.abs(delta)>100000)
          throw Error('Invalid denomination or coin quantity');
        const records=await list('terravale_character_wallet');
        const existing=records.find(x=>x.character_id===c.id&&x.denomination_id===denomination);
        const before=Number(existing?.quantity||0),remaining=before+delta;
        if(!Number.isSafeInteger(remaining)||remaining<0)
          throw Error('Not enough currency for this transaction');
        await save('terravale_character_wallet',{...existing,
          id:existing?.id||uuid(),character_id:c.id,denomination_id:denomination,
          quantity:remaining});
        await save('terravale_wallet_ledger',{id:uuid(),campaign_id:c.campaign_id,
          character_id:c.id,denomination_id:denomination,delta,
          note:String(args.purpose||''),operation:name==='terravale_wallet_adjust'?'dm_adjust':'owner_adjust',
          actor_id:uid});
        return ok({denomination_id:denomination,quantity:remaining});
      }
      case 'terravale_vault_save_item':{
        await assertDm(args.target_campaign);
        const existing=args.existing_item
          ?await get('terravale_dm_vault_items',args.existing_item):null;
        if(existing&&existing.campaign_id!==args.target_campaign)
          throw Error('Vault item belongs to another campaign');
        if(args.delete_item){
          if(!existing)throw Error('Vault item not found');
          await remove('terravale_dm_vault_items',existing.id);
          return ok({deleted:true});
        }
        const payload=args.item_payload||{},mechanics=args.mechanics_payload||{};
        if(!String(payload.name||'').trim())throw Error('Item name required');
        const item=await save('terravale_dm_vault_items',{
          id:existing?.id||uuid(),campaign_id:args.target_campaign,
          item_data:{...existing?.item_data,...payload},
          mechanics:{...existing?.mechanics,...mechanics}});
        return ok(item);
      }
      case 'terravale_vault_issue_item':{
        const item=await get('terravale_dm_vault_items',args.vault_item_id);
        const c=await get('characters',args.recipient_character);
        if(!item||!c||item.campaign_id!==c.campaign_id)throw Error('Vault and recipient mismatch');
        await assertDm(item.campaign_id);
        const amount=Number(args.send_quantity||1),stock=Number(item.item_data?.qty||1);
        if(!Number.isSafeInteger(amount)||amount<=0||amount>stock)throw Error('Not enough item stock');
        const row=(await list('character_state')).find(x=>x.character_id===c.id);
        const inv=Array.isArray(row?.inventory)?row.inventory.slice():[];
        const newItem={...item.item_data,id:uuid(),qty:amount};
        inv.push(newItem);
        await save('character_state',{...(row||{}),id:row?.id||uuid(),character_id:c.id,
          inventory:inv,hp:row?.hp??0,blood_state:row?.blood_state??0});
        await save('character_item_properties',{id:uuid(),character_id:c.id,
          item_id:newItem.id,properties:item.mechanics||{}});
        item.item_data.qty=stock-amount;
        if(item.item_data.qty===0)await remove('terravale_dm_vault_items',item.id);
        else await save('terravale_dm_vault_items',item);
        return ok({issued:true,inventory:inv});
      }
      case 'terravale_dm_edit_inventory_item':{
        const c=await get('characters',args.target_character);
        if(!c)throw Error('Character not found');
        await assertDm(c.campaign_id);
        const state=(await list('character_state')).find(x=>x.character_id===c.id);
        const inv=Array.isArray(state?.inventory)?state.inventory.slice():[];
        const index=inv.findIndex(x=>x.id===args.item_id);
        let id=args.item_id||uuid();
        if(args.delete_item){
          if(index<0)throw Error('Inventory item not found');
          inv.splice(index,1);
        }else{
          const payload=args.item_payload||{};
          if(!String(payload.name||'').trim())throw Error('Item name required');
          if(index>=0)inv[index]={...inv[index],...payload,id};
          else{inv.push({...payload,id});}
        }
        await save('character_state',{...state,id:state?.id||uuid(),
          character_id:c.id,inventory:inv,hp:state?.hp??0,
          blood_state:state?.blood_state??0});
        const records=(await list('character_item_properties')).filter(x=>x.character_id===c.id);
        const matching=records.find(x=>x.item_id===id);
        if(args.delete_item){if(matching)await remove('character_item_properties',matching.id)}
        else await save('character_item_properties',{...matching,id:matching?.id||uuid(),
          character_id:c.id,item_id:id,properties:args.mechanics||{}});
        const properties=Object.fromEntries(
          (await list('character_item_properties')).filter(x=>x.character_id===c.id)
            .map(x=>[x.item_id,x.properties]));
        return ok({inventory:inv,item_properties:properties});
      }
      case 'terravale_dm_save_custom_feat':{
        await assertDm(args.target_campaign);
        const old=args.existing_feat
          ?await get('terravale_dm_custom_feats',args.existing_feat):null;
        if(old&&old.campaign_id!==args.target_campaign)throw Error('Feat belongs to another campaign');
        if(args.delete_feat){
          if(!old)throw Error('Feat not found');
          await save('terravale_dm_custom_feats',{...old,state:'archived'});
          return ok({archived:true});
        }
        const spec=args.feat_spec||{};
        if(!String(spec.name||'').trim())throw Error('Feat name required');
        return ok(await save('terravale_dm_custom_feats',{...old,...spec,
          id:old?.id||uuid(),campaign_id:args.target_campaign}));
      }
      case 'terravale_dm_assign_custom_feat':{
        const feat=await get('terravale_dm_custom_feats',args.target_feat);
        const c=await get('characters',args.target_character);
        if(!feat||!c||feat.campaign_id!==c.campaign_id)throw Error('Feat/character mismatch');
        await assertDm(c.campaign_id);
        if(args.grant_feat&&feat.state==='archived')throw Error('Archived feats cannot be newly granted');
        const records=await list('terravale_character_custom_feats');
        const old=records.find(x=>x.feat_id===feat.id&&x.character_id===c.id);
        return ok(await save('terravale_character_custom_feats',{...old,
          id:old?.id||uuid(),feat_id:feat.id,character_id:c.id,
          campaign_id:c.campaign_id,status:args.grant_feat?'active':'revoked',
          granted_at:old?.granted_at||now(),reason:String(args.reason||'')}));
      }
      case 'terravale_set_personal_adblocker':return ok({count:25,enabled:!!args.desired_enabled});
      case 'terravale_unlock_verdant_growth':return ok({unlocked:false,new:false});
      default:return errorRPC(name);
    }
  }catch(e){return fail(e.message||String(e))}
}
const supabase={
  from(table){return new Query(table)},
  rpc,
  auth:{
    async getUser(){return {data:{user:state.user},error:null}},
    async getSession(){return {data:{session:{user:state.user}},error:null}},
    async signOut(){return fail('Use Offline DB to switch local profiles')}
  },
  storage:{from(){return{getPublicUrl(){return{data:{publicUrl:''}}},upload:async()=>fail('Offline media storage not yet available')}}},
  channel(){return{on(){return this},subscribe(){return this},unsubscribe(){return Promise.resolve()}}},
  removeChannel(){return Promise.resolve()}
};
async function adopt(profileId){
  const p=await get('profiles',profileId);
  if(!p)throw Error('Unknown local profile');
  active=p.id;current=p;
  try{localStorage.setItem(ACTIVE_KEY,p.id)}catch{}
  state.user={id:p.id,user_metadata:{full_name:p.discord_username}};
  state.profile={...p,is_dm:!!p.is_dm};
  state.ready=true;
}
async function createProfile(name,dm=false){
  if(!String(name).trim())throw Error('Profile name required');
  const n=(await allProfiles()).length;
  return save('profiles',{id:uuid(),discord_username:String(name).trim(),
    is_dm:!!dm,discord_uid:'local-'+uuid(),tvuid:String(n).padStart(3,'0'),
    local_only:true});
}
async function seed(){
  const profiles=await allProfiles();
  if(!profiles.length)await save('profiles',{id:ROOT_ID,
    discord_username:'Offline DM',discord_uid:'local-'+ROOT_ID,
    tvuid:'000',is_dm:true,local_only:true});
  let which=null;try{which=localStorage.getItem(ACTIVE_KEY)}catch{}
  await adopt(which&&await get('profiles',which)?which:(await allProfiles())[0].id);
}
async function exportData(){
  const tables={};
  for(const t of TABLES)tables[t]=await list(t);
  return {format:'living-codex-offline-database',version:VERSION,
    exported_at:now(),tables};
}
async function importData(backup){
  if(backup?.format!=='living-codex-offline-database'||backup.version!==VERSION)
    throw Error('Unsupported database backup version');
  for(const t of TABLES)if(!Array.isArray(backup.tables?.[t]))
    throw Error('Missing table '+t+'; import was not started');
  // Validation before changes; replace all tables rather than merging account data.
  for(const [t,rows] of Object.entries(backup.tables))
    for(const r of rows)if(!r||typeof r.id!=='string')
      throw Error('Invalid row id in '+t);
  await storage();
  if(native){
    await new Promise((resolve,reject)=>{
      const tx=native.transaction('rows','readwrite');const store=tx.objectStore('rows');
      store.clear();
      for(const [table,rows] of Object.entries(backup.tables))
        for(const value of rows)store.put({key:table+'|'+value.id,table,id:value.id,value});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }else{
    memory=clone(backup.tables);
    localStorage.setItem(FALLBACK,JSON.stringify(memory));
  }
  try{localStorage.removeItem(ACTIVE_KEY)}catch{}
  await seed();
}
async function addContent(campaignId,type,name){
  await assertDm(campaignId);
  if(!['class','ancestry','lore','item','feat','rule','spell'].includes(type))
    throw Error('Unsupported content category');
  if(!String(name).trim())throw Error('Enter an entry name');
  const rows=await list('campaign_content');
  const old=rows.find(x=>x.campaign_id===campaignId&&x.type===type&&
    x.name.toLowerCase()===name.trim().toLowerCase());
  if(old)return old;
  return save('campaign_content',{id:uuid(),campaign_id:campaignId,
    type,name:name.trim(),enabled:true});
}
async function addParty(campaignId,name){
  await assertDm(campaignId);
  return save('parties',{id:uuid(),campaign_id:campaignId,name:String(name||'Party').trim()});
}
async function addDm(campaignId,profileId){
  await assertDm(campaignId);
  if(!await get('profiles',profileId))throw Error('Local profile not found');
  const m=await membership(campaignId,profileId);
  if(m)await save('campaign_members',{...m,role:'dm'});
  else await save('campaign_members',{id:uuid(),campaign_id:campaignId,
    profile_id:profileId,role:'dm'});
  // The live V2 interface exposes the DM perspective using a profile flag;
  // membership retains the actual per-campaign permissions.
  const coDm=await get('profiles',profileId);
  await save('profiles',{...coDm,is_dm:true});
}
function dom(tag,cls,txt){
  const e=document.createElement(tag);if(cls)e.className=cls;
  if(txt!==undefined)e.textContent=String(txt);
  return e;
}
function makeButton(label,handler){
  const b=dom('button','btn ghost small',label);b.type='button';
  b.addEventListener('click',handler);return b;
}
function themeControl(){
  const top=document.querySelector('.topbar-right,.topbar');
  if(!top||top.querySelector('#tv-v4-db-button'))return;
  const b=makeButton('Offline DB',openManager);
  b.id='tv-v4-db-button';b.title='Local profiles and database backup';
  top.append(b);
}
function field(label){
  const l=dom('label','tv254-label'),span=dom('span','',label),i=dom('input','tv254-input');
  l.append(span,i);return{wrap:l,input:i};
}
function notify(node,message,isError=false){
  node.textContent=message;node.style.color=isError?'#ed9da5':'';
}
async function openManager(){
  const existing=document.getElementById('tv-v4-db-dialog');if(existing)existing.remove();
  const dialog=dom('div','tv-v4-db-dialog');dialog.id='tv-v4-db-dialog';
  dialog.style.cssText='position:fixed;inset:0;background:#090711dd;z-index:999999;display:grid;place-items:center;padding:16px';
  const card=dom('section','v2-card');
  card.style.cssText='width:min(650px,100%);max-height:86vh;overflow:auto;padding:24px;background:var(--surface,#171321);color:var(--ink,#fff);border:1px solid var(--edge,#55446b);border-radius:12px';
  const close=makeButton('Close',()=>dialog.remove());close.style.float='right';
  card.append(close,dom('h2','','Offline database'),dom('p','',
    'Local-only simulator. Profiles are not real sign-ins. Nothing connects to the live database.'));
  const profiles=await allProfiles(),selector=dom('select','tv254-input');
  for(const p of profiles){const op=dom('option','',p.discord_username+(p.is_dm?' · DM':' · Player'));
    op.value=p.id;op.selected=p.id===active;selector.append(op)}
  const switcher=makeButton('Switch local profile',async()=>{
    await adopt(selector.value);location.reload()
  });
  card.append(dom('h3','','Profile'),selector,switcher);
  const newName=field('New profile name'),dmLabel=dom('label','');
  const dmToggle=dom('input');dmToggle.type='checkbox';
  dmLabel.append(dmToggle,dom('span','',' DM profile'));
  const create=makeButton('Create local profile',async()=>{
    try{const p=await createProfile(newName.input.value,dmToggle.checked);await adopt(p.id);location.reload()}
    catch(e){notify(status,e.message,true)}
  });
  card.append(newName.wrap,dmLabel,create);
  const currentCamp=(typeof db!=='undefined'&&db.campaign)||'';
  if(currentCamp&&(await membership(currentCamp))?.role==='dm'){
    card.append(dom('h3','','Campaign setup'),dom('p','',
      'Campaigns start empty. Add a class AND ancestry to enable character creation.'));
    const type=dom('select','tv254-input');
    for(const t of ['class','ancestry','lore','item','feat','rule','spell']){
      const op=dom('option','',t);op.value=t;type.append(op)
    }
    const name=field('Content name (use original V2 class/ancestry name)');
    card.append(type,name.wrap,makeButton('Enable for this campaign',async()=>{
      try{await addContent(currentCamp,type.value,name.input.value);
        notify(status,'Added to campaign. Refreshing...');location.reload()}
      catch(e){notify(status,e.message,true)}
    }));
    const dmProfiles=dom('select','tv254-input');
    for(const p of profiles.filter(x=>x.id!==active)){
      const op=dom('option','',p.discord_username);op.value=p.id;dmProfiles.append(op)
    }
    const party=field('New party name');
    card.append(dom('h3','','Collaborators & parties'),dmProfiles,
      makeButton('Give DM access to selected local profile',async()=>{
        try{await addDm(currentCamp,dmProfiles.value);notify(status,'Added a co-DM.')}
        catch(e){notify(status,e.message,true)}
      }),party.wrap,makeButton('Create party',async()=>{
        try{await addParty(currentCamp,party.input.value);notify(status,'Party created.')}
        catch(e){notify(status,e.message,true)}
      }));
  }
  card.append(dom('h3','','Backups'));
  const backup=makeButton('Export complete offline database',async()=>{
    const json=JSON.stringify(await exportData(),null,2);
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const a=dom('a');a.href=url;a.download='living-codex-offline-backup.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)
  });
  const restore=dom('input');restore.type='file';restore.accept='application/json,.json';
  restore.addEventListener('change',async()=>{
    const f=restore.files?.[0];if(!f)return;
    if(!confirm('REPLACE every local profile and campaign from this backup?'))return;
    try{await importData(JSON.parse(await f.text()));location.reload()}
    catch(e){notify(status,'Import failed: '+e.message,true)}
  });
  const status=dom('p','');status.setAttribute('role','status');
  card.append(backup,dom('p','','Import backup (replaces local data):'),restore,status);
  dialog.append(card);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove()});
  document.body.append(dialog);
}
async function paintGate(){
  if(typeof db==='undefined'||!document.getElementById('pageRoot'))return;
  const path=location.hash||'';
  if(!path.includes('/characters/create'))return;
  const host=document.getElementById('pageRoot');
  if(host.querySelector('#tv-v4-campaign-gate'))return;
  const id=db.campaign||'',entries=(await list('campaign_content')).filter(x=>
    x.campaign_id===id&&x.enabled!==false);
  const classes=entries.filter(x=>x.type==='class'),ancestries=entries.filter(x=>x.type==='ancestry');
  const message=!id?'Choose a campaign before creating a character.'
    :(!classes.length||!ancestries.length)
      ?'This campaign does not yet have a class and ancestry. The DM must enable at least one of each in Offline DB.'
      :'Campaign options enabled: '+classes.map(x=>x.name).join(', ')+
        ' · ancestries: '+ancestries.map(x=>x.name).join(', ')+
        '. Only these choices can be saved.';
  const info=dom('section','v2-card',message);info.id='tv-v4-campaign-gate';
  info.style.cssText='padding:12px;margin:12px 0;border:1px solid var(--edge);border-radius:8px';
  host.prepend(info);
}
async function boot(){
  if(booted)return;booted=true;
  try{
    await seed();
    window.TerravaleVerifiedAccount={supabase,state,openProfile:openManager,
      avatarUrl:()=>''};
    window.TerravaleOfflineDatabase={
      version:VERSION,localOnly:true,storageKind:native?'indexeddb':'localStorage-fallback',
      from:t=>supabase.from(t),rpc,all:list,get,put:save,delete:remove,
      exportData,importData,createProfile,adopt,addContent,addParty,addDm,identity:()=>clone(current)
    };
    const role=()=>{const button=document.querySelector('#previewTray [data-role="'+
      (state.profile.is_dm?'dm':'player')+'"]');button?.click()};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',role,{once:true});
    else role();
    window.dispatchEvent(new CustomEvent('terravale-auth-ready',
      {detail:{isDm:state.profile.is_dm,offline:true}}));
    const startUI=()=>{
      let requested=false;
      const refresh=()=>{
        if(requested)return;requested=true;
        requestAnimationFrame(()=>{requested=false;themeControl();paintGate().catch(console.warn)});
      };
      refresh();
      new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true});
      window.addEventListener('hashchange',refresh);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startUI,{once:true});
    else startUI();
  }catch(e){
    console.error('[Living Codex offline database]',e);
    const p=dom('div','', 'Offline database could not start: '+e.message);
    p.style.cssText='position:fixed;bottom:16px;left:16px;padding:16px;background:#411b22;color:white;z-index:999999';
    document.body.append(p);
  }
}
boot();
})();
