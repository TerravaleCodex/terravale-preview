/* Terravale V2.79 · Archive 2 literal heading reader.
   This script contains NO boon text. It classifies source sections from a DM ZIP
   while preserving their exact original mechanics. Only a human DM can publish. */
(function(root){
'use strict';
const ROMAN={I:1,II:2,III:3,IV:4,V:5},FAVOUR={1:1,2:3,3:5,4:7,5:9},GREATER={1:3,2:5,3:7,4:9,5:10};
function headings(text){
 const rx=/^(#{1,6})\s+([^\r\n]+)\r?$/gm;
 const a=[...text.matchAll(rx)].map(m=>({
   depth:m[1].length,heading:m[2].trim(),start:m.index,bodyStart:m.index+m[0].length
 }));
 for(let i=0;i<a.length;i++){
  const x=a[i];x.end=text.length;
  for(let j=i+1;j<a.length;j++)if(a[j].depth<=x.depth){x.end=a[j].start;break}
  x.body=text.slice(x.bodyStart,x.end).trim();x.ordinal=i+1;
 }
 return a;
}
function explicit(text,label){
 const rx=new RegExp('^\\*\\*'+label+':\\*\\*\\s*([^\\r\\n]+)','im');
 return text.match(rx)?.[1]?.trim()||null;
}
function parse(doc){
 const original=String(doc.name||''),p=original.replace(/^\/?Boons\//,'').replace(/\\/g,'/');
 const text=String(doc.text||'');
 if(!p.endsWith('.md'))return {path:p,category:'excluded',entries:[]};
 if(!text.trim())throw Error('Empty source '+p);
 const h=headings(text),entries=[];
 const patron=(text.match(/^patron:\s*(.*?)(?:\r?$)/mi)||[])[1]?.trim()||
    p.split('/').pop().replace(/ (?:Minor )?Boons\.md$/,'');
 const frameworks=new Set(['Divine Boons.md','Concordant Boons/Concordant Boons.md','Minor Gods/Minor God Boons.md','Nyrha/Nyrha and the Pantheon.md']);
 const family=frameworks.has(p)?'system':p.startsWith('Major Gods/')?'major_collection':
    p.startsWith('Minor Gods/')?'minor_collection':p.startsWith('Concordant Boons/')?
    'concordant_collection':p==='Nyrha/Nyrha Revisions.md'?'nyrha_revisions':'unknown';
 function add(kind,head,override={}){
  if(!head.body)return;
  entries.push({
   kind,title:override.title||head.heading.replace(/^\d+\.\s*/,'').trim(),
   source_path:original,source_ordinal:head.ordinal,heading:head.heading,
   patron:override.patron||patron,other_patron:override.other_patron||null,
   tier:override.tier??null,required_favour:override.required_favour??null,
   required_favour_second:override.required_favour_second??null,
   slot:override.slot??explicit(head.body,'Slot')??null,
   activation:override.activation??explicit(head.body,'Activation')??null,
   uses_text:override.uses_text??explicit(head.body,'Uses?')??null,
   mechanics:head.body,source_family:family,review_status:'source_only'
  });
 }
 if(family==='major_collection'){
  const greater=['Pae','Kalma','Tyrius'].includes(patron),tiers=[];
  for(const parent of h){
   const t=parent.depth<=2&&parent.heading.match(/^Tier\s+(I|II|III|IV|V|0)\b/i);
   if(!t)continue;
   const tier=t[1]==='0'?0:ROMAN[t[1].toUpperCase()];
   tiers.push(tier);
   const children=h.filter(c=>c.start>parent.start&&c.start<parent.end&&c.depth===parent.depth+1);
   for(const child of children){
    if(/^(?:Design Intent|Tier [IVX0]+ Identity|Using (?:\w+ )?Tier 0|Tier 0 Philosophy|Concordant Principle|Overview|Shared Limit|Boon Catalogue)/i.test(child.heading))continue;
    add(tier===0?'tier_zero':'divine',child,{
     tier,required_favour:tier===0?null:(greater?GREATER:FAVOUR)[tier]
    });
   }
  }
  return {path:p,category:family,patron,tiers:[...new Set(tiers)].sort((a,b)=>a-b),entries};
 }
 if(family==='minor_collection'){
  for(const parent of h){
   if(parent.depth!==2||!['Minor Grace','Minor Intercession'].includes(parent.heading))continue;
   const kind=parent.heading==='Minor Grace'?'minor_grace':'minor_intercession';
   for(const child of h.filter(c=>c.start>parent.start&&c.start<parent.end&&c.depth===3)){
    add(kind,child,{slot:kind==='minor_grace'?'Grace':'Intercession',
      uses_text:kind==='minor_intercession'?'Shared 1 / long rest':null});
   }
  }
 }
 if(family==='concordant_collection'){
  for(const child of h){
   const m=child.depth===2&&child.heading.match(/^Pae and ([^—]+)\s+—\s+(.+)$/);
   if(!m)continue;
   const partner=m[1].trim(),tier=ROMAN[(explicit(child.body,'Tier')||'').trim()]||null;
   const requirement=explicit(child.body,'Required Favour')||'';
   const primary=requirement.match(/Pae\s*\+(\d+)/);
   const secondary=requirement.match(new RegExp(partner+'\\s*\\+(\\d+)'));
   add('concordant',child,{title:m[2].trim(),patron:'Pae',
    other_patron:partner,tier,required_favour:primary?Number(primary[1]):null,
    required_favour_second:secondary?Number(secondary[1]):null});
  }
 }
 if(family==='nyrha_revisions'){
  let depth=0;
  for(const child of h){
   if(child.depth===1){
    const m=child.heading.match(/^Depth\s+(I|II|III|IV|V)\b/i);
    depth=m?ROMAN[m[1].toUpperCase()]:child.heading==='Impossible Offers'?-1:0;
    if(depth===5)add('nyrha_state',child,{patron:'Nyrha',tier:5,
      title:'The Unwritten State',uses_text:'Once per campaign arc'});
   }else if(child.depth===2&&[1,2,3,4,-1].includes(depth)){
    add(depth===-1?'nyrha_offer':'nyrha_revision',child,{patron:'Nyrha',tier:depth});
   }
  }
 }
 return {path:p,category:family,patron,entries};
}
function inventory(documents){
 if(!Array.isArray(documents)||documents.length<1||documents.length>100)
  throw Error('Expected an Archive 2 source set.');
 const names=new Set(),docs=[],entries=[],counts={};
 for(const item of documents){
  if(names.has(item.name))throw Error('Duplicate archive path: '+item.name);
  names.add(item.name);
  const parsed=parse(item);
  docs.push({path:item.name,category:parsed.category,patron:parsed.patron||'',
     tiers:parsed.tiers||[],count:parsed.entries.length});
  for(const entry of parsed.entries){
   counts[entry.kind]=(counts[entry.kind]||0)+1;
   entries.push(entry);
  }
 }
 const sourceCount=docs.filter(x=>x.path.toLowerCase().endsWith('.md')).length;
 const missingTier5=docs.filter(x=>x.category==='major_collection'&&!x.tiers.includes(5)).map(x=>x.patron);
 return {sourceCount,entries,counts,docs,missingTier5,
  complete:sourceCount===49&&counts.divine===344&&counts.tier_zero===100&&
   counts.minor_grace===29&&counts.minor_intercession===29&&
   counts.concordant===12&&counts.nyrha_revision===13&&
   counts.nyrha_state===1&&counts.nyrha_offer===6};
}
root.TerravaleArchive2V279={parse,headings,inventory};
})(typeof module!=='undefined'&&module.exports?module.exports:window);