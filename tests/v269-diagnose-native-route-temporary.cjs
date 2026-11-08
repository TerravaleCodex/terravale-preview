const fs=require('node:fs');const h=fs.readFileSync('published/veiled-codex/index.html','utf8');
const xs=[
 'function route(','const route=','let route=','function renderPage(','function navigate(',
 'location.hash=','location.hash =','location.hash ||','location.hash||','window.location.hash','#/characters',
 'route()==','route()===','route()==="/"','path:"/characters"','path:"/"','path: "/characters"',
 'history.replaceState(','hashchange','location.hash.replace'
];
for(const term of xs){
 let i=0,at=[],total=0;
 while((i=h.indexOf(term,i))>=0){
  total++; if(at.length<5)at.push(i);i+=term.length;
 }
 console.log('LANDING_TOKEN '+JSON.stringify(term)+' count='+total);
 for(const index of at)console.log('LANDING_CONTEXT '+JSON.stringify(term)+' at='+index+' '+h.slice(Math.max(0,index-300),index+500).replace(/\s+/g,' ').slice(0,800));
}
const scripts=[...h.matchAll(/<script\b([^>]*)>/g)].map(x=>x[1]);console.log('SCRIPT_COUNT '+scripts.length);
