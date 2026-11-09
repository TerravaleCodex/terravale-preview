/* Terravale V2.73 — private, review-first import of canonical Markdown/ZIP boons.
   Archive bytes stay within the DM browser. Import requires an explicit DM action,
   and source text is preserved as the full mechanics field without interpretation. */
(function(){
'use strict';
const MAX_ARCHIVE=4*1024*1024, MAX_FILES=500, MAX_ITEM=14000, MAX_TOTAL=6*1024*1024;
const magic=(v,o)=>v.getUint32(o,true);
const textFile=(name,body)=>({name,text:body.replace(/^\uFEFF/,'')});
function readU16(v,o){if(o<0||o+2>v.byteLength)throw Error('Damaged ZIP entry');return v.getUint16(o,true)}
function readU32(v,o){if(o<0||o+4>v.byteLength)throw Error('Damaged ZIP entry');return v.getUint32(o,true)}
async function unzipMarkdown(file){
 if(file.size>MAX_ARCHIVE)throw Error('Archive is larger than the permitted 4 MB.');
 const buf=await file.arrayBuffer(),v=new DataView(buf);
 let eocd=-1;
 for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--){
  if(magic(v,i)===0x06054b50){eocd=i;break}
 }
 if(eocd<0)throw Error('ZIP directory not found.');
 if(readU16(v,eocd+4)||readU16(v,eocd+6))throw Error('Multi-disk ZIP archives are not supported.');
 const count=readU16(v,eocd+10),dir=readU32(v,eocd+16);
 if(count>MAX_FILES||count===0)throw Error('Expected 1–500 files in ZIP.');
 if(dir===0xffffffff)throw Error('ZIP64 archives are not supported.');
 let offset=dir,total=0;
 const result=[],decoder=new TextDecoder('utf-8');
 for(let i=0;i<count;i++){
  if(magic(v,offset)!==0x02014b50)throw Error('Invalid ZIP directory record.');
  const method=readU16(v,offset+10),compressed=readU32(v,offset+20);
  const size=readU32(v,offset+24),length=readU16(v,offset+28);
  const extra=readU16(v,offset+30),comment=readU16(v,offset+32);
  const local=readU32(v,offset+42);
  const end=offset+46+length+extra+comment;
  if(end>buf.byteLength)throw Error('Truncated ZIP directory.');
  const name=decoder.decode(new Uint8Array(buf,offset+46,length));
  offset=end;
  if(name.endsWith('/')||name.startsWith('__MACOSX/')||name.split('/').some(p=>p==='..'||p==='.')||
     /(^|\/)\._/.test(name))continue;
  if(!/\.(md|markdown|txt)$/i.test(name))continue;
  if(size>MAX_ITEM||compressed>MAX_ARCHIVE)throw Error('A boon file exceeds the permitted size: '+name);
  total+=size;
  if(total>MAX_TOTAL)throw Error('Uncompressed archive exceeds the 6 MB limit.');
  if(magic(v,local)!==0x04034b50)throw Error('Invalid ZIP local record.');
  const start=local+30+readU16(v,local+26)+readU16(v,local+28);
  if(start+compressed>buf.byteLength)throw Error('ZIP contains truncated data.');
  const payload=new Uint8Array(buf,start,compressed);
  let bytes;
  if(method===0)bytes=payload;
  else if(method===8){
   if(typeof DecompressionStream!=='function')throw Error('Your browser cannot unpack ZIP files; select extracted Markdown files instead.');
   try{
    let expanded=0;
    const guard=new TransformStream({transform(chunk,controller){
     expanded+=chunk.byteLength;
     if(expanded>MAX_ITEM||expanded>size)throw Error('ZIP entry expands beyond its declared size.');
     controller.enqueue(chunk);
    }});
    const stream=new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw')).pipeThrough(guard);
    bytes=new Uint8Array(await new Response(stream).arrayBuffer());
   }catch(e){throw Error('ZIP decompression failed for '+name+': '+(e.message||String(e)))}
  }else throw Error('Unsupported ZIP compression for '+name);
  if(bytes.byteLength!==size)throw Error('ZIP size check failed for '+name);
  result.push(textFile(name,decoder.decode(bytes)));
 }
 if(!result.length)throw Error('No Markdown boon documents were found inside ZIP.');
 return result;
}
async function openDocuments(files){
 const result=[];
 for(const file of files){
  if(/\.zip$/i.test(file.name))result.push(...await unzipMarkdown(file));
  else if(/\.(md|markdown|txt)$/i.test(file.name)){
   if(file.size>MAX_ITEM)throw Error('Source file too large: '+file.name);
   result.push(textFile(file.webkitRelativePath||file.name,await file.text()));
  }else throw Error('Select ZIP or Markdown files.');
 }
 if(result.length>MAX_FILES)throw Error('Too many boon documents (maximum 500).');
 return result;
}
function frontmatter(markdown){
 const m=markdown.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
 const meta={};
 if(m){
  for(const line of m[1].split(/\r?\n/)){
   const kv=line.match(/^([\w -]+):\s*(.+?)\s*$/);
   if(kv)meta[kv[1].trim().toLowerCase().replace(/[\s-]+/g,'_')]=kv[2].trim().replace(/^["']|["']$/g,'');
  }
 }
 for(const line of markdown.split(/\r?\n/).slice(0,55)){
  const kv=line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?([\w -]{3,35})(?:\*\*)?\s*:\s*(.*?)\s*$/);
  if(kv){
   const key=kv[1].trim().toLowerCase().replace(/[\s-]+/g,'_');
   if(!meta[key])meta[key]=kv[2].trim();
  }
 }
 return meta;
}
const first=(meta,keys)=>keys.map(k=>meta[k]).find(Boolean)||'';
function detectKind(value){
 const s=String(value||'').toLowerCase();
 if(/\bconcordant\b/.test(s))return 'concordant';
 if(/\bminor(?: god)?\b/.test(s))return 'minor';
 if(/\bdivine\b/.test(s))return 'divine';
 return '';
}
function detectThreshold(value){
 const m=String(value||'').match(/(?:threshold|required favou?r|minimum favou?r|favou?r needed)\s*[:=]?\s*\+?(\d{1,2})/i);
 const literal=String(value||'').trim().match(/^\+?(\d{1,2})$/);
 const found=literal||m;
 return found&&Number(found[1])>=1&&Number(found[1])<=10?String(Number(found[1])):'';
}
function detectCharges(value,source){
 const s=String(value||'').trim();
 const m=s.match(/^(\d{1,2})$/)||
  source.match(/(?:max(?:imum)?\s+charges?|charges?\s*(?:max(?:imum)?)?|uses?\s*(?:per|each)\s*(?:short|long)\s*rest)\s*[:=]?\s*(\d{1,2})/i)||
  source.match(/\b(\d{1,2})\s+uses?\s+per\s+(?:short|long)\s+rest\b/i);
 if(m&&Number(m[1])>=1&&Number(m[1])<=99)return String(Number(m[1]));
 if(/\bonce\s+per\s+(?:short|long)\s+rest\b/i.test(source))return '1';
 return /\b(?:charges?|uses?\s+per\s+rest|once\s+per\s+rest|twice\s+per\s+rest)\b/i.test(source)?'':'0';
}
function detectRecovery(value,source){
 const s=String(value||'').toLowerCase();
 if(/\bshort\b/.test(s))return 'short';
 if(/\blong\b/.test(s))return 'long';
 if(/\bdawn\b/.test(s))return 'dawn';
 if(/\bmanual\b/.test(s))return 'manual';
 if(/\bnone|never\b/.test(s))return 'none';
 if(/\bper\s+short\s+rest\b|\bafter\s+a\s+short\s+rest\b/i.test(source))return 'short';
 if(/\bper\s+long\s+rest\b|\bafter\s+a\s+long\s+rest\b/i.test(source))return 'long';
 if(/\bat\s+dawn\b|\beach\s+dawn\b/i.test(source))return 'dawn';
 return '';
}
function detectPatron(input,patrons){
 const s=String(input||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
 let hits=patrons.filter(p=>{
  const name=p.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
  const key=String(p.key_name||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
  return (' '+s+' ').includes(' '+name+' ')||(' '+s+' ').includes(' '+key+' ');
 });
 return hits.length===1?hits[0].name:'';
}
function derive(doc,patrons){
 const body=doc.text,meta=frontmatter(body),path=doc.name;
 const base=path.split('/').pop().replace(/\.(md|markdown|txt)$/i,'').replace(/[_-]+/g,' ');
 const heading=body.match(/^#\s+(.+?)\s*$/m);
 const name=first(meta,['boon_name','title','name'])||(heading?heading[1].trim():base);
 const kind=detectKind(first(meta,['kind','family','boon_type','type'])||path);
 const explicit=first(meta,['patron','god','deity','divine_patron']);
 const patron=detectPatron(explicit||path,patrons);
 const second=detectPatron(first(meta,['second_patron','other_patron','concordant_patron']),patrons);
 const threshold=detectThreshold(first(meta,['required_favour','required_favor','threshold','favour','favor'])||body);
 const charges=detectCharges(first(meta,['max_charges','charges','uses_per_rest','uses']),body);
 const recovery=detectRecovery(first(meta,['recovery','recharge','rest']),body);
 const summary=first(meta,['summary','description','short_description'])||
  (body.replace(/^---[\s\S]*?\n---\s*/,'').split(/\n\s*\n/).find(p=>
    p.trim()&&!/^\s*#|^\s*\*\*|^\s*[-*]\s|\b(?:threshold|favour|charges)\s*:/i.test(p))||'').trim().slice(0,450);
 return {name:name.slice(0,130),kind,patron,second_patron:second,required_favour:threshold,
  max_charges:charges,recovery:recovery||(charges==='0'?'none':''),summary:summary.slice(0,1200),
  mechanics:body.trim(),source:path,state:'draft'};
}
function elem(tag,cls,content){
 const el=document.createElement(tag);
 if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);
 return el;
}
function button(label,callback){const el=elem('button','btn ghost small',label);el.type='button';el.addEventListener('click',callback);return el}
function field(label,value,update,options={}){
 const host=elem('label','tv273-field');
 host.append(elem('span','',label));
 const el=elem('input','tv270-input');el.type=options.type||'text';
 el.value=value||'';if(options.placeholder)el.placeholder=options.placeholder;
 if(options.min!=null)el.min=options.min;if(options.max!=null)el.max=options.max;
 el.addEventListener('input',()=>update(el.value));host.append(el);return host;
}
function choice(label,items,selected,choose){
 const host=elem('div','tv273-choice');host.append(elem('span','',label));
 const rail=elem('div','tv273-options');
 for(const [id,name] of items){
  const control=button(name,()=>{choose(id);rail.querySelectorAll('button').forEach(b=>{
   b.classList.toggle('active',b.dataset.value===id);
  })});
  control.dataset.value=id;control.classList.toggle('active',selected===id);rail.append(control);
 }
 host.append(rail);return host;
}
function check(rec,patrons){
 const primary=patrons.find(p=>[p.name.toLowerCase(),String(p.key_name).toLowerCase()].includes(rec.patron.toLowerCase()));
 const other=patrons.find(p=>[p.name.toLowerCase(),String(p.key_name).toLowerCase()].includes(rec.second_patron.toLowerCase()));
 const threshold=Number(rec.required_favour),charges=Number(rec.max_charges);
 const errs=[];
 if(!Object.hasOwn({divine:1,minor:1,concordant:1},rec.kind))errs.push('boon family');
 if(!rec.name||rec.name.length>130)errs.push('name');
 if(!primary)errs.push('patron');
 if(!Number.isInteger(threshold)||threshold<1||threshold>10||rec.required_favour==='')errs.push('favour threshold');
 if(rec.max_charges===''||!Number.isInteger(charges)||charges<0||charges>99)errs.push('charges');
 if(charges>0&&!['short','long','dawn','manual','none'].includes(rec.recovery))errs.push('recovery');
 if(rec.kind==='concordant'&&(!other||other.id===primary?.id))errs.push('second patron');
 if(rec.kind==='divine'&&primary?.rank==='minor')errs.push('major deity required');
 if(rec.kind==='minor'&&primary?.rank!=='minor')errs.push('minor deity required');
 if(rec.mechanics.length>10000)errs.push('source exceeds 10,000 characters');
 return {errs,primary,other};
}
let activePanel=null;
function createReview(host,documents,patrons){
 activePanel?.remove();
 const panel=elem('section','tv273-import-review');activePanel=panel;
 const header=elem('div','tv273-review-head'),title=elem('h4','','Review imported source files');
 const summary=elem('p','tv254-muted','The original Markdown is preserved in full. All entries import as private drafts. Unresolved entries are skipped, never guessed or published.');
 const count=elem('p','tv273-review-count');
 header.append(title,summary,count);panel.append(header);
 const rows=documents.map(d=>derive(d,patrons));
 const list=elem('div','tv273-review-items');panel.append(list);
 const rerender=()=>{
  let valid=0;
  for(const item of list.querySelectorAll('[data-tv273-entry]')){
   const n=Number(item.dataset.index),status=item.querySelector('[data-tv273-state]');
   const state=check(rows[n],patrons);
   status.textContent=state.errs.length?'Needs review: '+state.errs.join(', '):'Ready to import as private draft';
   status.className='tv273-entry-state '+(state.errs.length?'needs':'ready');
   if(!state.errs.length)valid++;
  }
  count.textContent=valid+' verified / '+rows.length+' source files';
 };
 rows.forEach((r,i)=>{
  const item=elem('details','tv273-entry');item.dataset.tv273Entry='1';item.dataset.index=String(i);
  const top=elem('summary','',r.name+' · '+r.source);
  const status=elem('small','tv273-entry-state');status.dataset.tv273State='1';
  item.append(top,status);
  const controls=elem('div','tv273-entry-controls');
  controls.append(
   field('Name',r.name,v=>{r.name=v;rerender()}),
   choice('Family',[['divine','Divine'],['minor','Minor God'],['concordant','Concordant']],r.kind,v=>{r.kind=v;rerender()}),
   field('Patron',r.patron,v=>{r.patron=v;rerender()},{placeholder:'Exact deity name'}),
   field('Second patron (Concordant)',r.second_patron,v=>{r.second_patron=v;rerender()},{placeholder:'If required'}),
   field('Minimum favour',r.required_favour,v=>{r.required_favour=v;rerender()},{type:'number',min:1,max:10}),
   field('Maximum charges (0 = none)',r.max_charges,v=>{r.max_charges=v;rerender()},{type:'number',min:0,max:99}),
   choice('Recovery',[['short','Short rest'],['long','Long rest'],['dawn','Dawn'],['manual','DM'],['none','None']],r.recovery,v=>{r.recovery=v;rerender()})
  );
  const original=elem('details','tv273-original');
  original.append(elem('summary','','Read exact source Markdown'),elem('pre','',r.mechanics));
  item.append(controls,original);list.append(item);
 });
 rerender();
 const actions=elem('div','tv273-import-actions'),status=elem('p','tv273-import-status');
 actions.append(button('Close import review',()=>{panel.remove();activePanel=null}),button('Import verified private drafts',async()=>{
  const valid=rows.filter(r=>!check(r,patrons).errs.length);
  if(!valid.length){status.textContent='No records are ready. Open an entry and complete its missing metadata.';return}
  const payload=valid.map(r=>({name:r.name,kind:r.kind,patron:r.patron,second_patron:r.second_patron,
   summary:r.summary,mechanics:r.mechanics,required_favour:Number(r.required_favour),
   max_charges:Number(r.max_charges),recovery:r.recovery,state:'draft'}));
  const importer=window.TerravaleV270Divine?.importPreparedBoons;
  if(typeof importer!=='function'){status.textContent='The verified DM importer is not available.';return}
  await importer(payload,status);
 }));
 panel.append(actions,status);host.append(panel);
 const missing=list.querySelector('.needs')?.closest('details');if(missing)missing.open=true;
}
function mount(section,patrons){
 if(!section||section.querySelector('[data-tv273-launch]')||!window.TerravaleV270Divine)return;
 const launch=button('Import Archive 2 ZIP / Markdown',()=>picker.click());
 launch.dataset.tv273Launch='1';
 const picker=elem('input');picker.type='file';picker.accept='.zip,.md,.markdown,.txt,application/zip';picker.multiple=true;picker.hidden=true;
 const message=elem('small','tv273-message');
 picker.addEventListener('change',async()=>{
  const files=Array.from(picker.files||[]);picker.value='';
  if(!files.length)return;
  message.textContent='Reading source documents locally…';
  try{
   const docs=await openDocuments(files);
   message.textContent=docs.length+' Markdown source files recovered. Review them before importing.';
   createReview(section,docs,patrons);
  }catch(e){message.textContent='Archive could not be read: '+(e.message||String(e))}
 });
 const anchor=section.querySelector('[data-tv273-launch]')||section.querySelector('input[type="file"]');
 if(anchor?.parentNode)anchor.parentNode.insertBefore(launch,anchor.nextSibling);
 else section.append(launch);
 section.append(picker,message);
}
window.TerravaleBoonArchiveV273={mount,unzipMarkdown,openDocuments,derive};
})();
