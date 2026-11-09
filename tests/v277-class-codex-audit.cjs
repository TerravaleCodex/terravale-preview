/* V2.77 exploratory diagnostic: inspect the actual approved embedded Class Codex.
   Prints only short code excerpts; not the lore library or any private data. */
'use strict';
const fs=require('fs');
const s=fs.readFileSync('published/veiled-codex/index.html','utf8');
for(const [label,re,max] of [
 ['class-level-classes',/class[-_](?:levels?|progression|detail|codex)|(?:class|cls)Levels?|level[-_]picker|level[-_]grid|level[-_]button/gi,16],
 ['class-titles',/Class Codex|class progression|level progression|class feature|level breakdown|class levels/gi,16],
 ['level-events',/data-(?:level|class|class-level)[\w-]{0,30}=|classList\.toggle\(['"](?:active|selected)/gi,12],
 ['scroll-scripts',/scrollIntoView\s*\(|scrollTo\s*\(|scrollTop\s*=|scroll-behavior\s*:/gi,24],
 ['anchors',/scrollbar-gutter|overflow-anchor|requestAnimationFrame\s*\(|MutationObserver\s*\(/gi,8]
]){
 const hits=[...s.matchAll(re)],found=hits.slice(0,max).map(x=>{
  const at=x.index;return {at,excerpt:s.slice(Math.max(0,at-170),Math.min(s.length,at+240)).replace(/[\r\n]+/g,' ').slice(0,410)};
 });
 console.log('=== '+label+' COUNT='+hits.length+' SAMPLE='+JSON.stringify(found));
}
