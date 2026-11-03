'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),assert=require('assert');
const root=path.resolve(__dirname,'../site'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('codex-achievements/cabinet-v2-live.html');
const dataset=html.match(/<script type="application\/json" id="tv-cabinet-records">([\s\S]*?)<\/script>/);
assert(dataset,'Approved collection missing');
const entries=JSON.parse(dataset[1]);
assert.equal(entries.length,62);assert.equal(new Set(entries.map(x=>x.id)).size,62);
for(const feature of ['Cabinet of Curiosities','Emphasise milestones','Search achievements','Sort by','Keeper of the Living Codex','cabinet-v2-live.js'])assert(html.includes(feature),feature+' missing');
assert(!html.includes('Show demo progress'));
assert(read('cabinet-of-curiosities/index.html').includes('cabinet-v2-embed.js'));
assert(read('index.html').includes('cabinet-v2-embed.js'),'Home navigation must install the Cabinet V2 bridge');
assert(read('codex-achievements/cabinet-v2-embed.js').includes('tv-cabinet-v2-host'));
const app=read('codex-achievements/cabinet-v2-live.js');
assert(app.includes('TerravaleAchievementState')&&app.includes('terravale-achievements-changed'));
const tracker=read('codex-achievements/codex-achievements-v1.js');
assert(tracker.includes('window.TerravaleAchievementState=state'));
assert(read('codex-ads/terravale-adblocknt.js').includes('Number(live?.total)||62'));
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>fs.existsSync(x));
if(!chrome){console.log('PASS: Cabinet V2 assets, integrations and 62 approved keys');process.exit(0);}
const server=http.createServer((req,res)=>{
 const pathPart=new URL(req.url,'http://localhost').pathname.replace(/^\/terravale-preview\//,'');
 const file=path.resolve(root,pathPart);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'}).end(fs.readFileSync(file));}
 catch{res.writeHead(404).end();}
});
async function verify(width){
 const url='http://127.0.0.1:'+server.address().port+'/terravale-preview/codex-achievements/cabinet-v2-live.html';
 const doc=await new Promise((resolve,reject)=>{
  const p=cp.spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=3500','--window-size='+width+',900','--dump-dom',url],{stdio:['ignore','pipe','pipe']});
  let data='',err='';const timer=setTimeout(()=>{p.kill();reject(Error('Chromium timeout'))},35000);
  p.stdout.on('data',v=>data+=v.toString());p.stderr.on('data',v=>err=(err+v.toString()).slice(-650));
  p.on('error',e=>{clearTimeout(timer);reject(e)});
  p.on('close',n=>{clearTimeout(timer);n===0?resolve(data):reject(Error('Chromium '+n+' '+err))});
 });
 assert(doc.includes('data-id="class:artificer"'),'Client-side achievement cards did not render');
 assert(doc.includes('data-id="adblocknt"'),'Adblockn’t must remain in the collection');
 assert(doc.includes('id="heroCount"'),'V2 summary must render');
 assert(doc.includes('id="sortSelect"')&&doc.includes('id="searchInput"'));
 console.log('PASS: Cabinet V2 rendered with Chromium at '+width+'px');
}
(async()=>{await new Promise(done=>server.listen(0,'127.0.0.1',done));try{await verify(1440);await verify(420);}finally{server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
