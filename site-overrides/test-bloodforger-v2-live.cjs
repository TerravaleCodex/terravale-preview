const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'site/bloodforger-v2-live.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'site-overrides/bloodforger-v2-demo.html'),'utf8');
const source=demo.match(/<script type="application\/json" id="graphdata">([\s\S]*?)<\/script>/);
assert(source,'original diagram graph exists');
const graphs=JSON.parse(source[1]);
assert.equal(Object.keys(graphs).length,13);
assert(script.includes('BLOODFORGER_V2_GRAPHS'),'live adapter embeds all diagrams');
assert(script.includes('MutationObserver'),'live adapter follows React re-renders');
assert(script.includes('layoutSkillGraph(graph,branch)'),'existing layouts are replaced');
assert(script.includes("buttons.length !== layout.placed.length"),'unknown graph is safely left unchanged');
assert(!script.includes('supabase.from('),'adapter cannot change Supabase data');
assert(!script.includes('localStorage.setItem'),'adapter cannot change saved character data');
const beforeAdapter=script.split('const BLOODFORGER_V2_GRAPHS=')[0];
const layout=vm.runInNewContext(beforeAdapter+';layoutSkillGraph;');
let layouts=0;
for(const [name,graph] of Object.entries(graphs)){
 for(const filter of ['All branches',...graph.groups]){
  const result=layout(graph,filter);
  const ids=new Set(graph.nodes.filter(n=>filter==='All branches'||n.group==='Foundation'||n.group===filter).map(n=>n.id));
  assert.equal(result.placed.length,ids.size,name+'/'+filter+' node count');
  assert.equal(result.paths.length,graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).length,name+'/'+filter+' edge count');
  assert(result.paths.every(p=>p.d.startsWith('M ')&&!/NaN|undefined|Infinity/.test(p.d)),name+'/'+filter+' path geometry');
  for(let i=0;i<result.placed.length;i++)for(let j=i+1;j<result.placed.length;j++){
   const a=result.placed[i],b=result.placed[j];
   const overlap=a.x<b.x+240&&a.x+240>b.x&&a.y<b.y+104&&a.y+104>b.y;
   assert(!overlap,name+'/'+filter+' node overlap');
  }
  layouts++;
 }
}
const htmlFiles=[];
function walk(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name);
  if(item.isDirectory())walk(full);
  else if(item.name.endsWith('.html'))htmlFiles.push(full);
 }
}
walk(path.join(root,'site'));
const trees=htmlFiles.filter(f=>f.toLowerCase().includes('bloodforger')&&f.toLowerCase().includes('trees'));
assert(trees.length>0,'compiled live tree route exists');
assert(trees.every(f=>fs.readFileSync(f,'utf8').includes('bloodforger-v2-live.js')),'live tree includes V2 adapter');
assert(fs.readFileSync(path.join(root,'site/index.html'),'utf8').includes('bloodforger-v2-live.js'),'main site includes V2 adapter');
console.log('PASS: '+layouts+' Bloodforger layouts, V2 injected into '+htmlFiles.length+' HTML pages, no character writes.');
