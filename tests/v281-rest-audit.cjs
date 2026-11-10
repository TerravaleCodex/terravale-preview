/* Temporary native rest/condition source audit for V2.81 hook placement. */
const fs=require('node:fs');
const html=fs.readFileSync('published/veiled-codex/index.html','utf8');
const probes=[
 ['rest-action',/data-(?:action|sheet20-\w+)\s*=\s*['"][^'"]*(?:rest|recover|heal)[^'"]*['"]/gi],
 ['rest-switch',/case\s*['"][^'"]*(?:rest|recover|heal)[^'"]*['"]/gi],
 ['rest-function',/(?:function|const|let)\s+(?:\w*Rest\w*|\w*rest\w*)\s*\(/gi],
 ['rest-words',/short rest|long rest|shortRest|longRest|short_rest|long_rest/gi],
 ['conditions',/data-action=['"][^'"]*(?:condition|effect|status)[^'"]*['"]/gi]
];
for(const [label,re] of probes){
 const matches=[...html.matchAll(re)].filter(x=>x.index>5000000);
 console.log('V281 NATIVE '+label+' '+matches.length);
 for(const m of matches.slice(-14)){
  const i=m.index;
  console.log('SNIPPET '+label+' '+i+': '+html.slice(Math.max(0,i-300),i+750).replace(/[\r\n]+/g,' ').slice(0,1050));
 }
}
