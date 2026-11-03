'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),assert=require('assert');
const root=path.resolve(__dirname,'../site');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('codex-achievements/cabinet-v2-live.html');
const data=JSON.parse(html.match(/<script type="application\/json" id="tv-cabinet-records">([\s\S]*?)<\/script>/)[1]);
assert.equal(data.length,62);assert.equal(new Set(data.map(x=>x.id)).size,62);
assert(!html.includes('Show demo progress'));
assert(read('cabinet-of-curiosities/index.html').includes('cabinet-v2-embed.js'));
assert(read('codex-achievements/cabinet-v2-live.js').includes('TerravaleAchievementState'));
assert(read('codex-achievements/codex-achievements-v1.js').includes('window.TerravaleAchievementState=state'));
assert(read('codex-ads/terravale-adblocknt.js').includes('Number(live?.total)||62'));
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>fs.existsSync(x));
if(!chrome){console.log('PASS: static Cabinet V2 tests');process.exit(0);}
const state={ready:true,authenticated:true,earnedKeys:['theme_first','class:artificer'],earned:2,total:62,events:[{kind:'read_class',subject:'Artificer'}],adsDismissed:7};
const fixture='<!doctype html><html><body><main data-cabinet-full-page><p id="legacy">0 / 1</p></main>'
+'<script>window.TerravaleAchievementState='+JSON.stringify(state)+';</script>'
+'<script src="/terravale-preview/codex-achievements/cabinet-v2-embed.js"></script>'
+'<script>setTimeout(function(){var f=document.getElementById("tv-cabinet-v2-frame"),d=f&&f.contentDocument,x={};'
+'try{x.count=d.getElementById("heroCount").textContent.trim();x.cards=d.querySelectorAll(".ach-card").length;'
+'x.ads=d.querySelector("[data-id=adblocknt] .progress-copy strong").textContent.trim();'
+'x.hidden=getComputedStyle(document.getElementById("legacy")).display;'
+'var s=d.getElementById("searchInput");s.value="Artificer";s.dispatchEvent(new Event("input",{bubbles:true}));x.filtered=d.querySelectorAll(".ach-card").length;'
+'d.querySelector("[data-id=class\\:artificer]")?.click();x.dialog=!d.getElementById("modal").hidden;}catch(e){x.error=String(e)}'
+'document.body.dataset.fixture=encodeURIComponent(JSON.stringify(x));},2200)</script></body></html>';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);return;}
 const file=path.resolve(root,pathname.replace(/^\/terravale-preview\//,''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'text/html'}).end(fs.readFileSync(file));}
 catch{res.writeHead(404).end();}
});
async function verify(width){
 const dom=await new Promise((ok,no)=>{
  const p=cp.spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=5000','--window-size='+width+',900','--dump-dom','http://127.0.0.1:'+server.address().port+'/'],{stdio:['ignore','pipe','pipe']});
  let s='',err='';const timer=setTimeout(()=>{p.kill();no(Error('Chromium timeout'))},35000);
  p.stdout.on('data',x=>s+=x);p.stderr.on('data',x=>err=(err+x).slice(-600));
  p.on('error',e=>{clearTimeout(timer);no(e)});
  p.on('close',n=>{clearTimeout(timer);n===0?ok(s):no(Error('Chromium '+n+' '+err))});
 });
 const m=dom.match(/data-fixture="([^"]+)"/);assert(m,'No Cabinet V2 fixture output');
 const got=JSON.parse(decodeURIComponent(m[1]));console.log('Cabinet V2 '+width+'px:',got);
 assert.equal(got.cards,62);assert.match(got.count,/^2\s*\/\s*62$/);
 assert.equal(got.ads,'7 / 25');assert.equal(got.hidden,'none');assert.equal(got.filtered,1);
}
(async()=>{await new Promise(ok=>server.listen(0,'127.0.0.1',ok));try{await verify(1440);await verify(420);console.log('PASS: Cabinet V2 browser verification');}finally{server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
