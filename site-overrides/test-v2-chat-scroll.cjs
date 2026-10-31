#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const pageFile=path.resolve('site/session-room-v2/index.html');
if(!fs.existsSync(pageFile)) throw Error('Missing V2 page');
const choices=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
let browser=choices.find(fs.existsSync);
if(!browser){for(const cmd of ['google-chrome','chromium','chromium-browser'])try{browser=cp.execFileSync('which',[cmd],{encoding:'utf8'}).trim();break;}catch{}}
if(!browser){console.log('Browser test skipped: no Chrome/Chromium installed');process.exit(0);}
const original=fs.readFileSync(pageFile,'utf8');
const injected='<script>('+function(){
try{
 const room=document.getElementById('workspace-grid'),feed=document.getElementById('feed'),chat=room.querySelector('.chat'),panels=Array.from(room.querySelectorAll('.chat,.dicebox,.mine'));
 const measure=()=>({body:document.body.scrollHeight,room:room.getBoundingClientRect().height,chat:chat.getBoundingClientRect().height,panels:panels.map(p=>p.getBoundingClientRect().height)});
 const before=measure();
 for(let i=0;i<200;i++){const node=document.createElement('article');node.className='msg';node.style.minHeight='58px';node.textContent='Test message '+i;feed.appendChild(node);}
 feed.scrollTop=0;
 const after={...measure(),feedClient:feed.clientHeight,feedScroll:feed.scrollHeight};
 feed.scrollTop=feed.scrollHeight;after.scrolled=feed.scrollTop;
 const pass=after.chat>=425&&after.chat<=522&&after.feedScroll>after.feedClient+100&&after.scrolled>100&&Math.abs(after.body-before.body)<10&&after.panels.every((h,j)=>Math.abs(h-before.panels[j])<10);
 document.body.dataset.chatRegression=encodeURIComponent(JSON.stringify({pass,before,after}));
}catch(err){document.body.dataset.chatRegression=encodeURIComponent(JSON.stringify({pass:false,error:String(err)}));}
 }.toString()+')();</scr'+'ipt>';
const testFile=path.join(path.dirname(pageFile),'test-chat-regression-temp.html');
try{
 fs.writeFileSync(testFile,original.replace('</body>',injected+'\n</body>'));
 const html=cp.execFileSync(browser,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--virtual-time-budget=3000','--window-size=1450,900','--dump-dom',pathToFileURL(testFile).href],{encoding:'utf8',timeout:45000,stdio:['ignore','pipe','ignore'],maxBuffer:8*1024*1024});
 const match=html.match(/data-chat-regression="([^"]+)"/);
 if(!match)throw Error('Browser did not report chat test metrics');
 const metrics=JSON.parse(decodeURIComponent(match[1]));
 console.log('V2 chat scroll regression: '+JSON.stringify(metrics));
 if(!metrics.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(testFile);}catch{}}
