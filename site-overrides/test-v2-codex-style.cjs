#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const pageFile=path.resolve('site/session-room-v2/index.html');
if(!fs.existsSync(pageFile))throw Error('No V2 page');
const sources=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
let browser=sources.find(fs.existsSync);
if(!browser){for(const cmd of ['google-chrome','chromium','chromium-browser']){try{browser=cp.execFileSync('which',[cmd],{encoding:'utf8'}).trim();break;}catch{}}}
if(!browser){console.log('Style browser test skipped: no Chrome/Chromium');process.exit(0);}
const html=fs.readFileSync(pageFile,'utf8');
const injector='<script>('+function(){
try{
 const $=s=>document.querySelector(s),bg=e=>getComputedStyle(e).backgroundColor,br=e=>getComputedStyle(e).borderTopColor;
 const body=document.body,sidebar=$('.side'),nav=$('.menu a.active'),panel=$('.initiative'),chat=$('.room .chat'),mine=$('.room .mine'),primary=$('.btn.end-turn-large');
 const theme=$('#codex-theme-select');
 const old={
   id:document.documentElement.dataset.codexTheme,
   body:bg(body),sidebar:bg(sidebar),panel:bg(panel),chat:bg(chat),mine:bg(mine),
   navHeight:Math.round(nav.getBoundingClientRect().height),
   primary:bg(primary),
   themeSelect:theme.value,
   border:br(panel)
 };
 const expectedOld=old.id==='dark'&&old.themeSelect==='dark'&&old.body==='rgb(16, 23, 32)'&&old.sidebar==='rgb(21, 30, 41)'&&old.panel==='rgb(27, 38, 49)'&&old.chat==='rgb(27, 38, 49)'&&old.mine==='rgb(27, 38, 49)'&&old.primary==='rgb(215, 181, 121)'&&old.navHeight<=45;
 theme.value='night-sky';theme.dispatchEvent(new Event('change',{bubbles:true}));
 const night={id:document.documentElement.dataset.codexTheme,body:bg(body),panel:bg(panel),sidebar:bg(sidebar)};
 const switched=night.id==='night-sky'&&night.body==='rgb(9, 18, 37)'&&night.panel==='rgb(23, 35, 58)'&&night.sidebar==='rgb(16, 26, 47)';
 theme.value='dark';theme.dispatchEvent(new Event('change',{bubbles:true}));
 const restored=document.documentElement.dataset.codexTheme==='dark'&&bg(panel)==='rgb(27, 38, 49)';
 document.body.dataset.styleRegression=encodeURIComponent(JSON.stringify({pass:expectedOld&&switched&&restored,old,night,restored}));
}catch(e){document.body.dataset.styleRegression=encodeURIComponent(JSON.stringify({pass:false,error:String(e)}));}
}.toString()+')();</scr'+'ipt>';
const testFile=path.join(path.dirname(pageFile),'test-theme-regression-temp.html');
try{
fs.writeFileSync(testFile,html.replace('</body>',injector+'\n</body>'));
const dom=cp.execFileSync(browser,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--virtual-time-budget=3000','--window-size=1550,970','--dump-dom',pathToFileURL(testFile).href],{encoding:'utf8',timeout:45000,stdio:['ignore','pipe','ignore'],maxBuffer:8*1024*1024});
const result=dom.match(/data-style-regression="([^"]+)"/);
if(!result)throw Error('No style metrics returned');
const metrics=JSON.parse(decodeURIComponent(result[1]));
console.log('V2 Codex style regression:',JSON.stringify(metrics));
if(!metrics.pass)process.exitCode=1;
}finally{try{fs.unlinkSync(testFile);}catch{}}
