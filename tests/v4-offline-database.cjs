/* Tests real V2 database call patterns against the offline compatibility layer.
   No network, fake logins or external dependencies. Run with node. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.resolve(__dirname,'../v4/offline-database.js'),'utf8');
const entries=new Map();
const listeners={};
const localStorage={getItem:k=>entries.has(k)?entries.get(k):null,
  setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};
const document={readyState:'loading',addEventListener:(event,handler)=>listeners[event]=handler};
const window={dispatchEvent:()=>{},addEventListener:()=>{}};
const context=vm.createContext({window,document,localStorage,console,Date,Math,Promise,
  setTimeout,CustomEvent:class CustomEvent{constructor(event,init){this.type=event;this.detail=init?.detail}}});
vm.runInContext(script,context,{filename:'offline-database.js',timeout:5000});
const wait=async()=>{for(let i=0;i<90;i++)await Promise.resolve()};
(async()=>{
  await wait();
  const api=window.TerravaleOfflineDatabase;
  assert(api,'Local database must boot with no web service');
  assert.equal(api.localOnly,true);
  const initial=api.identity().id;
  const made=await api.from('campaigns').insert({name:'Frostvale'}).select().single();
  assert.equal(made.error,null);const campaign=made.data.id;
  assert.equal((await api.from('campaigns').select()).data.length,1);
  assert((await api.rpc('terravale_create_character',{target_campaign:campaign,
    sheet:{name:'Hollow Wanderer',className:'Fighter',ancestry:'Elf'}})).error,
    'Character creation MUST be blocked until both categories enabled');
  await api.addContent(campaign,'class','Fighter');
  assert((await api.rpc('terravale_create_character',{target_campaign:campaign,
    sheet:{name:'Hollow Wanderer',className:'Fighter',ancestry:'Elf'}})).error);
  await api.addContent(campaign,'ancestry','Elf');
  assert((await api.rpc('terravale_create_character',{target_campaign:campaign,
    sheet:{name:'Hollow Wanderer',className:'Wizard',ancestry:'Elf'}})).error,
    'Unapproved class must not save');
  const madeCharacter=await api.rpc('terravale_create_character',{target_campaign:campaign,
    sheet:{name:'Hollow Wanderer',className:'Fighter',ancestry:'Elf',hp:14}});
  assert.equal(madeCharacter.error,null);
  const id=madeCharacter.data.id;
  const characters=await api.from('characters')
    .select('id,name,character_state(hp,blood_state,inventory)')
    .order('created_at',{ascending:true}).limit(300);
  assert.equal(characters.data.length,1);
  assert.equal(characters.data[0].character_state.hp,14);
  assert.equal(characters.data[0].status,'pending');
  assert.equal((await api.rpc('terravale_dm_approve_initial_character',{target_character:id})).data.approved,true);
  assert.equal((await api.rpc('terravale_save_character_sheet',{target_character:id,
    sheet:{name:'Hollow Wanderer',className:'Fighter',ancestry:'Elf',hp:12}})).error,null);
  assert.equal((await api.from('characters').select()).data[0].character_state.hp,12);
  const request=await api.rpc('terravale_request_character_level_up',{target_character:id});
  assert(request.data.pending);
  const decision=await api.rpc('terravale_dm_decide_character_level_up',
    {target_request:request.data.id,approve_level:true});
  assert.equal(decision.data.status,'approved');
  assert.equal((await api.from('characters').select()).data[0].approved_build.level,2);
  const invitation=await api.rpc('create_campaign_join_code',{target_campaign:campaign});
  assert.match(invitation.data,/^TV-[A-Z0-9]{6}$/);
  const player=await api.createProfile('Player',false);
  await api.adopt(player.id);
  assert.equal((await api.from('campaigns').select()).data.length,0,'No foreign campaign visibility');
  assert.equal((await api.rpc('join_campaign_by_code',{given_code:invitation.data})).data,campaign);
  assert.equal((await api.from('campaigns').select()).data.length,1);
  assert.equal((await api.from('characters').select()).data.length,0,'Private sheets remain invisible to players');
  assert((await api.rpc('terravale_dm_approve_initial_character',{target_character:id})).error,
    'A player must not approve a character');
  const forbidden=await api.rpc('terravale_wallet_self_adjust',{target_character:id,amount:1});
  assert(forbidden.error,'Unsupported RPC must explicitly fail, not silently succeed');
  await api.adopt(initial);
  const coDM=await api.createProfile('Second DM',false);
  await api.addDm(campaign,coDM.id);
  await api.adopt(coDM.id);
  assert.equal(api.identity().is_dm,true);
  assert.equal((await api.from('campaigns').select()).data[0].owner_id,coDM.id,
    'Live V2 must display DM Chronicle for co-DM membership');
  assert.equal((await api.from('characters').select()).data.length,1);
  const backup=await api.exportData();
  assert.equal(backup.format,'living-codex-offline-database');
  assert(backup.tables.campaign_members.length>=3);
  await api.importData(backup);
  assert.equal((await api.from('campaigns').select()).data.length,1,'Backup import should restore local campaign');
  console.log('PASS: genuine V2 query shapes, empty campaign gate, saves, approvals, local multi-user, co-DM, backup and unsupported RPC safety');
})().catch(error=>{console.error(error);process.exitCode=1});