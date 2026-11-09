/* Terravale V2.75 — source-first Archive 2 custody; DM only.
   The archive is never interpreted as boon grants or automatically published. */
(function(){
'use strict';
const MAX_FILES=500,MAX_ITEM=250000,MAX_ALL=8000000;
const el=(tag,cls,text)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;
};
const button=(text,handler)=>{
 const b=el('button','btn ghost small',text);b.type='button';b.addEventListener('click',handler);return b;
};
const account=()=>window.TerravaleVerifiedAccount;
const api=()=>account()?.supabase;
const hasDM=()=>Boolean(account()?.state?.ready&&account()?.state?.profile?.is_dm&&
 typeof db!=='undefined'&&db.role==='dm');
function validate(docs){
 if(!docs.length||docs.length>MAX_FILES)throw Error('Expected 1–500 Markdown source files.');
 const unique=new Set();let size=0;
 for(const d of docs){
  const path=String(d.name||''),body=String(d.text||'');
  if(path.length<1||path.length>500||path.startsWith('/')||
     path.includes('\\')||path.split('/').some(p=>p==='.'||p==='..')||
     unique.has(path))throw Error('Unsafe or repeated source path: '+path);
  unique.add(path);
  const bytes=new TextEncoder().encode(body).length;
  if(!bytes||bytes>MAX_ITEM)throw Error('Original document exceeds 250 KB: '+path);
  size+=bytes;if(size>MAX_ALL)throw Error('Original source set exceeds 8 MB.');
 }
 return size;
}
async function save(campaign,docs,progress,getSet){
 if(!hasDM())throw Error('Only a verified campaign DM may store sources.');
 validate(docs);
 const setId=getSet();
 for(const [i,doc] of docs.entries()){
  progress.textContent='Saving source '+(i+1)+' / '+docs.length+' · '+doc.name;
  const {error}=await api().rpc('terravale_divine_dm_source_add',{
    target_campaign:campaign,target_set:setId,source_path:doc.name,
    source_kind:doc.type,source_markdown:doc.text
  });
  if(error)throw Error('Stopped at source '+(i+1)+': '+(error.message||String(error)));
 }
 const {data,error}=await api().rpc('terravale_divine_dm_source_manifest',{target_campaign:campaign});
 if(error)throw error;
 const verified=(data||[]).filter(d=>d.source_set===setId);
 if(verified.length!==docs.length)throw Error('Vault contains '+verified.length+' / '+docs.length+' sources; do not assume the import completed.');
 progress.textContent='All '+verified.length+' originals verified in the private Source Vault. No boon abilities were created.';
 return setId;
}
async function browse(campaign,host){
 host.replaceChildren(el('p','tv254-muted','Reading DM source index…'));
 try{
  const {data,error}=await api().rpc('terravale_divine_dm_source_manifest',{target_campaign:campaign});
  if(error)throw error;
  host.replaceChildren();
  if(!data?.length){host.append(el('p','tv254-muted','The private source vault is empty.'));return}
  const bySet=new Map();
  for(const d of data){const g=bySet.get(d.source_set)||[];g.push(d);bySet.set(d.source_set,g)}
  for(const [id,sources] of bySet){
   const group=el('details','tv275-source-set');
   group.append(el('summary','','Source archive '+id.slice(0,8)+' · '+sources.length+' original files'));
   const list=el('div','tv275-source-list');
   for(const d of sources){
    const line=el('details','tv275-source-file');
    line.append(el('summary','',d.path+' · '+d.kind+' · '+Math.ceil(d.bytes/1024)+' KB'));
    const source=el('pre','tv275-source-text','Open this entry to read the original Markdown.');
    line.append(source);
    let loaded=false;
    line.addEventListener('toggle',async()=>{
     if(!line.open||loaded)return;
     source.textContent='Loading private source…';
     const {data:body,error:readError}=await api().rpc('terravale_divine_dm_source_read',{
      target_campaign:campaign,target_source:d.id
     });
     if(readError){source.textContent='Read failed: '+readError.message;return}
     source.textContent=body?.markdown||'';loaded=true;
    });
    list.append(line);
   }
   group.append(list);host.append(group);
  }
 }catch(e){host.replaceChildren(el('p','tv270-status',e.message||String(e)))}
}
function mount(host,campaign){
 if(!hasDM()||!campaign||host.querySelector('[data-tv275-source-vault]'))return;
 const library=window.TerravaleBoonArchiveV273;
 if(!library?.openDocuments||!library?.sourceInventory)return;
 const wrap=el('details','tv275-source-vault');wrap.dataset.tv275SourceVault='1';
 wrap.append(el('summary','','Source Vault · complete Archive 2 rules'));
 const copy=el('p','tv254-muted',
  'Preserve every original Markdown file privately, including system rules, patron collections and named conditions. This does not create or award boons.');
 const input=el('input');input.type='file';input.accept='.zip,.md,.markdown,.txt';input.multiple=true;input.hidden=true;
 const status=el('p','tv275-source-status');
 const stage=el('div','tv275-source-stage');
 const pick=button('Choose Archive 2 ZIP / Markdown',()=>input.click());
 const stored=button('Browse saved original sources',()=>browse(campaign,stage));
 wrap.append(copy,pick,stored,input,status,stage);
 let documents=[],sourceSet=null;
 input.addEventListener('change',async()=>{
  const chosen=Array.from(input.files||[]);input.value='';
  if(!chosen.length)return;
  status.textContent='Reading the exact source documents locally…';
  stage.replaceChildren();
  try{
   const originals=await library.openDocuments(chosen);
   validate(originals);
   const inventory=library.sourceInventory(originals);
   documents=originals.map(doc=>({...doc,type:library.classifySource(doc)}));
   sourceSet=window.crypto?.randomUUID?.()||null;
   if(!sourceSet)throw Error('Secure browser identity generation is unavailable.');
   status.textContent=documents.length+' original documents ready. Classification is only a review hint; the entire source text is retained.';
   const summary=el('p','tv254-muted',
    inventory.counts.system+' frameworks · '+inventory.counts.collection+
    ' collections · '+inventory.counts.single+' possible standalone entries · '+
    inventory.counts.unclassified+' unclassified.');
   const index=el('details','tv275-import-index');
   index.append(el('summary','','Review all source filenames before storage'));
   const list=el('ul','');
   for(const doc of documents)list.append(el('li','',doc.name+' · '+doc.type));
   index.append(list);
   const action=button('Store all originals privately (no boon grants)',async()=>{
    if(!window.confirm('Store '+documents.length+
       ' original source documents in this campaign’s private DM database? This does not create or publish boons.'))return;
    action.disabled=true;pick.disabled=true;
    try{
     await save(campaign,documents,status,()=>sourceSet);
     action.textContent='Stored and verified';
     await browse(campaign,stage);
    }catch(e){status.textContent=e.message||String(e);action.disabled=false}
    finally{pick.disabled=false}
   });
   stage.append(summary,index,action);
  }catch(e){documents=[];status.textContent='Could not read archive: '+(e.message||String(e))}
 });
 host.append(wrap);
}
window.TerravaleV275SourceVault={mount,validate};
})();
