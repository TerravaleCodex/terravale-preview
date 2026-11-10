/* Terravale V2.79 — DM-only Archive 2 full-document custody and source index.
   Nothing here publishes a boon, grants an ability, or exposes unrewarded mechanics
   to players. Original paragraphs are verified against their private source. */
(function(){
'use strict';
const A=()=>window.TerravaleVerifiedAccount;
const api=()=>A()?.supabase;
const ready=()=>Boolean(A()?.state?.ready&&A()?.state?.profile?.is_dm&&
 typeof db!=='undefined'&&db.role==='dm');
const node=(tag,cls,text)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);
 return n;
};
function btn(label,fn,cls='btn ghost small'){
 const n=node('button',cls,label);n.type='button';n.addEventListener('click',fn);return n;
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const familyNames={
 divine:'Conventional boons',minor_grace:'Minor Graces',minor_intercession:'Minor Intercessions',
 concordant:'Concordants',tier_zero:'Tier 0 · bargains and caveats',
 nyrha_revision:'Nyrha · Revisions',nyrha_state:'Nyrha · Unwritten State',
 nyrha_offer:'Nyrha · Impossible Offers'
};
let indexCampaign=null;
let sourceSet=null;
let documents=null;
let currentAudit=null;
let importing=false;
const TEXTLIMIT=8000000;
const parser=()=>window.TerravaleArchive2V279;
const reader=()=>window.TerravaleBoonArchiveV273;
async function sourceManifest(campaign){
 const {data,error}=await api().rpc('terravale_divine_dm_source_manifest',{target_campaign:campaign});
 if(error)throw error;
 return data||[];
}
function verifyAudit(audit){
 if(!audit?.complete)throw Error('Archive differs from the verified 49-file Archive 2. No data has been uploaded.');
 if(audit.missingTier5.length!==1||audit.missingTier5[0]!=='Amora')
  throw Error('The original Tier V coverage has changed. Review the source version before importing.');
 const byKind=new Map(audit.docs.map(d=>[d.path,d.category]));
 const expected={major_collection:14,minor_collection:29,concordant_collection:1,nyrha_revisions:1,system:4};
 for(const [kind,num] of Object.entries(expected))
  if(audit.docs.filter(d=>d.category===kind).length!==num)
   throw Error('Unexpected number of '+kind+' files.');
 for(const doc of documents||[]){
  const path=doc.name||'';
  if(!path.startsWith('Boons/')||!byKind.has(path)||path.split('/').some(x=>x==='..'||x==='.'))
   throw Error('Unexpected or unsafe archive path: '+path);
 }
 return true;
}
function sourceKind(doc){
 const item=currentAudit.docs.find(x=>x.path===doc.name);
 return item?.category==='system'?'system':'collection';
}
async function uploadSourceAndIndex(campaign,status,run){
 if(!ready()||!UUID.test(campaign)||indexCampaign!==campaign)throw Error('Verified campaign DM access required.');
 if(importing)return;
 importing=true;
 run.disabled=true;
 try{
  verifyAudit(currentAudit);
  if(!sourceSet)sourceSet=window.crypto?.randomUUID?.();
  if(!sourceSet)throw Error('Secure browser UUID generation unavailable.');
  let bytes=0;
  for(const d of documents){
   bytes+=new TextEncoder().encode(d.text).byteLength;
   if(bytes>TEXTLIMIT)throw Error('Uncompressed source exceeds 8 MB.');
  }
  const selected=sourceSet;
  if(document.visibilityState==='hidden')status.textContent='Preserving original documents; keep the DM window open…';
  for(const [n,doc] of documents.entries()){
   if(indexCampaign!==campaign)throw Error('Campaign changed; import stopped.');
   status.textContent='Preserving original Markdown '+(n+1)+'/'+documents.length+': '+doc.name;
   const {error}=await api().rpc('terravale_divine_dm_source_add',{
    target_campaign:campaign,target_set:selected,source_path:doc.name,
    source_kind:sourceKind(doc),source_markdown:doc.text
   });
   if(error)throw Error('Original source '+doc.name+': '+(error.message||String(error)));
  }
  const manifest=(await sourceManifest(campaign)).filter(d=>d.source_set===selected);
  if(manifest.length!==documents.length)
   throw Error('Private Source Vault checksum manifest incomplete: '+manifest.length+'/'+documents.length);
  const hashes=new Map(manifest.map(d=>[d.path,d.sha256]));
  const entries=currentAudit.entries.map(e=>{
   const source_hash=hashes.get(e.source_path);
   if(!source_hash)throw Error('Missing original source hash for '+e.source_path);
   return {...e,source_hash};
  });
  // Every entry is an exact source excerpt. None is made into a grantable boon.
  for(let i=0;i<entries.length;i+=25){
   if(indexCampaign!==campaign)throw Error('Campaign changed; import stopped.');
   const items=entries.slice(i,i+25);
   status.textContent='Indexing original abilities and rules '+Math.min(i+25,entries.length)+'/'+entries.length+'…';
   const {data,error}=await api().rpc('terravale_divine_dm_index_source_entries',{
    target_campaign:campaign,target_set:selected,entries:items
   });
   if(error)throw Error('Archive section '+(i+1)+': '+(error.message||String(error)));
   if(!data?.accepted)throw Error('Server did not confirm private archive indexing.');
  }
  const {data:checked,error:checkError}=await api().rpc('terravale_divine_dm_archive_list',{
   target_campaign:campaign,target_set:selected,family:null,needle:null,
   page_size:1,page_offset:0
  });
  if(checkError)throw checkError;
  if(Number(checked?.total)!==currentAudit.entries.length)
   throw Error('Index verification failed: '+checked?.total+'/'+currentAudit.entries.length+'.');
  status.textContent='Verified '+manifest.length+' complete original documents and '+
   checked.total+' source entries in this campaign’s DM-only database. No boons have been granted.';
  return {sourceSet:selected,sourceCount:manifest.length,entryCount:checked.total};
 }finally{importing=false;run.disabled=false;}
}
async function browse(campaign,stage){
 if(!ready()||!UUID.test(campaign)||indexCampaign!==campaign)return;
 stage.replaceChildren(node('p','tv254-muted','Reading the private source index…'));
 const page={offset:0,family:null,query:''};
 const controls=node('div','tv279-library-tools');
 const input=node('input','tv270-input');
 input.type='search';input.placeholder='Search source titles or patrons';
 input.setAttribute('aria-label','Search archive entries');
 const select=node('select','tv270-input');
 select.setAttribute('aria-label','Filter by divine system');
 for(const [key,name] of [['','All source families'],...Object.entries(familyNames)]){
  const option=node('option','',name);option.value=key;select.append(option);
 }
 controls.append(input,select);
 const count=node('p','tv279-count');
 const results=node('div','tv279-results');
 const pagination=node('div','tv279-page-controls');
 const previous=btn('Previous',()=>{page.offset=Math.max(0,page.offset-30);load()});
 const next=btn('Next',()=>{page.offset+=30;load()});
 pagination.append(previous,next);
 stage.replaceChildren(controls,count,results,pagination);
 let request=0;
 async function load(){
  const current=++request;count.textContent='Loading source entries…';
  try{
   const {data,error}=await api().rpc('terravale_divine_dm_archive_list',{
    target_campaign:campaign,target_set:null,
    family:page.family,needle:page.query,page_size:30,page_offset:page.offset
   });
   if(error)throw error;
   if(indexCampaign!==campaign||current!==request||!stage.isConnected)return;
   results.replaceChildren();
   count.textContent=(data?.total||0)+' private source sections · showing '+
     (data.total? (page.offset+1)+'–'+(page.offset+(data.entries||[]).length):'none');
   previous.disabled=page.offset===0;
   next.disabled=page.offset+30>=data.total;
   for(const rec of data.entries||[]){
    const line=node('details','tv279-source-entry');
    const heading=node('summary','',rec.name+' · '+rec.patron);
    const facts=node('div','tv279-facts');
    for(const value of [familyNames[rec.kind]||rec.kind,
      rec.tier!==null?'Tier/Depth '+rec.tier:null,
      rec.other_patron?'With '+rec.other_patron:null,
      rec.required_favour!==null?'Favour '+rec.required_favour:null,
      rec.required_favour_second!==null?'Partner +'+rec.required_favour_second:null,
      rec.slot?'Slot '+rec.slot:null,rec.uses_text])
      if(value!==null&&value!==undefined)facts.append(node('span','tv279-pill',value));
    const source=node('small','tv279-path',rec.source_path);
    const original=node('pre','tv279-original','Open this entry to read the exact original rules.');
    let loaded=false;
    line.addEventListener('toggle',async()=>{
     if(!line.open||loaded)return;
     original.textContent='Loading DM-only source text…';
     const {data:body,error:readErr}=await api().rpc('terravale_divine_dm_archive_read',{
      target_campaign:campaign,target_entry:rec.id
     });
     if(!line.isConnected)return;
     if(readErr){original.textContent=readErr.message||String(readErr);return}
     loaded=true;original.textContent=body?.original_mechanics||'';
    });
    line.append(heading,facts,source,original);results.append(line);
   }
   if(!data?.entries?.length)results.append(node('p','tv254-muted',
     'No source entries match. Import the verified ZIP first or change the filters.'));
  }catch(e){count.textContent='Could not read private index: '+(e.message||String(e))}
 }
 let queued=0;
 input.addEventListener('input',()=>{
  page.query=input.value.trim().slice(0,100);page.offset=0;
  clearTimeout(queued);queued=setTimeout(load,220);
 });
 select.addEventListener('change',()=>{page.family=select.value||null;page.offset=0;load()});
 await load();
}
function mount(host,campaign){
 if(!host||!ready()||!UUID.test(String(campaign))||!parser()||!reader()?.openDocuments)return;
 if(host.querySelector('[data-tv279-root]'))return;
 const section=node('details','tv279-archive');section.dataset.tv279Root='1';
 section.append(node('summary','','Archive 2 · original system rules & source catalogue'));
 const info=node('p','tv254-muted',
  'Imports 49 original Markdown documents and a source-exact, DM-only index. The source index cannot grant abilities. Minor Grace, Intercession, Concordant, Tier 0 and Nyrha rules remain distinct.');
 const pick=node('input');pick.type='file';pick.accept='.zip,.md,.markdown';pick.multiple=true;pick.hidden=true;
 const status=node('p','tv279-status','No original ZIP loaded in this view.');
 const inventory=node('div','tv279-inventory');
 const action=btn('Store originals and private source index',()=>{},'btn primary small');
 action.hidden=true;
 const review=node('div','tv279-review');
 const pickerButton=btn('Select the original Boons ZIP',()=>pick.click());
 const openIndex=btn('Browse private source index',()=>{indexCampaign=campaign;browse(campaign,review)});
 const actions=node('div','tv279-actions');
 actions.append(pickerButton,action,openIndex);
 section.append(info,actions,pick,status,inventory,review);
 pick.addEventListener('change',async()=>{
  const files=Array.from(pick.files||[]);pick.value='';
  if(!files.length)return;
  status.textContent='Reading original source files without changing your database…';
  inventory.replaceChildren();review.replaceChildren();
  try{
   const docs=await reader().openDocuments(files);
   const checked=parser().inventory(docs);
   documents=docs;currentAudit=checked;sourceSet=null;indexCampaign=campaign;
   verifyAudit(checked);
   status.textContent='49 originals verified · '+checked.entries.length+
     ' classified entries · source text preserved in full.';
   const stats=node('div','tv279-stats');
   for(const [kind,amount] of Object.entries(checked.counts)){
    const badge=node('div','tv279-stat');
    badge.append(node('strong','',String(amount)),node('span','',familyNames[kind]||kind));
    stats.append(badge);
   }
   inventory.append(stats,node('p','tv254-muted',
    'Source caution: Amora has no Tier V section. Tier 0 and Nyrha entries are NOT ordinary prepared boons. Exact charges, Burdens and mechanical gaps remain under DM review.'));
   action.hidden=false;
  }catch(e){
   documents=null;currentAudit=null;sourceSet=null;indexCampaign=campaign;
   action.hidden=true;status.textContent='Source validation failed: '+(e.message||String(e));
  }
 });
 action.addEventListener('click',async()=>{
  if(!documents||!currentAudit||importing)return;
  if(!window.confirm('Store 49 complete original rule documents and '+
     currentAudit.entries.length+' source sections privately? This does NOT grant, publish or activate any boons.'))return;
  try{
   const finished=await uploadSourceAndIndex(campaign,status,action);
   inventory.append(node('p','tv279-success',
     'Source archive indexed and verified: '+finished.entryCount+' private entries.'));
   await browse(campaign,review);
  }catch(e){status.textContent='Import stopped safely: '+(e.message||String(e))+
    '. Retry with this panel open to resume the same source set.'}
 });
 host.append(section);
}
window.TerravaleV279Archive={mount};
})();