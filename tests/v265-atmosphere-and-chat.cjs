/* V2.65 regression: Chat height fixed; five original textures distinct;
   texture and motion switches independently reversible, no gameplay writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process');
const read=p=>fs.readFileSync('site-overrides/'+p,'utf8');
const chat=read('v265-fixed-session-chat.css'),appearance=read('v265-atmosphere.js'),cosmetics=read('v265-atmosphere.css'),prior=read('v251-live-item-actions.js');
const overlay=fs.readFileSync('tools/overlay-v239-with-discord.py','utf8');
const built=fs.readFileSync('published/veiled-codex/index.html','utf8');
const files=['dashboard','character','initiative','lore','achievements'];
const digests=new Set();
for(const name of files){
 const text=read('v265-texture-'+name+'.css');
 const m=text.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
 assert.ok(m,'Original '+name+' artwork must embed as a standalone WebP');
 const data=Buffer.from(m[1],'base64');
 assert.ok(data.length>1100&&data.length<8000,name+' optimized texture size');
 assert.equal(data.toString('ascii',0,4),'RIFF',name+' valid RIFF');
 assert.equal(data.toString('ascii',8,12),'WEBP',name+' valid WebP container');
 const sha=crypto.createHash('sha256').update(data).digest('hex');assert.ok(!digests.has(sha),name+' is NOT another area\'s artwork');digests.add(sha);
 assert.ok(overlay.includes('v265-texture-'+name+'.css'),name+' texture is shipped');
 assert.ok(built.includes('--tv265-art-'+name),name+' texture present in generated HTML');
}
assert.equal(digests.size,5);
assert.ok(chat.includes('.page-session .sr-chat-panel'));
assert.ok(chat.includes('height:580px!important;min-height:580px!important;max-height:580px!important'));
assert.ok(chat.includes('flex:1 1 auto!important'));
assert.ok(chat.includes('height:auto!important;min-height:0!important;max-height:none!important'));
assert.ok(chat.includes('overflow-y:auto!important'));
assert.ok(chat.includes('.sr-dice-panel'));
assert.ok(!chat.includes('data-tv265-textures'), 'Functional chat geometry never gated behind cosmetic settings');
for(const token of ['tv265-dashboard','tv265-featured','tv265-character','tv265-initiative','tv265-lore','tv-achievement-notice','tv265-appearance-panel','tv265-setting-toggle','data-tv265-textures="on"','data-tv265-motion="off"','prefers-reduced-motion:reduce'])assert.ok(cosmetics.includes(token),'Missing cosmetic treatment '+token);
for(const token of ['v265-fixed-session-chat.css','v265-atmosphere.css','v265-atmosphere.js','"version":"2.65"'])assert.ok(overlay.includes(token),'Missing generated integration: '+token);
for(const token of ['v265-atmosphere.js','v265-fixed-session-chat.css','v265-atmosphere.css'])assert.ok(built.includes(token),'Missing generated source '+token);
assert.ok(prior.includes("document.documentElement.dataset.tv265Motion!=='off'"),'Older V2.64 initiative movement honours the new off switch');
assert.ok(appearance.includes('#tv238-article-body'),'Reader article depth targets the actual reader');
assert.ok(appearance.includes('.sheet20-hero'),'Character cover texture targets the live sheet');
assert.ok(appearance.includes('tv-cabinet-v2-frame'),'Rare achievement texture reaches same-origin Cabinet iframe');
assert.ok(appearance.includes("key==='textures'?TEXTURE_KEY:MOTION_KEY"),'Texture and motion settings persisted separately');
assert.ok(!appearance.includes('terravale_wallet_'),'Cosmetic script never writes gameplay wallets');
const storage=new Map();
const doc={
 documentElement:{dataset:{}},
 querySelectorAll:()=>[],getElementById:()=>null,
 addEventListener:()=>{},body:{},
};
const ctx={document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
 MutationObserver:class{observe(){}},
 requestAnimationFrame:cb=>{cb();return 1;},
 location:{hash:'#/appearance'},
 innerHeight:900,Element:class{},
 getComputedStyle:()=>({getPropertyValue:()=>''})};
vm.createContext(ctx);vm.runInContext(appearance,ctx,{filename:'v265-atmosphere.js'});
assert.equal(doc.documentElement.dataset.tv265Textures,'on');
assert.equal(doc.documentElement.dataset.tv265Motion,'on');
ctx.window.TerravaleAtmosphereV265.setTextures(false);
assert.equal(doc.documentElement.dataset.tv265Textures,'off');
assert.equal(doc.documentElement.dataset.tv265Motion,'on','Turning off texture must NOT disable movement');
ctx.window.TerravaleAtmosphereV265.setMotion(false);
assert.equal(doc.documentElement.dataset.tv265Motion,'off');
ctx.window.TerravaleAtmosphereV265.setTextures(true);
assert.equal(doc.documentElement.dataset.tv265Textures,'on');
assert.equal(doc.documentElement.dataset.tv265Motion,'off','Restoring texture must NOT enable motion');
assert.equal(storage.get('terravale.atelier.textures.v265'),'on');
assert.equal(storage.get('terravale.atelier.motion.v265'),'off');
for(const p of ['site-overrides/v265-atmosphere.js','site-overrides/v251-live-item-actions.js'])cp.execFileSync('node',['--check',p]);
console.log('PASS: fixed session chat, five DIFFERENT original textures, independent reversible appearance controls and reduced-motion compliance');
