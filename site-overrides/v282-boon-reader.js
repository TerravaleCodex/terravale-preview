/* V2.82 — source-faithful Divine Boon Reader.
   Semantic Markdown -> DOM, no innerHTML or execution. Retain exact source meaning. */
(function(){
'use strict';
const el=(tag,cls,text)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(text!==undefined)x.textContent=String(text);return x;
};
function inline(parent,source){
 const text=String(source||'').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2')
  .replace(/\[\[([^\]]+)\]\]/g,(m,s)=>s.split('#').pop()||s);
 const regex=/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
 let start=0;for(const match of text.matchAll(regex)){
  if(match.index>start)parent.append(document.createTextNode(text.slice(start,match.index)));
  const v=match[0],bold=v.startsWith('**')||v.startsWith('__');
  const code=v.startsWith('`');
  const item=el(code?'code':bold?'strong':'em','',v.slice(code?1:bold?2:1,code?-1:bold?-2:-1));
  parent.append(item);start=match.index+v.length;
 }
 if(start<text.length)parent.append(document.createTextNode(text.slice(start)));
}
function read(source,meta={}){
 const root=el('article','tv282-reader');
 const lines=String(source||'').replace(/\r\n?/g,'\n').split('\n');
 let i=0;
 function isBlank(line){return !line.trim()}
 function takeParagraph(){
  const pieces=[];
  while(i<lines.length&&!isBlank(lines[i])&&
   !/^\s*(?:#{1,5}\s|[-*] |\d+[.)] |\| |\> |---\s*$)/.test(lines[i])){
   pieces.push(lines[i++].trim());
  }
  if(!pieces.length){i++;return}
  if(pieces.length===1){
   const label=pieces[0].match(/^\*\*([^*]{2,80}):\*\*\s*$/);
   if(label){
    const kind=/^(benefit|effect)/i.test(label[1])?'benefit':
      /^(cost|price|consequence|burden|risk)/i.test(label[1])?'cost':'field';
    root.append(el('h4','tv282-section-heading is-'+kind,label[1]));return;
   }
  }
  const p=el('p','tv282-paragraph');
  inline(p,pieces.join(' ').replace(/\s{2,}/g,' '));
  root.append(p);
 }
 function readList(){
  const list=el('ul','tv282-list');let previous=null;
  while(i<lines.length){
   const m=lines[i].match(/^(\s*)(?:[-*]|\d+[.)])\s+(.+)$/);
   if(!m)break;i++;
   const item=el('li','');
   inline(item,m[2].trim());
   if(m[1].length>=2&&previous){
    let child=previous.querySelector('ul');
    if(!child){child=el('ul','tv282-sublist');previous.append(child)}
    child.append(item);
   }else{list.append(item);previous=item}
  }
  root.append(list);
 }
 function readTable(){
  const rows=[];
  while(i<lines.length&&/^\s*\|/.test(lines[i]))rows.push(lines[i++]);
  const table=el('table','tv282-table');
  const caption=meta.tableLabel;if(caption)table.append(el('caption','',caption));
  rows.forEach((line,idx)=>{
   if(/^\s*\|?\s*:?-{3,}/.test(line))return;
   const tr=el('tr','');
   line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').forEach(c=>{
    const cell=el(idx===0?'th':'td','');
    inline(cell,c.trim());tr.append(cell);
   });table.append(tr);
  });
  const wrap=el('div','tv282-table-scroll');wrap.append(table);root.append(wrap);
 }
 while(i<lines.length){
  const line=lines[i];
  if(isBlank(line)){i++;continue}
  if(/^\s*---\s*$/.test(line)){i++;continue}
  if(/^\s*```/.test(line)){
   i++;const chunk=[];while(i<lines.length&&!/^\s*```/.test(lines[i]))chunk.push(lines[i++]);
   if(i<lines.length)i++;
   const pre=el('pre','tv282-code');pre.append(el('code','',chunk.join('\n')));root.append(pre);continue;
  }
  const h=line.match(/^\s*(#{1,5})\s+(.+)$/);
  if(h){i++;const title=el('h'+Math.min(5,h[1].length+2),'tv282-heading');
   inline(title,h[2].replace(/\s*#+\s*$/,''));root.append(title);continue}
  if(/^\s*>/.test(line)){
   const quoted=[];while(i<lines.length&&/^\s*>/.test(lines[i]))
    quoted.push(lines[i++].replace(/^\s*>\s?/,'')); 
   const label=quoted[0]?.match(/^\[!(note|warning|tip|quote|important)\]\s*(.*)$/i);
   const box=el('section','tv282-callout'+(label?' is-'+label[1].toLowerCase():''));
   if(label){box.append(el('strong','tv282-callout-label',
     label[2]||label[1][0].toUpperCase()+label[1].slice(1)));
    quoted.shift();}
   const p=el('p','');inline(p,quoted.join(' ').trim());box.append(p);root.append(box);continue;
  }
  if(/^\s*\|/.test(line)){readTable();continue}
  if(/^\s*(?:[-*] |\d+[.)] )/.test(line)){readList();continue}
  takeParagraph();
 }
 if(!root.childElementCount)root.append(el('p','tv282-paragraph is-empty','No further source mechanics were specified.'));
 return root;
}
function meta(entry={}){
 const aside=el('div','tv282-metadata');
 const fields=[
  ['Patron',entry.patron+(entry.other_patron?' & '+entry.other_patron:'')],
  ['Tier',entry.tier===0?'Tier 0':entry.tier?'Tier '+entry.tier:null],
  ['Activation',entry.activation],
  ['Favour slot',entry.source_slot||entry.slot],
  ['Sheet space',entry.kind==='concordant'?'Concordant':
    entry.kind==='tier_zero'?'Divine bargain':null],
  ['Uses',entry.uses_text],['Required Favour',entry.required_favour!==null&&entry.required_favour!==undefined?
    '+'+entry.required_favour+(entry.required_favour_second?' & +'+entry.required_favour_second:''):null]
 ];
 for(const [key,value] of fields){
  if(!value)continue;
  const part=el('div','tv282-meta-pill');
  part.append(el('span','',key),el('strong','',value));aside.append(part);
 }
 return aside;
}
function feature(source,entry={}){
 const frame=el('div','tv282-feature');
 frame.append(meta(entry),read(source,entry));return frame;
}
window.TerravaleDivineReaderV282={read,meta,feature};
})();